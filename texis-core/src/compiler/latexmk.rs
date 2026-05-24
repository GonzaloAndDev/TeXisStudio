use super::{CompilationBackend, CompilationOptions, CompilationResult};
use crate::error::{CoreError, CoreResult};
use std::path::Path;
use std::process::Command;

pub struct LatexmkBackend;

impl LatexmkBackend {
    pub fn new() -> Self {
        Self
    }
}

impl Default for LatexmkBackend {
    fn default() -> Self {
        Self::new()
    }
}

impl CompilationBackend for LatexmkBackend {
    fn name(&self) -> &str {
        "latexmk"
    }

    fn is_available(&self) -> bool {
        Command::new("latexmk").arg("--version").output().is_ok()
    }

    fn compile(&self, build_dir: &Path, options: &CompilationOptions) -> CoreResult<CompilationResult> {
        if !self.is_available() {
            return Err(CoreError::BackendUnavailable {
                backend: "latexmk".to_string(),
            });
        }

        let mut cmd = Command::new("latexmk");
        cmd.current_dir(build_dir)
            .arg("-xelatex")
            .arg("-interaction=nonstopmode")
            .arg("-file-line-error");

        if options.draft {
            cmd.arg("-draftmode");
        }

        if let Some(max) = options.max_runs {
            cmd.arg(format!("-max_repeat={}", max));
        }

        cmd.arg("main.tex");

        let output = cmd.output().map_err(CoreError::Io)?;
        let log = String::from_utf8_lossy(&output.stdout).to_string()
            + &String::from_utf8_lossy(&output.stderr);

        let user_errors = super::error_translator::translate_log(&log);
        let success = output.status.success() && user_errors.iter().all(|e| e.suggestion.is_some() || !log.contains("Fatal error"));

        let pdf_path = if success {
            let pdf = build_dir.join("main.pdf");
            if pdf.exists() { Some(pdf) } else { None }
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
        let extensions = ["aux", "log", "toc", "out", "bbl", "bcf", "blg", "run.xml", "fls", "fdb_latexmk", "synctex.gz"];
        for entry in std::fs::read_dir(build_dir).map_err(CoreError::Io)? {
            let entry = entry.map_err(CoreError::Io)?;
            let path = entry.path();
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if extensions.contains(&ext) {
                    let _ = std::fs::remove_file(&path);
                }
            }
        }
        Ok(())
    }
}
