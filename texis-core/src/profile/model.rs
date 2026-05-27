use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ProfileStatus {
    Experimental,
    Draft,
    Reviewed,
    Verified,
    Stale,
    Deprecated,
}

impl Default for ProfileStatus {
    fn default() -> Self {
        ProfileStatus::Experimental
    }
}

/// Metadatos de verificación y revisión de un perfil institucional.
///
/// `reviewed_at` / `reviewed_by` → revisión humana con trazabilidad de fuentes.
/// `verified_at` / `verified_by` → verificación automatizada completa (CI + sample).
/// Los campos legacy `verified_at`/`verified_by` se preservan para compatibilidad con
/// perfiles existentes que los usan para indicar revisión.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
pub struct ProfileVerification {
    /// Fecha de la última verificación automatizada (ISO 8601).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<String>,
    /// Nombre o alias del verificador en la última verificación automatizada.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified_by: Option<String>,
    /// Fecha de la última revisión humana (ISO 8601). Semántica más precisa que verified_at.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewed_at: Option<String>,
    /// Nombre o alias del revisor humano.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviewed_by: Option<String>,
    /// URLs de las fuentes institucionales oficiales consultadas.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub source_urls: Vec<String>,
    /// Intervalo máximo recomendado de re-revisión en días.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_interval_days: Option<u32>,
    /// URL o referencia a la ejecución de CI que respaldó el status 'verified'.
    /// Obligatorio para perfiles con status: verified (ver POL_VERIFIED_NO_CI_EVIDENCE).
    /// Ejemplo: "https://github.com/GonzaloAndDev/TeXisStudio-Profiles/actions/runs/12345"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ci_evidence: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ProfileMargins {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bottom: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ProfilePageLayout {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paper: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub margins: Option<ProfileMargins>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_spacing: Option<f32>,
}

/// Requisitos de formato PDF declarados por el perfil institucional.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct PdfRequirements {
    /// Requisitos de conformidad PDF/A.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pdfa: Option<PdfaRequirement>,
}

/// Requisito de conformidad PDF/A.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct PdfaRequirement {
    /// Si es true, el perfil exige PDF/A en la entrega final.
    pub required: bool,
    /// Nivel de PDF/A requerido, ej. "PDF/A-1b", "PDF/A-2b".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct Profile {
    #[serde(default)]
    pub schema_version: String,
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
    /// Confianza verificada del perfil. Visible en UI para que el estudiante sepa
    /// si el perfil tiene fuente oficial trazada o es experimental.
    #[serde(default)]
    pub status: ProfileStatus,
    /// Metadatos de verificación contra fuentes oficiales.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verification: Option<ProfileVerification>,
    pub document_class: ProfileDocumentClass,
    pub latex_engine: String,
    #[serde(default)]
    pub compiler: String,
    pub bibliography_backend: String,
    pub bibliography_style: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub packages: Vec<String>,
    /// Layout de página declarado por el perfil. Consumido por el generador
    /// cuando page_layout está presente y tiene precedencia sobre los defaults.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page_layout: Option<ProfilePageLayout>,
    /// Aliases de element_id para compatibilidad con perfiles externos.
    /// Ejemplo: { "cover": "title_page", "toc": "table_of_contents" }
    /// El loader aplica estos aliases (más los built-in) al cargar el perfil.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub element_aliases: Option<HashMap<String, String>>,
    /// Límite de palabras del cuerpo principal (excluye preliminares y bibliografía).
    /// Cambridge: 80 000, Oxford DPhil: 100 000. None = sin límite declarado.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_words: Option<u32>,
    /// Límite de palabras del resumen / abstract.
    /// Cambridge y Oxford: 300. None = sin límite declarado.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_abstract_words: Option<u32>,
    pub sections: Vec<ProfileSectionDef>,
    /// Requisitos de formato PDF (PDF/A, etc.). None = sin requisitos declarados.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pdf_requirements: Option<PdfRequirements>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ProfileDocumentClass {
    pub name: String,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ProfileSectionDef {
    pub id: String,
    pub element_id: String,
    pub placement: String,
    pub required: bool,
    pub title: Option<String>,
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub guidance: Option<String>,
}

impl Profile {
    /// Constructor semántico para perfiles nuevos creados desde la UI o la CLI.
    ///
    /// Produce un perfil en estado `Draft` con todos los campos opcionales en `None`/vacíos.
    /// El caller asigna `schema_version` después de la construcción usando
    /// `texis_core::schema::versions::CURRENT_SCHEMA_VERSION`.
    ///
    /// No usar `..Default::default()` — `Profile` no implementa `Default` intencionalmente
    /// para evitar construcciones incompletas con carga semántica institucional.
    pub fn new_draft(
        id: String,
        name: String,
        document_class: ProfileDocumentClass,
        latex_engine: String,
        bibliography_backend: String,
        bibliography_style: String,
    ) -> Self {
        Self {
            schema_version: String::new(),
            id,
            name,
            description: None,
            tags: vec![],
            author: None,
            version: Some("0.1.0".to_string()),
            license: None,
            status: ProfileStatus::Draft,
            verification: None,
            document_class,
            latex_engine,
            compiler: "latexmk".to_string(),
            bibliography_backend,
            bibliography_style,
            packages: vec![],
            page_layout: None,
            element_aliases: None,
            max_words: None,
            max_abstract_words: None,
            sections: vec![],
            pdf_requirements: None,
        }
    }
}
