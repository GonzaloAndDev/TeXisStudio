// Stub en Release 0.1. Implementación completa en Release 0.4.
// El trait ya existe para que el código que lo usa no cambie.

use super::{CompilationBackend, CompilationOptions, CompilationResult};
use crate::error::{CoreError, CoreResult};
use std::path::Path;

pub struct TectonicBackend;

impl CompilationBackend for TectonicBackend {
    fn name(&self) -> &str {
        "tectonic"
    }

    fn is_available(&self) -> bool {
        false
    }

    fn compile(&self, _build_dir: &Path, _options: &CompilationOptions) -> CoreResult<CompilationResult> {
        Err(CoreError::BackendUnavailable {
            backend: "tectonic".to_string(),
        })
    }

    fn clean(&self, _build_dir: &Path) -> CoreResult<()> {
        Err(CoreError::BackendUnavailable {
            backend: "tectonic".to_string(),
        })
    }
}
