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

        let engine_flag = match options.latex_engine.as_deref().unwrap_or("xelatex") {
            "pdflatex" => "-pdf",
            "lualatex" => "-lualatex",
            _ => "-xelatex",
        };

        // Write .latexmkrc to ensure biber runs correctly with biblatex.
        // latexmk needs explicit biber configuration to process biblatex .bcf files.
        let latexmkrc = build_dir.join(".latexmkrc");
        std::fs::write(&latexmkrc,
            "$biber = 'biber %O %S';\n\
             $bibtex_use = 2;\n\
             $clean_ext = 'bbl run.xml bcf fls fdb_latexmk synctex.gz';\n"
        ).map_err(CoreError::Io)?;

        let first_log = run_latexmk(build_dir, options, engine_flag)?;

        // Algunos entornos/versiones de latexmk dejan biblatex a medias aunque .bcf exista.
        // Si el primer pase indica bibliografía pendiente, forzamos biber + segundo pase.
        // La decisión de éxito se basa SOLO en el último pase para evitar falsos positivos
        // del "Please (re)run Biber" que siempre aparece en el primer pase intermedio.
        let final_log = if needs_manual_biber(&first_log, build_dir) {
            let biber_log = run_biber(build_dir)?;
            let second_log = run_latexmk(build_dir, options, engine_flag)?;
            format!("{first_log}\n[biber]\n{biber_log}\n[latexmk-pass2]\n{second_log}")
        } else {
            first_log.clone()
        };

        let last_pass_log = final_log
            .rfind("[latexmk-pass2]")
            .map(|pos| &final_log[pos..])
            .unwrap_or(&final_log);

        let user_errors = super::error_translator::translate_log(last_pass_log);
        let success = !has_blocking_compile_issue(last_pass_log, &user_errors);
        let log = final_log;

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

fn run_latexmk(build_dir: &Path, options: &CompilationOptions, engine_flag: &str) -> CoreResult<String> {
    let mut cmd = Command::new("latexmk");
    cmd.current_dir(build_dir)
        .arg(engine_flag)
        .arg("-bibtex")
        .arg("-interaction=nonstopmode")
        .arg("-file-line-error");

    if options.draft {
        cmd.arg("-draftmode");
    }

    if let Some(max) = options.max_runs {
        cmd.arg(format!("-max_repeat={}", max));
    }

    cmd.arg("main.tex");
    run_and_capture(&mut cmd)
}

fn run_biber(build_dir: &Path) -> CoreResult<String> {
    let mut cmd = Command::new("biber");
    cmd.current_dir(build_dir).arg("main");
    run_and_capture(&mut cmd)
}

fn run_and_capture(cmd: &mut Command) -> CoreResult<String> {
    let output = cmd.output().map_err(CoreError::Io)?;
    let log = String::from_utf8_lossy(&output.stdout).to_string()
        + &String::from_utf8_lossy(&output.stderr);

    if output.status.success() {
        Ok(log)
    } else {
        Err(CoreError::Compilation {
            message: log,
        })
    }
}

fn needs_manual_biber(log: &str, build_dir: &Path) -> bool {
    let bcf_exists = build_dir.join("main.bcf").exists();
    let bbl = build_dir.join("main.bbl");
    let bbl_missing_or_empty = std::fs::metadata(&bbl).map(|m| m.len() == 0).unwrap_or(true);

    bcf_exists && bbl_missing_or_empty && bibliography_pending_in_log(log)
}

fn bibliography_pending_in_log(log: &str) -> bool {
    log.contains("Please (re)run Biber")
        || log.contains("Empty bibliography")
        || log.contains("No file main.bbl")
}

fn has_blocking_compile_issue(
    log: &str,
    user_errors: &[super::UserError],
) -> bool {
    bibliography_pending_in_log(log)
        || !user_errors.is_empty()
}

#[cfg(test)]
mod tests {
    use super::{bibliography_pending_in_log, has_blocking_compile_issue};
    use crate::compiler::UserError;

    #[test]
    fn detecta_bibliografia_pendiente() {
        assert!(bibliography_pending_in_log("LaTeX Warning: Empty bibliography"));
        assert!(bibliography_pending_in_log("Package biblatex Warning: Please (re)run Biber on the file: main"));
        assert!(bibliography_pending_in_log("No file main.bbl."));
    }

    #[test]
    fn exito_requiere_pdf_y_sin_errores() {
        let ok_log = "Output written on main.pdf (12 pages).";
        assert!(!has_blocking_compile_issue(ok_log, &[]));

        let err = UserError {
            message: "Error en la bibliografía (biber).".to_string(),
            suggestion: Some("Revisa references.bib".to_string()),
            raw_log_line: None,
        };
        assert!(has_blocking_compile_issue(ok_log, &[err]));
    }
}
