use super::action::AiActionMode;
use super::context::AiContextPackage;
use super::conversation::{AiConversationId, AiMessage};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiProviderId {
    OpenAi,
    Claude,
    Gemini,
}

impl AiProviderId {
    #[allow(dead_code)]
    pub fn as_str(&self) -> &'static str {
        match self {
            AiProviderId::OpenAi => "openai",
            AiProviderId::Claude => "claude",
            AiProviderId::Gemini => "gemini",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiRequest {
    pub conversation_id: AiConversationId,
    pub provider_id: AiProviderId,
    /// ID del modelo dentro del proveedor, p. ej. "gpt-4o", "claude-sonnet-4-6", "gemini-2.0-flash".
    pub model_id: String,
    /// Prompt del sistema ya construido por el módulo de prompts.
    pub system_prompt: String,
    /// Historial de la conversación (sin system messages).
    pub messages: Vec<AiMessage>,
    /// Contexto del documento que el usuario eligió compartir.
    pub context: AiContextPackage,
    /// Modo de acción solicitado.
    pub action_mode: AiActionMode,
    /// Temperatura para la generación. None → usar default del proveedor.
    pub temperature: Option<f32>,
}
