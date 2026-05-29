use crate::ai::action::AiProposedAction;
use crate::ai::request::AiRequest;
use crate::ai::response::{AiProviderError, AiResponse, AiUsage};
use crate::ai::safety::AiSafetyPolicy;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const OPENAI_BASE: &str = "https://api.openai.com/v1/chat/completions";
const TIMEOUT: Duration = Duration::from_secs(60);

// ── OpenAI API types ──────────────────────────────────────────────────────────

#[derive(Serialize)]
struct OaiRequest {
    model: String,
    messages: Vec<OaiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    max_tokens: u32,
}

#[derive(Serialize, Deserialize)]
struct OaiMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OaiResponse {
    choices: Vec<OaiChoice>,
    usage: Option<OaiUsage>,
}

#[derive(Deserialize)]
struct OaiChoice {
    message: OaiMessage,
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct OaiUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Deserialize)]
struct OaiError {
    error: OaiErrorBody,
}

#[derive(Deserialize)]
struct OaiErrorBody {
    message: String,
    #[serde(rename = "type")]
    error_type: Option<String>,
    code: Option<String>,
}

// ── Provider ──────────────────────────────────────────────────────────────────

pub struct OpenAiProvider {
    api_key: String,
}

impl OpenAiProvider {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self { api_key: api_key.into() }
    }

    pub async fn send(&self, request: &AiRequest) -> Result<AiResponse, AiProviderError> {
        if self.api_key.trim().is_empty() {
            return Err(AiProviderError::NotConfigured);
        }

        // Construir mensajes
        let mut messages: Vec<OaiMessage> = Vec::new();
        messages.push(OaiMessage {
            role: "system".to_string(),
            content: build_system_prompt(request),
        });
        for msg in &request.messages {
            messages.push(OaiMessage {
                role: match msg.role {
                    crate::ai::conversation::AiRole::User => "user".to_string(),
                    crate::ai::conversation::AiRole::Assistant => "assistant".to_string(),
                    crate::ai::conversation::AiRole::System => "system".to_string(),
                },
                content: msg.content.clone(),
            });
        }

        let body = OaiRequest {
            model: request.model_id.clone(),
            messages,
            temperature: request.temperature,
            max_tokens: 2048,
        };

        let client = reqwest::Client::builder()
            .timeout(TIMEOUT)
            .build()
            .map_err(|e| AiProviderError::NetworkError(e.to_string()))?;

        let resp = client
            .post(OPENAI_BASE)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AiProviderError::NetworkError(e.to_string()))?;

        let status = resp.status();

        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(AiProviderError::AuthError);
        }
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(AiProviderError::RateLimited);
        }
        if !status.is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            if let Ok(oai_err) = serde_json::from_str::<OaiError>(&err_text) {
                return Err(AiProviderError::ProviderError(oai_err.error.message));
            }
            return Err(AiProviderError::ProviderError(format!("HTTP {}: {}", status, err_text)));
        }

        let oai_resp: OaiResponse = resp
            .json()
            .await
            .map_err(|e| AiProviderError::ProviderError(e.to_string()))?;

        let text = oai_resp
            .choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default();

        // Validar texto antes de retornar
        AiSafetyPolicy::validate_response_text(&text)
            .map_err(|e| AiProviderError::SafetyRejection(e))?;

        let usage = oai_resp.usage.map(|u| AiUsage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        });

        // Construir acción propuesta según modo
        let (response_text, action) = extract_action_from_response(&text, request);

        let mut ai_response = match action {
            Some(act) => {
                let safety = AiSafetyPolicy::classify_action(&act);
                AiResponse::with_action(response_text, act, safety)
            }
            None => AiResponse::chat_only(response_text),
        };
        ai_response.usage = usage;
        Ok(ai_response)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn build_system_prompt(request: &AiRequest) -> String {
    let context_block = request.context.to_prompt_block();
    format!("{}{}", request.system_prompt, context_block)
}

/// Extrae la acción propuesta del texto de la IA según el modo.
/// En v1 la IA devuelve texto plano; la app interpreta según el modo.
fn extract_action_from_response(
    text: &str,
    request: &AiRequest,
) -> (String, Option<AiProposedAction>) {
    use crate::ai::action::AiActionMode;

    match &request.action_mode {
        AiActionMode::ImproveWriting
        | AiActionMode::ShortenText
        | AiActionMode::ExpandText
        | AiActionMode::ConvertToLatex => {
            // La respuesta ES el reemplazo propuesto
            let original = request
                .context
                .selection
                .clone()
                .unwrap_or_default();
            if !original.is_empty() {
                let action = AiProposedAction::ReplaceSelection {
                    original,
                    replacement: text.to_string(),
                };
                return (text.to_string(), Some(action));
            }
            (text.to_string(), None)
        }
        AiActionMode::GenerateTableSnippet
        | AiActionMode::GenerateCaption
        | AiActionMode::GenerateAbstract => {
            let action = AiProposedAction::InsertAtCursor {
                content: text.to_string(),
            };
            (text.to_string(), Some(action))
        }
        _ => (text.to_string(), None),
    }
}
