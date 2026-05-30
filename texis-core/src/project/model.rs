// ProjectModel es la fuente de verdad del proyecto.
// Se persiste en tesis.project.yaml (raíz) + content/sections/*.yaml
//
// DISEÑO:
// - ProjectSection.blocks → contenido narrativo (capítulos, texto largo)
// - ProjectSection.fields → formularios de metadata (portada, datos)

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

fn default_true() -> bool {
    true
}

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
    /// Agencia financiadora o número de beca (opcional).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub funding: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocumentKind {
    Tesis,
    Tesina,
    TesisPosgrado,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AcademicLevel {
    Bachillerato,
    Tecnico,
    Licenciatura,
    Especialidad,
    Maestria,
    Doctorado,
    Posdoctorado,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstitutionData {
    pub name: String,
    pub faculty: Option<String>,
    pub department: Option<String>,
    pub logo_path: Option<PathBuf>,
    pub country: String,
}

/// Miembro del comité sinodal / jurado de posgrado.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitteeMember {
    pub full_name: String,
    /// Rol en el comité: "Presidente", "Secretario", "Vocal 1", etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    /// Institución de adscripción (puede diferir de la del estudiante).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub institution: Option<String>,
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
    /// Comité sinodal / jurado (posgrado).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub committee: Vec<CommitteeMember>,
    /// ORCID iD del autor (https://orcid.org/XXXX-XXXX-XXXX-XXXX).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub orcid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatexConfig {
    pub document_class: DocumentClassConfig,
    pub engine: LatexEngine,
    pub compiler: CompilerKind,
    pub bibliography_backend: BibliographyBackend,
    pub bibliography_style: String,
    pub packages_required: Vec<String>,
    /// Ajustes tipográficos del usuario. Tienen prioridad sobre los valores del perfil.
    #[serde(default)]
    pub typography: LatexTypography,
    /// Layout de página copiado del perfil activo. Tiene prioridad sobre `typography.margin_cm`.
    /// None en proyectos creados antes de P1.1 — el generador usa margin_cm como fallback.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page_layout: Option<PageLayout>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentClassConfig {
    /// "book" por defecto. Configurable por perfil.
    pub name: String,
    pub options: Vec<String>,
}

/// Márgenes asimétricos declarados por el perfil institucional.
/// Cada valor es una medida LaTeX válida, ej. "38.1mm", "2.54cm", "1in".
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PageMargins {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bottom: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right: Option<String>,
}

/// Layout de página copiado del perfil activo al crear el proyecto.
/// Los márgenes asimétricos tienen prioridad sobre el margen uniforme de `LatexTypography`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PageLayout {
    /// Tamaño de papel del perfil (ej. "a4paper", "letterpaper").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paper: Option<String>,
    /// Márgenes asimétricos del perfil (ej. MIT: 38.1mm izquierdo para encuadernación).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub margins: Option<PageMargins>,
    /// Interlineado declarado por el perfil (ej. 1.5 = onehalf).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_spacing: Option<f32>,
}

/// Ajustes tipográficos configurables por el usuario desde la UI.
/// Todos los campos son opcionales; si no se especifican se usan los valores del perfil.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LatexTypography {
    /// Tamaño de fuente base: "10pt" | "11pt" | "12pt".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub font_size: Option<String>,
    /// Tamaño de papel: "a4paper" | "letterpaper".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paper_size: Option<String>,
    /// Interlineado: "single" | "onehalf" | "double".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_spacing: Option<String>,
    /// Margen uniforme en cm (p. ej. 2.5). Se aplica con el paquete geometry.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub margin_cm: Option<f32>,
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

// ── SectionStatus ─────────────────────────────────────────────────

/// Estado editorial de una sección: refleja el progreso de redacción.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SectionStatus {
    /// Borrador inicial — trabajo en progreso.
    #[default]
    Draft,
    /// En revisión — listo para que el asesor lo lea.
    InReview,
    /// Revisado — el asesor ya hizo observaciones, en corrección.
    Revised,
    /// Aprobado — sección finalizada y aceptada.
    Approved,
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
    /// Estado editorial de la sección.
    #[serde(default)]
    pub status: SectionStatus,
    /// Notas internas del autor (no se incluyen en el PDF).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
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
    // ── Bloques de posgrado ────────────────────────────────────
    GlossaryEntry(GlossaryEntryBlock),
    AcronymEntry(AcronymEntryBlock),
    Code(CodeBlock),
    Algorithm(AlgorithmBlock),
    Theorem(TheoremBlock),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParagraphBlock {
    pub id: String,
    pub content: String,
    /// Cuando true, el contenido se pasa verbatim (sin latex_escape).
    /// Usar para párrafos con math inline ($...$) o \ref{} intencionales.
    #[serde(default)]
    pub verbatim: bool,
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
    /// Cuando true, los headers se pasan verbatim (permiten math: $\Delta V$).
    #[serde(default)]
    pub raw_headers: bool,
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

// ── Bloques de posgrado ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlossaryEntryBlock {
    pub id: String,
    pub term: String,
    pub definition: String,
    /// Cuando true, la definición se pasa verbatim (permite math inline).
    #[serde(default)]
    pub verbatim: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcronymEntryBlock {
    pub id: String,
    pub acronym: String,
    pub full_form: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeBlock {
    pub id: String,
    /// Lenguaje para resaltado: "Python", "Java", "C", "C++", "MATLAB", "R", etc.
    pub language: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub content: String,
    #[serde(default)]
    pub show_line_numbers: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlgorithmBlock {
    pub id: String,
    pub caption: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Entradas del algoritmo (e.g. "dataset $D$, umbral $\theta$").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input: Option<String>,
    /// Salidas del algoritmo.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    /// Pseudocódigo: una instrucción por línea.
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TheoremKind {
    Theorem,
    Lemma,
    Corollary,
    Definition,
    Proposition,
    Proof,
    Remark,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TheoremBlock {
    pub id: String,
    pub kind: TheoremKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub content: String,
    #[serde(default = "default_true")]
    pub numbered: bool,
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
