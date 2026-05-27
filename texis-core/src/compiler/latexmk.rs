use super::{CompilationBackend, CompilationOptions, CompilationResult};
use crate::error::{CoreError, CoreResult};
use std::path::Path;
use std::process::Command;

pub struct LatexmkBackend;

struct CommandCapture {
    log: String,
    success: bool,
}

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

        let first_pass = run_latexmk(build_dir, options, engine_flag)?;

        // Algunos entornos/versiones de latexmk dejan biblatex a medias aunque .bcf exista.
        // Si el primer pase indica bibliografía pendiente, forzamos biber + segundo pase.
        // La decisión de éxito se basa SOLO en el último pase para evitar falsos positivos
        // del "Please (re)run Biber" que siempre aparece en el primer pase intermedio.
        let (final_log, last_pass_log, command_succeeded) = if needs_manual_biber(&first_pass.log, build_dir) {
            let biber = run_biber(build_dir)?;
            let second_pass = run_latexmk(build_dir, options, engine_flag)?;
            let final_log = format!(
                "{}\n[biber]\n{}\n[latexmk-pass2]\n{}",
                first_pass.log, biber.log, second_pass.log
            );
            let last_pass_log = final_log
                .rfind("[latexmk-pass2]")
                .map(|pos| &final_log[pos..])
                .unwrap_or(&final_log)
                .to_string();
            (final_log, last_pass_log, biber.success && second_pass.success)
        } else {
            (first_pass.log.clone(), first_pass.log.clone(), first_pass.success)
        };

        let user_errors = super::error_translator::translate_log(&last_pass_log);
        // bbl_resolved = biber ya corrió y produjo bibliography no-vacía.
        // Cuando es true, ignoramos warnings de "Please (re)run Biber" en el log:
        // son mensajes INTERMEDIOS de antes de que biber corriera (bien de latexmk interno
        // o de nuestro fallback manual), no del estado final del documento.
        let bbl = build_dir.join("main.bbl");
        let bbl_resolved = std::fs::metadata(&bbl).map(|m| m.len() > 0).unwrap_or(false);
        let success = pass_succeeded(command_succeeded, &last_pass_log, &user_errors, bbl_resolved);
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

fn run_latexmk(build_dir: &Path, options: &CompilationOptions, engine_flag: &str) -> CoreResult<CommandCapture> {
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

fn run_biber(build_dir: &Path) -> CoreResult<CommandCapture> {
    let mut cmd = Command::new("biber");
    cmd.current_dir(build_dir).arg("main");
    run_and_capture(&mut cmd)
}

fn run_and_capture(cmd: &mut Command) -> CoreResult<CommandCapture> {
    let output = cmd.output().map_err(CoreError::Io)?;
    let log = String::from_utf8_lossy(&output.stdout).to_string()
        + &String::from_utf8_lossy(&output.stderr);
    Ok(CommandCapture {
        log,
        success: output.status.success(),
    })
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
    bbl_resolved: bool,
) -> bool {
    // Si biber ya resolvió la bibliografía (bbl no-vacío), los warnings de
    // "Please (re)run Biber" son mensajes intermedios del log y no son bloqueantes.
    (!bbl_resolved && bibliography_pending_in_log(log))
        || !user_errors.is_empty()
}

#[cfg(test)]
mod tests {
    use super::{bibliography_pending_in_log, has_blocking_compile_issue, pass_succeeded};
    use crate::compiler::UserError;

    #[test]
    fn detecta_bibliografia_pendiente() {
        assert!(bibliography_pending_in_log("LaTeX Warning: Empty bibliography"));
        assert!(bibliography_pending_in_log("Package biblatex Warning: Please (re)run Biber on the file: main"));
        assert!(bibliography_pending_in_log("No file main.bbl."));
    }

    #[test]
    fn exito_requiere_sin_errores_de_usuario() {
        let ok_log = "Output written on main.pdf (12 pages).";
        // Sin bbl_resolved y sin errores → OK
        assert!(!has_blocking_compile_issue(ok_log, &[], false));

        let err = UserError {
            message: "Error en la bibliografía (biber).".to_string(),
            suggestion: Some("Revisa references.bib".to_string()),
            raw_log_line: None,
        };
        // Con error de usuario → siempre bloqueante
        assert!(has_blocking_compile_issue(ok_log, &[err.clone()], false));
        assert!(has_blocking_compile_issue(ok_log, &[err], true));
    }

    #[test]
    fn biber_pending_en_log_bloquea_solo_si_bbl_no_resuelto() {
        let pending_log = "Package biblatex Warning: Please (re)run Biber on the file: main";

        // bbl_resolved=false → warning es bloqueante
        assert!(has_blocking_compile_issue(pending_log, &[], false));
        // bbl_resolved=true → warning es intermedio, no bloqueante
        assert!(!has_blocking_compile_issue(pending_log, &[], true));
    }

    #[test]
    fn exito_final_requiere_comando_ok_y_log_limpio() {
        let ok_log = "Output written on main.pdf (12 pages).";
        let pending_log = "Package biblatex Warning: Please (re)run Biber on the file: main";

        // Caso normal: comando ok, log limpio, sin bbl
        assert!(pass_succeeded(true, ok_log, &[], false));
        // Comando fallido → siempre false
        assert!(!pass_succeeded(false, ok_log, &[], false));
        // bbl no resuelto + warning en log → false
        assert!(!pass_succeeded(true, pending_log, &[], false));
    }

    #[test]
    fn falso_positivo_corregido_cuando_latexmk_maneja_biber_internamente() {
        // CASO REAL: latexmk corre biber internamente (-bibtex).
        // Su log completo contiene el warning "Please (re)run Biber" de ANTES de que
        // biber corriera, pero biber ya resolvió la bibliografía (bbl_resolved=true).
        // Antes del fix: pass_succeeded devolvía false (falso positivo).
        // Después del fix: pass_succeeded devuelve true.
        let full_latexmk_log = concat!(
            "Latexmk: Run number 1 of rule 'xelatex'\n",
            "Package biblatex Warning: Please (re)run Biber on the file: main\n",
            "Latexmk: Run number 1 of rule 'biber main'\n",
            "INFO - This is Biber 2.19\n",
            "Latexmk: Run number 2 of rule 'xelatex'\n",
            "Output written on main.pdf (42 pages).\n",
            "Latexmk: All targets (main.pdf) are up-to-date\n",
        );
        // bbl_resolved=true porque latexmk corrió biber y main.bbl no está vacío
        assert!(pass_succeeded(true, full_latexmk_log, &[], true),
            "Falso positivo: latexmk manejó biber correctamente pero pass_succeeded falló");
    }
}

fn pass_succeeded(
    command_succeeded: bool,
    log: &str,
    user_errors: &[super::UserError],
    bbl_resolved: bool,
) -> bool {
    command_succeeded && !has_blocking_compile_issue(log, user_errors, bbl_resolved)
}
