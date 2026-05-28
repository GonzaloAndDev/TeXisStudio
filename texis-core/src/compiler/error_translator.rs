use super::UserError;

/// Traduce líneas del log de LaTeX a mensajes de error en lenguaje humano.
///
/// Clasifica los errores por dominio para que el usuario sepa exactamente qué
/// corregir sin tener que leer el log crudo de LaTeX:
///
///  - [Entorno]      herramientas faltantes, motores, fuentes
///  - [Contenido]    errores en el documento del usuario (LaTeX mal escrito)
///  - [Bibliografía] errores de biber/biblatex
///  - [Plantilla]    errores en la plantilla generada por TeXisStudio
///
/// IMPORTANTE: "Please (re)run Biber" NO se clasifica como error de usuario —
/// es un aviso intermedio de biblatex que latexmk resuelve internamente.
/// Ver bibliography_pending_in_log() en latexmk.rs para cómo se maneja.
pub fn translate_log(log: &str) -> Vec<UserError> {
    let mut errors = Vec::new();
    let lines: Vec<&str> = log.lines().collect();

    let mut i = 0;
    while i < lines.len() {
        let line = lines[i];

        // Saltamos líneas vacías o de progreso
        if line.trim().is_empty() || line.starts_with("Latexmk:") {
            i += 1;
            continue;
        }

        // Intentamos traducir. Algunas reglas miran líneas de contexto adelante.
        if let Some(err) = translate_line(line, lines.get(i + 1).copied()) {
            // Deduplicar: no agregar el mismo código dos veces seguidas
            if errors.last().map(|e: &UserError| &e.message) != Some(&err.message) {
                errors.push(err);
            }
        }
        i += 1;
    }

    errors
}

fn translate_line(line: &str, next_line: Option<&str>) -> Option<UserError> {
    // ── [Contenido] Archivo no encontrado ────────────────────────────────────
    if line.contains("! LaTeX Error: File") && line.contains("not found") {
        let file = extract_quoted(line).unwrap_or_else(|| "desconocido".to_string());
        return Some(UserError {
            message: format!("[Contenido] Archivo no encontrado: '{}'", file),
            suggestion: Some(format!(
                "Verifica que '{}' existe en la ruta correcta. \
                 Si es una imagen, ponla en content/figures/. \
                 Si es un paquete .sty, instálalo en tu distribución LaTeX.",
                file
            )),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Contenido] Comando LaTeX desconocido ─────────────────────────────────
    if line.contains("! Undefined control sequence") {
        let cmd = next_line
            .and_then(|l| l.split_whitespace().last())
            .map(|s| format!(" ('{}')", s))
            .unwrap_or_default();
        return Some(UserError {
            message: format!("[Contenido] Comando LaTeX desconocido{}", cmd),
            suggestion: Some(
                "Revisa que el paquete que define este comando está habilitado. \
                 Si usas un bloque RawLatex, verifica la sintaxis del comando."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Contenido] Símbolo matemático fuera de entorno ──────────────────────
    if line.contains("! Missing $ inserted") {
        return Some(UserError {
            message: "[Contenido] Símbolo matemático fuera de un entorno de ecuación.".to_string(),
            suggestion: Some(
                "Envuelve el contenido matemático en $...$ (en línea) o en un bloque \
                 de ecuación. Si el texto contiene guiones bajos o circunflejo, \
                 usa \\_ o \\^{} fuera de modo matemático."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Contenido] Entorno no cerrado / llave faltante ───────────────────────
    if line.contains("Runaway argument") || line.contains("! Emergency stop") {
        return Some(UserError {
            message: "[Contenido] Argumento o entorno LaTeX sin cerrar.".to_string(),
            suggestion: Some(
                "Revisa que todos los bloques tienen su cierre correspondiente: \
                 llaves {}, corchetes [], y entornos \\begin{}...\\end{}."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Contenido] Desbordamiento de caja ───────────────────────────────────
    if line.contains("Overfull \\hbox") && line.contains("too wide") {
        return Some(UserError {
            message: "[Contenido] Texto o imagen demasiado ancho para los márgenes.".to_string(),
            suggestion: Some(
                "Si es una imagen, usa \\linewidth en lugar de un ancho fijo. \
                 Si es texto largo sin espacios (URL, código), añade \\allowbreak o \
                 usa el paquete url. En tablas, considera reducir el contenido."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Entorno] Fuente no encontrada ────────────────────────────────────────
    if line.contains("Font") && (line.contains("not found") || line.contains("not loadable")) {
        let font = extract_quoted(line).unwrap_or_else(|| "desconocida".to_string());
        return Some(UserError {
            message: format!("[Entorno] Fuente no encontrada: '{}'", font),
            suggestion: Some(
                "La fuente especificada en el perfil institucional no está instalada \
                 en tu sistema. Instala la fuente o cambia la configuración tipográfica \
                 del proyecto a una fuente disponible (ej. Latin Modern)."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Entorno] Paquete no encontrado ──────────────────────────────────────
    if line.contains("! LaTeX Error: File") && line.contains(".sty' not found") {
        let pkg = extract_quoted(line)
            .map(|s| s.replace(".sty", ""))
            .unwrap_or_else(|| "desconocido".to_string());
        return Some(UserError {
            message: format!("[Entorno] Paquete LaTeX faltante: '{}'", pkg),
            suggestion: Some(format!(
                "Instala el paquete '{}' en tu distribución TeX Live o MiKTeX. \
                 En Linux: sudo apt-get install texlive-latex-extra. \
                 En macOS (MacTeX): tlmgr install {}.",
                pkg, pkg
            )),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Bibliografía] Error duro de biber ───────────────────────────────────
    // NOTA: "Please (re)run Biber" NO va aquí — es un aviso intermedio,
    // no un error. Ver bibliography_pending_in_log() en latexmk.rs.
    if (line.contains("biber") || line.contains("Biber")) && line.contains("error") {
        return Some(UserError {
            message: "[Bibliografía] Error en el procesamiento de la bibliografía.".to_string(),
            suggestion: Some(
                "Verifica que references.bib existe en content/bibliography/ y tiene \
                 entradas bien formadas. Revisa que cada entrada tiene los campos \
                 obligatorios (author, title, year). Las llaves {} deben estar balanceadas."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Bibliografía] Clave de cita no encontrada ────────────────────────────
    if line.contains("LaTeX Warning: Citation") && line.contains("undefined") {
        let key = extract_quoted(line).unwrap_or_else(|| "?".to_string());
        return Some(UserError {
            message: format!("[Bibliografía] Clave de cita no definida: '{}'", key),
            suggestion: Some(format!(
                "La cita '{}' no existe en references.bib. \
                 Verifica que la clave en el documento coincide exactamente con \
                 la clave en el archivo .bib (distingue mayúsculas/minúsculas).",
                key
            )),
            raw_log_line: Some(line.to_string()),
        });
    }

    // ── [Plantilla] Error interno de la plantilla ─────────────────────────────
    if line.contains("! Package") && line.contains("Error:") {
        let pkg_err = line
            .trim_start_matches("! Package ")
            .split("Error:")
            .next()
            .unwrap_or("")
            .trim()
            .to_string();
        return Some(UserError {
            message: format!("[Plantilla] Error en paquete LaTeX: {}", pkg_err),
            suggestion: Some(
                "Este error proviene de un paquete LaTeX interno a la plantilla. \
                 Si acabas de cambiar el perfil institucional o la tipografía, \
                 revisa la configuración. Si el error persiste, reporta el issue \
                 incluyendo el log completo de compilación."
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
    fn traduce_cita_no_definida() {
        let log = "LaTeX Warning: Citation 'smith2020' on page 1 undefined";
        let errors = translate_log(log);
        assert!(!errors.is_empty());
        assert!(errors[0].message.contains("[Bibliografía]"));
        assert!(errors[0].message.contains("smith2020"));
    }

    #[test]
    fn no_falso_positivo_please_rerun_biber() {
        // "Please (re)run Biber" NO debe generar UserError.
        let log = "Package biblatex Warning: Please (re)run Biber on the file: main";
        let errors = translate_log(log);
        assert!(
            errors.is_empty(),
            "Please (re)run Biber no debe generar UserError: {:?}", errors
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
        // Mismo error repetido en múltiples líneas → solo una entrada
        let log = "! Undefined control sequence.\n! Undefined control sequence.";
        let errors = translate_log(log);
        assert_eq!(errors.len(), 1, "Debe deduplicar errores consecutivos idénticos");
    }
}
