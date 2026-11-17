use chrono::{Local, Utc};
use persona_companion::*;
use serde_json::{json, Value};
use std::{path::PathBuf, sync::Mutex, time::Duration};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;

struct Runtime {
    prefs: Preferences,
    snapshot: Snapshot,
    alert_error: Option<String>,
}
struct AppState {
    runtime: Mutex<Runtime>,
    config: PathBuf,
}
fn restore_window(app: &tauri::AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
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
fn open_persona(app: tauri::AppHandle) -> Result<(), String> {
    restore_window(&app, "persona");
    if let Some(window) = app.get_webview_window("persona") {
        window
            .eval("location.hash='#today'")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
fn show_overlay(app: tauri::AppHandle) {
    restore_window(&app, "main");
}
fn require_editor(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "persona" {
        return Err("Somente a janela principal pode editar o banco".into());
    }
    Ok(())
}
fn current_database(state: &AppState) -> Result<Value, String> {
    let rt = state.runtime.lock().unwrap();
    let path = rt
        .prefs
        .database
        .as_ref()
        .ok_or("Nenhum banco selecionado")?;
    Ok(json!({"path": path, "data": read_database(std::path::Path::new(path))?}))
}
#[tauri::command]
fn desktop_read(state: State<AppState>) -> Result<Value, String> {
    current_database(&state)
}
fn adopt_database(state: &AppState, path: PathBuf) -> Result<Value, String> {
    let data = read_database(&path)?;
    let mut rt = state.runtime.lock().unwrap();
    let mut prefs = rt.prefs.clone();
    prefs.database = Some(path.to_string_lossy().into_owned());
    save_preferences(&state.config, &prefs)?;
    rt.prefs = prefs;
    rt.snapshot = Snapshot {
        data: Some(data.clone()),
        connection: "connected".into(),
        last_valid_at: Some(Utc::now().to_rfc3339()),
    };
    Ok(json!({"path":path,"data":data}))
}
#[tauri::command]
fn desktop_init(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: State<AppState>,
    initial: String,
) -> Result<Value, String> {
    require_editor(&window)?;
    if state.runtime.lock().unwrap().prefs.database.is_some() {
        return current_database(&state);
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("persona.json");
    // Never overwrite an existing default database, including after settings recovery.
    if !path.exists() {
        write_database_atomic(&path, &initial, None)?;
    }
    adopt_database(&state, path)
}
#[tauri::command]
async fn desktop_create(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: State<'_, AppState>,
    initial: String,
) -> Result<Option<Value>, String> {
    require_editor(&window)?;
    let file = tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .add_filter("Banco Persona", &["json"])
            .set_file_name("persona.json")
            .blocking_save_file()
    })
    .await
    .map_err(|e| e.to_string())?;
    if let Some(file) = file {
        let path = file.into_path().map_err(|e| e.to_string())?;
        write_database_atomic(&path, &initial, None)?;
        return adopt_database(&state, path).map(Some);
    }
    Ok(None)
}
#[tauri::command]
fn desktop_write(
    window: tauri::WebviewWindow,
    state: State<AppState>,
    snapshot: String,
    expected: String,
    path: String,
) -> Result<Value, String> {
    require_editor(&window)?;
    let mut rt = state.runtime.lock().unwrap();
    if rt.prefs.database.as_deref() != Some(&path) {
        return Err("O banco vinculado mudou. Reabra o arquivo antes de salvar.".into());
    }
    let expected: Value =
        serde_json::from_str(&expected).map_err(|_| "Reabra o banco antes de salvar")?;
    let data = write_database_atomic(std::path::Path::new(&path), &snapshot, Some(&expected))?;
    rt.snapshot = Snapshot {
        data: Some(data.clone()),
        connection: "connected".into(),
        last_valid_at: Some(Utc::now().to_rfc3339()),
    };
    Ok(json!({"path":path,"data":data}))
}
#[tauri::command]
fn finish_exit(app: tauri::AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    require_editor(&window)?;
    app.exit(0);
    Ok(())
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
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            restore_window(app, "persona")
        }))
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
            open_persona,
            show_overlay,
            desktop_init,
            desktop_read,
            desktop_create,
            desktop_write,
            finish_exit
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
            let show =
                MenuItem::with_id(app, "show", "Mostrar overlay de Hoje", true, None::<&str>)?;
            let open = MenuItem::with_id(app, "persona", "Abrir Persona", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Sair do Persona", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &open, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Persona")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => restore_window(app, "main"),
                    "persona" => {
                        let _ = open_persona(app.clone());
                    }
                    "quit" => {
                        restore_window(app, "persona");
                        let _ = app.emit_to("persona", "persona-exit", ());
                    }
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
                        restore_window(tray.app_handle(), "persona");
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
                if window.label() == "persona" {
                    if let Some(overlay) = window.app_handle().get_webview_window("main") {
                        let _ = overlay.show();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Falha ao iniciar Persona");
}
