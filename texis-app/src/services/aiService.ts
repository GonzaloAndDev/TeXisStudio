/**
 * Servicio de AI — bridge entre el store y los comandos Tauri.
 * No aplica cambios al documento. Solo envía peticiones y retorna respuestas.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  AiActionMode,
  AiContextScope,
  AiMessage,
  AiPendingAction,
  AiProvider,
} from "../stores/ai";
import { useProjectStore } from "../stores/project";

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
    risk_level: "low" | "medium" | "high" | "forbidden";
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

export function buildErrorMessage(errorKind?: string): string {
  switch (errorKind) {
    case "not_configured":
      return "API key no configurada. Agrega tu clave en la pestaña del proveedor.";
    case "auth_error":
      return "API key inválida. Verifica que sea correcta y esté activa.";
    case "rate_limited":
      return "Límite de peticiones alcanzado. Intenta en unos minutos.";
    case "network_error":
      return "Error de red. Verifica tu conexión a internet.";
    case "safety_rejection":
      return "La solicitud fue bloqueada por política de seguridad.";
    case "model_not_available":
      return "El modelo seleccionado no está disponible. Elige otro en la configuración.";
    default:
      return "Error del proveedor. Intenta de nuevo.";
  }
}
