// Comandos Tauri para AIEngine v1.
// Estos son el único punto de entrada desde el frontend.
// No aplican cambios al documento — solo retornan la respuesta de la IA.
// El frontend es responsable de mostrar el preview y pedir confirmación.

use crate::ai::action::AiActionMode;
use crate::ai::context::AiContextPackage;
use crate::ai::conversation::AiMessage;
use crate::ai::engine::AiEngine;
use crate::ai::request::AiProviderId;
use crate::ai::response::{AiProviderError, AiResponse};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

// ── Estado compartido para cancelación ────────────────────────────────────────

/// Bandera global de cancelación para llamadas a la IA. El frontend la activa
/// vía `cancel_ai_message`; el `tokio::select!` dentro de `ai_send_message`
/// la observa y aborta el future de envío (lo que cierra la conexión HTTP
/// vía el cancel-safety de reqwest, evitando "fantasma" de respuesta tardía).
pub struct AiState {
    pub cancel_flag: Arc<AtomicBool>,
}

impl AiState {
    pub fn new() -> Self {
        Self {
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
    }
}

impl Default for AiState {
    fn default() -> Self {
        Self::new()
    }
}

// ── Tipos del frontend ────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct AiSendRequest {
    pub provider: String, // "openai" | "claude" | "gemini"
    pub model_id: String,
    pub api_key: String,     // nunca se persiste, viene de la sesión del frontend
    pub action_mode: String, // snake_case del enum AiActionMode
    pub user_message: String,
    pub context: AiFrontendContext,
    pub history: Vec<AiFrontendMessage>,
}

#[derive(Deserialize)]
pub struct AiFrontendContext {
    pub scope: String, // "none" | "current_selection" | "current_file" | "diagnostics" | "build_log"
    pub selection: Option<String>,
    pub file_name: Option<String>,
    pub file_content: Option<String>,
    pub diagnostics: Option<String>,
    pub build_log: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct AiFrontendMessage {
    pub role: String, // "user" | "assistant"
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
        let proposed = response
            .proposed_action
            .as_ref()
            .and_then(|a| serde_json::to_value(a).ok());
        let safety = response
            .safety
            .as_ref()
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
        "review_content" => Some(AiActionMode::ReviewContent),
        "suggest_sources" => Some(AiActionMode::SuggestSources),
        "analyze_argument" => Some(AiActionMode::AnalyzeArgument),
        "check_consistency" => Some(AiActionMode::CheckConsistency),
        "suggest_structure" => Some(AiActionMode::SuggestStructure),
        "simulate_examiner" => Some(AiActionMode::SimulateExaminer),
        "app_help" => Some(AiActionMode::AppHelp),
        "learn_latex" => Some(AiActionMode::LearnLatex),
        "improve_writing" => Some(AiActionMode::ImproveWriting),
        "shorten_text" => Some(AiActionMode::ShortenText),
        "expand_text" => Some(AiActionMode::ExpandText),
        "rewrite_text" => Some(AiActionMode::RewriteText),
        "convert_to_latex" => Some(AiActionMode::ConvertToLatex),
        "add_paragraph" => Some(AiActionMode::AddParagraph),
        "explain_latex_error" => Some(AiActionMode::ExplainLatexError),
        "insert_citation" => Some(AiActionMode::InsertCitation),
        "add_bibliography_entry" => Some(AiActionMode::AddBibliographyEntry),
        "insert_cross_reference" => Some(AiActionMode::InsertCrossReference),
        "insert_table" => Some(AiActionMode::InsertTable),
        "insert_figure_placeholder" => Some(AiActionMode::InsertFigurePlaceholder),
        "insert_equation" => Some(AiActionMode::InsertEquation),
        "add_glossary_entry" => Some(AiActionMode::AddGlossaryEntry),
        "add_acronym" => Some(AiActionMode::AddAcronym),
        "insert_code_block" => Some(AiActionMode::InsertCodeBlock),
        "generate_caption" => Some(AiActionMode::GenerateCaption),
        "generate_abstract" => Some(AiActionMode::GenerateAbstract),
        _ => None,
    }
}

fn parse_context(ctx: AiFrontendContext) -> AiContextPackage {
    match ctx.scope.as_str() {
        "current_selection" => AiContextPackage::with_selection(ctx.selection.unwrap_or_default()),
        "current_file" => AiContextPackage::with_file(
            ctx.file_name.unwrap_or_else(|| "archivo.tex".to_string()),
            ctx.file_content.unwrap_or_default(),
        ),
        "diagnostics" => AiContextPackage::with_diagnostics(ctx.diagnostics.unwrap_or_default()),
        "build_log" => AiContextPackage::with_build_log(ctx.build_log.unwrap_or_default()),
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
///
/// Es cancelable vía `cancel_ai_message`: el flag compartido es observado por
/// un watcher de tokio que corre en paralelo al envío real. Cuando se activa,
/// el `tokio::select!` aborta el future de send_message; reqwest es cancel-safe
/// y cierra la conexión HTTP al ser dropeado, evitando que el bill del
/// proveedor cuente la respuesta que el usuario ya no quiere ver.
#[tauri::command]
pub async fn ai_send_message(
    state: tauri::State<'_, AiState>,
    request: AiSendRequest,
) -> Result<AiCommandResponse, String> {
    // Reset del flag al inicio para que una cancelación previa no afecte la
    // llamada actual. SeqCst para ordenar el reset frente al setup del watcher.
    state.cancel_flag.store(false, Ordering::SeqCst);
    let cancel = state.cancel_flag.clone();

    let provider = match parse_provider(&request.provider) {
        Some(p) => p,
        None => {
            return Ok(AiCommandResponse::error(AiProviderError::ProviderError(
                format!("Proveedor desconocido: '{}'", request.provider),
            )))
        }
    };

    let action_mode = match parse_action_mode(&request.action_mode) {
        Some(m) => m,
        None => {
            return Ok(AiCommandResponse::error(AiProviderError::ProviderError(
                format!("Modo de acción desconocido: '{}'", request.action_mode),
            )))
        }
    };

    // Validar que el mensaje no está vacío
    if request.user_message.trim().is_empty() {
        return Ok(AiCommandResponse::error(AiProviderError::ProviderError(
            "El mensaje no puede estar vacío.".to_string(),
        )));
    }

    let context = parse_context(request.context);
    let history = parse_history(request.history);

    let send_fut = AiEngine::send_message(
        provider,
        request.model_id,
        request.api_key,
        action_mode,
        request.user_message,
        context,
        history,
    );

    // Watcher: completa cuando el flag de cancelación se activa.
    // Pollea cada 100ms — overhead despreciable, latencia de cancel < 100ms.
    let cancel_watcher = async move {
        loop {
            tokio::time::sleep(Duration::from_millis(100)).await;
            if cancel.load(Ordering::Relaxed) {
                return;
            }
        }
    };

    tokio::select! {
        result = send_fut => Ok(match result {
            Ok(response) => AiCommandResponse::success(response),
            Err(err) => AiCommandResponse::error(err),
        }),
        _ = cancel_watcher => {
            // El send_fut se dropea aquí; reqwest cierra la conexión.
            Ok(AiCommandResponse::error(AiProviderError::ProviderError(
                "Solicitud cancelada por el usuario.".to_string(),
            )))
        }
    }
}

/// Cancela la llamada actual a `ai_send_message`, si hay alguna en vuelo.
/// Idempotente: llamarlo sin solicitud activa es no-op.
#[tauri::command]
pub fn cancel_ai_message(state: tauri::State<'_, AiState>) {
    state.cancel_flag.store(true, Ordering::SeqCst);
}

/// Retorna los modos de acción disponibles con sus metadatos.
#[tauri::command]
pub fn ai_get_action_modes() -> Vec<serde_json::Value> {
    use crate::ai::safety::AiSafetyPolicy;
    let modes = [
        AiActionMode::Ask,
        AiActionMode::ReviewContent,
        AiActionMode::SuggestSources,
        AiActionMode::AnalyzeArgument,
        AiActionMode::CheckConsistency,
        AiActionMode::SuggestStructure,
        AiActionMode::SimulateExaminer,
        AiActionMode::AppHelp,
        AiActionMode::LearnLatex,
        AiActionMode::ImproveWriting,
        AiActionMode::ShortenText,
        AiActionMode::ExpandText,
        AiActionMode::RewriteText,
        AiActionMode::ConvertToLatex,
        AiActionMode::AddParagraph,
        AiActionMode::ExplainLatexError,
        AiActionMode::InsertCitation,
        AiActionMode::AddBibliographyEntry,
        AiActionMode::InsertCrossReference,
        AiActionMode::InsertTable,
        AiActionMode::InsertFigurePlaceholder,
        AiActionMode::InsertEquation,
        AiActionMode::AddGlossaryEntry,
        AiActionMode::AddAcronym,
        AiActionMode::InsertCodeBlock,
        AiActionMode::GenerateCaption,
        AiActionMode::GenerateAbstract,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_action_mode_supports_modes_exposed_in_ui() {
        assert!(matches!(
            parse_action_mode("rewrite_text"),
            Some(AiActionMode::RewriteText)
        ));
        assert!(matches!(
            parse_action_mode("review_content"),
            Some(AiActionMode::ReviewContent)
        ));
        assert!(matches!(
            parse_action_mode("insert_table"),
            Some(AiActionMode::InsertTable)
        ));
        assert!(matches!(
            parse_action_mode("add_acronym"),
            Some(AiActionMode::AddAcronym)
        ));
    }

    #[test]
    fn action_mode_catalog_includes_insert_and_review_modes() {
        let ids = ai_get_action_modes()
            .into_iter()
            .filter_map(|v| v.get("id").and_then(|id| id.as_str()).map(str::to_string))
            .collect::<Vec<_>>();

        assert!(ids.iter().any(|id| id == "review_content"));
        assert!(ids.iter().any(|id| id == "rewrite_text"));
        assert!(ids.iter().any(|id| id == "insert_table"));
    }
}
