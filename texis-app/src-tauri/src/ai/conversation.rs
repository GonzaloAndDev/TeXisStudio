use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type AiConversationId = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiRole {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessage {
    pub role: AiRole,
    pub content: String,
}

impl AiMessage {
    pub fn user(content: impl Into<String>) -> Self {
        Self { role: AiRole::User, content: content.into() }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self { role: AiRole::Assistant, content: content.into() }
    }
    pub fn system(content: impl Into<String>) -> Self {
        Self { role: AiRole::System, content: content.into() }
    }
}

/// Conversación independiente por proveedor.
/// Cada tab de proveedor en la UI mantiene su propia instancia.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConversation {
    pub id: AiConversationId,
    pub provider_id: String,
    pub messages: Vec<AiMessage>,
}

impl AiConversation {
    pub fn new(provider_id: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            provider_id: provider_id.into(),
            messages: Vec::new(),
        }
    }

    pub fn push(&mut self, message: AiMessage) {
        self.messages.push(message);
    }

    pub fn clear(&mut self) {
        self.messages.clear();
    }

    /// Retorna solo los mensajes para enviar al proveedor (sin system messages).
    pub fn messages_for_api(&self) -> Vec<&AiMessage> {
        self.messages
            .iter()
            .filter(|m| m.role != AiRole::System)
            .collect()
    }
}
