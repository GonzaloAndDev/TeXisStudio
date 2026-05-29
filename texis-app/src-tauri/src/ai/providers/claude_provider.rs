use crate::ai::conversation::AiRole;
use crate::ai::request::AiRequest;
use crate::ai::response::{AiProviderError, AiResponse, AiUsage};
use crate::ai::safety::AiSafetyPolicy;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const CLAUDE_BASE: &str = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const TIMEOUT: Duration = Duration::from_secs(60);

// ── Anthropic API types ───────────────────────────────────────────────────────

#[derive(Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    system: String,
    messages: Vec<ClaudeMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Serialize, Deserialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ClaudeResponse {
    content: Vec<ClaudeContent>,
    usage: Option<ClaudeUsage>,
}

#[derive(Deserialize)]
struct ClaudeContent {
    #[serde(rename = "type")]
    content_type: String,
    text: Option<String>,
}

#[derive(Deserialize)]
struct ClaudeUsage {
    input_tokens: u32,
    output_tokens: u32,
}

#[derive(Deserialize)]
struct ClaudeError {
    error: ClaudeErrorBody,
}

#[allow(dead_code)]
#[derive(Deserialize)]
struct ClaudeErrorBody {
    message: String,
    #[serde(rename = "type")]
    error_type: String,
}

// ── Provider ──────────────────────────────────────────────────────────────────

pub struct ClaudeProvider {
    api_key: String,
}

impl ClaudeProvider {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
        }
    }

    pub async fn send(&self, request: &AiRequest) -> Result<AiResponse, AiProviderError> {
        if self.api_key.trim().is_empty() {
            return Err(AiProviderError::NotConfigured);
        }

        let system_prompt = format!(
            "{}{}",
            request.system_prompt,
            request.context.to_prompt_block()
        );

        let messages: Vec<ClaudeMessage> = request
            .messages
            .iter()
            .filter(|m| m.role != AiRole::System)
            .map(|m| ClaudeMessage {
                role: match m.role {
                    AiRole::User => "user".to_string(),
                    AiRole::Assistant => "assistant".to_string(),
                    AiRole::System => "user".to_string(),
                },
                content: m.content.clone(),
            })
            .collect();

        if messages.is_empty() {
            return Err(AiProviderError::ProviderError(
                "No hay mensajes en la conversación".to_string(),
            ));
        }

        let body = ClaudeRequest {
            model: request.model_id.clone(),
            max_tokens: 2048,
            system: system_prompt,
            messages,
            temperature: request.temperature,
        };

        let client = reqwest::Client::builder()
            .timeout(TIMEOUT)
            .build()
            .map_err(|e| AiProviderError::NetworkError(e.to_string()))?;

        let resp = client
            .post(CLAUDE_BASE)
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
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
            if let Ok(ce) = serde_json::from_str::<ClaudeError>(&err_text) {
                return Err(AiProviderError::ProviderError(ce.error.message));
            }
            return Err(AiProviderError::ProviderError(format!(
                "HTTP {}: {}",
                status, err_text
            )));
        }

        let claude_resp: ClaudeResponse = resp
            .json()
            .await
            .map_err(|e| AiProviderError::ProviderError(e.to_string()))?;

        let text = claude_resp
            .content
            .iter()
            .filter(|c| c.content_type == "text")
            .filter_map(|c| c.text.clone())
            .collect::<Vec<_>>()
            .join("");

        AiSafetyPolicy::validate_response_text(&text).map_err(AiProviderError::SafetyRejection)?;

        let usage = claude_resp.usage.map(|u| AiUsage {
            prompt_tokens: u.input_tokens,
            completion_tokens: u.output_tokens,
            total_tokens: u.input_tokens + u.output_tokens,
        });

        let (response_text, action) =
            crate::ai::engine::extract_action(&text, &request.action_mode, &request.context);
        let mut ai_response = match action {
            Some(act) => {
                let safety = AiSafetyPolicy::classify_action(&act, &request.action_mode);
                AiResponse::with_action(response_text, act, safety)
            }
            None => AiResponse::chat_only(response_text),
        };
        ai_response.usage = usage;
        Ok(ai_response)
    }
}
