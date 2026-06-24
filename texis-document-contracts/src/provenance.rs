//! Provenance: de dónde salió cada valor resuelto (§5.1, §5.3).
//!
//! El `DocumentIR` conserva provenance para explicar toda decisión y toda
//! degradación o fallback (Regla del agente §18.10).

use serde::{Deserialize, Serialize};

/// Fuente de un valor resuelto, ordenada por precedencia (§5.3).
/// El orden de la enum refleja la prioridad: variantes superiores ganan.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ValueSource {
    /// Invariante del núcleo: no negociable.
    CoreInvariant,
    /// Requisito obligatorio del perfil institucional.
    ProfileRequirement,
    /// Configuración explícita del proyecto del usuario.
    ProjectExplicit,
    /// Recomendación del perfil (modificable).
    ProfileRecommendation,
    /// Default del tipo documental.
    DocumentTypeDefault,
    /// Default seguro del núcleo.
    CoreSafeDefault,
}

impl ValueSource {
    /// `true` si un valor de esta fuente puede ser modificado por el usuario.
    pub fn is_mutable(self) -> bool {
        !matches!(
            self,
            ValueSource::CoreInvariant | ValueSource::ProfileRequirement
        )
    }
}

/// Registro de cómo se resolvió un valor concreto.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProvenanceEntry {
    /// Ruta lógica del valor, p. ej. "metadata.title" o "cover.institution.name".
    pub field: String,
    pub source: ValueSource,
    /// Regla concreta aplicada (clave estable, no texto traducido).
    pub rule: String,
    /// Si el valor puede modificarse en la UI.
    pub mutable: bool,
    /// Evidencia institucional cuando corresponda (clave de perfil/documento).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence: Option<String>,
}

impl ProvenanceEntry {
    pub fn new(field: impl Into<String>, source: ValueSource, rule: impl Into<String>) -> Self {
        Self {
            field: field.into(),
            mutable: source.is_mutable(),
            source,
            rule: rule.into(),
            evidence: None,
        }
    }

    pub fn with_evidence(mut self, evidence: impl Into<String>) -> Self {
        self.evidence = Some(evidence.into());
        self
    }
}

/// Conjunto de entradas de provenance de una resolución completa.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResolutionProvenance {
    pub entries: Vec<ProvenanceEntry>,
}

impl ResolutionProvenance {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record(&mut self, entry: ProvenanceEntry) {
        self.entries.push(entry);
    }

    pub fn get(&self, field: &str) -> Option<&ProvenanceEntry> {
        self.entries.iter().find(|e| e.field == field)
    }
}

/// Valor resuelto junto a su provenance. Útil para campos individuales que la UI
/// necesita explicar (§5.3: valor final + fuente + regla + mutabilidad).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Resolved<T> {
    pub value: T,
    pub provenance: ProvenanceEntry,
}

impl<T> Resolved<T> {
    pub fn new(value: T, provenance: ProvenanceEntry) -> Self {
        Self { value, provenance }
    }
}
