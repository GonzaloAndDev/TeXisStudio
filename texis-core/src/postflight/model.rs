use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PdfIssueSeverity {
    Error,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfIssue {
    pub severity: PdfIssueSeverity,
    pub code: String,
    pub message: String,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PdfMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub creation_date: Option<String>,
    pub pages: Option<u32>,
    pub pdf_version: Option<String>,
    pub file_size_bytes: Option<u64>,
    pub page_size: Option<String>,
    pub is_encrypted: bool,
    pub is_linearized: bool,
    pub has_javascript: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FontCheck {
    pub name: String,
    pub font_type: String,
    pub embedded: bool,
    pub subset: bool,
}

/// Resultado del chequeo PDF/A vía veraPDF.
/// `None` si veraPDF no está disponible.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfaCheck {
    /// Si el PDF es conforme al estándar PDF/A detectado.
    pub compliant: bool,
    /// Variante detectada: "PDFA_1_B", "PDFA_2_B", etc. Null si el PDF no declara ser PDF/A.
    pub flavour: Option<String>,
    /// Línea de resumen de la salida de veraPDF.
    pub summary: String,
    pub verapdf_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PdfPostflightResult {
    pub pdf_exists: bool,
    pub metadata: PdfMetadata,
    pub fonts: Vec<FontCheck>,
    pub all_fonts_embedded: bool,
    pub non_embedded_fonts: Vec<String>,
    pub issues: Vec<PdfIssue>,
    /// true si no hay issues de severidad Error
    pub passed: bool,
    pub tools_available: Vec<String>,
    pub tools_missing: Vec<String>,
    /// Resultado de verificación PDF/A. None si veraPDF no está instalado.
    pub pdfa: Option<PdfaCheck>,
}

impl PdfPostflightResult {
    pub fn pdf_not_found() -> Self {
        Self {
            pdf_exists: false,
            metadata: PdfMetadata::default(),
            fonts: vec![],
            all_fonts_embedded: false,
            non_embedded_fonts: vec![],
            issues: vec![PdfIssue {
                severity: PdfIssueSeverity::Error,
                code: "PF_NO_PDF".to_string(),
                message: "No se encontró el PDF compilado en build/main.pdf.".to_string(),
                suggestion: Some(
                    "Compila el proyecto antes de ejecutar el postflight.".to_string(),
                ),
            }],
            passed: false,
            tools_available: vec![],
            tools_missing: vec![],
            pdfa: None,
        }
    }
}
