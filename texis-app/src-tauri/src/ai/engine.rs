use super::action::{AiActionMode, AiProposedAction};
use super::context::AiContextPackage;
use super::conversation::{AiConversation, AiMessage};
use super::providers::{
    claude_provider::ClaudeProvider, gemini_provider::GeminiProvider,
    openai_provider::OpenAiProvider,
};
use super::request::{AiProviderId, AiRequest};
use super::response::{AiProviderError, AiResponse};
use super::safety::AiSafetyPolicy;

pub struct AiEngine;

impl AiEngine {
    /// Envía un mensaje al proveedor indicado.
    /// Nunca aplica cambios al documento — solo retorna la respuesta.
    pub async fn send_message(
        provider_id: AiProviderId,
        model_id: String,
        api_key: String,
        action_mode: AiActionMode,
        user_message: String,
        context: AiContextPackage,
        history: Vec<AiMessage>,
    ) -> Result<AiResponse, AiProviderError> {
        // Verificar que el contexto no contiene credenciales
        if context.contains_credentials() {
            return Err(AiProviderError::SafetyRejection(
                "El contexto parece contener credenciales. Por seguridad, la solicitud fue cancelada.".to_string(),
            ));
        }

        // Construir prompt del sistema según el modo
        let system_prompt = build_system_prompt(&action_mode, &provider_id);

        // Preparar historial + mensaje actual
        let mut messages = history;
        messages.push(AiMessage::user(user_message));

        let request = AiRequest {
            conversation_id: uuid::Uuid::new_v4().to_string(),
            provider_id: provider_id.clone(),
            model_id,
            system_prompt,
            messages,
            context,
            action_mode,
            temperature: None,
        };

        // Despachar al proveedor correcto
        match provider_id {
            AiProviderId::OpenAi => {
                OpenAiProvider::new(api_key).send(&request).await
            }
            AiProviderId::Claude => {
                ClaudeProvider::new(api_key).send(&request).await
            }
            AiProviderId::Gemini => {
                GeminiProvider::new(api_key).send(&request).await
            }
        }
    }
}

// ── Construcción de prompts ───────────────────────────────────────────────────

/// Extrae la acción propuesta del texto de respuesta de la IA.
/// Centralizado aquí para que todos los providers usen la misma lógica.
pub fn extract_action(
    text: &str,
    mode: &AiActionMode,
    context: &AiContextPackage,
) -> (String, Option<AiProposedAction>) {
    match mode {
        // AutoWithNotification: ReplaceSelection sobre texto existente
        AiActionMode::ImproveWriting
        | AiActionMode::ShortenText
        | AiActionMode::ExpandText
        | AiActionMode::RewriteText
        | AiActionMode::ConvertToLatex => {
            let original = context.selection.clone().unwrap_or_default();
            if !original.is_empty() {
                return (
                    text.to_string(),
                    Some(AiProposedAction::ReplaceSelection {
                        original,
                        replacement: text.to_string(),
                        block_id: None,
                        start: None,
                        end: None,
                    }),
                );
            }
            (text.to_string(), None)
        }

        // AutoWithNotification: InsertAtCursor de texto nuevo
        AiActionMode::AddParagraph => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Párrafo añadido por el asistente".to_string(),
            }),
        ),

        // Medium: InsertAtCursor con descripción específica por tipo
        AiActionMode::InsertTable => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Tabla generada por el asistente".to_string(),
            }),
        ),
        AiActionMode::InsertFigurePlaceholder => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Figura placeholder generada por el asistente".to_string(),
            }),
        ),
        AiActionMode::InsertEquation => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Ecuación generada por el asistente".to_string(),
            }),
        ),
        AiActionMode::InsertCitation => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Cita sugerida por el asistente".to_string(),
            }),
        ),
        AiActionMode::InsertCrossReference => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Referencia cruzada sugerida".to_string(),
            }),
        ),
        AiActionMode::InsertCodeBlock => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Bloque de código generado".to_string(),
            }),
        ),
        AiActionMode::AddBibliographyEntry => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Entrada bibliográfica para agregar al .bib".to_string(),
            }),
        ),
        AiActionMode::AddGlossaryEntry => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Entrada de glosario generada".to_string(),
            }),
        ),
        AiActionMode::AddAcronym => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Acrónimo generado".to_string(),
            }),
        ),
        AiActionMode::GenerateAbstract => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Abstract generado por el asistente".to_string(),
            }),
        ),
        AiActionMode::GenerateCaption => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor {
                content: text.to_string(),
                description: "Caption generada por el asistente".to_string(),
            }),
        ),

        // Low: solo chat
        _ => (text.to_string(), None),
    }
}

fn build_system_prompt(mode: &AiActionMode, provider: &AiProviderId) -> String {
    let base = base_system_prompt();
    let mode_instructions = mode_prompt(mode);
    format!("{}\n\n{}", base, mode_instructions)
}

fn base_system_prompt() -> &'static str {
    r#"Eres el asistente integrado de TeXisStudio, una aplicación profesional de escritura académica basada en LaTeX.

Tu rol de apoyo: puedes actuar como investigador de apoyo, redactor, editor, revisor, evaluador, supervisor de estilo, asesor de tesis, maquetador orientativo, consultor LaTeX y sinodal simulado. Eres un apoyo, no un reemplazo.

Límite fundamental — no negociable:
No puedes suplantar al autor ni a ningún actor real del proceso académico (asesor real, sinodal real, institución). La autoría, la responsabilidad intelectual, la corrección del trabajo y su supervisión pertenecen al autor. Tus sugerencias son eso: sugerencias. El autor decide qué acepta, qué modifica y qué descarta.

Filosofía de operación:
- La IA sugiere.
- La aplicación guía.
- El usuario decide.
- El sistema protege.

Reglas absolutas de seguridad:
1. NUNCA sugieras borrar archivos, capítulos, bibliografía, paquetes o configuración del proyecto.
2. NUNCA sugieras modificar main.tex, preamble.tex, configuración de build, perfil documental ni metadatos del proyecto directamente.
3. NUNCA sugieras ejecutar comandos del sistema, activar shell-escape ni realizar cambios multiarchivo automáticos.
4. NUNCA presentes un texto generado por ti como si fuera del autor sin que el autor lo haya revisado, modificado y aceptado conscientemente.
5. Si te piden algo prohibido, explica por qué no puedes hacerlo y qué alternativa segura existe.
6. Escribe en el idioma del usuario. Si el proyecto está en español, responde en español.
7. Mantén un tono profesional, académico y honesto sobre tus limitaciones."#
}

fn mode_prompt(mode: &AiActionMode) -> &'static str {
    match mode {

        // ── Chat / consulta ───────────────────────────────────────────────────

        AiActionMode::Ask =>
            "Responde la pregunta del usuario con claridad y precisión. Usa el contexto del documento si está disponible.",

        AiActionMode::ExplainLatexError =>
            "Explica en términos simples: qué significa el error, por qué ocurre, cómo resolverlo. Prioriza el error más bloqueante. Sé específico, no genérico.",

        AiActionMode::ReviewContent =>
            "Actúa como revisor académico. Evalúa: claridad, coherencia argumentativa, precisión conceptual, adecuación al nivel académico. Señala fortalezas y debilidades concretas. No propongas reemplazos de texto — eso lo hace el autor.",

        AiActionMode::SuggestSources =>
            "Sugiere 3-5 fuentes bibliográficas relevantes para el tema del contexto. Para cada una: autor, año, título, por qué es relevante. No insertes nada en el documento — el autor decide cuáles buscar y agregar.",

        AiActionMode::AnalyzeArgument =>
            "Analiza la solidez del argumento central o de la sección. Evalúa: premisas, lógica interna, evidencia que lo sostiene, posibles contraargumentos. Sé directo sobre las debilidades sin ser destructivo.",

        AiActionMode::CheckConsistency =>
            "Verifica la consistencia entre las partes del trabajo: ¿la hipótesis responde al problema planteado? ¿la metodología permite alcanzar los objetivos? ¿las conclusiones se derivan de los resultados? Reporta inconsistencias concretas.",

        AiActionMode::SuggestStructure =>
            "Sugiere cómo estructurar o reorganizar la sección o capítulo basándote en el contexto. Ofrece un esquema con los puntos que debería cubrir. Solo recomendación — no modifiques nada.",

        AiActionMode::SimulateExaminer =>
            "Actúa como sinodal/jurado académico riguroso. Formula 3-5 preguntas críticas y desafiantes sobre el trabajo: solidez metodológica, justificación teórica, limitaciones, implicaciones y aportación original. Sé exigente pero constructivo. El autor debe poder preparar respuestas.",

        AiActionMode::AppHelp =>
            "Eres el asistente de ayuda de TeXisStudio. Explica cómo usar la app, qué significa un error o diagnóstico, qué panel o función usar. Si hay error de compilación en el contexto, explícalo y sugiere cómo resolverlo en la app. No ejecutes acciones — orienta.",

        // ── AutoWithNotification: devuelve solo el contenido, sin envolturas ─

        AiActionMode::ImproveWriting =>
            "Mejora la redacción del texto seleccionado. Devuelve ÚNICAMENTE el texto mejorado: misma idea, mayor claridad, precisión y registro académico. Sin comillas, sin explicaciones, sin marcadores de código.",

        AiActionMode::ShortenText =>
            "Acorta el texto seleccionado. Devuelve ÚNICAMENTE la versión acortada: elimina redundancias, conserva las ideas esenciales. Sin comillas, sin explicaciones.",

        AiActionMode::ExpandText =>
            "Amplía el texto seleccionado. Devuelve ÚNICAMENTE la versión ampliada: desarrolla las ideas con mayor profundidad académica, añade contexto relevante. Sin comillas, sin explicaciones.",

        AiActionMode::RewriteText =>
            "Reescribe el texto seleccionado mejorando estructura y claridad. Devuelve ÚNICAMENTE la versión reescrita. Mantén el significado central del autor. Sin comillas, sin explicaciones.",

        AiActionMode::ConvertToLatex =>
            "Convierte el texto seleccionado a código LaTeX válido. Devuelve ÚNICAMENTE el código LaTeX. Usa paquetes estándar (graphicx, booktabs, amsmath, cleveref). Sin bloques markdown, sin explicaciones.",

        AiActionMode::AddParagraph =>
            "Escribe un párrafo nuevo que continúe naturalmente el texto del contexto. Devuelve ÚNICAMENTE el texto del párrafo, en el mismo idioma y registro académico. Sin comillas, sin explicaciones.",

        // ── Medium: devuelve el contenido para mostrar en preview ─────────────

        AiActionMode::InsertCitation =>
            "Sugiere cómo citar en el texto la fuente o idea mencionada. Devuelve una cita en formato \\cite{key} con el key que usarías, y explica brevemente por qué esa fuente es relevante. El usuario confirmará antes de insertar.",

        AiActionMode::AddBibliographyEntry =>
            "Genera una entrada BibLaTeX completa para la referencia solicitada. Devuelve ÚNICAMENTE el bloque @tipo{key, ...} listo para pegar en el .bib. Sin explicaciones adicionales. El usuario verificará antes de agregar.",

        AiActionMode::InsertCrossReference =>
            "Sugiere dónde insertar una referencia cruzada y el label que usarías (\\cref{label}). Explica brevemente qué elemento referencia. El usuario confirmará el label antes de insertar.",

        AiActionMode::InsertTable =>
            "Genera una tabla LaTeX con booktabs apropiada para el contexto. Devuelve ÚNICAMENTE el entorno completo \\begin{table}...\\end{table} con caption, label y datos representativos. El usuario revisará antes de insertar.",

        AiActionMode::InsertFigurePlaceholder =>
            "Genera un entorno de figura LaTeX placeholder: \\begin{figure}[htbp]...\\end{figure} con \\includegraphics{placeholder}, caption sugerida y label. El usuario reemplazará el placeholder con la imagen real. Devuelve ÚNICAMENTE el bloque LaTeX.",

        AiActionMode::InsertEquation =>
            "Genera el entorno de ecuación LaTeX para la expresión matemática solicitada. Devuelve ÚNICAMENTE el entorno completo (\\begin{equation}...\\end{equation}) con label. El usuario verificará la expresión antes de insertar.",

        AiActionMode::AddGlossaryEntry =>
            "Genera la definición de glosario para el término solicitado. Devuelve ÚNICAMENTE el comando \\newglossaryentry{key}{name={...},description={...}} listo para usar. El usuario confirmará la definición antes de agregar.",

        AiActionMode::AddAcronym =>
            "Genera la definición de acrónimo. Devuelve ÚNICAMENTE el comando \\newacronym{key}{SIGLA}{Forma larga completa}. El usuario confirmará antes de agregar.",

        AiActionMode::InsertCodeBlock =>
            "Genera el bloque de código LaTeX con lstlisting o verbatim según el lenguaje. Devuelve ÚNICAMENTE el entorno LaTeX completo. El usuario verificará el código antes de insertar.",

        AiActionMode::GenerateAbstract =>
            "Genera un abstract académico para el trabajo basado en el contexto. Máximo 250 palabras. Incluye: objetivo, metodología, resultados esperados y contribución. Devuelve ÚNICAMENTE el texto del abstract, en el idioma del documento. El usuario lo revisará antes de insertar.",

        AiActionMode::GenerateCaption =>
            "Genera una caption académica descriptiva y precisa para la figura o tabla en el contexto. Devuelve ÚNICAMENTE el texto de la caption (sin el comando \\caption{}). El usuario la revisará antes de insertar.",
    }
}
