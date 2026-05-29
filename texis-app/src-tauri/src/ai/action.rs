use serde::{Deserialize, Serialize};

/// Modo de acción que el usuario solicita a la IA.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiActionMode {
    /// Pregunta libre, sin modificación de documento.
    Ask,
    /// Mejorar redacción de la selección actual.
    ImproveWriting,
    /// Acortar la selección actual.
    ShortenText,
    /// Ampliar la selección actual.
    ExpandText,
    /// Convertir selección a LaTeX válido.
    ConvertToLatex,
    /// Explicar un error de LaTeX del diagnóstico.
    ExplainLatexError,
    /// Generar snippet de tabla en LaTeX.
    GenerateTableSnippet,
    /// Generar caption para figura o tabla.
    GenerateCaption,
    /// Generar abstract del proyecto.
    GenerateAbstract,
    /// Actuar como sinodal simulado haciendo preguntas críticas.
    SimulateExaminer,
    /// Ayuda sobre cómo usar TeXisStudio.
    AppHelp,
}

impl AiActionMode {
    pub fn display_name(&self) -> &'static str {
        match self {
            AiActionMode::Ask => "Preguntar",
            AiActionMode::ImproveWriting => "Mejorar redacción",
            AiActionMode::ShortenText => "Acortar texto",
            AiActionMode::ExpandText => "Ampliar texto",
            AiActionMode::ConvertToLatex => "Convertir a LaTeX",
            AiActionMode::ExplainLatexError => "Explicar error LaTeX",
            AiActionMode::GenerateTableSnippet => "Generar tabla",
            AiActionMode::GenerateCaption => "Generar caption",
            AiActionMode::GenerateAbstract => "Generar abstract",
            AiActionMode::SimulateExaminer => "Sinodal simulado",
            AiActionMode::AppHelp => "Ayuda de la app",
        }
    }

    /// Indica si esta acción modifica o inserta contenido en el documento.
    pub fn touches_document(&self) -> bool {
        matches!(
            self,
            AiActionMode::ImproveWriting
                | AiActionMode::ShortenText
                | AiActionMode::ExpandText
                | AiActionMode::ConvertToLatex
                | AiActionMode::GenerateTableSnippet
                | AiActionMode::GenerateCaption
                | AiActionMode::GenerateAbstract
        )
    }
}

/// Acción propuesta por la IA sobre el documento.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AiProposedAction {
    /// Reemplazar texto seleccionado con el nuevo texto.
    ReplaceSelection {
        original: String,
        replacement: String,
    },
    /// Insertar texto en la posición actual del cursor.
    InsertAtCursor { content: String },
    /// Solo mostrar la respuesta en el chat (sin tocar el documento).
    ShowInChat { response: String },
}

/// Elementos del proyecto que AIEngine puede analizar pero nunca modificar.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ProtectedProjectElement {
    MainTex,
    Preamble,
    BuildConfiguration,
    DocumentProfile,
    PackageRegistry,
    GeneratedTableOfContents,
    GeneratedBibliographyOutput,
    GeneratedGlossaryOutput,
    ProjectMetadata,
    MigrationFiles,
    Credentials,
    PluginConfiguration,
}
