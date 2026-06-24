//! Política de precedencia de configuración (§5.3).
//!
//! ```text
//! invariantes del núcleo
//!     > requisitos obligatorios del perfil
//!     > configuración explícita del proyecto
//!     > recomendaciones del perfil
//!     > defaults del tipo documental
//!     > defaults seguros del núcleo
//! ```
//!
//! El resolutor recoge candidatos de distintas fuentes y elige el de mayor
//! precedencia, registrando provenance (valor final, fuente, regla, mutabilidad).

use texis_document_contracts::provenance::{ProvenanceEntry, Resolved, ValueSource};

/// Un valor candidato aportado por una fuente concreta.
pub struct Candidate<T> {
    pub value: T,
    pub source: ValueSource,
    /// Regla estable que justifica el candidato (no texto traducido).
    pub rule: String,
    pub evidence: Option<String>,
}

impl<T> Candidate<T> {
    pub fn new(value: T, source: ValueSource, rule: impl Into<String>) -> Self {
        Self {
            value,
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

/// Resuelve un campo eligiendo el candidato de mayor precedencia.
///
/// `ValueSource` está ordenado de mayor a menor precedencia, por lo que el
/// candidato ganador es el de `source` mínimo. Devuelve `None` si no hay
/// candidatos (el llamador decide si eso es un diagnóstico).
pub fn resolve_field<T>(field: &str, candidates: Vec<Candidate<T>>) -> Option<Resolved<T>> {
    let winner = candidates
        .into_iter()
        .min_by(|a, b| a.source.cmp(&b.source))?;

    let mut entry = ProvenanceEntry::new(field, winner.source, winner.rule);
    if let Some(ev) = winner.evidence {
        entry = entry.with_evidence(ev);
    }
    Some(Resolved::new(winner.value, entry))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_requirement_beats_project_explicit() {
        let resolved = resolve_field(
            "page.paper",
            vec![
                Candidate::new("letter", ValueSource::ProjectExplicit, "project.typography"),
                Candidate::new("a4", ValueSource::ProfileRequirement, "profile.mandatory_paper"),
            ],
        )
        .unwrap();
        assert_eq!(resolved.value, "a4");
        assert_eq!(resolved.provenance.source, ValueSource::ProfileRequirement);
        assert!(!resolved.provenance.mutable);
    }

    #[test]
    fn project_explicit_beats_recommendation_and_defaults() {
        let resolved = resolve_field(
            "page.paper",
            vec![
                Candidate::new("a4", ValueSource::CoreSafeDefault, "core.default"),
                Candidate::new("letter", ValueSource::ProjectExplicit, "project.typography"),
                Candidate::new("a4", ValueSource::ProfileRecommendation, "profile.suggested"),
            ],
        )
        .unwrap();
        assert_eq!(resolved.value, "letter");
        assert!(resolved.provenance.mutable);
    }

    #[test]
    fn empty_candidates_resolve_to_none() {
        let resolved: Option<Resolved<&str>> = resolve_field("x", vec![]);
        assert!(resolved.is_none());
    }
}
