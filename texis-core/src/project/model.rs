// ProjectModel es la fuente de verdad del proyecto.
// Se persiste en tesis.project.yaml (raíz) + content/sections/*.yaml
//
// DISEÑO:
// - ProjectSection.blocks → contenido narrativo (capítulos, texto largo)
// - ProjectSection.fields → formularios de metadata (portada, datos)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

// ── ProjectModel ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectModel {
    pub id: String,
    pub schema_version: String,
    pub created_at: String,
    pub updated_at: String,

    pub metadata: ProjectMetadata,
    pub institution: InstitutionData,
    pub student: StudentData,
    pub profile_id: String,
    pub latex_config: LatexConfig,
    pub sections: Vec<ProjectSection>,

    /// Estado de cada archivo .tex en build/.
    /// Clave: ruta relativa desde build/
    pub file_states: HashMap<String, FileState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub title: String,
    pub subtitle: Option<String>,
    pub document_kind: DocumentKind,
    pub academic_level: AcademicLevel,
    pub language: String,
    pub city: String,
    pub year: u32,
    pub keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentKind {
    Tesis,
    Tesina,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AcademicLevel {
    Bachillerato,
    Tecnico,
    Licenciatura,
    Maestria,
    Doctorado,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstitutionData {
    pub name: String,
    pub faculty: Option<String>,
    pub department: Option<String>,
    pub logo_path: Option<PathBuf>,
    pub country: String,
}

/// Co-autor de un trabajo grupal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoAuthor {
    pub full_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub student_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudentData {
    pub full_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub student_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    /// Asesor principal (campo legacy — se mantiene para compatibilidad).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advisor: Option<String>,
    /// Lista completa de asesores (sustituye a advisor + co_advisor).
    /// Si no está vacía, tiene prioridad sobre `advisor`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub advisors: Vec<String>,
    /// Co-autores en trabajos grupales.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub co_authors: Vec<CoAuthor>,
    /// @deprecated — usar `advisors` en proyectos nuevos.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub co_advisor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatexConfig {
    pub document_class: DocumentClassConfig,
    pub engine: LatexEngine,
    pub compiler: CompilerKind,
    pub bibliography_backend: BibliographyBackend,
    pub bibliography_style: String,
    pub packages_required: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentClassConfig {
    /// "book" por defecto. Configurable por perfil.
    pub name: String,
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LatexEngine {
    Xelatex,
    Pdflatex,
    Lualatex,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompilerKind {
    Latexmk,
    Tectonic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BibliographyBackend {
    Biber,
    Bibtex,
}

// ── ProjectSection ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSection {
    pub id: String,
    pub element_id: String,
    pub title: Option<String>,
    pub placement: SectionPlacement,
    pub required: bool,
    pub enabled: bool,
    pub label: Option<String>,
    /// Contenido narrativo. Para capítulos y texto largo.
    pub blocks: Vec<ContentBlock>,
    /// Campos de formulario. Para portada y metadata.
    pub fields: HashMap<String, FieldValue>,
    pub children: Vec<ProjectSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SectionPlacement {
    FrontMatter,
    Body,
    BackMatter,
    Appendix,
}

// ── ContentBlock ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Paragraph(ParagraphBlock),
    Heading(HeadingBlock),
    Figure(FigureBlock),
    Table(TableBlock),
    Citation(CitationBlock),
    Equation(EquationBlock),
    List(ListBlock),
    RawLatex(RawLatexBlock),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParagraphBlock {
    pub id: String,
    /// SIEMPRE pasa por latex_escape al generarse.
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeadingBlock {
    pub id: String,
    pub level: HeadingLevel,
    /// SIEMPRE pasa por latex_escape al generarse.
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HeadingLevel {
    Section,
    Subsection,
    Subsubsection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FigureBlock {
    pub id: String,
    pub file: String,
    pub caption: String,
    pub source: Option<String>,
    pub width: FigureWidth,
    pub label: String,
    pub include_in_list: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FigureWidth {
    Half,
    ThreeQuarters,
    Full,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableBlock {
    pub id: String,
    pub caption: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    pub label: String,
    pub include_in_list: bool,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    #[serde(default)]
    pub table_style: TableStyle,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TableStyle {
    #[default]
    Simple,
    Wide,
    Long,
    Booktabs,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitationBlock {
    pub id: String,
    pub citation_key: String,
    pub citation_type: CitationType,
    pub page: Option<String>,
    pub prefix: Option<String>,
    pub suffix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CitationType {
    Parenthetical,
    Narrative,
    Multiple,
    Footnote,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquationBlock {
    pub id: String,
    /// LaTeX intencional del usuario. NO pasa por latex_escape.
    pub latex_content: String,
    pub label: Option<String>,
    pub numbered: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListBlock {
    pub id: String,
    pub list_type: ListType,
    /// Cada ítem SIEMPRE pasa por latex_escape al generarse.
    pub items: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ListType {
    Itemize,
    Enumerate,
    Description,
}

/// REGLAS DE SEGURIDAD:
/// - Visible con etiqueta "LaTeX manual ⚠"
/// - Requiere advertencia al insertarlo
/// - NO pasa por latex_escape
/// - Puede romper la compilación
/// - En perfiles comunitarios: permitido solo con user_confirmed = true
///   más advertencia visible en la UI
/// - shell-escape no permitido desde bloques raw
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawLatexBlock {
    pub id: String,
    pub content: String,
    pub user_confirmed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum FieldValue {
    Text(String),
    Number(f64),
    Bool(bool),
    FilePath(String),
    List(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileState {
    Auto,   // Gestionado por la app, se regenera automáticamente
    Manual, // Editado manualmente, la app no lo sobreescribe
}
