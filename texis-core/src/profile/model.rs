use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub schema_version: String,
    pub id: String,
    pub name: String,
    pub description: Option<String>,
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
