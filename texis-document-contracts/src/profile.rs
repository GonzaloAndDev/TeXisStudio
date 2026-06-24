//! Contrato de Perfil 2.x (§9.1, Etapa H): política institucional **declarativa**
//! y verificable. Sin aliases ni placements ambiguos.
//!
//! Separa estrictamente requisito oficial, recomendación, ejemplo y preferencia.
//! El YAML, el creador visual y el CI de perfiles viven en el repo
//! `TeXisStudio-Profiles`; aquí está el contrato que el núcleo consume y el
//! conjunto de políticas **auto-comprobables** contra el `DocumentIR`.

use crate::version::ContractVersion;
use serde::{Deserialize, Serialize};

pub const PROFILE_CONTRACT_VERSION: ContractVersion = ContractVersion::new(2, 0);

/// Nivel de confianza de un perfil (§ Provenance y Confianza).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrustLevel {
    /// Exige fuentes oficiales, fixture, revisión, compilación, postflight y CI.
    Verified,
    /// Aportado por la comunidad, sin verificación oficial completa.
    Community,
    /// Borrador/experimental.
    Draft,
}

/// Identidad y vigencia del perfil.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProfileIdentity {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub institution: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    pub trust: TrustLevel,
    /// Fecha de revisión/vigencia (ISO-8601). Requerida para `Verified`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub revised_at: Option<String>,
    /// Evidencia oficial (URLs/citas de reglamento).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub evidence: Vec<String>,
}

/// Clase de elemento preliminar exigible por política (espejo del dominio).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RequiredPreliminary {
    Dedication,
    Acknowledgements,
    OriginalityStatement,
    Authorization,
    Abstract,
    Keywords,
    Epigraph,
    Nomenclature,
    Glossary,
}

/// Política de portada.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoverPolicy {
    pub require_logo: bool,
    pub require_signatures: bool,
    pub require_orcid: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_title_chars: Option<usize>,
}

/// Política de bibliografía.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct BibliographyPolicy {
    /// Estilos permitidos (vacío = cualquiera soportado).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_styles: Vec<String>,
    /// Backend obligatorio ("biber"/"bibtex"), si la institución lo fija.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required_backend: Option<String>,
}

/// Política de índices.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct IndexesPolicy {
    pub require_toc: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_toc_depth: Option<u8>,
}

/// Política de entrega.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeliveryPolicy {
    pub require_pdf_metadata: bool,
    /// Si la entrega institucional exige conformidad PDF/A.
    #[serde(default)]
    pub require_pdfa: bool,
    /// Nivel esperado, por ejemplo "PDF/A-1b" o "PDF/A-2b".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pdfa_level: Option<String>,
    /// Idiomas de resumen exigidos (p. ej. ["es","en"]).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub required_abstract_languages: Vec<String>,
}

/// Conjunto de políticas **auto-comprobables** del perfil contra el IR.
/// Requisitos → diagnósticos de error; recomendaciones → advertencias.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProfilePolicy {
    /// Preliminares obligatorios (incumplir = error).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub required_preliminaries: Vec<RequiredPreliminary>,
    /// Preliminares recomendados (faltar = advertencia).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recommended_preliminaries: Vec<RequiredPreliminary>,
    pub require_keywords: bool,
    #[serde(default)]
    pub cover: CoverPolicy,
    #[serde(default)]
    pub bibliography: BibliographyPolicy,
    #[serde(default)]
    pub indexes: IndexesPolicy,
    #[serde(default)]
    pub delivery: DeliveryPolicy,
}

/// Perfil 2.x completo: identidad + política verificable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Profile2 {
    pub contract_version: ContractVersion,
    pub identity: ProfileIdentity,
    pub policy: ProfilePolicy,
}

impl Profile2 {
    /// Comprueba la coherencia interna del perfil (no contra un IR): un perfil
    /// `Verified` exige fecha de revisión y evidencia (§9.1).
    pub fn self_consistency_errors(&self) -> Vec<&'static str> {
        let mut e = Vec::new();
        if self.identity.trust == TrustLevel::Verified {
            if self.identity.revised_at.is_none() {
                e.push("verified_profile_missing_revised_at");
            }
            if self.identity.evidence.is_empty() {
                e.push("verified_profile_missing_evidence");
            }
        }
        e
    }
}
