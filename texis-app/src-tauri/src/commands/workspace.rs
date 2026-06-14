// Comandos Tauri para persistencia del estado de workspace.
// Guarda / carga el archivo .texisstudio/workspace.json en el directorio del proyecto.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceState {
    #[serde(default)]
    pub open_files: Vec<String>,
    #[serde(default)]
    pub active_file: Option<String>,
    #[serde(default = "default_zoom")]
    pub zoom_level: f64,
    #[serde(default)]
    pub cursor_positions: std::collections::HashMap<String, CursorPosition>,
    #[serde(default)]
    pub last_build_summary: Option<BuildSummary>,
}

impl Default for WorkspaceState {
    fn default() -> Self {
        Self {
            open_files: Vec::new(),
            active_file: None,
            zoom_level: default_zoom(),
            cursor_positions: std::collections::HashMap::new(),
            last_build_summary: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildSummary {
    pub success: bool,
    pub pdf_path: Option<String>,
    pub duration_ms: Option<u64>,
}

fn default_zoom() -> f64 {
    1.0
}

fn workspace_path(project_path: &str) -> PathBuf {
    Path::new(project_path)
        .join(".texisstudio")
        .join("workspace.json")
}

/// Guarda el estado de workspace en `.texisstudio/workspace.json`.
#[tauri::command]
pub fn save_workspace_state(project_path: String, state: WorkspaceState) -> Result<(), String> {
    let path = workspace_path(&project_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(err)?;
    }
    let json = serde_json::to_string_pretty(&state).map_err(err)?;
    std::fs::write(&path, json).map_err(err)?;
    Ok(())
}

/// Carga el estado de workspace desde `.texisstudio/workspace.json`.
/// Si el archivo no existe, retorna el estado por defecto (sin error).
#[tauri::command]
pub fn load_workspace_state(project_path: String) -> Result<WorkspaceState, String> {
    let path = workspace_path(&project_path);
    if !path.exists() {
        return Ok(WorkspaceState::default());
    }
    let content = std::fs::read_to_string(&path).map_err(err)?;
    serde_json::from_str::<WorkspaceState>(&content).map_err(err)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_dir() -> TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn save_and_load_roundtrip() {
        let dir = make_dir();
        let project_path = dir.path().to_string_lossy().to_string();

        let state = WorkspaceState {
            open_files: vec!["intro.tex".to_string()],
            active_file: Some("intro.tex".to_string()),
            zoom_level: 1.25,
            cursor_positions: {
                let mut m = std::collections::HashMap::new();
                m.insert(
                    "intro.tex".to_string(),
                    CursorPosition { line: 5, column: 3 },
                );
                m
            },
            last_build_summary: Some(BuildSummary {
                success: true,
                pdf_path: Some("build/main.pdf".to_string()),
                duration_ms: Some(1500),
            }),
        };

        save_workspace_state(project_path.clone(), state).unwrap();
        let loaded = load_workspace_state(project_path).unwrap();

        assert_eq!(loaded.open_files, vec!["intro.tex"]);
        assert_eq!(loaded.active_file, Some("intro.tex".to_string()));
        assert!((loaded.zoom_level - 1.25).abs() < f64::EPSILON);
        let cursor = loaded.cursor_positions.get("intro.tex").unwrap();
        assert_eq!(cursor.line, 5);
        assert_eq!(cursor.column, 3);
        assert!(loaded.last_build_summary.unwrap().success);
    }

    #[test]
    fn load_missing_file_returns_default() {
        let dir = make_dir();
        let project_path = dir.path().to_string_lossy().to_string();
        let loaded = load_workspace_state(project_path).unwrap();
        assert!(loaded.open_files.is_empty());
        assert_eq!(loaded.zoom_level, 1.0);
    }
}
