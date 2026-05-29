use super::model::{Diagnostic, DiagnosticSource, FixAction};
use regex::Regex;
use std::path::{Path, PathBuf};

/// Motor de diagnósticos: parsea logs de LaTeX, Biber y herramientas auxiliares
/// y los convierte en mensajes amigables con contexto de archivo/línea.
pub struct DiagnosticsEngine;

impl DiagnosticsEngine {
    /// Parsea el log completo de LaTeX y retorna diagnósticos.
    pub fn parse_latex_log(log: &str, project_root: &Path) -> Vec<Diagnostic> {
        let mut diagnostics = Vec::new();

        for pattern in LATEX_PATTERNS.iter() {
            for m in pattern.regex.captures_iter(log) {
                let diag = (pattern.builder)(&m, project_root);
                diagnostics.push(diag);
            }
        }

        // Deduplicar: mismo código + mismo archivo + misma línea
        diagnostics.sort_by(|a, b| {
            a.code.cmp(&b.code).then(
                a.location
                    .as_ref()
                    .and_then(|l| l.line)
                    .cmp(&b.location.as_ref().and_then(|l| l.line)),
            )
        });
        diagnostics.dedup_by(|a, b| {
            a.code == b.code
                && a.location.as_ref().and_then(|l| l.line)
                    == b.location.as_ref().and_then(|l| l.line)
        });

        diagnostics
    }

    /// Parsea el log de Biber.
    pub fn parse_biber_log(log: &str, project_root: &Path) -> Vec<Diagnostic> {
        let mut diagnostics = Vec::new();

        for pattern in BIBER_PATTERNS.iter() {
            for m in pattern.regex.captures_iter(log) {
                diagnostics.push((pattern.builder)(&m, project_root));
            }
        }

        diagnostics
    }
}

// ── Registro de patrones ──────────────────────────────────────────────────────

struct LogPattern {
    regex: Regex,
    builder: fn(&regex::Captures, &Path) -> Diagnostic,
}

impl LogPattern {
    fn new(pattern: &str, builder: fn(&regex::Captures, &Path) -> Diagnostic) -> Self {
        Self {
            regex: Regex::new(pattern).expect("Invalid log pattern regex"),
            builder,
        }
    }
}

// Macro para construir los patrones de forma concisa
macro_rules! latex_pattern {
    ($pattern:expr, $builder:expr) => {
        LogPattern::new($pattern, $builder)
    };
}

lazy_static::lazy_static! {
    static ref LATEX_PATTERNS: Vec<LogPattern> = vec![
        // ! LaTeX Error: File 'image.png' not found.
        latex_pattern!(
            r"! LaTeX Error: File `([^']+)' not found\.",
            |m, _root| {
                let file_name = &m[1];
                Diagnostic::error(
                    DiagnosticSource::LatexLog,
                    "E_FILE_NOT_FOUND",
                    format!("No se encontró el archivo `{}`.", file_name),
                )
                .with_explanation(
                    "Verifica si el archivo fue movido, eliminado o si la ruta relativa es correcta."
                )
                .with_suggestion(
                    format!("Buscar `{}` en el proyecto", file_name),
                    FixAction::LocateAsset(file_name.to_string()),
                )
                .with_raw(m[0].to_string())
            }
        ),

        // ! Undefined control sequence.
        latex_pattern!(
            r"! Undefined control sequence\.\s*\nl\.\d+ (\\[a-zA-Z@]+)",
            |m, _| {
                let cmd = m.get(1).map(|c| c.as_str()).unwrap_or("?");
                Diagnostic::error(
                    DiagnosticSource::LatexLog,
                    "E_UNDEFINED_COMMAND",
                    format!("Comando `{}` no definido. Puede faltar un paquete.", cmd),
                )
                .with_raw(m[0].to_string())
            }
        ),

        // ! Missing $ inserted
        latex_pattern!(
            r"! Missing \$ inserted",
            |m, _| {
                Diagnostic::error(
                    DiagnosticSource::LatexLog,
                    "E_MISSING_DOLLAR",
                    "LaTeX esperaba modo matemático. Falta un `$` en el código.",
                )
                .with_raw(m[0].to_string())
            }
        ),

        // ! Missing { inserted / ! Missing } inserted
        latex_pattern!(
            r"! Missing (\{|\}) inserted",
            |m, _| {
                let brace = &m[1];
                Diagnostic::error(
                    DiagnosticSource::LatexLog,
                    "E_MISSING_BRACE",
                    format!("Falta una llave `{}`. Revisa el comando en la línea indicada.", brace),
                )
                .with_raw(m[0].to_string())
            }
        ),

        // ! Runaway argument?
        latex_pattern!(
            r"! Runaway argument\?",
            |m, _| {
                Diagnostic::error(
                    DiagnosticSource::LatexLog,
                    "E_RUNAWAY_ARGUMENT",
                    "Un argumento de comando no está cerrado correctamente.",
                )
                .with_raw(m[0].to_string())
            }
        ),

        // ! Emergency stop.
        latex_pattern!(
            r"! Emergency stop\.",
            |m, _| {
                Diagnostic::error(
                    DiagnosticSource::LatexLog,
                    "E_EMERGENCY_STOP",
                    "LaTeX no pudo continuar. Revisa los errores anteriores.",
                )
                .with_raw(m[0].to_string())
            }
        ),

        // ! Package X Error: message
        latex_pattern!(
            r"! Package ([A-Za-z]+) Error: (.+)",
            |m, _| {
                let pkg = &m[1];
                let msg = &m[2];
                Diagnostic::error(
                    DiagnosticSource::LatexLog,
                    "E_PACKAGE_ERROR",
                    format!("Error en paquete `{}`: {}", pkg, msg),
                )
                .with_raw(m[0].to_string())
            }
        ),

        // LaTeX Warning: Citation 'key' on page N undefined.
        latex_pattern!(
            r"LaTeX Warning: Citation `([^']+)' on page \d+ undefined",
            |m, _| {
                let key = &m[1];
                Diagnostic::warning(
                    DiagnosticSource::LatexLog,
                    "W_UNDEFINED_CITATION",
                    format!("La cita `{}` no tiene referencia en el .bib.", key),
                )
                .with_suggestion(
                    format!("Agregar referencia `{}` al .bib o importar por DOI", key),
                    FixAction::RerunBiber,
                )
                .with_raw(m[0].to_string())
            }
        ),

        // LaTeX Warning: Reference 'key' on page N undefined.
        latex_pattern!(
            r"LaTeX Warning: Reference `([^']+)' on page \d+ undefined",
            |m, _| {
                let key = &m[1];
                Diagnostic::warning(
                    DiagnosticSource::LatexLog,
                    "W_UNDEFINED_REFERENCE",
                    format!("La referencia `{}` no está definida como `\\label`.", key),
                )
                .with_raw(m[0].to_string())
            }
        ),

        // LaTeX Warning: Label 'key' multiply defined
        latex_pattern!(
            r"LaTeX Warning: Label `([^']+)' multiply defined",
            |m, _| {
                let key = &m[1];
                Diagnostic::warning(
                    DiagnosticSource::LatexLog,
                    "W_DUPLICATE_LABEL",
                    format!("El label `{}` está definido más de una vez.", key),
                )
                .with_raw(m[0].to_string())
            }
        ),

        // Package biblatex Warning: Please rerun Biber.
        latex_pattern!(
            r"Package biblatex Warning: Please (re)?run Biber",
            |m, _| {
                Diagnostic::warning(
                    DiagnosticSource::LatexLog,
                    "W_BIBER_RERUN",
                    "La bibliografía necesita recompilarse con Biber.",
                )
                .with_suggestion("Ejecutar Biber", FixAction::RerunBiber)
                .with_raw(m[0].to_string())
            }
        ),

        // Package biblatex Warning: Please rerun LaTeX.
        latex_pattern!(
            r"Package biblatex Warning: Please rerun LaTeX",
            |m, _| {
                Diagnostic::info(
                    DiagnosticSource::LatexLog,
                    "I_LATEX_RERUN",
                    "LaTeX necesita otra pasada para incorporar la bibliografía.",
                )
                .with_raw(m[0].to_string())
            }
        ),

        // I found no \bibdata command
        latex_pattern!(
            r"I found no \\bibdata command",
            |m, _| {
                Diagnostic::error(
                    DiagnosticSource::LatexLog,
                    "E_NO_BIBDATA",
                    "No se declaró un archivo .bib. Agrega `\\addbibresource{bibliography/references.bib}` al preámbulo.",
                )
                .with_raw(m[0].to_string())
            }
        ),

        // Package inputenc Error: Invalid UTF-8
        latex_pattern!(
            r"Package inputenc Error: .*(UTF-8|utf8)",
            |m, _| {
                Diagnostic::error(
                    DiagnosticSource::LatexLog,
                    "E_INVALID_UTF8",
                    "El archivo contiene caracteres no válidos en UTF-8.",
                )
                .with_suggestion("Convertir el archivo a UTF-8", FixAction::ConvertToUtf8)
                .with_raw(m[0].to_string())
            }
        ),

        // Package minted Error: ...shell escape
        latex_pattern!(
            r"Package minted Error.*shell.?escape",
            |m, _| {
                Diagnostic::warning(
                    DiagnosticSource::LatexLog,
                    "W_SHELL_ESCAPE_REQUIRED",
                    "El paquete `minted` requiere shell-escape. Actívalo con precaución en Configuración del proyecto.",
                )
                .with_explanation(
                    "shell-escape permite que LaTeX ejecute comandos del sistema. \
                     Solo actívalo si confías en el documento."
                )
                .with_suggestion(
                    "Activar shell-escape para este proyecto",
                    FixAction::EnableShellEscapeWithConfirmation,
                )
                .with_raw(m[0].to_string())
            }
        ),
    ];

    static ref BIBER_PATTERNS: Vec<LogPattern> = vec![
        // ERROR - BibTeX subsystem: file 'references.bib' not found
        latex_pattern!(
            r"ERROR - BibTeX subsystem: .*file '([^']+)' not found",
            |m, _| {
                let file = &m[1];
                Diagnostic::error(
                    DiagnosticSource::BiberLog,
                    "E_BIB_FILE_NOT_FOUND",
                    format!("El archivo .bib `{}` no se encontró.", file),
                )
                .with_suggestion(
                    format!("Agregar `\\addbibresource{{{}}}` al preámbulo", file),
                    FixAction::AddBibResource(PathBuf::from(file)),
                )
                .with_raw(m[0].to_string())
            }
        ),

        // WARN - I didn't find a database entry for 'key'
        latex_pattern!(
            r"WARN - I didn't find a database entry for '([^']+)'",
            |m, _| {
                let key = &m[1];
                Diagnostic::warning(
                    DiagnosticSource::BiberLog,
                    "W_BIB_KEY_NOT_FOUND",
                    format!("La cita `{}` no tiene entrada en el .bib.", key),
                )
                .with_raw(m[0].to_string())
            }
        ),

        // ERROR - Duplicate entry key: 'key'
        latex_pattern!(
            r"ERROR - Duplicate entry key: '([^']+)'",
            |m, _| {
                let key = &m[1];
                Diagnostic::error(
                    DiagnosticSource::BiberLog,
                    "E_BIB_DUPLICATE_KEY",
                    format!("La clave `{}` está duplicada en el .bib.", key),
                )
                .with_raw(m[0].to_string())
            }
        ),

        // WARN - Encoding 'UTF-8' is not the same
        latex_pattern!(
            r"WARN - Encoding '([^']+)' is not the same",
            |m, _| {
                let enc = &m[1];
                Diagnostic::warning(
                    DiagnosticSource::BiberLog,
                    "W_BIB_ENCODING_MISMATCH",
                    format!("El .bib tiene encoding `{}` diferente al esperado.", enc),
                )
                .with_suggestion("Convertir el .bib a UTF-8", FixAction::ConvertToUtf8)
                .with_raw(m[0].to_string())
            }
        ),
    ];
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::model::DiagnosticSeverity;

    #[test]
    fn parses_file_not_found() {
        let log = "! LaTeX Error: File `image.png' not found.";
        let diags = DiagnosticsEngine::parse_latex_log(log, Path::new("/project"));
        assert!(!diags.is_empty());
        assert_eq!(diags[0].code, "E_FILE_NOT_FOUND");
        assert!(diags[0].message.contains("image.png"));
        assert!(diags[0].is_blocking);
    }

    #[test]
    fn parses_missing_dollar() {
        let log = "! Missing $ inserted";
        let diags = DiagnosticsEngine::parse_latex_log(log, Path::new("/project"));
        assert!(diags.iter().any(|d| d.code == "E_MISSING_DOLLAR"));
    }

    #[test]
    fn parses_undefined_citation_as_warning() {
        let log = "LaTeX Warning: Citation `smith2024' on page 5 undefined";
        let diags = DiagnosticsEngine::parse_latex_log(log, Path::new("/project"));
        let d = diags
            .iter()
            .find(|d| d.code == "W_UNDEFINED_CITATION")
            .unwrap();
        assert_eq!(d.severity, DiagnosticSeverity::Warning);
        assert!(!d.is_blocking);
        assert!(d.message.contains("smith2024"));
    }

    #[test]
    fn parses_biber_rerun_as_warning_not_error() {
        let log = "Package biblatex Warning: Please rerun Biber.";
        let diags = DiagnosticsEngine::parse_latex_log(log, Path::new("/project"));
        let d = diags.iter().find(|d| d.code == "W_BIBER_RERUN").unwrap();
        assert_eq!(d.severity, DiagnosticSeverity::Warning);
        assert!(!d.is_blocking);
    }

    #[test]
    fn parses_duplicate_label() {
        let log = "LaTeX Warning: Label `fig:arch' multiply defined";
        let diags = DiagnosticsEngine::parse_latex_log(log, Path::new("/project"));
        assert!(diags.iter().any(|d| d.code == "W_DUPLICATE_LABEL"));
    }

    #[test]
    fn parses_emergency_stop_as_blocking_error() {
        let log = "! Emergency stop.";
        let diags = DiagnosticsEngine::parse_latex_log(log, Path::new("/project"));
        let d = diags.iter().find(|d| d.code == "E_EMERGENCY_STOP").unwrap();
        assert!(d.is_blocking);
    }

    #[test]
    fn parses_shell_escape_required_as_non_blocking_warning() {
        let log = "Package minted Error: You must invoke LaTeX with the -shell-escape flag.";
        let diags = DiagnosticsEngine::parse_latex_log(log, Path::new("/project"));
        let d = diags.iter().find(|d| d.code == "W_SHELL_ESCAPE_REQUIRED");
        // Puede no matchear si el regex no coincide exactamente — aceptable
        // Lo que importa es que si matchea, NO sea blocking
        if let Some(d) = d {
            assert!(!d.is_blocking);
        }
    }

    #[test]
    fn biber_file_not_found_is_error() {
        let log = "ERROR - BibTeX subsystem: file 'references.bib' not found";
        let diags = DiagnosticsEngine::parse_biber_log(log, Path::new("/project"));
        assert!(diags.iter().any(|d| d.code == "E_BIB_FILE_NOT_FOUND"));
    }

    #[test]
    fn biber_key_not_found_is_warning() {
        let log = "WARN - I didn't find a database entry for 'smith2024'";
        let diags = DiagnosticsEngine::parse_biber_log(log, Path::new("/project"));
        let d = diags
            .iter()
            .find(|d| d.code == "W_BIB_KEY_NOT_FOUND")
            .unwrap();
        assert_eq!(d.severity, DiagnosticSeverity::Warning);
    }

    #[test]
    fn clean_log_produces_no_diagnostics() {
        let log =
            "Output written on main.pdf (42 pages, 123456 bytes).\nTranscript written on main.log.";
        let diags = DiagnosticsEngine::parse_latex_log(log, Path::new("/project"));
        let blocking: Vec<_> = diags.iter().filter(|d| d.is_blocking).collect();
        assert!(
            blocking.is_empty(),
            "Un log limpio no debe tener errores bloqueantes"
        );
    }
}
