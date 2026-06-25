//! Observabilidad local y respetuosa (§6). Eventos estructurados que **nunca**
//! registran contenido académico, títulos, autores, citas ni rutas completas.
//! Logging local con rotación por tamaño y exportación; sin telemetría remota.

use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Resultado de una operación observada.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OpResult {
    Ok,
    Failed,
    Cancelled,
}

/// Evento estructurado. Solo metadatos técnicos; cero contenido del usuario.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Event {
    pub unix_nanos: u128,
    /// Versión de la app/build.
    pub version: String,
    /// Operación ("open", "save", "build", "migrate", "recover", ...).
    pub operation: String,
    /// Módulo o subsistema ("platform", "document", "compiler", ...).
    pub module: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub build_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    /// Código de diagnóstico estable (no mensaje traducido ni contenido).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    pub result: OpResult,
}

impl Event {
    pub fn new(operation: &str, module: &str, result: OpResult, version: &str) -> Self {
        Self {
            unix_nanos: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0),
            version: version.to_string(),
            operation: operation.to_string(),
            module: module.to_string(),
            build_id: None,
            duration_ms: None,
            code: None,
            result,
        }
    }

    pub fn with_duration_ms(mut self, ms: u64) -> Self {
        self.duration_ms = Some(ms);
        self
    }

    pub fn with_code(mut self, code: &str) -> Self {
        self.code = Some(code.to_string());
        self
    }
}

/// Redacta una ruta: conserva SOLO el nombre del archivo, descartando los
/// directorios (que podrían revelar nombres de tesis, usuario, institución).
pub fn redact_path(path: &str) -> String {
    path.rsplit(['/', '\\'])
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("<redacted>")
        .to_string()
}

/// Log de eventos local con rotación por tamaño.
pub struct EventLog {
    path: PathBuf,
    max_bytes: u64,
}

impl EventLog {
    /// Crea un log en `path` con rotación cuando supere `max_bytes`.
    pub fn new(path: impl Into<PathBuf>, max_bytes: u64) -> Self {
        Self {
            path: path.into(),
            max_bytes,
        }
    }

    /// Registra un evento (JSON-line). Rota si el archivo excede el límite.
    pub fn record(&self, event: &Event) -> io::Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }
        self.rotate_if_needed()?;
        let mut line = serde_json::to_string(event).map_err(io::Error::other)?;
        line.push('\n');
        let mut f = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;
        f.write_all(line.as_bytes())
    }

    fn rotate_if_needed(&self) -> io::Result<()> {
        if let Ok(meta) = fs::metadata(&self.path) {
            if meta.len() >= self.max_bytes {
                let rotated = self.path.with_extension("log.1");
                // Reemplaza la rotación anterior (conservamos una generación).
                let _ = fs::remove_file(&rotated);
                fs::rename(&self.path, &rotated)?;
            }
        }
        Ok(())
    }

    /// Exporta los eventos del log actual (no incluye la rotación previa).
    pub fn export(&self) -> Vec<Event> {
        let Ok(content) = fs::read_to_string(&self.path) else {
            return Vec::new();
        };
        content
            .lines()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|l| serde_json::from_str::<Event>(l).ok())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_directories_from_paths() {
        assert_eq!(redact_path("/Users/ada/Tesis Secreta/main.tex"), "main.tex");
        assert_eq!(redact_path("C:\\Users\\x\\proj\\a.bib"), "a.bib");
        assert_eq!(redact_path("solo.txt"), "solo.txt");
    }

    #[test]
    fn records_and_exports_events() {
        let dir = tempfile::tempdir().unwrap();
        let log = EventLog::new(dir.path().join("events.log"), 1_000_000);
        log.record(&Event::new("save", "platform", OpResult::Ok, "1.2.0").with_duration_ms(12))
            .unwrap();
        log.record(&Event::new("build", "document", OpResult::Failed, "1.2.0").with_code("BIB-001"))
            .unwrap();
        let events = log.export();
        assert_eq!(events.len(), 2);
        assert_eq!(events[1].code.as_deref(), Some("BIB-001"));
        assert_eq!(events[1].result, OpResult::Failed);
    }

    #[test]
    fn rotates_when_exceeding_limit() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("events.log");
        let log = EventLog::new(&path, 200); // límite pequeño para forzar rotación
        for _ in 0..20 {
            log.record(&Event::new("save", "platform", OpResult::Ok, "1.2.0"))
                .unwrap();
        }
        // Existe una generación rotada y el log actual no creció sin límite.
        assert!(path.with_extension("log.1").exists());
    }
}
