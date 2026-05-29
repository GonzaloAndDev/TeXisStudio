use std::path::PathBuf;
use thiserror::Error;

// ── Command trait ─────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum CommandError {
    #[error("Error de E/S: {0}")]
    Io(#[from] std::io::Error),
    #[error("Error de validación: {message}")]
    Validation { message: String },
    #[error("Operación revertida: {reason}")]
    Reverted { reason: String },
    #[error("Operación no reversible")]
    NotUndoable,
}

pub type CommandResult = String; // Descripción del resultado para el usuario

/// Trait que deben implementar todos los comandos del sistema.
pub trait Command: Send + 'static {
    fn name(&self) -> &str;
    fn description(&self) -> String {
        self.name().to_string()
    }
    fn execute(&mut self, ctx: &mut CommandContext) -> Result<CommandResult, CommandError>;
    fn undo(&mut self, ctx: &mut CommandContext) -> Result<CommandResult, CommandError>;
    fn is_undoable(&self) -> bool {
        true
    }
}

/// Contexto mínimo que los comandos reciben al ejecutarse.
/// Expande según lo que los engines necesiten.
pub struct CommandContext {
    pub project_root: PathBuf,
}

impl CommandContext {
    pub fn new(project_root: PathBuf) -> Self {
        Self { project_root }
    }
}

// ── CommandDispatcher ─────────────────────────────────────────────────────────

pub struct CommandDispatcher {
    undo_stack: Vec<Box<dyn Command>>,
    redo_stack: Vec<Box<dyn Command>>,
    max_history: usize,
}

impl Default for CommandDispatcher {
    fn default() -> Self {
        Self::new(50)
    }
}

impl CommandDispatcher {
    pub fn new(max_history: usize) -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            max_history,
        }
    }

    /// Ejecuta un comando y lo añade al undo stack si es reversible.
    pub fn execute(
        &mut self,
        mut cmd: Box<dyn Command>,
        ctx: &mut CommandContext,
    ) -> Result<CommandResult, CommandError> {
        let result = cmd.execute(ctx)?;
        if cmd.is_undoable() {
            self.redo_stack.clear();
            self.undo_stack.push(cmd);
            if self.undo_stack.len() > self.max_history {
                self.undo_stack.remove(0);
            }
        }
        Ok(result)
    }

    /// Revierte el último comando ejecutado.
    pub fn undo(
        &mut self,
        ctx: &mut CommandContext,
    ) -> Option<Result<CommandResult, CommandError>> {
        let mut cmd = self.undo_stack.pop()?;
        let result = cmd.undo(ctx);
        self.redo_stack.push(cmd);
        Some(result)
    }

    /// Re-ejecuta el último comando revertido.
    pub fn redo(
        &mut self,
        ctx: &mut CommandContext,
    ) -> Option<Result<CommandResult, CommandError>> {
        let mut cmd = self.redo_stack.pop()?;
        let result = cmd.execute(ctx);
        if result.is_ok() {
            self.undo_stack.push(cmd);
        }
        Some(result)
    }

    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    pub fn undo_description(&self) -> Option<&str> {
        self.undo_stack.last().map(|c| c.name())
    }

    pub fn redo_description(&self) -> Option<&str> {
        self.redo_stack.last().map(|c| c.name())
    }

    pub fn clear_history(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}

// ── RenameLabelCommand ────────────────────────────────────────────────────────

/// Renombra un label en todos los archivos .tex del proyecto.
/// Operación atómica: guarda backups en memoria, revierte si hay discrepancia.
pub struct RenameLabelCommand {
    pub old_key: String,
    pub new_key: String,
    // Calculados en execute, usados en undo
    backups: std::collections::HashMap<PathBuf, String>,
    affected_files: Vec<PathBuf>,
}

impl RenameLabelCommand {
    pub fn new(old_key: impl Into<String>, new_key: impl Into<String>) -> Self {
        Self {
            old_key: old_key.into(),
            new_key: new_key.into(),
            backups: std::collections::HashMap::new(),
            affected_files: Vec::new(),
        }
    }
}

impl Command for RenameLabelCommand {
    fn name(&self) -> &str {
        "Renombrar label"
    }

    fn description(&self) -> String {
        format!("Renombrar label '{}' → '{}'", self.old_key, self.new_key)
    }

    fn execute(&mut self, ctx: &mut CommandContext) -> Result<CommandResult, CommandError> {
        // 1. Encontrar todos los .tex del proyecto
        let tex_files = find_tex_files(&ctx.project_root);

        // 2. Encontrar los que contienen el old_key
        let mut files_with_label: Vec<PathBuf> = Vec::new();
        for path in &tex_files {
            let content = std::fs::read_to_string(path)?;
            if content_references_key(&content, &self.old_key) {
                files_with_label.push(path.clone());
            }
        }

        if files_with_label.is_empty() {
            return Err(CommandError::Validation {
                message: format!("No se encontró '{}' en ningún archivo .tex", self.old_key),
            });
        }

        // 3. Contar ocurrencias antes
        let mut before_count = 0usize;
        for path in &files_with_label {
            let content = std::fs::read_to_string(path)?;
            before_count += count_key_occurrences(&content, &self.old_key);
        }

        // 4. Guardar backups en memoria
        self.backups.clear();
        self.affected_files.clear();
        for path in &files_with_label {
            let content = std::fs::read_to_string(path)?;
            self.backups.insert(path.clone(), content);
            self.affected_files.push(path.clone());
        }

        // 5. Aplicar sustituciones
        let mut after_count = 0usize;
        for path in &files_with_label {
            let content = self.backups[path].clone();
            let new_content = replace_key(&content, &self.old_key, &self.new_key);
            after_count += count_key_occurrences(&new_content, &self.new_key);
            std::fs::write(path, &new_content)?;
        }

        // 6. Verificar consistencia
        if after_count != before_count {
            // Revertir desde backups
            for (path, original) in &self.backups {
                let _ = std::fs::write(path, original);
            }
            return Err(CommandError::Reverted {
                reason: format!(
                    "Discrepancia en ocurrencias: antes={}, después={}. Cambios revertidos.",
                    before_count, after_count
                ),
            });
        }

        Ok(format!(
            "Label '{}' renombrado a '{}' en {} archivo(s), {} ocurrencia(s)",
            self.old_key,
            self.new_key,
            files_with_label.len(),
            after_count
        ))
    }

    fn undo(&mut self, _ctx: &mut CommandContext) -> Result<CommandResult, CommandError> {
        if self.backups.is_empty() {
            return Err(CommandError::Validation {
                message: "No hay backup disponible para revertir".to_string(),
            });
        }
        for (path, original) in &self.backups {
            std::fs::write(path, original)?;
        }
        Ok(format!(
            "Revertido: '{}' restaurado en {} archivo(s)",
            self.old_key,
            self.backups.len()
        ))
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn find_tex_files(root: &PathBuf) -> Vec<PathBuf> {
    walkdir::WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|ext| ext.to_str())
                == Some("tex")
        })
        .map(|e| e.path().to_path_buf())
        .collect()
}

/// Comprueba si un contenido referencia a un label key dado
/// (como \label{key}, \ref{key}, \cref{key}, etc.)
fn content_references_key(content: &str, key: &str) -> bool {
    let patterns = [
        format!("\\label{{{}}}", key),
        format!("\\ref{{{}}}", key),
        format!("\\cref{{{}}}", key),
        format!("\\Cref{{{}}}", key),
        format!("\\autoref{{{}}}", key),
        format!("\\pageref{{{}}}", key),
        format!("\\nameref{{{}}}", key),
        format!("\\eqref{{{}}}", key),
        format!("\\vref{{{}}}", key),
    ];
    patterns.iter().any(|p| content.contains(p.as_str()))
}

fn count_key_occurrences(content: &str, key: &str) -> usize {
    let patterns = [
        format!("\\label{{{}}}", key),
        format!("\\ref{{{}}}", key),
        format!("\\cref{{{}}}", key),
        format!("\\Cref{{{}}}", key),
        format!("\\autoref{{{}}}", key),
        format!("\\pageref{{{}}}", key),
        format!("\\nameref{{{}}}", key),
        format!("\\eqref{{{}}}", key),
        format!("\\vref{{{}}}", key),
    ];
    patterns.iter().map(|p| content.matches(p.as_str()).count()).sum()
}

fn replace_key(content: &str, old_key: &str, new_key: &str) -> String {
    let prefixes = [
        "\\label", "\\ref", "\\cref", "\\Cref", "\\autoref",
        "\\pageref", "\\nameref", "\\eqref", "\\vref",
    ];
    let mut result = content.to_string();
    for prefix in &prefixes {
        let old_pattern = format!("{}{{{}}}", prefix, old_key);
        let new_pattern = format!("{}{{{}}}", prefix, new_key);
        result = result.replace(&old_pattern, &new_pattern);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn setup_project(files: &[(&str, &str)]) -> TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (name, content) in files {
            let path = dir.path().join(name);
            std::fs::write(path, content).unwrap();
        }
        dir
    }

    #[test]
    fn dispatcher_execute_and_undo() {
        struct IncrementCmd { value: i32 }
        impl Command for IncrementCmd {
            fn name(&self) -> &str { "increment" }
            fn execute(&mut self, _: &mut CommandContext) -> Result<CommandResult, CommandError> {
                self.value += 1;
                Ok(self.value.to_string())
            }
            fn undo(&mut self, _: &mut CommandContext) -> Result<CommandResult, CommandError> {
                self.value -= 1;
                Ok(self.value.to_string())
            }
        }

        let mut dispatcher = CommandDispatcher::new(10);
        let mut ctx = CommandContext::new(std::env::temp_dir());
        let cmd = Box::new(IncrementCmd { value: 0 });
        dispatcher.execute(cmd, &mut ctx).unwrap();
        assert!(dispatcher.can_undo());
        dispatcher.undo(&mut ctx).unwrap();
        assert!(!dispatcher.can_undo());
    }

    #[test]
    fn dispatcher_redo_works() {
        struct NoopCmd;
        impl Command for NoopCmd {
            fn name(&self) -> &str { "noop" }
            fn execute(&mut self, _: &mut CommandContext) -> Result<CommandResult, CommandError> {
                Ok("done".to_string())
            }
            fn undo(&mut self, _: &mut CommandContext) -> Result<CommandResult, CommandError> {
                Ok("undone".to_string())
            }
        }

        let mut dispatcher = CommandDispatcher::new(10);
        let mut ctx = CommandContext::new(std::env::temp_dir());
        dispatcher.execute(Box::new(NoopCmd), &mut ctx).unwrap();
        dispatcher.undo(&mut ctx).unwrap();
        assert!(dispatcher.can_redo());
        dispatcher.redo(&mut ctx).unwrap();
        assert!(!dispatcher.can_redo());
    }

    #[test]
    fn rename_label_single_file() {
        let dir = setup_project(&[(
            "main.tex",
            "Some text \\label{fig:old} and \\ref{fig:old}",
        )]);
        let mut cmd = RenameLabelCommand::new("fig:old", "fig:new");
        let mut ctx = CommandContext::new(dir.path().to_path_buf());
        let result = cmd.execute(&mut ctx).unwrap();
        assert!(result.contains("fig:new"));

        let content = std::fs::read_to_string(dir.path().join("main.tex")).unwrap();
        assert!(content.contains("\\label{fig:new}"));
        assert!(content.contains("\\ref{fig:new}"));
        assert!(!content.contains("fig:old"));
    }

    #[test]
    fn rename_label_undo_restores() {
        let original = "\\label{fig:old} and \\ref{fig:old}";
        let dir = setup_project(&[("main.tex", original)]);
        let mut cmd = RenameLabelCommand::new("fig:old", "fig:new");
        let mut ctx = CommandContext::new(dir.path().to_path_buf());
        cmd.execute(&mut ctx).unwrap();
        cmd.undo(&mut ctx).unwrap();

        let content = std::fs::read_to_string(dir.path().join("main.tex")).unwrap();
        assert_eq!(content, original);
    }

    #[test]
    fn rename_label_not_found_returns_error() {
        let dir = setup_project(&[("main.tex", "\\label{fig:other}")]);
        let mut cmd = RenameLabelCommand::new("fig:nonexistent", "fig:new");
        let mut ctx = CommandContext::new(dir.path().to_path_buf());
        assert!(cmd.execute(&mut ctx).is_err());
    }
}
