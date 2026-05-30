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

/// Declaración de un paquete LaTeX con opciones.
/// Alternativa estructurada a escribir `\usepackage[opts]{pkg}` a mano.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageConfig {
    pub name: String,
    /// Opciones del paquete, ej. ["version=4"] → \usepackage[version=4]{mhchem}
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<String>,
}

/// Operador matemático personalizado.
/// Genera `\DeclareMathOperator{\<command>}{<text>}` en el preámbulo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MathOperator {
    /// Nombre del comando sin backslash: "rank", "tr", "Im", "Re"
    pub command: String,
    /// Texto que aparece en el PDF: "rank", "tr", "Im", "Re"
    pub text: String,
}

/// Entorno de teorema adicional (más allá de los ya definidos por el perfil).
/// Genera `\newtheorem{id}{label}[parent]` en el preámbulo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtraTheorem {
    /// Identificador del entorno: "hypothesis", "conjecture", "claim"
    pub id: String,
    /// Etiqueta que aparece en el PDF: "Hipótesis", "Conjetura"
    pub label: String,
    /// Contador padre (numeración dentro de capítulo/sección). None = numeración global.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_counter: Option<String>,
    #[serde(default = "default_true")]
    pub numbered: bool,
}

/// Configuración explícita del preámbulo LaTeX.
/// Todo lo que no sea texto narrativo y que el generador no emite automáticamente.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PreambleConfig {
    /// Fuente para texto en Cirílico (Ruso, Búlgaro, Serbio…).
    /// Se emite como \newfontfamily\cyrillicfont[Script=Cyrillic]{font}.
    /// Necesaria para que polyglossia ruso funcione correctamente con XeLaTeX.
    /// macOS: "Arial Unicode MS" | multiplataforma: "CMU Serif"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cyrillic_font: Option<String>,
    /// Fuente CJK principal (chino simplificado / coreano).
    /// Si None y el documento contiene caracteres CJK, el generador usa "Heiti SC".
    /// macOS: "Heiti SC", "Songti SC", "STSong"
    /// Windows/Linux: "Noto Sans CJK SC", "WenQuanYi Micro Hei"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cjk_main_font: Option<String>,
    /// Fuente japonesa (override sobre cjk_main_font para texto japonés).
    /// macOS: "Hiragino Mincho ProN", "Hiragino Kaku Gothic Pro"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cjk_japanese_font: Option<String>,
    /// Fuente coreana (override sobre cjk_main_font para texto coreano).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cjk_korean_font: Option<String>,
    /// Fuente principal del documento (override sobre el perfil activo).
    /// XeLaTeX: nombre exacto de la fuente OpenType/TrueType del sistema.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub main_font: Option<String>,
    /// Fuente sans-serif del documento.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sans_font: Option<String>,
    /// Fuente monoespaciada del documento.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mono_font: Option<String>,
    /// Operadores matemáticos adicionales.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub math_operators: Vec<MathOperator>,
    /// Entornos de teoremas adicionales (hipótesis, conjeturas, etc.).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub extra_theorems: Vec<ExtraTheorem>,
    /// LaTeX adicional para el preámbulo (escape hatch para usuarios avanzados).
    /// ADVERTENCIA: puede romper la compilación si contiene errores.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extra: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatexConfig {
    pub document_class: DocumentClassConfig,
    pub engine: LatexEngine,
    pub compiler: CompilerKind,
    pub bibliography_backend: BibliographyBackend,
    pub bibliography_style: String,
    /// Paquetes simples (sin opciones). Para paquetes con opciones usa packages_with_options.
    pub packages_required: Vec<String>,
    /// Paquetes con opciones. Ej: {name: "mhchem", options: ["version=4"]}
    /// Se emiten como \usepackage[opts]{name} ANTES de packages_required.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub packages_with_options: Vec<PackageConfig>,
    /// Ajustes tipográficos del usuario. Tienen prioridad sobre los valores del perfil.
    #[serde(default)]
    pub typography: LatexTypography,
    /// Layout de página copiado del perfil activo. Tiene prioridad sobre `typography.margin_cm`.
    /// None en proyectos creados antes de P1.1 — el generador usa margin_cm como fallback.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page_layout: Option<PageLayout>,
    /// Configuración explícita del preámbulo: fuentes CJK, operadores matemáticos,
    /// teoremas adicionales y preámbulo extra. El generador completa automáticamente
    /// lo que puede inferir del contenido (ej. xeCJK si hay caracteres CJK).
    #[serde(default)]
    pub preamble_config: PreambleConfig,
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
    // ── Bloques visuales nativos ───────────────────────────────
    /// Diagrama visual generado automáticamente. El usuario configura
    /// mediante formulario; TeXisStudio genera el LaTeX correcto.
    Visual(VisualBlock),
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
    /// Cuando true, el caption se pasa verbatim (permite math inline en la leyenda).
    #[serde(default)]
    pub verbatim_caption: bool,
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
    /// Cuando true, las celdas de datos se pasan verbatim (permiten math inline).
    #[serde(default)]
    pub raw_cells: bool,
    /// Cuando true, el caption se pasa verbatim (permite math inline en el pie de tabla).
    #[serde(default)]
    pub verbatim_caption: bool,
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
    /// Cuando true, el contenido se pasa verbatim (permite notación LaTeX/math).
    #[serde(default)]
    pub verbatim: bool,
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

// ── Visual Blocks ─────────────────────────────────────────────────
//
// Un VisualBlock representa un diagrama académico que el usuario edita
// mediante formulario en la app. TeXisStudio genera el LaTeX completo.
// El usuario nunca necesita escribir TikZ, chemfig, mhchem, etc.
//
// Paquetes auto-detectados por tipo:
//   VennEuler, FlowDiagram, Timeline, BioPathway → tikz
//   ChemReaction                                 → mhchem
//   Molecule                                     → chemfig
//   Circuit                                      → circuitikz
//   Feynman                                      → tikz + TikZ libraries
//   MusicFragment                                → musixtex (o fallback)

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualBlock {
    pub id: String,
    pub caption: String,
    pub label: String,
    #[serde(default = "default_true")]
    pub include_in_list: bool,
    /// Override de LaTeX avanzado. Si presente, sustituye al generado automáticamente.
    /// Solo visible en modo advanced. Requiere user_confirmed=true.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advanced_latex_override: Option<String>,
    #[serde(default)]
    pub advanced_override_confirmed: bool,
    pub config: VisualConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum VisualConfig {
    VennEuler(VennEulerConfig),
    FlowDiagram(FlowDiagramConfig),
    Timeline(TimelineConfig),
    ChemReaction(ChemReactionConfig),
    Molecule(MoleculeConfig),
    Circuit(CircuitConfig),
    Feynman(FeynmanConfig),
    BioPathway(BioPathwayConfig),
    MusicFragment(MusicFragmentConfig),
}

// ── Venn / Euler ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VennEulerConfig {
    pub sets: Vec<VennSet>,
    /// Etiquetas para intersecciones pares. Clave: "01", "02", "12", "012" (índices).
    #[serde(default)]
    pub intersections: std::collections::HashMap<String, String>,
    /// Estilo visual: "circles" (Venn clásico) o "ellipses" (Euler)
    #[serde(default = "default_venn_style")]
    pub style: String,
}

fn default_venn_style() -> String {
    "circles".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VennSet {
    pub label: String,
    /// Color CSS/LaTeX: "red", "blue", "green", "#4A90E2", etc.
    #[serde(default = "default_set_color")]
    pub color: String,
}

fn default_set_color() -> String {
    "blue".to_string()
}

// ── Flow Diagram ──────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowDiagramConfig {
    pub nodes: Vec<FlowNode>,
    pub edges: Vec<FlowEdge>,
    #[serde(default = "default_flow_orientation")]
    pub orientation: String, // "vertical" | "horizontal"
}

fn default_flow_orientation() -> String {
    "vertical".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    pub id: String,
    pub label: String,
    #[serde(default = "default_node_shape")]
    pub shape: String, // "rect" | "diamond" | "circle" | "rounded"
    #[serde(default = "default_set_color")]
    pub color: String,
}

fn default_node_shape() -> String {
    "rect".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowEdge {
    pub from: String,
    pub to: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default = "default_arrow_style")]
    pub style: String, // "arrow" | "dashed" | "double"
}

fn default_arrow_style() -> String {
    "arrow".to_string()
}

// ── Timeline ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineConfig {
    pub events: Vec<TimelineEvent>,
    #[serde(default = "default_timeline_orientation")]
    pub orientation: String, // "horizontal" | "vertical"
    #[serde(default = "default_set_color")]
    pub accent_color: String,
}

fn default_timeline_orientation() -> String {
    "horizontal".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub date: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

// ── Chemical Reaction (mhchem) ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChemReactionConfig {
    /// Ecuación en notación mhchem: "H2 + O2 -> H2O", "N2 + 3H2 <=> 2NH3"
    pub equation: String,
    /// Catalizador o condición de la flecha: "Fe", "Δ", "hν"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub catalyst: Option<String>,
    /// Temperatura u otras condiciones
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conditions: Option<String>,
    #[serde(default = "default_reaction_type")]
    pub reaction_type: String, // "forward" | "equilibrium" | "resonance"
    /// Si true, muestra como bloque equation; si false, inline
    #[serde(default = "default_true")]
    pub display_mode: bool,
}

fn default_reaction_type() -> String {
    "forward".to_string()
}

// ── Molecule (chemfig) ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoleculeConfig {
    /// Preset de molécula conocida: "benzene", "water", "aspirin", "glucose", etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preset: Option<String>,
    /// Fórmula chemfig manual (override del preset)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chemfig_formula: Option<String>,
    /// Escala del diagrama
    #[serde(default = "default_mol_scale")]
    pub scale: f32,
}

fn default_mol_scale() -> f32 {
    1.0
}

/// Presets disponibles de moléculas con sus fórmulas chemfig.
pub const MOLECULE_PRESETS: &[(&str, &str, &str)] = &[
    // (id, nombre, fórmula chemfig)
    ("benzene", "Benceno", "*6(-=-=-=)"),
    ("water", "Agua", "H-O-H"),
    ("co2", "CO₂", "O=C=O"),
    ("ethanol", "Etanol", "H_3C-CH_2-OH"),
    (
        "glucose",
        "Glucosa",
        "HO-[2]CH_2-[6](-[8]OH)-[2](-[8]OH)-[6](-[8]OH)-[2](-[8]OH)-[6]=O",
    ),
    (
        "aspirin",
        "Aspirina",
        "*6(=-(-[2]OH)=(-[6](-[7]CH_3)=[8]O)-=-)",
    ),
    ("nacl", "Cloruro de sodio", "Na^{+}-Cl^{-}"),
    ("methane", "Metano", "H-C(-[2]H)(-[6]H)-H"),
];

// ── Circuit (circuitikz) ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CircuitConfig {
    /// Preset de circuito: "rc_series", "rlc_parallel", "voltage_divider",
    /// "inverting_opamp", "full_wave_rectifier"
    pub preset: String,
    /// Valores de componentes: { "R": "1kΩ", "C": "10μF", "V": "5V" }
    #[serde(default)]
    pub component_values: std::collections::HashMap<String, String>,
}

/// Presets de circuitos disponibles.
pub const CIRCUIT_PRESETS: &[(&str, &str)] = &[
    ("rc_series", "Circuito RC en serie"),
    ("rlc_parallel", "Circuito RLC en paralelo"),
    ("voltage_divider", "Divisor de voltaje resistivo"),
    ("inverting_opamp", "Amplificador operacional inversor"),
    ("full_wave_rectifier", "Rectificador de onda completa"),
];

// ── Feynman Diagram (tikz-feynman) ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeynmanConfig {
    /// Preset de diagrama: "vertex_qed", "compton", "muon_decay",
    /// "pair_production", "bhabha", "higgs_production"
    pub preset: String,
    /// Etiquetas personalizadas para partículas (override del preset)
    #[serde(default)]
    pub particle_labels: std::collections::HashMap<String, String>,
    /// Si true, muestra etiquetas de momento
    #[serde(default)]
    pub show_momentum: bool,
}

pub const FEYNMAN_PRESETS: &[(&str, &str)] = &[
    ("vertex_qed", "Vértice QED (e⁻ + γ)"),
    ("compton", "Dispersión Compton"),
    ("muon_decay", "Desintegración del muón (μ⁻ → e⁻ νμ ν̄e)"),
    ("pair_production", "Producción de par (γ → e⁺ e⁻)"),
    ("bhabha", "Dispersión Bhabha (e⁺e⁻ → e⁺e⁻)"),
    (
        "higgs_production",
        "Producción de Higgs vía fusión de gluones",
    ),
];

// ── Bio Pathway (TikZ presets) ────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BioPathwayConfig {
    /// Preset de vía: "krebs_cycle", "glycolysis", "photosynthesis",
    /// "electron_transport", "beta_oxidation"
    pub preset: String,
    /// Etiquetas personalizadas para metabolitos (override parcial)
    #[serde(default)]
    pub custom_labels: std::collections::HashMap<String, String>,
    /// Si true, muestra cofactores y ATP/NADH
    #[serde(default = "default_true")]
    pub show_cofactors: bool,
}

pub const BIO_PATHWAY_PRESETS: &[(&str, &str)] = &[
    ("krebs_cycle", "Ciclo de Krebs (ácido cítrico)"),
    ("glycolysis", "Glucólisis (Embden-Meyerhof)"),
    ("photosynthesis", "Fotosíntesis (ciclo de Calvin)"),
    ("electron_transport", "Cadena de transporte de electrones"),
    ("beta_oxidation", "Beta-oxidación de ácidos grasos"),
];

// ── Music Fragment (MusiXTeX / ABC) ──────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicFragmentConfig {
    /// Notación ABC del fragmento musical.
    /// Ej: "X:1\nT:Escala Do\nM:4/4\nK:C\nCDEFGABC'|"
    pub abc_notation: String,
    /// Instrumento (solo para metadatos/caption)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instrument: Option<String>,
    /// Si true, intenta generar con MusiXTeX; si false, sólo muestra warning
    /// y el usuario debe importar como figura externa.
    #[serde(default = "default_true")]
    pub try_musixtex: bool,
}
