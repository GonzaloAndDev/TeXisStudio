//! Nodos semánticos del cuerpo (§7.4).
//!
//! El cuerpo expone *nodos semánticos*, no fragmentos LaTeX como formato
//! principal. `TrustedRawLatex` es explícito, auditable y diagnosticable — no
//! el camino normal.
//!
//! Los tipos modelan el significado, independientes del backend. La importación
//! desde el modelo legacy debe ser fiel (sin pérdida silenciosa).

use serde::{Deserialize, Serialize};
use texis_document_contracts::ids::{AssetId, NodeId};

/// Nivel de encabezado dentro de una sección.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HeadingLevel {
    Section,
    Subsection,
    Subsubsection,
}

/// Ancho relativo de una figura.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FigureWidth {
    Half,
    ThreeQuarters,
    Full,
}

/// Tipo de lista.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ListKind {
    Itemize,
    Enumerate,
    Description,
}

/// Tipo de cita.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CitationKind {
    Parenthetical,
    Narrative,
    Multiple,
    Footnote,
}

/// Clase de teorema/entorno matemático.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

/// Texto que puede ser literal o contener notación matemática intencional.
/// `is_math` indica que NO debe escaparse al renderizar (equivale a `verbatim`
/// en el modelo legacy), pero el dominio no decide el escape: solo lo declara.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RichText {
    pub text: String,
    #[serde(default)]
    pub is_math: bool,
}

impl RichText {
    pub fn plain(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            is_math: false,
        }
    }

    pub fn maybe_math(text: impl Into<String>, is_math: bool) -> Self {
        Self {
            text: text.into(),
            is_math,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Paragraph {
    pub id: NodeId,
    pub content: RichText,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Heading {
    pub id: NodeId,
    pub level: HeadingLevel,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Figure {
    pub id: NodeId,
    /// Asset referenciado (ruta relativa garantizada por el AssetRef).
    pub asset: AssetId,
    pub caption: RichText,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    pub width: FigureWidth,
    pub label: String,
    pub include_in_list: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Table {
    pub id: NodeId,
    pub caption: RichText,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    pub label: String,
    pub include_in_list: bool,
    pub headers: Vec<RichText>,
    pub rows: Vec<Vec<RichText>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Equation {
    pub id: NodeId,
    /// LaTeX matemático intencional del usuario.
    pub latex: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub numbered: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListNode {
    pub id: NodeId,
    pub kind: ListKind,
    pub items: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CodeListing {
    pub id: NodeId,
    pub language: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub content: String,
    pub show_line_numbers: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Algorithm {
    pub id: NodeId,
    pub caption: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Theorem {
    pub id: NodeId,
    pub kind: TheoremKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub content: RichText,
    pub numbered: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Citation {
    pub id: NodeId,
    pub citation_key: String,
    pub kind: CitationKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prefix: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suffix: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GlossaryEntry {
    pub id: NodeId,
    pub term: String,
    pub definition: RichText,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AcronymEntry {
    pub id: NodeId,
    pub acronym: String,
    pub full_form: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

/// Contribución de un plugin (§7.4, §9.3). En la Etapa A se conserva fiel el
/// artefacto LaTeX y la fuente editable del modelo legacy; la Etapa E
/// profundiza el contrato semántico.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PluginContribution {
    pub id: NodeId,
    pub plugin_id: String,
    pub figure_id: String,
    pub caption: String,
    pub label: String,
    /// Artefacto LaTeX completo producido por el plugin.
    pub artifact_latex: String,
    /// Paquetes requeridos declarados por el plugin.
    pub required_packages: Vec<String>,
    /// Fuente editable serializada (JSON del engine), para re-edición.
    pub editable_source: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
}

/// Diagrama visual nativo (§7.4). Se conserva la configuración como fuente y el
/// override avanzado si existe. El renderizado semántico pertenece a la Etapa E.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VisualNode {
    pub id: NodeId,
    pub caption: String,
    pub label: String,
    pub include_in_list: bool,
    /// Discriminante del tipo de visual ("venn_euler", "flow_diagram", ...).
    pub kind: String,
    /// Configuración serializada (JSON) — fuente editable.
    pub config_json: String,
    /// Override LaTeX avanzado confirmado por el usuario, si existe.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advanced_override: Option<String>,
}

/// Escape hatch de LaTeX confiable (§7.4). Explícito, auditable, diagnosticable.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrustedRawLatex {
    pub id: NodeId,
    pub content: String,
    /// El usuario confirmó explícitamente la inserción de LaTeX crudo.
    pub user_confirmed: bool,
}

/// Referencia cruzada a un label del documento (§7.4).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrossReference {
    pub id: NodeId,
    pub target_label: String,
}

/// Nodo semántico del cuerpo. Cubre los tipos del plan (§7.4) y los necesarios
/// para una importación fiel del modelo legacy.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "node", rename_all = "snake_case")]
pub enum BodyNode {
    Paragraph(Paragraph),
    Heading(Heading),
    Figure(Figure),
    Table(Table),
    Equation(Equation),
    List(ListNode),
    Theorem(Theorem),
    CodeListing(CodeListing),
    Algorithm(Algorithm),
    Citation(Citation),
    CrossReference(CrossReference),
    GlossaryEntry(GlossaryEntry),
    AcronymEntry(AcronymEntry),
    PluginContribution(PluginContribution),
    Visual(VisualNode),
    TrustedRawLatex(TrustedRawLatex),
}

impl BodyNode {
    /// Id estable del nodo, para localización en diagnósticos.
    pub fn node_id(&self) -> &NodeId {
        match self {
            BodyNode::Paragraph(n) => &n.id,
            BodyNode::Heading(n) => &n.id,
            BodyNode::Figure(n) => &n.id,
            BodyNode::Table(n) => &n.id,
            BodyNode::Equation(n) => &n.id,
            BodyNode::List(n) => &n.id,
            BodyNode::Theorem(n) => &n.id,
            BodyNode::CodeListing(n) => &n.id,
            BodyNode::Algorithm(n) => &n.id,
            BodyNode::Citation(n) => &n.id,
            BodyNode::CrossReference(n) => &n.id,
            BodyNode::GlossaryEntry(n) => &n.id,
            BodyNode::AcronymEntry(n) => &n.id,
            BodyNode::PluginContribution(n) => &n.id,
            BodyNode::Visual(n) => &n.id,
            BodyNode::TrustedRawLatex(n) => &n.id,
        }
    }
}
