use crate::error::CoreResult;
use std::path::Path;

pub mod detector;
pub mod error_translator;
pub mod latexmk;
pub mod tectonic;

#[derive(Debug, Clone)]
pub struct CompilationResult {
    pub success: bool,
    pub pdf_path: Option<std::path::PathBuf>,
    pub log: String,
    pub user_errors: Vec<UserError>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct UserError {
    pub message: String,
    pub suggestion: Option<String>,
    pub raw_log_line: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct CompilationOptions {
    pub draft: bool,
    pub clean_temp: bool,
    pub max_runs: Option<u8>,
}

pub trait CompilationBackend: Send + Sync {
    fn name(&self) -> &str;
    fn is_available(&self) -> bool;

    /// build_dir es el directorio build/ del proyecto.
    /// La compilación se ejecuta con build_dir como working directory.
    fn compile(
        &self,
        build_dir: &Path,
        options: &CompilationOptions,
    ) -> CoreResult<CompilationResult>;

    fn clean(&self, build_dir: &Path) -> CoreResult<()>;
}
