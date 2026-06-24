//! Capacidades declaradas por backends y exigidas por perfiles (§8.3, §9.1).
//!
//! Un backend declara qué puede hacer; si una solicitud no puede resolverse
//! fielmente se explica el límite en vez de simular que LaTeX puede hacerlo.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// Capacidad nombrada (clave estable). Se modela como cadena para permitir que
/// perfiles y plugins declaren capacidades sin recompilar el núcleo.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Capability(String);

impl Capability {
    pub fn new(name: impl Into<String>) -> Self {
        Self(name.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Conjunto de capacidades. `BTreeSet` para orden determinista.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct CapabilitySet {
    items: BTreeSet<Capability>,
}

impl CapabilitySet {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, cap: Capability) {
        self.items.insert(cap);
    }

    pub fn contains(&self, cap: &Capability) -> bool {
        self.items.contains(cap)
    }

    /// Capacidades requeridas que este conjunto NO satisface.
    pub fn missing_from(&self, required: &CapabilitySet) -> Vec<Capability> {
        required
            .items
            .iter()
            .filter(|c| !self.items.contains(c))
            .cloned()
            .collect()
    }

    pub fn iter(&self) -> impl Iterator<Item = &Capability> {
        self.items.iter()
    }
}

impl FromIterator<Capability> for CapabilitySet {
    fn from_iter<T: IntoIterator<Item = Capability>>(iter: T) -> Self {
        Self {
            items: iter.into_iter().collect(),
        }
    }
}
