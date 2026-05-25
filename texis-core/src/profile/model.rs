use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileVerification {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified_by: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub source_urls: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_interval_days: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfilePageLayout {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paper: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub margins: Option<ProfileMargins>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_spacing: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub sections: Vec<ProfileSectionDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileDocumentClass {
    pub name: String,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
