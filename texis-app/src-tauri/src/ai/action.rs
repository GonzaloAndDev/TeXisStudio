use serde::{Deserialize, Serialize};

// ── Modos de acción ───────────────────────────────────────────────────────────
//
// Clasificados por nivel de riesgo por defecto.
// El criterio de diseño:
//   ¿Cuál es el costo de un error? ¿Qué tan reversible es?
//
// AutoWithNotification — aplica inmediatamente, notifica, ofrece deshacer.
//   Solo para ediciones sobre texto que el autor ya escribió.
//   El contenido es suyo; la IA lo pule. Error: trivialmente reversible.
//
// Medium / RequiresConfirmation — preview + confirmar antes de aplicar.
//   Para insertar elementos estructurados que no existían:
//   citas, tablas, figuras, referencias, nuevas secciones.
//   El autor necesita verificar antes de que el elemento entre al documento.
//
// Low / ChatOnly — solo responde en el chat, no toca el documento.
//   Para consultas, análisis, orientación, simulación.
//
// Forbidden — el sistema rechaza sin importar el prompt.
//   Para cualquier eliminación y para cambios estructurales que comprometan
//   la integridad del trabajo.

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiActionMode {
    // ── Chat / consulta (Low) ─────────────────────────────────────────────────
    /// Pregunta libre sobre cualquier tema. Sin modificación de documento.
    Ask,
    /// Explicar un error de LaTeX/Biber/makeglossaries de forma comprensible.
    ExplainLatexError,
    /// Revisar y comentar el contenido académico (coherencia, argumentos, rigor).
    /// La IA opina; el autor decide qué cambia.
    ReviewContent,
    /// Sugerir fuentes bibliográficas relevantes al tema. Solo lista, no inserta nada.
    SuggestSources,
    /// Analizar la solidez del argumento central o de una sección específica.
    AnalyzeArgument,
    /// Verificar consistencia entre hipótesis, metodología y conclusiones.
    CheckConsistency,
    /// Sugerir cómo estructurar un capítulo o sección. Solo recomendación.
    SuggestStructure,
    /// Actuar como sinodal simulado: preguntas críticas para preparar la defensa.
    SimulateExaminer,
    /// Ayuda sobre cómo usar TeXisStudio.
    AppHelp,
    /// Explica el LaTeX que la app genera: qué hace un comando, por qué se usa ese paquete.
    /// Para usuarios que quieren entender lo que hay debajo sin tener que aprenderlo por obligación.
    LearnLatex,

    // ── Edición automática con notificación (AutoWithNotification) ────────────
    // Aplica directamente. La app muestra qué cambió y ofrece deshacer.
    // Solo para texto que el autor ya redactó — nunca para contenido nuevo estructurado.
    /// Mejorar la redacción del texto seleccionado sin cambiar el significado.
    ImproveWriting,
    /// Acortar el texto seleccionado eliminando redundancias.
    ShortenText,
    /// Ampliar el texto seleccionado desarrollando las ideas.
    ExpandText,
    /// Reescribir el texto seleccionado con mejor estructura o claridad.
    RewriteText,
    /// Convertir texto seleccionado a código LaTeX válido.
    ConvertToLatex,
    /// Añadir un párrafo nuevo después de la posición activa.
    AddParagraph,

    // ── Inserciones estructuradas con confirmación previa (Medium) ────────────
    // Preview + confirmar. Para elementos que no existían y que tienen
    // consecuencias en la estructura o en registros del proyecto.
    /// Insertar una cita bibliográfica (\cite) en el texto.
    InsertCitation,
    /// Agregar una nueva entrada al archivo .bib del proyecto.
    AddBibliographyEntry,
    /// Insertar una referencia cruzada (\cref, \ref) en el texto.
    InsertCrossReference,
    /// Insertar un entorno de tabla generado por la IA.
    InsertTable,
    /// Insertar un placeholder de figura con caption y label.
    InsertFigurePlaceholder,
    /// Insertar una ecuación en entorno matemático.
    InsertEquation,
    /// Agregar un término al glosario.
    AddGlossaryEntry,
    /// Agregar un acrónimo al glosario de acrónimos.
    AddAcronym,
    /// Insertar un bloque de código (lstlisting).
    InsertCodeBlock,
    /// Generar y proponer un abstract para el proyecto.
    GenerateAbstract,
    /// Generar una caption para una figura o tabla.
    GenerateCaption,
}

impl AiActionMode {
    pub fn display_name(&self) -> &'static str {
        match self {
            // Chat
            AiActionMode::Ask => "Preguntar",
            AiActionMode::ExplainLatexError => "Explicar error",
            AiActionMode::ReviewContent => "Revisar contenido",
            AiActionMode::SuggestSources => "Sugerir fuentes",
            AiActionMode::AnalyzeArgument => "Analizar argumento",
            AiActionMode::CheckConsistency => "Verificar consistencia",
            AiActionMode::SuggestStructure => "Sugerir estructura",
            AiActionMode::SimulateExaminer => "Sinodal simulado",
            AiActionMode::AppHelp => "Ayuda de la app",
            AiActionMode::LearnLatex => "Entender el LaTeX",
            // Auto
            AiActionMode::ImproveWriting => "Mejorar redacción",
            AiActionMode::ShortenText => "Acortar",
            AiActionMode::ExpandText => "Ampliar",
            AiActionMode::RewriteText => "Reescribir",
            AiActionMode::ConvertToLatex => "→ LaTeX",
            AiActionMode::AddParagraph => "Añadir párrafo",
            // Confirmation
            AiActionMode::InsertCitation => "Insertar cita",
            AiActionMode::AddBibliographyEntry => "Añadir referencia",
            AiActionMode::InsertCrossReference => "Insertar referencia cruzada",
            AiActionMode::InsertTable => "Insertar tabla",
            AiActionMode::InsertFigurePlaceholder => "Insertar figura",
            AiActionMode::InsertEquation => "Insertar ecuación",
            AiActionMode::AddGlossaryEntry => "Añadir al glosario",
            AiActionMode::AddAcronym => "Añadir acrónimo",
            AiActionMode::InsertCodeBlock => "Insertar código",
            AiActionMode::GenerateAbstract => "Generar abstract",
            AiActionMode::GenerateCaption => "Generar caption",
        }
    }

    pub fn touches_document(&self) -> bool {
        !matches!(
            self,
            AiActionMode::Ask
                | AiActionMode::ExplainLatexError
                | AiActionMode::ReviewContent
                | AiActionMode::SuggestSources
                | AiActionMode::AnalyzeArgument
                | AiActionMode::CheckConsistency
                | AiActionMode::SuggestStructure
                | AiActionMode::SimulateExaminer
                | AiActionMode::AppHelp
                | AiActionMode::LearnLatex
        )
    }
}

/// Acción propuesta por la IA sobre el documento.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AiProposedAction {
    /// Reemplazar texto seleccionado. Nivel: AutoWithNotification.
    ReplaceSelection {
        original: String,
        replacement: String,
        block_id: Option<String>,
        start: Option<usize>,
        end: Option<usize>,
    },
    /// Insertar contenido nuevo después del cursor. Nivel: AutoWithNotification o Medium según el modo.
    InsertAtCursor {
        content: String,
        /// Descripción breve de qué se insertó, para la notificación al usuario.
        description: String,
    },
    /// Solo mostrar en el chat. Nivel: Low.
    ShowInChat { response: String },
}

/// Elementos del proyecto que la IA puede analizar pero nunca modificar.
#[allow(dead_code)]
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
