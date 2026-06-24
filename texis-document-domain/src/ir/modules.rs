//! Documentos por módulo del dominio (§7). Cada uno es el modelo propio del
//! módulo correspondiente; en la Etapa A son ricos pero mínimos, y las etapas
//! C–G profundizan cada uno con su editor, validación y verificación.

use crate::ir::body_node::BodyNode;
use serde::{Deserialize, Serialize};
use texis_document_contracts::ids::{AssetId, SectionId};
use texis_document_contracts::text::LocalizedText;

// ── 7.1 Portada e identidad institucional ──────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InstitutionIdentity {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub faculty: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department: Option<String>,
    pub country: String,
    /// Logo institucional como asset (ruta relativa garantizada).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo: Option<AssetId>,
}

/// Autor del documento.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Author {
    pub full_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub student_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub orcid: Option<String>,
}

/// Rol de una autoridad académica (asesor, comité, jurado).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthorityRole {
    Advisor,
    CoAdvisor,
    CommitteeMember,
}

/// Autoridad académica con su rol (§7.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AcademicAuthority {
    pub full_name: String,
    pub role: AuthorityRole,
    /// Rol específico dentro del comité ("Presidente", "Secretario", "Vocal").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub committee_role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub institution: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CoverDocument {
    pub institution: InstitutionIdentity,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitle: Option<String>,
    pub authors: Vec<Author>,
    pub authorities: Vec<AcademicAuthority>,
    pub city: String,
    pub year: u32,
    /// Página de firmas requerida (jurado/comité). Vacío = sin firmas.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub signatures: Vec<SignatureRequirement>,
    /// Política ante exceso de contenido en la portada (§7.1).
    #[serde(default)]
    pub overflow_policy: CoverOverflowPolicy,
}

/// Requisito de firma en la página de firmas/declaraciones.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SignatureRequirement {
    pub full_name: String,
    /// Rol mostrado junto a la línea de firma ("Asesor", "Presidente", ...).
    pub role: String,
}

/// Política ante portada que excede una página (§7.1: nunca esconder contenido).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum CoverOverflowPolicy {
    /// Reducir tipografía dentro de límites seguros.
    #[default]
    ShrinkWithinLimits,
    /// Trasladar formalmente comité/firmas a una página propia.
    MoveAuthoritiesToPage,
    /// Fallar de forma visible (no esconder) y diagnosticar.
    FailLoud,
}

// ── 7.2 Preliminares ───────────────────────────────────────────────────────

/// Clase de elemento preliminar (canónico). El orden y obligatoriedad los
/// declara el perfil; aquí solo el tipo y el contenido.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PreliminaryKind {
    Dedication,
    Acknowledgements,
    OriginalityStatement,
    Authorization,
    Abstract,
    Keywords,
    Epigraph,
    Nomenclature,
    Glossary,
    Other,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreliminaryItem {
    pub id: SectionId,
    pub kind: PreliminaryKind,
    /// Título mostrado, localizable (los resúmenes pueden ser multilingües).
    #[serde(default, skip_serializing_if = "LocalizedText::is_empty")]
    pub title: LocalizedText,
    pub nodes: Vec<BodyNode>,
    /// `true` si lo provee el usuario; `false` si es texto institucional/ejemplo.
    pub user_provided: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreliminariesDocument {
    pub items: Vec<PreliminaryItem>,
}

// ── 7.3 Índices y listas ───────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IndexKind {
    TableOfContents,
    ListOfFigures,
    ListOfTables,
    ListOfAlgorithms,
    ListOfCode,
}

/// Declaración de un índice/lista. Las entradas se generan después a partir del
/// índice semántico del cuerpo/anexos; el IR solo declara qué listas existen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IndexList {
    pub kind: IndexKind,
    pub enabled: bool,
    /// Profundidad para el índice general (niveles). `None` = default del perfil.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub depth: Option<u8>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct IndexesDocument {
    pub lists: Vec<IndexList>,
}

// ── 7.4 Cuerpo académico ───────────────────────────────────────────────────

/// Estado editorial de una sección del cuerpo.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum EditorialStatus {
    #[default]
    Draft,
    InReview,
    Revised,
    Approved,
}

/// Sección del cuerpo (capítulo o subsección anidada).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BodySection {
    pub id: SectionId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub status: EditorialStatus,
    pub nodes: Vec<BodyNode>,
    pub children: Vec<BodySection>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct BodyDocument {
    pub sections: Vec<BodySection>,
}

// ── 7.5 Bibliografía y referencias ─────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BibliographyBackend {
    Biber,
    Bibtex,
}

/// Entrada bibliográfica normalizada (independiente del formato .bib).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BibEntry {
    pub key: String,
    /// Tipo canónico en minúsculas ("article", "book", "inproceedings", ...).
    pub entry_type: String,
    /// Campos normalizados (author, title, year, doi, ...).
    pub fields: std::collections::BTreeMap<String, String>,
}

impl BibEntry {
    pub fn new(key: impl Into<String>, entry_type: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            entry_type: entry_type.into(),
            fields: std::collections::BTreeMap::new(),
        }
    }

    pub fn field(&self, name: &str) -> Option<&str> {
        self.fields.get(name).map(String::as_str)
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct BibliographyDocument {
    /// Estilo bibliográfico canónico ("apa7", "ieee", "vancouver", ...).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub style: String,
    pub backend: Option<BibliographyBackend>,
    /// Fuentes .bib referenciadas (rutas relativas).
    pub sources: Vec<String>,
    /// Entradas normalizadas (parseadas desde las fuentes por infraestructura).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entries: Vec<BibEntry>,
}

// ── 7.6 Anexos ─────────────────────────────────────────────────────────────

/// Anexo: fase canónica propia, NUNCA back matter (§7.6).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Appendix {
    pub id: SectionId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub nodes: Vec<BodyNode>,
    pub children: Vec<BodySection>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppendicesDocument {
    pub appendices: Vec<Appendix>,
}
