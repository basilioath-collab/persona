use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::BTreeSet, fs, path::Path};

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Preferences {
    pub database: Option<String>,
    pub persona_url: String,
    pub summary_time: String,
    pub summary_enabled: bool,
    pub always_on_top: bool,
    pub collapsed: bool,
    pub delivered_days: BTreeSet<String>,
}
impl Preferences {
    pub fn validate(&self) -> Result<(), String> {
        if !valid_time(&self.summary_time) {
            return Err("Use um horário HH:MM válido".into());
        }
        Ok(())
    }
}
pub fn valid_time(value: &str) -> bool {
    let b = value.as_bytes();
    b.len() == 5
        && b[2] == b':'
        && b.iter()
            .enumerate()
            .all(|(i, b)| i == 2 || b.is_ascii_digit())
        && value[..2].parse::<u8>().unwrap_or(99) < 24
        && value[3..].parse::<u8>().unwrap_or(99) < 60
}
pub fn read_database(path: &Path) -> Result<Value, String> {
    // Read only: no opening for write, no lock and no normalization saved to disk.
    let before = fs::metadata(path)
        .map_err(|_| "Arquivo indisponível. Selecione novamente ou aguarde a reconexão.")?;
    if before.len() > 32 * 1024 * 1024 {
        return Err("Banco excede o limite de 32 MiB".into());
    }
    let bytes = fs::read(path).map_err(|_| "Não foi possível ler o banco")?;
    let after = fs::metadata(path).map_err(|_| "Banco em atualização")?;
    if before.len() != after.len() || before.modified().ok() != after.modified().ok() {
        return Err("Banco em atualização; mantendo a última leitura válida".into());
    }
    let data: Value = serde_json::from_slice(&bytes)
        .map_err(|_| "JSON incompleto ou inválido; mantendo a última leitura válida")?;
    let tasks = data
        .get("tasks")
        .and_then(Value::as_array)
        .ok_or("Banco Persona inválido: tasks ausente")?;
    if tasks.iter().any(|t| !t.is_object() || !t["id"].is_string()) {
        return Err("Banco Persona inválido: demandas sem identificação".into());
    }
    for key in ["dailyPlans", "tomorrowPlan"] {
        if let Some(plans) = data.get(key) {
            if !plans.is_array()
                || plans
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|p| !p.is_object() || !p["taskId"].is_string() || !p["date"].is_string())
            {
                return Err("Banco Persona inválido: plano do dia".into());
            }
        }
    }
    Ok(data)
}
#[derive(Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub data: Option<Value>,
    pub connection: String,
    pub last_valid_at: Option<String>,
}
impl Snapshot {
    pub fn refresh(&mut self, path: &Path, now: &str) {
        match read_database(path) {
            Ok(data) => {
                self.data = Some(data);
                self.connection = "connected".into();
                self.last_valid_at = Some(now.into());
            }
            Err(error) => self.connection = error,
        }
    }
}
// Same membership as shared/today.js: date + existing task, including completed plans/tasks.
// Recurrences are generated ONLY by web complete(); never inferred by the reader.
pub fn plan_counts(db: &Value, date: &str) -> (usize, usize) {
    let tasks = db["tasks"].as_array().cloned().unwrap_or_default();
    let plans = db
        .get("dailyPlans")
        .or_else(|| db.get("tomorrowPlan"))
        .and_then(Value::as_array);
    let items: Vec<_> = plans
        .into_iter()
        .flatten()
        .filter(|p| p["date"] == date && tasks.iter().any(|t| t["id"] == p["taskId"]))
        .collect();
    let pending = items
        .iter()
        .filter(|p| !p["done"].as_bool().unwrap_or(false))
        .count();
    (items.len(), pending)
}
pub fn summary_due(p: &Preferences, day: &str, time: &str, connected: bool) -> bool {
    connected
        && p.summary_enabled
        && valid_time(&p.summary_time)
        && time >= p.summary_time.as_str()
        && !p.delivered_days.contains(day)
}
pub fn save_preferences(path: &Path, prefs: &Preferences) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(
        &tmp,
        serde_json::to_vec_pretty(prefs).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    fs::rename(tmp, path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> Value {
        serde_json::from_str(include_str!("../../../tests/fixtures/today.json")).unwrap()
    }
    #[test]
    fn same_plan_membership_and_independent_completion() {
        assert_eq!(plan_counts(&fixture(), "2026-11-17"), (4, 3));
        assert_eq!(plan_counts(&fixture(), "2026-11-18"), (1, 1));
    }
    #[test]
    fn summary_catchup_restart_changes_and_midnight() {
        let mut p = Preferences {
            summary_enabled: true,
            summary_time: "08:30".into(),
            ..Default::default()
        };
        assert!(!summary_due(&p, "2026-11-17", "08:29", true));
        assert!(!summary_due(&p, "2026-11-17", "09:00", false));
        assert!(summary_due(&p, "2026-11-17", "09:00", true));
        p.delivered_days.insert("2026-11-17".into());
        let p: Preferences = serde_json::from_str(&serde_json::to_string(&p).unwrap()).unwrap();
        assert!(!summary_due(&p, "2026-11-17", "23:59", true));
        assert!(!summary_due(&p, "2026-11-18", "00:00", true));
        assert!(summary_due(&p, "2026-11-18", "08:30", true));
        assert!(!valid_time("25:00"));
        assert!(!valid_time("8:30"));
    }
    #[test]
    fn partial_write_unavailable_recovery_and_read_only() {
        let dir = std::env::temp_dir().join(format!("persona-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("synthetic.json");
        let mut s = Snapshot::default();
        let data = fixture();
        fs::write(&file, data.to_string()).unwrap();
        s.refresh(&file, "first");
        assert_eq!(s.connection, "connected");
        fs::write(&file, "{\"tasks\":").unwrap();
        s.refresh(&file, "partial");
        assert_eq!(s.data, Some(data.clone()));
        assert_eq!(s.last_valid_at.as_deref(), Some("first"));
        fs::remove_file(&file).unwrap();
        s.refresh(&file, "missing");
        assert_eq!(s.data, Some(data.clone()));
        let mut edited = data;
        edited["dailyPlans"][0]["done"] = true.into();
        let bytes = edited.to_string();
        fs::write(&file, &bytes).unwrap();
        s.refresh(&file, "recovered");
        assert_eq!(s.data, Some(edited));
        assert_eq!(s.connection, "connected");
        assert_eq!(fs::read_to_string(&file).unwrap(), bytes);
        fs::remove_dir_all(dir).unwrap();
    }
}
