//! Grafo de recursos del documento (§5): assets y requisitos de paquetes.

use serde::{Deserialize, Serialize};
use texis_document_contracts::assets::AssetRef;

/// Requisito de paquete LaTeX declarado por contenido o perfil. El backend lo
/// resuelve; el dominio solo declara la necesidad y sus opciones.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PackageRequirement {
    pub name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<String>,
}

impl PackageRequirement {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            options: Vec::new(),
        }
    }
}

/// Grafo de recursos: todos los assets referenciados y los paquetes requeridos.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceGraph {
    pub assets: Vec<AssetRef>,
    pub packages: Vec<PackageRequirement>,
}

impl ResourceGraph {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_asset(&mut self, asset: AssetRef) {
        self.assets.push(asset);
    }

    pub fn require_package(&mut self, req: PackageRequirement) {
        if !self.packages.iter().any(|p| p.name == req.name) {
            self.packages.push(req);
        }
    }
}
