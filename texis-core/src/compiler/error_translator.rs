use super::UserError;

/// Traduce líneas del log de LaTeX a mensajes en lenguaje humano.
pub fn translate_log(log: &str) -> Vec<UserError> {
    let mut errors = Vec::new();

    for line in log.lines() {
        if let Some(err) = translate_line(line) {
            errors.push(err);
        }
    }

    errors
}

fn translate_line(line: &str) -> Option<UserError> {
    // Archivo no encontrado
    if line.contains("! LaTeX Error: File") && line.contains("not found") {
        let file = extract_quoted(line).unwrap_or_default();
        return Some(UserError {
            message: format!("Archivo no encontrado: '{}'", file),
            suggestion: Some(format!(
                "Verifica que el archivo '{}' existe en la ruta correcta y está incluido en el proyecto.",
                file
            )),
            raw_log_line: Some(line.to_string()),
        });
    }

    // Undefined control sequence
    if line.contains("! Undefined control sequence") {
        return Some(UserError {
            message: "Comando LaTeX desconocido en el documento.".to_string(),
            suggestion: Some(
                "Revisa que todos los paquetes necesarios están incluidos en configuracion/paquetes.tex."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // Missing $ inserted
    if line.contains("! Missing $ inserted") {
        return Some(UserError {
            message: "Símbolo matemático usado fuera de un entorno de ecuación.".to_string(),
            suggestion: Some(
                "Envuelve el contenido matemático en un bloque de ecuación o usa un bloque RawLatex con confirmación."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // Runaway argument
    if line.contains("Runaway argument") {
        return Some(UserError {
            message: "Argumento LaTeX sin cerrar (falta una llave '}'.".to_string(),
            suggestion: Some(
                "Revisa que todos los comandos LaTeX tienen sus llaves correctamente cerradas."
                    .to_string(),
            ),
            raw_log_line: Some(line.to_string()),
        });
    }

    // biber/bibliography errors
    if line.contains("Please (re)run Biber") || line.contains("biber") && line.contains("error") {
        return Some(UserError {
            message: "Error en la bibliografía (biber).".to_string(),
            suggestion: Some(
                "Verifica que el archivo .bib existe en content/bibliography/ y tiene entradas válidas."
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
        assert!(errors[0].message.contains("imagen.png") || errors[0].message.contains("no encontrado"));
        assert!(errors[0].suggestion.is_some());
    }

    #[test]
    fn traduce_undefined_control_sequence() {
        let log = "! Undefined control sequence.";
        let errors = translate_log(log);
        assert!(!errors.is_empty());
        assert!(errors[0].suggestion.is_some());
    }

    #[test]
    fn log_limpio_sin_errores() {
        let log = "This is XeTeX, Version 3.141592\nOutput written on main.pdf (42 pages).";
        let errors = translate_log(log);
        assert!(errors.is_empty());
    }
}
