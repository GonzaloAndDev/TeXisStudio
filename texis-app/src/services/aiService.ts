/**
 * Servicio de AI — bridge entre el store y los comandos Tauri.
 * No aplica cambios al documento. Solo envía peticiones y retorna respuestas.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  AiActionMode,
  AiContextScope,
  AiMessage,
  AiProvider,
} from "../stores/ai";

export interface AiSendOptions {
  provider: AiProvider;
  modelId: string;
  apiKey: string;
  actionMode: AiActionMode;
  userMessage: string;
  contextScope: AiContextScope;
  history: AiMessage[];
  // Contexto adicional inyectado por la UI
  selection?: string;
  currentFileName?: string;
  currentFileContent?: string;
  diagnostics?: string;
  buildLog?: string;
}

export interface AiCommandResponse {
  ok: boolean;
  text?: string;
  proposed_action?: {
    kind: "replace_selection" | "insert_at_cursor" | "show_in_chat";
    original?: string;
    replacement?: string;
    content?: string;
    response?: string;
  };
  safety?: {
    risk_level: "low" | "auto_with_notification" | "medium" | "high" | "forbidden";
    requires_preview: boolean;
    requires_user_confirmation: boolean;
    can_apply_automatically: boolean;
    reason: string;
  };
  error?: string;
  error_kind?: string;
}

export async function sendAiMessage(opts: AiSendOptions): Promise<AiCommandResponse> {
  const context = buildContext(opts);

  const historyForApi = opts.history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  return invoke<AiCommandResponse>("ai_send_message", {
    request: {
      provider: opts.provider,
      model_id: opts.modelId,
      api_key: opts.apiKey,
      action_mode: opts.actionMode,
      user_message: opts.userMessage,
      context,
      history: historyForApi,
    },
  });
}

/**
 * Aborta la llamada actual a `ai_send_message` en el backend. El backend usa
 * un `tokio::select!` que pollea un flag compartido cada 100 ms; tras llamar
 * a esta función la respuesta llega como `error_kind = "provider_error"` con
 * mensaje "cancelada", lo que la UI usa para volver al estado idle.
 *
 * Idempotente: llamarla sin solicitud en vuelo es no-op.
 * No-op en modo browser/dev (no hay backend Tauri).
 */
export async function cancelAiMessage(): Promise<void> {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (!isTauri) return;
  try {
    await invoke("cancel_ai_message");
  } catch (e) {
    console.warn("[ai] cancel_ai_message failed:", e);
  }
}

function buildContext(opts: AiSendOptions) {
  return {
    scope: opts.contextScope,
    selection: opts.selection ?? null,
    file_name: opts.currentFileName ?? null,
    file_content: opts.currentFileContent ?? null,
    diagnostics: opts.diagnostics ?? null,
    build_log: opts.buildLog ?? null,
  };
}

export function aiErrorKey(errorKind?: string): string {
  switch (errorKind) {
    case "not_configured":
      return "ai.error_not_configured";
    case "auth_error":
      return "ai.error_auth";
    case "rate_limited":
      return "ai.error_rate_limited";
    case "network_error":
      return "ai.error_network";
    case "safety_rejection":
      return "ai.error_safety";
    case "model_not_available":
      return "ai.error_model_unavailable";
    default:
      return "ai.error_provider";
  }
}
