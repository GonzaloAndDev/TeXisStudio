use super::action::AiActionMode;
use super::context::AiContextPackage;
use super::conversation::{AiConversation, AiMessage};
use super::providers::{
    claude_provider::ClaudeProvider, gemini_provider::GeminiProvider,
    openai_provider::OpenAiProvider,
};
use super::request::{AiProviderId, AiRequest};
use super::response::{AiProviderError, AiResponse};
use super::safety::AiSafetyPolicy;
use crate::ai::action::AiProposedAction;

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
        AiActionMode::Ask => {
            "Responde la pregunta del usuario de forma clara y precisa. Si incluye contexto del documento, úsalo para dar una respuesta más relevante."
        }
        AiActionMode::ImproveWriting => {
            "El usuario quiere mejorar el texto seleccionado. Devuelve ÚNICAMENTE el texto mejorado, sin explicaciones adicionales, sin comillas, sin marcadores de código. El texto mejorado debe mantener el mismo significado, ser más claro, más preciso y más académico."
        }
        AiActionMode::ShortenText => {
            "El usuario quiere acortar el texto seleccionado. Devuelve ÚNICAMENTE el texto acortado, sin explicaciones, sin comillas. Elimina redundancias y mantén las ideas esenciales."
        }
        AiActionMode::ExpandText => {
            "El usuario quiere ampliar el texto seleccionado. Devuelve ÚNICAMENTE el texto ampliado, sin explicaciones, sin comillas. Desarrolla las ideas, añade precisión académica y contexto relevante."
        }
        AiActionMode::ConvertToLatex => {
            "El usuario quiere convertir el texto seleccionado a LaTeX válido. Devuelve ÚNICAMENTE el código LaTeX, sin explicaciones, sin bloques de código markdown. Usa paquetes estándar (graphicx, booktabs, amsmath, etc.)."
        }
        AiActionMode::ExplainLatexError => {
            "El usuario tiene un error de LaTeX. Explica en términos simples: qué significa el error, por qué ocurre, y cómo resolverlo. Sé específico y práctico. Si hay múltiples errores, prioriza el más bloqueante."
        }
        AiActionMode::GenerateTableSnippet => {
            "Genera un snippet de tabla LaTeX con booktabs. Devuelve ÚNICAMENTE el código LaTeX de la tabla, sin explicaciones, sin bloques markdown. Incluye caption y label. Usa columnas apropiadas según el contexto."
        }
        AiActionMode::GenerateCaption => {
            "Genera una caption académica profesional para la figura o tabla en el contexto. Devuelve ÚNICAMENTE el texto de la caption, sin \\caption{}, sin comillas, sin explicaciones. Debe ser descriptiva, precisa y seguir convenciones académicas."
        }
        AiActionMode::GenerateAbstract => {
            "Genera un abstract académico basado en el contenido del proyecto. Devuelve ÚNICAMENTE el texto del abstract, sin \\abstract{}, sin comillas, sin explicaciones. Incluye: objetivo, metodología, resultados esperados y contribución. Máximo 250 palabras."
        }
        AiActionMode::SimulateExaminer => {
            "Actúa como sinodal/jurado académico riguroso. Formula preguntas críticas, desafiantes y académicamente relevantes sobre el trabajo. Las preguntas deben explorar: solidez metodológica, justificación teórica, limitaciones, implicaciones y contribución original. Sé exigente pero constructivo."
        }
        AiActionMode::AppHelp => {
            "Eres el asistente de ayuda de TeXisStudio. Explica cómo usar la aplicación, qué significa un error o diagnóstico, qué panel o función usar para una tarea específica. Si el usuario tiene un error de compilación en el contexto, explícalo y sugiere cómo resolverlo dentro de la app. No ejecutes acciones — solo explica y orienta."
        }
    }
}
