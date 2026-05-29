use crate::ai::action::AiProposedAction;
use crate::ai::conversation::AiRole;
use crate::ai::request::AiRequest;
use crate::ai::response::{AiProviderError, AiResponse, AiUsage};
use crate::ai::safety::AiSafetyPolicy;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const GEMINI_BASE: &str =
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";
const TIMEOUT: Duration = Duration::from_secs(60);

// ── Gemini API types ──────────────────────────────────────────────────────────

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(rename = "systemInstruction", skip_serializing_if = "Option::is_none")]
    system_instruction: Option<GeminiSystemInstruction>,
    #[serde(rename = "generationConfig", skip_serializing_if = "Option::is_none")]
    generation_config: Option<GeminiGenerationConfig>,
}

#[derive(Serialize)]
struct GeminiSystemInstruction {
    parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize, Clone)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize, Clone)]
struct GeminiPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiGenerationConfig {
    #[serde(rename = "maxOutputTokens")]
    max_output_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
    #[serde(rename = "usageMetadata")]
    usage_metadata: Option<GeminiUsage>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: GeminiContent,
    #[serde(rename = "finishReason")]
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct GeminiUsage {
    #[serde(rename = "promptTokenCount")]
    prompt_token_count: Option<u32>,
    #[serde(rename = "candidatesTokenCount")]
    candidates_token_count: Option<u32>,
    #[serde(rename = "totalTokenCount")]
    total_token_count: Option<u32>,
}

// ── Provider ──────────────────────────────────────────────────────────────────

pub struct GeminiProvider {
    api_key: String,
}

impl GeminiProvider {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self { api_key: api_key.into() }
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

        let url = GEMINI_BASE.replace("{model}", &request.model_id);
        let url_with_key = format!("{}?key={}", url, self.api_key);

        let contents: Vec<GeminiContent> = request
            .messages
            .iter()
            .filter(|m| m.role != AiRole::System)
            .map(|m| GeminiContent {
                role: match m.role {
                    AiRole::User => "user".to_string(),
                    AiRole::Assistant => "model".to_string(),
                    AiRole::System => "user".to_string(),
                },
                parts: vec![GeminiPart { text: m.content.clone() }],
            })
            .collect();

        if contents.is_empty() {
            return Err(AiProviderError::ProviderError(
                "No hay mensajes en la conversación".to_string(),
            ));
        }

        let body = GeminiRequest {
            contents,
            system_instruction: Some(GeminiSystemInstruction {
                parts: vec![GeminiPart { text: system_prompt }],
            }),
            generation_config: Some(GeminiGenerationConfig {
                max_output_tokens: 2048,
                temperature: request.temperature,
            }),
        };

        let client = reqwest::Client::builder()
            .timeout(TIMEOUT)
            .build()
            .map_err(|e| AiProviderError::NetworkError(e.to_string()))?;

        let resp = client
            .post(&url_with_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AiProviderError::NetworkError(e.to_string()))?;

        let status = resp.status();

        if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
            return Err(AiProviderError::AuthError);
        }
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(AiProviderError::RateLimited);
        }
        if !status.is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(AiProviderError::ProviderError(format!("HTTP {}: {}", status, err_text)));
        }

        let gemini_resp: GeminiResponse = resp
            .json()
            .await
            .map_err(|e| AiProviderError::ProviderError(e.to_string()))?;

        let text = gemini_resp
            .candidates
            .first()
            .map(|c| {
                c.content
                    .parts
                    .iter()
                    .map(|p| p.text.clone())
                    .collect::<Vec<_>>()
                    .join("")
            })
            .unwrap_or_default();

        AiSafetyPolicy::validate_response_text(&text)
            .map_err(|e| AiProviderError::SafetyRejection(e))?;

        let usage = gemini_resp.usage_metadata.map(|u| AiUsage {
            prompt_tokens: u.prompt_token_count.unwrap_or(0),
            completion_tokens: u.candidates_token_count.unwrap_or(0),
            total_tokens: u.total_token_count.unwrap_or(0),
        });

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
            let original = request.context.selection.clone().unwrap_or_default();
            if !original.is_empty() {
                return (
                    text.to_string(),
                    Some(AiProposedAction::ReplaceSelection {
                        original,
                        replacement: text.to_string(),
                    }),
                );
            }
            (text.to_string(), None)
        }
        AiActionMode::GenerateTableSnippet
        | AiActionMode::GenerateCaption
        | AiActionMode::GenerateAbstract => (
            text.to_string(),
            Some(AiProposedAction::InsertAtCursor { content: text.to_string() }),
        ),
        _ => (text.to_string(), None),
    }
}
