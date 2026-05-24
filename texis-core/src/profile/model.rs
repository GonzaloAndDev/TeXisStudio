use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub schema_version: String,
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Nivel académico / tipo de documento (tesis, tesina, artículo…)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// Autor del perfil
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    /// Versión del perfil (semver)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Licencia del perfil
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
    pub document_class: ProfileDocumentClass,
    pub latex_engine: String,
    pub compiler: String,
    pub bibliography_backend: String,
    pub bibliography_style: String,
    pub packages: Vec<String>,
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
}
