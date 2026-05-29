use super::UserError;

/// Traduce líneas del log de LaTeX a mensajes de error en lenguaje humano.
///
/// CRITERIO DE INCLUSIÓN: solo se incluyen patrones que correspondan a errores
/// FATALES que impiden la generación del PDF. Patrones que aparecen en
/// compilaciones exitosas (warnings de layout, fallbacks de fuente, etc.)
/// NO se incluyen aquí porque romperían el check user_errors.is_empty()
/// que usa la detección de éxito por evidencia física en latexmk.rs.
///
/// Clasificación por dominio:
///  [Contenido]    errores en el documento del usuario (LaTeX mal escrito)
///  [Bibliografía] errores de biber/biblatex
///  [Entorno]      herramientas o paquetes faltantes
///  [Plantilla]    errores internos de la plantilla generada por TeXisStudio
///
/// NOTA sobre "Overfull \\hbox": warning de layout, NO incluir.
/// NOTA sobre "Font ... not loadable": fallback informativo de XeLaTeX, NO incluir.
/// NOTA sobre "Please (re)run Biber": aviso intermedio, NO incluir (ver latexmk.rs).
pub fn translate_log(log: &str) -> Vec<UserError> {
    let mut errors: Vec<UserError> = Vec::new();

    for line in log.lines() {
        if let Some(err) = translate_line(line) {
            // Deduplicar: no agregar el mismo mensaje dos veces seguidas
            let is_dup = errors
                .last()
                .map(|e| e.message == err.message)
                .unwrap_or(false);
            if !is_dup {
                errors.push(err);
            }
        }
    }

    errors
}

fn translate_line(line: &str) -> Option<UserError> {
    // Solo patrones de errores FATALES que impiden la compilación.

    // ── [Contenido] Archivo no encontrado (imagen, incluye, etc.) ─────────────
    // Patrón: "! LaTeX Error: File 'X' not found."
    if line.contains("! LaTeX Error: File") && line.contains("not found") {
        let file = extract_quoted(line).unwrap_or_else(|| "desconocido".to_string());
        let is_sty = file.ends_with(".sty") || file.ends_with(".cls");
        if is_sty {
            return Some(UserError {
                message: format!(
                    "[Entorno] Paquete LaTeX faltante: '{}'",
                    file.replace(".sty", "").replace(".cls", "")
                ),
                suggestion: Some(
                    "Instala el paquete en tu distribución TeX Live o MiKTeX. \
                     En Linux: sudo apt-get install texlive-latex-extra."
                        .to_string(),
                ),
                raw_log_line: Some(line.to_string()),
            });
        } else {
            return Some(UserError {
                message: format!("[Contenido] Archivo no encontrado: '{}'", file),
                suggestion: Some(format!(
                    "Verifica que '{}' existe en la ruta correcta. \
                     Si es una imagen, ponla en content/figures/.",
                    file
                )),
                raw_log_line: Some(line.to_string()),
            });
        }
    }

    // ── [Contenido] Comando LaTeX desconocido ─────────────────────────────────
    // Patrón: "! Undefined control sequence."
    if line.contains("! Undefined control sequence") {
        return Some(UserError {
            message: "[Contenido] Comando LaTeX desconocido.".to_string(),
            suggestion: Some(
                "Revisa que el paquete que define este comando está habilitado. \
                 Si usas un bloque RawLatex, verifica la sintaxis."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Contenido] Símbolo matemático fuera de entorno ──────────────────────
    // Patrón: "! Missing $ inserted."
    if line.contains("! Missing $ inserted") {
        return Some(UserError {
            message: "[Contenido] Símbolo matemático fuera de un entorno de ecuación.".to_string(),
            suggestion: Some(
                "Envuelve el contenido matemático en $...$ o en un bloque de ecuación.".to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Contenido] Entorno o argumento sin cerrar ────────────────────────────
    // Patrón: "Runaway argument" / "! Emergency stop"
    if line.contains("Runaway argument") || line.contains("! Emergency stop") {
        return Some(UserError {
            message: "[Contenido] Argumento o entorno LaTeX sin cerrar.".to_string(),
            suggestion: Some(
                "Revisa que todos los bloques tienen su cierre: \
                 llaves {}, corchetes [] y entornos \\begin{}...\\end{}."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Bibliografía] Error duro de biber ───────────────────────────────────
    // NOTA: NO incluir "Please (re)run Biber" — aviso intermedio, no fatal.
    // Solo capturamos líneas que explícitamente contienen "error" junto con biber.
    if (line.contains("biber") || line.contains("Biber")) && line.contains("error") {
        return Some(UserError {
            message: "[Bibliografía] Error en el procesamiento de la bibliografía.".to_string(),
            suggestion: Some(
                "Verifica que references.bib existe en content/bibliography/ \
                 con entradas bien formadas (author, title, year, llaves balanceadas)."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    None
}

fn extract_quoted(line: &str) -> Option<String> {
    let start = line.find('\'')?;
    let end = line[start + 1..].find('\'')?;
    Some(line[start + 1..start + 1 + end].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn traduce_archivo_no_encontrado() {
        let log = "! LaTeX Error: File 'imagen.png' not found.";
        let errors = translate_log(log);
        assert!(!errors.is_empty());
        assert!(errors[0].message.contains("imagen.png"));
        assert!(errors[0].message.contains("[Contenido]"));
        assert!(errors[0].suggestion.is_some());
    }

    #[test]
    fn traduce_paquete_sty_no_encontrado() {
        let log = "! LaTeX Error: File 'fontspec.sty' not found.";
        let errors = translate_log(log);
        assert!(!errors.is_empty());
        assert!(errors[0].message.contains("[Entorno]"));
        assert!(errors[0].message.contains("fontspec"));
    }

    #[test]
    fn traduce_undefined_control_sequence() {
        let log = "! Undefined control sequence.\nl.42 \\unknowncmd";
        let errors = translate_log(log);
        assert!(!errors.is_empty());
        assert!(errors[0].message.contains("[Contenido]"));
        assert!(errors[0].suggestion.is_some());
    }

    #[test]
    fn traduce_missing_dollar() {
        let log = "! Missing $ inserted.\n<inserted text>";
        let errors = translate_log(log);
        assert!(!errors.is_empty());
        assert!(errors[0].message.contains("[Contenido]"));
        assert!(errors[0].message.contains("matemático"));
    }

    #[test]
    fn no_falso_positivo_please_rerun_biber() {
        // "Please (re)run Biber" NO debe generar UserError — aviso intermedio.
        let log = "Package biblatex Warning: Please (re)run Biber on the file: main";
        let errors = translate_log(log);
        assert!(
            errors.is_empty(),
            "Please (re)run Biber no debe generar UserError: {:?}",
            errors
        );
    }

    #[test]
    fn no_falso_positivo_font_not_loadable() {
        // "Font ... not loadable" es un fallback informativo de XeLaTeX, no un error fatal.
        // NO debe generar UserError (aparece en compilaciones exitosas).
        let log = "Font \\zf@basefont=LM Roman/OT1/m/n/10 not loadable: TFM file not found";
        let errors = translate_log(log);
        assert!(
            errors.is_empty(),
            "Font fallback warning no debe generar UserError: {:?}",
            errors
        );
    }

    #[test]
    fn no_falso_positivo_overfull_hbox() {
        // "Overfull \\hbox" es un warning de layout, no un error fatal.
        let log = "Overfull \\hbox (12.5pt too wide) in paragraph at lines 123--145";
        let errors = translate_log(log);
        assert!(
            errors.is_empty(),
            "Overfull hbox no debe generar UserError: {:?}",
            errors
        );
    }

    #[test]
    fn log_limpio_sin_errores() {
        let log = "This is XeTeX, Version 3.141592\nOutput written on main.pdf (42 pages).";
        let errors = translate_log(log);
        assert!(errors.is_empty());
    }

    #[test]
    fn deduplica_errores_repetidos() {
        let log = "! Undefined control sequence.\n! Undefined control sequence.";
        let errors = translate_log(log);
        assert_eq!(
            errors.len(),
            1,
            "Debe deduplicar errores consecutivos idénticos"
        );
    }
}
