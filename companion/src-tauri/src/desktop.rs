use chrono::{Local, Utc};
use persona_companion::*;
use serde_json::{json, Value};
use std::{path::PathBuf, sync::Mutex, time::Duration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

struct Runtime {
    prefs: Preferences,
    snapshot: Snapshot,
    alert_error: Option<String>,
}
struct AppState {
    runtime: Mutex<Runtime>,
    config: PathBuf,
}
fn restore(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
#[tauri::command]
fn status(state: State<AppState>) -> Value {
    let rt = state.runtime.lock().unwrap();
    json!({"preferences": rt.prefs, "snapshot": rt.snapshot, "alertError": rt.alert_error})
}
#[tauri::command]
async fn select_database(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let file = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("Banco Persona", &["json"])
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    if let Some(file) = file {
        let path = file.into_path().map_err(|e| e.to_string())?;
        // Validate before replacing a working link. An invalid selection cannot erase its snapshot.
        let data = read_database(&path)?;
        let mut rt = state.runtime.lock().unwrap();
        let mut prefs = rt.prefs.clone();
        prefs.database = Some(path.to_string_lossy().into_owned());
        save_preferences(&state.config, &prefs)?;
        rt.prefs = prefs;
        rt.snapshot = Snapshot {
            data: Some(data),
            connection: "connected".into(),
            last_valid_at: Some(Utc::now().to_rfc3339()),
        };
    }
    Ok(())
}
#[tauri::command]
fn configure(
    state: State<AppState>,
    persona_url: String,
    summary_time: String,
    summary_enabled: bool,
    always_on_top: bool,
    collapsed: bool,
) -> Result<(), String> {
    if !persona_url.is_empty() {
        let url = tauri::Url::parse(&persona_url).map_err(|_| "URL inválida")?;
        if !["http", "https"].contains(&url.scheme())
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
        {
            return Err("Informe a URL HTTP/HTTPS do seu Persona, sem credenciais".into());
        }
    }
    let mut rt = state.runtime.lock().unwrap();
    let mut prefs = rt.prefs.clone();
    prefs.persona_url = persona_url;
    prefs.summary_time = summary_time;
    prefs.summary_enabled = summary_enabled;
    prefs.always_on_top = always_on_top;
    prefs.collapsed = collapsed;
    prefs.validate()?;
    save_preferences(&state.config, &prefs)?;
    rt.prefs = prefs;
    Ok(())
}
#[tauri::command]
fn open_persona(app: tauri::AppHandle, state: State<AppState>) -> Result<(), String> {
    let rt = state.runtime.lock().unwrap();
    let mut url = tauri::Url::parse(&rt.prefs.persona_url)
        .map_err(|_| "Configure a URL do Persona primeiro")?;
    if !["https", "http"].contains(&url.scheme()) {
        return Err("URL inválida".into());
    }
    url.set_fragment(Some("today"));
    app.opener()
        .open_url(url.to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}
fn tick(app: &tauri::AppHandle) {
    let state = app.state::<AppState>();
    let mut rt = state.runtime.lock().unwrap();
    if let Some(path) = rt.prefs.database.clone() {
        rt.snapshot
            .refresh(std::path::Path::new(&path), &Utc::now().to_rfc3339());
    }
    let now = Local::now();
    let day = now.format("%Y-%m-%d").to_string();
    let time = now.format("%H:%M").to_string();
    if summary_due(
        &rt.prefs,
        &day,
        &time,
        rt.snapshot.connection == "connected",
    ) {
        if let Some(data) = &rt.snapshot.data {
            // Calendar date and notification delivery both follow the user's local clock.
            let (total, pending) = plan_counts(data, &day);
            let body = format!("{pending} ação(ões) pendente(s) de {total} no plano de Hoje. Abra o Persona para editar ou concluir.");
            let mut prefs = rt.prefs.clone();
            prefs.delivered_days.insert(day);
            // Persist BEFORE dispatch: at most one dispatch per day, including restart and clock rollback.
            match save_preferences(&state.config, &prefs) {
                Ok(()) => {
                    rt.prefs = prefs;
                    rt.alert_error = app
                        .notification()
                        .builder()
                        .title("Persona • Resumo de Hoje")
                        .body(body)
                        .show()
                        .err()
                        .map(|e| e.to_string());
                }
                Err(_) => rt.alert_error = Some(
                    "Não foi possível registrar o resumo. Verifique o acesso à configuração local."
                        .into(),
                ),
            }
        }
    }
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| restore(app)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::SIZE,
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            status,
            select_database,
            configure,
            open_persona
        ])
        .setup(|app| {
            let dir = app.path().app_config_dir()?;
            std::fs::create_dir_all(&dir)?;
            let config = dir.join("preferences.json");
            let prefs = match std::fs::read(&config) {
                Ok(bytes) => serde_json::from_slice::<Preferences>(&bytes).map_err(|e| {
                    std::io::Error::other(format!(
                        "Configuração inválida; preserve e renomeie preferences.json: {e}"
                    ))
                })?,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Preferences {
                    summary_time: "08:30".into(),
                    ..Default::default()
                },
                Err(e) => return Err(e.into()),
            };
            if let Some(window) = app.get_webview_window("main") {
                window.set_always_on_top(prefs.always_on_top)?;
            }
            app.manage(AppState {
                runtime: Mutex::new(Runtime {
                    prefs,
                    snapshot: Snapshot::default(),
                    alert_error: None,
                }),
                config,
            });
            let show = MenuItem::with_id(app, "show", "Abrir Hoje", true, None::<&str>)?;
            let open = MenuItem::with_id(app, "persona", "Abrir Persona", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair do companion", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &open, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Persona • Hoje")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => restore(app),
                    "persona" => {
                        let _ = open_persona(app.clone(), app.state());
                    }
                    "quit" => app.exit(0),
                    _ => (),
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(
                        event,
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        }
                    ) {
                        restore(tray.app_handle());
                    }
                })
                .build(app)?;
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                tick(&handle);
                std::thread::sleep(Duration::from_secs(1));
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("Falha ao iniciar Persona Companion");
}
