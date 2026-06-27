use super::model::{PdfIssue, PdfIssueSeverity};
use std::path::Path;
use std::process::Command;

/// Resultado ligero del QA visual/estructural. Usa Poppler cuando está
/// disponible; si faltan herramientas, informa sin bloquear por sí mismo.
#[derive(Debug, Clone)]
pub struct PdfVisualQaResult {
    pub issues: Vec<PdfIssue>,
    pub pages_checked: usize,
    pub tools_available: Vec<String>,
    pub tools_missing: Vec<String>,
}

pub fn check_pdf_visual_quality(pdf_path: &Path) -> PdfVisualQaResult {
    let mut result = PdfVisualQaResult {
        issues: Vec::new(),
        pages_checked: 0,
        tools_available: Vec::new(),
        tools_missing: Vec::new(),
    };

    if !pdf_path.exists() {
        result.issues.push(PdfIssue {
            severity: PdfIssueSeverity::Error,
            code: "PF_VISUAL_NO_PDF".to_string(),
            message: "No se pudo ejecutar QA visual: build/main.pdf no existe.".to_string(),
            suggestion: Some(
                "Compila el proyecto antes de validar portada, índices y páginas renderizadas."
                    .to_string(),
            ),
        });
        return result;
    }

    if tool_available("pdftotext") {
        result.tools_available.push("pdftotext".to_string());
        check_sparse_pages(pdf_path, &mut result);
    } else {
        result.tools_missing.push("pdftotext".to_string());
        result.issues.push(PdfIssue {
            severity: PdfIssueSeverity::Info,
            code: "PF_VISUAL_MISSING_PDFTOTEXT".to_string(),
            message: "QA visual parcial: pdftotext no está disponible.".to_string(),
            suggestion: Some(
                "Instala Poppler para detectar páginas casi vacías e índices sin contenido."
                    .to_string(),
            ),
        });
    }

    if tool_available("pdftoppm") {
        result.tools_available.push("pdftoppm".to_string());
        check_first_page_renders(pdf_path, &mut result);
    } else {
        result.tools_missing.push("pdftoppm".to_string());
        result.issues.push(PdfIssue {
            severity: PdfIssueSeverity::Info,
            code: "PF_VISUAL_MISSING_PDFTOPPM".to_string(),
            message: "QA visual parcial: pdftoppm no está disponible para renderizar la portada."
                .to_string(),
            suggestion: Some(
                "Instala Poppler para verificar que la portada renderice como imagen no vacía."
                    .to_string(),
            ),
        });
    }

    result
}

fn tool_available(name: &str) -> bool {
    Command::new(name).arg("--version").output().is_ok()
        || Command::new(name).arg("-v").output().is_ok()
}

fn check_sparse_pages(pdf_path: &Path, result: &mut PdfVisualQaResult) {
    let out = match Command::new("pdftotext")
        .args(["-layout", "-enc", "UTF-8"])
        .arg(pdf_path)
        .arg("-")
        .output()
    {
        Ok(out) if out.status.success() => out,
        Ok(_) | Err(_) => {
            result.issues.push(PdfIssue {
                severity: PdfIssueSeverity::Info,
                code: "PF_VISUAL_TEXT_EXTRACTION_FAILED".to_string(),
                message: "No se pudo extraer texto para QA visual.".to_string(),
                suggestion: Some(
                    "Abre el PDF y revisa manualmente portada, índices y páginas finales."
                        .to_string(),
                ),
            });
            return;
        }
    };

    let text = String::from_utf8_lossy(&out.stdout);
    let pages: Vec<&str> = text.split('\u{000c}').collect();
    result.pages_checked = pages.iter().filter(|p| !p.trim().is_empty()).count();

    for (idx, page) in pages.iter().enumerate() {
        let page_no = idx + 1;
        let words = page.split_whitespace().count();
        let trimmed = page.trim();
        if trimmed.is_empty() {
            continue;
        }
        if page_no > 1 && words <= 8 {
            result.issues.push(PdfIssue {
                severity: PdfIssueSeverity::Warning,
                code: "PF_VISUAL_SPARSE_PAGE".to_string(),
                message: format!("La página {page_no} parece casi vacía ({words} palabra(s) extraídas)."),
                suggestion: Some("Revisa saltos de página, portada extendida, índices y secciones que quedaron aisladas.".to_string()),
            });
        }
        let lower = trimmed.to_lowercase();
        let looks_like_empty_index = words <= 12
            && (lower.contains("contents")
                || lower.contains("indice")
                || lower.contains("índice")
                || lower.contains("lista de figuras")
                || lower.contains("lista de tablas"));
        if looks_like_empty_index {
            result.issues.push(PdfIssue {
                severity: PdfIssueSeverity::Warning,
                code: "PF_VISUAL_EMPTY_INDEX".to_string(),
                message: format!("La página {page_no} parece contener un índice o lista sin entradas."),
                suggestion: Some("No emitas listas vacías; agrega contenido listable o desactiva esa lista en el perfil.".to_string()),
            });
        }
    }
}

fn check_first_page_renders(pdf_path: &Path, result: &mut PdfVisualQaResult) {
    let temp_dir = std::env::temp_dir().join(format!("texis-visual-qa-{}", std::process::id()));
    if std::fs::create_dir_all(&temp_dir).is_err() {
        return;
    }
    let prefix = temp_dir.join("page");
    let out = Command::new("pdftoppm")
        .args(["-f", "1", "-l", "1", "-png", "-singlefile"])
        .arg(pdf_path)
        .arg(&prefix)
        .output();

    let png = temp_dir.join("page.png");
    match out {
        Ok(status) if status.status.success() && png.exists() => {
            let size = std::fs::metadata(&png).ok().map(|m| m.len()).unwrap_or(0);
            if size < 1024 {
                result.issues.push(PdfIssue {
                    severity: PdfIssueSeverity::Warning,
                    code: "PF_VISUAL_TINY_RENDER".to_string(),
                    message: "La portada renderizada produjo una imagen sospechosamente pequeña."
                        .to_string(),
                    suggestion: Some(
                        "Abre la portada y verifica que no esté en blanco, cortada o corrupta."
                            .to_string(),
                    ),
                });
            }
        }
        Ok(_) | Err(_) => result.issues.push(PdfIssue {
            severity: PdfIssueSeverity::Info,
            code: "PF_VISUAL_RENDER_FAILED".to_string(),
            message: "No se pudo renderizar la portada con pdftoppm.".to_string(),
            suggestion: Some(
                "Revisa visualmente el PDF antes de entregar o instala Poppler completo."
                    .to_string(),
            ),
        }),
    }

    let _ = std::fs::remove_file(png);
    let _ = std::fs::remove_dir(temp_dir);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_pdf_is_blocking_visual_issue() {
        let result = check_pdf_visual_quality(Path::new("/tmp/texis-no-such-file.pdf"));
        assert!(result.issues.iter().any(|i| i.code == "PF_VISUAL_NO_PDF"));
    }
}
