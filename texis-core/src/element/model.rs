use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Element {
    pub schema_version: String,
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    /// Placements donde puede usarse: "front_matter", "body", "back_matter", "appendix"
    pub placement: Vec<String>,
    /// Plantilla MiniJinja para el contenido LaTeX del elemento.
    pub template: Option<String>,
}
