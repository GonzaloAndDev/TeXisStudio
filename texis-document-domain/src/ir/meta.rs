//! Identidad, metadatos y perfil resuelto del documento (§5).

use serde::{Deserialize, Serialize};
use texis_document_contracts::ids::{DocumentId, ProfileId};
use texis_document_contracts::measures::Length;
use texis_document_contracts::version::ContractVersion;

/// Tipo de documento académico (canónico, sin aliases).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentKind {
    Thesis,
    Tesina,
    GraduateThesis,
}

/// Nivel académico (canónico).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AcademicLevel {
    HighSchool,
    Technical,
    Bachelor,
    Specialty,
    Master,
    Doctorate,
    Postdoctorate,
}

/// Identidad estable del documento.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DocumentIdentity {
    pub id: DocumentId,
    pub created_at: String,
    pub updated_at: String,
    /// Versión del esquema legacy del que se importó (provenance de migración).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_schema: Option<String>,
}

/// Metadatos resueltos del documento.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResolvedMetadata {
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitle: Option<String>,
    pub document_kind: DocumentKind,
    pub academic_level: AcademicLevel,
    pub keywords: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub funding: Option<String>,
}

/// Geometría de página resuelta. Medidas tipográficas, no cadenas LaTeX.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PageGeometry {
    /// Tamaño de papel canónico ("a4", "letter").
    pub paper: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub margin_top: Option<Length>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub margin_bottom: Option<Length>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub margin_left: Option<Length>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub margin_right: Option<Length>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_spacing: Option<f32>,
}

/// Tipografía resuelta.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct Typography {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_font_size: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub main_font: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sans_font: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mono_font: Option<String>,
}

/// Perfil institucional resuelto (subconjunto necesario en la Etapa A).
/// La Etapa H reemplaza esto por el contrato de perfiles 2.x completo.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResolvedProfile {
    pub id: ProfileId,
    /// Versión del contrato de perfil del que proviene.
    pub contract_version: ContractVersion,
    /// Clase de documento canónica ("book", "report", "article").
    pub document_class: String,
    pub document_class_options: Vec<String>,
    pub page_geometry: PageGeometry,
    pub typography: Typography,
}
