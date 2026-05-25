use super::model::{FontCheck, PdfaCheck, PdfIssue, PdfIssueSeverity, PdfMetadata, PdfPostflightResult};
use std::path::Path;
use std::process::Command;

pub struct PdfChecker;

impl PdfChecker {
    pub fn check(pdf_path: &Path) -> PdfPostflightResult {
        if !pdf_path.exists() {
            return PdfPostflightResult::pdf_not_found();
        }

        let mut tools_available = vec![];
        let mut tools_missing = vec![];
        let mut issues: Vec<PdfIssue> = vec![];

        // ── pdfinfo ──────────────────────────────────────────────
        let metadata = if tool_available("pdfinfo") {
            tools_available.push("pdfinfo".to_string());
            run_pdfinfo(pdf_path, &mut issues)
        } else {
            tools_missing.push("pdfinfo".to_string());
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Warning,
                code: "PF_MISSING_PDFINFO".to_string(),
                message: "pdfinfo no está disponible — no se pueden verificar metadatos del PDF.".to_string(),
                suggestion: Some("Instala poppler-utils (Linux/macOS) o asegúrate de que TeX Live lo incluya.".to_string()),
            });
            let mut meta = PdfMetadata::default();
            meta.file_size_bytes = std::fs::metadata(pdf_path).ok().map(|m| m.len());
            meta
        };

        // ── pdffonts ─────────────────────────────────────────────
        let (fonts, all_embedded, non_embedded) = if tool_available("pdffonts") {
            tools_available.push("pdffonts".to_string());
            run_pdffonts(pdf_path, &mut issues)
        } else {
            tools_missing.push("pdffonts".to_string());
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Warning,
                code: "PF_MISSING_PDFFONTS".to_string(),
                message: "pdffonts no está disponible — no se puede verificar la incrustación de fuentes.".to_string(),
                suggestion: Some("Instala poppler-utils.".to_string()),
            });
            (vec![], true, vec![])
        };

        // ── Reglas sobre metadatos ────────────────────────────────
        if metadata.is_encrypted {
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Error,
                code: "PF_ENCRYPTED".to_string(),
                message: "El PDF está cifrado o protegido con contraseña.".to_string(),
                suggestion: Some("La mayoría de sistemas de entrega institucional rechazan PDFs cifrados. Recompila sin cifrado.".to_string()),
            });
        }

        if metadata.pages == Some(0) || metadata.pages.is_none() && tools_available.contains(&"pdfinfo".to_string()) {
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Error,
                code: "PF_NO_PAGES".to_string(),
                message: "El PDF no tiene páginas o no se pudo leer el número de páginas.".to_string(),
                suggestion: Some("El archivo puede estar corrupto. Recompila desde cero.".to_string()),
            });
        }

        if metadata.title.as_deref().map(|t| t.trim().is_empty()).unwrap_or(true)
            && tools_available.contains(&"pdfinfo".to_string())
        {
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Warning,
                code: "PF_NO_TITLE_METADATA".to_string(),
                message: "El PDF no tiene título en sus metadatos.".to_string(),
                suggestion: Some("Asegúrate de que el perfil genere los metadatos PDF (\\hypersetup{pdftitle=...}).".to_string()),
            });
        }

        if metadata.author.as_deref().map(|a| a.trim().is_empty()).unwrap_or(true)
            && tools_available.contains(&"pdfinfo".to_string())
        {
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Warning,
                code: "PF_NO_AUTHOR_METADATA".to_string(),
                message: "El PDF no tiene autor en sus metadatos.".to_string(),
                suggestion: Some("Asegúrate de que el perfil genere los metadatos PDF (\\hypersetup{pdfauthor=...}).".to_string()),
            });
        }

        if metadata.has_javascript {
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Warning,
                code: "PF_HAS_JAVASCRIPT".to_string(),
                message: "El PDF contiene JavaScript incrustado.".to_string(),
                suggestion: Some("Algunas instituciones rechazan PDFs con JavaScript. Verifica que sea necesario.".to_string()),
            });
        }

        // ── veraPDF (PDF/A) ─────────────────────────────────────
        let pdfa = if tool_available("verapdf") {
            tools_available.push("verapdf".to_string());
            Some(run_verapdf(pdf_path, &mut issues))
        } else {
            None
        };

        let passed = !issues.iter().any(|i| i.severity == PdfIssueSeverity::Error);

        PdfPostflightResult {
            pdf_exists: true,
            metadata,
            fonts,
            all_fonts_embedded: all_embedded,
            non_embedded_fonts: non_embedded,
            issues,
            passed,
            tools_available,
            tools_missing,
            pdfa,
        }
    }
}

fn tool_available(name: &str) -> bool {
    Command::new(name).arg("--version").output().is_ok()
        || Command::new(name).arg("-v").output().is_ok()
}

fn run_pdfinfo(pdf_path: &Path, issues: &mut Vec<PdfIssue>) -> PdfMetadata {
    let mut meta = PdfMetadata::default();

    let out = match Command::new("pdfinfo").arg(pdf_path).output() {
        Ok(o) => o,
        Err(e) => {
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Warning,
                code: "PF_PDFINFO_FAILED".to_string(),
                message: format!("pdfinfo falló: {e}"),
                suggestion: None,
            });
            return meta;
        }
    };

    let stdout = String::from_utf8_lossy(&out.stdout);

    // Extraer metadatos del formato "Key:   Value"
    for line in stdout.lines() {
        if let Some((key, val)) = line.split_once(':') {
            let k = key.trim();
            let v = val.trim().to_string();
            match k {
                "Title"       => meta.title = if v.is_empty() { None } else { Some(v) },
                "Author"      => meta.author = if v.is_empty() { None } else { Some(v) },
                "Creator"     => meta.creator = if v.is_empty() { None } else { Some(v) },
                "Producer"    => meta.producer = if v.is_empty() { None } else { Some(v) },
                "CreationDate"=> meta.creation_date = if v.is_empty() { None } else { Some(v) },
                "Pages"       => meta.pages = v.parse().ok(),
                "PDF version" => meta.pdf_version = if v.is_empty() { None } else { Some(v) },
                "Page size"   => meta.page_size = if v.is_empty() { None } else { Some(v) },
                "Encrypted"   => meta.is_encrypted = v.to_lowercase().starts_with("yes"),
                "Optimized" | "Linearized" => {
                    meta.is_linearized = v.to_lowercase().starts_with("yes");
                }
                "JavaScript"  => meta.has_javascript = v.to_lowercase().starts_with("yes"),
                "File size"   => {
                    // "12345 bytes"
                    if let Some(num) = v.split_whitespace().next() {
                        meta.file_size_bytes = num.parse().ok();
                    }
                }
                _ => {}
            }
        }
    }

    // Fallback file size desde el sistema si pdfinfo no lo reportó
    if meta.file_size_bytes.is_none() {
        meta.file_size_bytes = std::fs::metadata(pdf_path).ok().map(|m| m.len());
    }

    meta
}

fn run_pdffonts(
    pdf_path: &Path,
    issues: &mut Vec<PdfIssue>,
) -> (Vec<FontCheck>, bool, Vec<String>) {
    let out = match Command::new("pdffonts").arg(pdf_path).output() {
        Ok(o) => o,
        Err(e) => {
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Warning,
                code: "PF_PDFFONTS_FAILED".to_string(),
                message: format!("pdffonts falló: {e}"),
                suggestion: None,
            });
            return (vec![], true, vec![]);
        }
    };

    let stdout = String::from_utf8_lossy(&out.stdout);
    let mut fonts = vec![];
    let mut non_embedded = vec![];

    // pdffonts output:
    // name                  type       encoding   emb sub uni  object ID
    // -------------------- ---------- ---------- --- --- --- ---------
    // <data lines>
    for line in stdout.lines().skip(2) {
        if line.trim().is_empty() {
            continue;
        }
        // Split on whitespace — pdffonts columns are space-separated
        // Columns: name, type, encoding, emb, sub, uni, object, ID
        // Name can contain spaces but is always first; emb/sub/uni are "yes"/"no"
        // We detect emb/sub/uni by looking from the right side of the line.
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 6 {
            continue;
        }

        // emb, sub, uni are 3 fields before "object ID" (last 2 fields)
        // So: parts[len-5] = emb, parts[len-4] = sub, parts[len-3] = uni
        let n = parts.len();
        if n < 5 {
            continue;
        }

        let emb_str = parts[n - 5];
        let sub_str = parts[n - 4];
        let embedded = emb_str == "yes";
        let subset   = sub_str == "yes";

        // Name is everything before the type field. Type is the 2nd-to-last group
        // before encoding. This is complex; simpler heuristic: name ends before
        // "Type 1" | "TrueType" | "CIDFont" etc.
        // Use all parts except the last 6 (type enc emb sub uni obj id)
        let name_parts: Vec<&str> = parts[..n.saturating_sub(6)].to_vec();
        let name = if name_parts.is_empty() {
            "[none]".to_string()
        } else {
            name_parts.join(" ")
        };

        let font_type = if n >= 7 {
            parts[n - 6].to_string()
        } else {
            "unknown".to_string()
        };

        if !embedded && name != "[none]" {
            non_embedded.push(name.clone());
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Error,
                code: "PF_FONT_NOT_EMBEDDED".to_string(),
                message: format!("Fuente no incrustada: {name}"),
                suggestion: Some(
                    "Las instituciones de élite exigen fuentes incrustadas. \
                     Agrega \\usepackage{fontspec} con XeLaTeX o usa \\pdfmapfile{} con pdflatex."
                        .to_string(),
                ),
            });
        }

        fonts.push(FontCheck { name, font_type, embedded, subset });
    }

    let all_embedded = non_embedded.is_empty();
    (fonts, all_embedded, non_embedded)
}

fn run_verapdf(pdf_path: &Path, issues: &mut Vec<PdfIssue>) -> PdfaCheck {
    // Obtener la versión de veraPDF para el informe
    let verapdf_version = Command::new("verapdf")
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.lines().next().unwrap_or("").trim().to_string())
        .filter(|s| !s.is_empty());

    // Ejecutar veraPDF en modo auto-detección de flavour, salida texto plano
    let out = match Command::new("verapdf")
        .args(["--format", "text"])
        .arg(pdf_path)
        .output()
    {
        Ok(o) => o,
        Err(e) => {
            issues.push(PdfIssue {
                severity: PdfIssueSeverity::Warning,
                code: "PF_VERAPDF_FAILED".to_string(),
                message: format!("veraPDF no pudo ejecutarse: {e}"),
                suggestion: None,
            });
            return PdfaCheck {
                compliant: false,
                flavour: None,
                summary: e.to_string(),
                verapdf_version,
            };
        }
    };

    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();

    // Detectar si el PDF no tiene metadatos PDF/A (veraPDF no puede verificar)
    let no_pdfa_metadata = stdout.trim().is_empty()
        || stderr.to_lowercase().contains("no pdfa")
        || stderr.to_lowercase().contains("flavour")
        || (!stdout.to_uppercase().contains("PASS") && !stdout.to_uppercase().contains("FAIL"));

    if no_pdfa_metadata {
        // No es PDF/A — informativo, no un error
        issues.push(PdfIssue {
            severity: PdfIssueSeverity::Info,
            code: "PF_NOT_PDFA".to_string(),
            message: "El PDF no está en formato PDF/A. Algunos repositorios institucionales lo requieren.".to_string(),
            suggestion: Some(
                "Para generar PDF/A-2b con XeLaTeX: \\usepackage[a-2b]{pdfx}. \
                 Consulta las instrucciones de entrega de tu institución."
                    .to_string(),
            ),
        });
        return PdfaCheck {
            compliant: false,
            flavour: None,
            summary: "El PDF no declara conformidad PDF/A (sin metadatos XMP).".to_string(),
            verapdf_version,
        };
    }

    // Extraer la línea de resumen (contiene PASS/FAIL y el flavour)
    let summary_line = stdout
        .lines()
        .find(|l| l.to_uppercase().contains("PASS") || l.to_uppercase().contains("FAIL"))
        .unwrap_or(stdout.lines().next().unwrap_or(""))
        .trim()
        .to_string();

    let compliant = summary_line.to_uppercase().contains("PASS");

    // Extraer flavour: buscar patrón "PDFA_X_Y" o "PDF/A-X"
    let flavour = extract_pdfa_flavour(&stdout).or_else(|| extract_pdfa_flavour(&summary_line));

    if !compliant {
        issues.push(PdfIssue {
            severity: PdfIssueSeverity::Warning,
            code: "PF_PDFA_NON_COMPLIANT".to_string(),
            message: format!(
                "El PDF declara ser PDF/A pero no es conforme{}.",
                flavour.as_deref().map(|f| format!(" ({})", f)).unwrap_or_default()
            ),
            suggestion: Some(
                "Verifica que todas las fuentes estén incrustadas, que las imágenes no usen \
                 transparencias prohibidas y que el paquete pdfx esté correctamente configurado."
                    .to_string(),
            ),
        });
    }

    PdfaCheck { compliant, flavour, summary: summary_line, verapdf_version }
}

/// Extrae el identificador de flavour PDF/A de una cadena de texto.
/// Reconoce: "PDFA_1_B", "PDFA_2_B", "PDFA_3_B", "PDF/A-1b", etc.
fn extract_pdfa_flavour(s: &str) -> Option<String> {
    let upper = s.to_uppercase();
    // Buscar patrón "PDFA_X_Y"
    if let Some(idx) = upper.find("PDFA_") {
        let rest = &upper[idx..];
        let end = rest.find(|c: char| !c.is_ascii_alphanumeric() && c != '_').unwrap_or(rest.len());
        let candidate = &rest[..end];
        if candidate.len() >= 7 {
            return Some(candidate.to_string());
        }
    }
    // Buscar patrón "PDF/A-Xb" o "PDF/A-X"
    if let Some(idx) = upper.find("PDF/A-") {
        let rest = &upper[idx..];
        let end = rest.find(|c: char| c == ' ' || c == '\n' || c == '\t' || c == ',').unwrap_or(rest.len());
        let candidate = &rest[..end.min(10)];
        if candidate.len() >= 6 {
            return Some(candidate.replace('/', "_").replace('-', "_").to_string());
        }
    }
    None
}
