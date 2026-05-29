// Comandos Tauri para AIEngine v1.
// Estos son el único punto de entrada desde el frontend.
// No aplican cambios al documento — solo retornan la respuesta de la IA.
// El frontend es responsable de mostrar el preview y pedir confirmación.

use crate::ai::action::AiActionMode;
use crate::ai::context::{AiContextPackage, AiContextScope};
use crate::ai::conversation::AiMessage;
use crate::ai::engine::AiEngine;
use crate::ai::request::AiProviderId;
use crate::ai::response::{AiProviderError, AiResponse};
use serde::{Deserialize, Serialize};

// ── Tipos del frontend ────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AiSendRequest {
    pub provider: String,       // "openai" | "claude" | "gemini"
    pub model_id: String,
    pub api_key: String,        // nunca se persiste, viene de la sesión del frontend
    pub action_mode: String,    // snake_case del enum AiActionMode
    pub user_message: String,
    pub context: AiFrontendContext,
    pub history: Vec<AiFrontendMessage>,
}

#[derive(Deserialize)]
pub struct AiFrontendContext {
    pub scope: String,          // "none" | "current_selection" | "current_file" | "diagnostics" | "build_log"
    pub selection: Option<String>,
    pub file_name: Option<String>,
    pub file_content: Option<String>,
    pub diagnostics: Option<String>,
    pub build_log: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct AiFrontendMessage {
    pub role: String,           // "user" | "assistant"
    pub content: String,
}

#[derive(Serialize)]
pub struct AiCommandResponse {
    pub ok: bool,
    pub text: Option<String>,
    pub proposed_action: Option<serde_json::Value>,
    pub safety: Option<serde_json::Value>,
    pub error: Option<String>,
    pub error_kind: Option<String>,
}

impl AiCommandResponse {
    fn success(response: AiResponse) -> Self {
        let proposed = response.proposed_action.as_ref()
            .and_then(|a| serde_json::to_value(a).ok());
        let safety = response.safety.as_ref()
            .and_then(|s| serde_json::to_value(s).ok());
        Self {
            ok: true,
            text: Some(response.text),
            proposed_action: proposed,
            safety,
            error: None,
            error_kind: None,
        }
    }

    fn error(err: AiProviderError) -> Self {
        let kind = match &err {
            AiProviderError::NotConfigured => "not_configured",
            AiProviderError::NetworkError(_) => "network_error",
            AiProviderError::AuthError => "auth_error",
            AiProviderError::RateLimited => "rate_limited",
            AiProviderError::ModelNotAvailable(_) => "model_not_available",
            AiProviderError::SafetyRejection(_) => "safety_rejection",
            AiProviderError::ProviderError(_) => "provider_error",
        };
        Self {
            ok: false,
            text: None,
            proposed_action: None,
            safety: None,
            error: Some(err.to_string()),
            error_kind: Some(kind.to_string()),
        }
    }
}

// ── Parseo de tipos del frontend ──────────────────────────────────────────────

fn parse_provider(s: &str) -> Option<AiProviderId> {
    match s {
        "openai" => Some(AiProviderId::OpenAi),
        "claude" => Some(AiProviderId::Claude),
        "gemini" => Some(AiProviderId::Gemini),
        _ => None,
    }
}

fn parse_action_mode(s: &str) -> Option<AiActionMode> {
    match s {
        "ask" => Some(AiActionMode::Ask),
        "improve_writing" => Some(AiActionMode::ImproveWriting),
        "shorten_text" => Some(AiActionMode::ShortenText),
        "expand_text" => Some(AiActionMode::ExpandText),
        "convert_to_latex" => Some(AiActionMode::ConvertToLatex),
        "explain_latex_error" => Some(AiActionMode::ExplainLatexError),
        "generate_table_snippet" => Some(AiActionMode::GenerateTableSnippet),
        "generate_caption" => Some(AiActionMode::GenerateCaption),
        "generate_abstract" => Some(AiActionMode::GenerateAbstract),
        "simulate_examiner" => Some(AiActionMode::SimulateExaminer),
        "app_help" => Some(AiActionMode::AppHelp),
        _ => None,
    }
}

fn parse_context(ctx: AiFrontendContext) -> AiContextPackage {
    match ctx.scope.as_str() {
        "current_selection" => {
            AiContextPackage::with_selection(ctx.selection.unwrap_or_default())
        }
        "current_file" => AiContextPackage::with_file(
            ctx.file_name.unwrap_or_else(|| "archivo.tex".to_string()),
            ctx.file_content.unwrap_or_default(),
        ),
        "diagnostics" => {
            AiContextPackage::with_diagnostics(ctx.diagnostics.unwrap_or_default())
        }
        "build_log" => {
            AiContextPackage::with_build_log(ctx.build_log.unwrap_or_default())
        }
        _ => AiContextPackage::none(),
    }
}

fn parse_history(history: Vec<AiFrontendMessage>) -> Vec<AiMessage> {
    history
        .into_iter()
        .map(|m| match m.role.as_str() {
            "assistant" => AiMessage::assistant(m.content),
            _ => AiMessage::user(m.content),
        })
        .collect()
}

// ── Comando Tauri ─────────────────────────────────────────────────────────────

/// Envía un mensaje al proveedor de IA.
/// Nunca aplica cambios al documento.
/// El frontend muestra el preview y pide confirmación antes de cualquier cambio.
#[tauri::command]
pub async fn ai_send_message(request: AiSendRequest) -> AiCommandResponse {
    let provider = match parse_provider(&request.provider) {
        Some(p) => p,
        None => return AiCommandResponse::error(AiProviderError::ProviderError(
            format!("Proveedor desconocido: '{}'", request.provider),
        )),
    };

    let action_mode = match parse_action_mode(&request.action_mode) {
        Some(m) => m,
        None => return AiCommandResponse::error(AiProviderError::ProviderError(
            format!("Modo de acción desconocido: '{}'", request.action_mode),
        )),
    };

    // Validar que el mensaje no está vacío
    if request.user_message.trim().is_empty() {
        return AiCommandResponse::error(AiProviderError::ProviderError(
            "El mensaje no puede estar vacío.".to_string(),
        ));
    }

    let context = parse_context(request.context);
    let history = parse_history(request.history);

    match AiEngine::send_message(
        provider,
        request.model_id,
        request.api_key,
        action_mode,
        request.user_message,
        context,
        history,
    )
    .await
    {
        Ok(response) => AiCommandResponse::success(response),
        Err(err) => AiCommandResponse::error(err),
    }
}

/// Retorna los modos de acción disponibles con sus metadatos.
#[tauri::command]
pub fn ai_get_action_modes() -> Vec<serde_json::Value> {
    use crate::ai::safety::AiSafetyPolicy;
    let modes = [
        AiActionMode::Ask,
        AiActionMode::ImproveWriting,
        AiActionMode::ShortenText,
        AiActionMode::ExpandText,
        AiActionMode::ConvertToLatex,
        AiActionMode::ExplainLatexError,
        AiActionMode::GenerateTableSnippet,
        AiActionMode::GenerateCaption,
        AiActionMode::GenerateAbstract,
        AiActionMode::SimulateExaminer,
        AiActionMode::AppHelp,
    ];

    modes.iter().map(|m| {
        let safety = AiSafetyPolicy::classify_mode(m);
        serde_json::json!({
            "id": serde_json::to_value(m).unwrap_or(serde_json::Value::Null),
            "name": m.display_name(),
            "touches_document": m.touches_document(),
            "risk_level": serde_json::to_value(&safety.risk_level).unwrap_or(serde_json::Value::Null),
            "requires_confirmation": safety.requires_user_confirmation,
        })
    }).collect()
}
