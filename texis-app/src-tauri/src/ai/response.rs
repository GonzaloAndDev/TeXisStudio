use super::action::AiProposedAction;
use super::safety::AiSafetyDecision;
use serde::{Deserialize, Serialize};

/// Respuesta completa del AIEngine al frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiResponse {
    /// Texto de la respuesta para mostrar en el chat.
    pub text: String,
    /// Acción propuesta, si la hay.
    pub proposed_action: Option<AiProposedAction>,
    /// Clasificación de seguridad de la acción propuesta.
    pub safety: Option<AiSafetyDecision>,
    /// Tokens usados (informativo).
    pub usage: Option<AiUsage>,
}

impl AiResponse {
    /// Respuesta solo de chat, sin acción sobre el documento.
    pub fn chat_only(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            proposed_action: None,
            safety: None,
            usage: None,
        }
    }

    /// Respuesta con acción propuesta y su clasificación de seguridad.
    pub fn with_action(
        text: impl Into<String>,
        action: AiProposedAction,
        safety: AiSafetyDecision,
    ) -> Self {
        Self {
            text: text.into(),
            proposed_action: Some(action),
            safety: Some(safety),
            usage: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Error del proveedor de IA.
#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
pub enum AiProviderError {
    #[error("Proveedor no configurado — agrega tu API key en Configuración")]
    NotConfigured,
    #[error("Error de red: {0}")]
    NetworkError(String),
    #[error("Error de autenticación — verifica tu API key")]
    AuthError,
    #[error("Límite de peticiones excedido — intenta en unos minutos")]
    RateLimited,
    #[error("Modelo no disponible: {0}")]
    ModelNotAvailable(String),
    #[error("Respuesta rechazada por política de seguridad: {0}")]
    SafetyRejection(String),
    #[error("Error del proveedor: {0}")]
    ProviderError(String),
}
