// TectonicBackend — compilador LaTeX autónomo.
//
// Tectonic es un motor XeLaTeX en Rust que descarga solo los paquetes
// necesarios la primera vez. No requiere TeX Live ni Strawberry Perl.
//
// Instalación:
//   Windows (winget): winget install tectonic-typesetting.tectonic
//   macOS (brew):     brew install tectonic
//   Linux (cargo):    cargo install tectonic
//
// Documentación: https://tectonic-typesetting.github.io

use super::{CompilationBackend, CompilationOptions, CompilationResult};
use crate::compiler::error_translator;
use crate::error::{CoreError, CoreResult};
use std::path::Path;
use std::process::Command;

pub struct TectonicBackend;

impl TectonicBackend {
    pub fn new() -> Self {
        Self
    }

    /// Devuelve la versión de tectonic si está instalado.
    pub fn version() -> Option<String> {
        let output = Command::new("tectonic").arg("--version").output().ok()?;
        let text = String::from_utf8_lossy(&output.stdout);
        text.lines().next().map(|l| l.trim().to_string())
    }
}

impl Default for TectonicBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl CompilationBackend for TectonicBackend {
    fn name(&self) -> &str {
        "tectonic"
    }

    fn is_available(&self) -> bool {
        Command::new("tectonic").arg("--version").output().is_ok()
    }

    fn compile(
        &self,
        build_dir: &Path,
        options: &CompilationOptions,
    ) -> CoreResult<CompilationResult> {
        if !self.is_available() {
            return Err(CoreError::BackendUnavailable {
                backend: "tectonic".to_string(),
            });
        }

        let mut cmd = Command::new("tectonic");
        cmd.current_dir(build_dir);

        // API V1 (compatible con cualquier versión de tectonic):
        //   tectonic [--keep-intermediates] [--keep-logs] main.tex
        // Tectonic ejecuta múltiples pasadas automáticamente y gestiona
        // BibTeX/Biber internamente.

        if options.draft {
            // Modo borrador: una sola pasada sin generar PDF final
            cmd.arg("--only-cached");
        }

        // Mantener logs para poder leerlos y traducir errores
        cmd.arg("--keep-logs");
        cmd.arg("main.tex");

        let output = cmd.output().map_err(CoreError::Io)?;

        // Leer log completo (stdout + stderr + main.log si existe)
        let mut log = String::from_utf8_lossy(&output.stdout).to_string()
            + &String::from_utf8_lossy(&output.stderr);

        // Tectonic escribe el log en main.log dentro del build dir
        let log_file = build_dir.join("main.log");
        if log_file.exists() {
            if let Ok(file_log) = std::fs::read_to_string(&log_file) {
                log = file_log + "\n" + &log;
            }
        }

        let user_errors = error_translator::translate_log(&log);
        let success = output.status.success();

        let pdf_path = if success {
            let pdf = build_dir.join("main.pdf");
            if pdf.exists() {
                Some(pdf)
            } else {
                None
            }
        } else {
            None
        };

        Ok(CompilationResult {
            success,
            pdf_path,
            log,
            user_errors,
            warnings: vec![],
        })
    }

    fn clean(&self, build_dir: &Path) -> CoreResult<()> {
        // Tectonic genera menos archivos temporales que latexmk,
        // pero puede dejar logs y archivos intermedios.
        let to_clean = [
            "main.log",
            "main.xdv",
            "main.aux",
            "main.toc",
            "main.out",
            "main.bbl",
            "main.bcf",
            "main.blg",
            "main.run.xml",
        ];
        for name in &to_clean {
            let path = build_dir.join(name);
            if path.exists() {
                let _ = std::fs::remove_file(&path);
            }
        }
        Ok(())
    }
}
