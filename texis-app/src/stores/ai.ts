/**
 * Store de AIEngine v1.
 * - Historial independiente por proveedor.
 * - API keys en memoria de sesión ÚNICAMENTE — nunca se persisten en disco.
 * - El usuario siempre confirma antes de aplicar cambios al documento.
 */

import { create } from "zustand";

export type AiProvider = "openai" | "claude" | "gemini";

export type AiActionMode =
  // Chat / consulta — solo responde, no toca el documento
  | "ask"
  | "explain_latex_error"
  | "review_content"
  | "suggest_sources"
  | "analyze_argument"
  | "check_consistency"
  | "suggest_structure"
  | "simulate_examiner"
  | "app_help"
  // AutoWithNotification — aplica directamente, notifica, ofrece deshacer
  | "improve_writing"
  | "shorten_text"
  | "expand_text"
  | "rewrite_text"
  | "convert_to_latex"
  | "add_paragraph"
  // Medium — preview + confirmación explícita
  | "insert_citation"
  | "add_bibliography_entry"
  | "insert_cross_reference"
  | "insert_table"
  | "insert_figure_placeholder"
  | "insert_equation"
  | "add_glossary_entry"
  | "add_acronym"
  | "insert_code_block"
  | "generate_abstract"
  | "generate_caption";

export type AiContextScope =
  | "none"
  | "current_selection"
  | "current_file"
  | "diagnostics"
  | "build_log";

export type AiRiskLevel = "low" | "auto_with_notification" | "medium" | "high" | "forbidden";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AiProposedAction {
  kind: "replace_selection" | "insert_at_cursor" | "show_in_chat";
  original?: string;
  replacement?: string;
  content?: string;
  response?: string;
}

export interface AiSafetyDecision {
  risk_level: AiRiskLevel;
  requires_preview: boolean;
  requires_user_confirmation: boolean;
  can_apply_automatically: boolean;
  reason: string;
}

export interface AiPendingAction {
  proposed: AiProposedAction;
  safety: AiSafetyDecision;
  messageIndex: number;
}

// Modelos predeterminados por proveedor
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  claude: "claude-sonnet-4-6",
  gemini: "gemini-2.0-flash",
};

interface ProviderState {
  history: AiMessage[];
  model: string;
}

interface AiStore {
  // Proveedor activo en la UI
  activeProvider: AiProvider;
  setActiveProvider: (p: AiProvider) => void;

  // Estado por proveedor (historial independiente)
  providers: Record<AiProvider, ProviderState>;

  // API keys en memoria de sesión (NUNCA persisten)
  apiKeys: Record<AiProvider, string>;
  setApiKey: (provider: AiProvider, key: string) => void;

  // Modo de acción
  actionMode: AiActionMode;
  setActionMode: (m: AiActionMode) => void;

  // Contexto
  contextScope: AiContextScope;
  setContextScope: (s: AiContextScope) => void;

  // Estado de carga
  isLoading: boolean;

  // Acción pendiente de confirmación
  pendingAction: AiPendingAction | null;
  setPendingAction: (a: AiPendingAction | null) => void;

  // Panel abierto/cerrado
  isPanelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;

  // Notificación de cambio automático (AutoWithNotification)
  changeNotification: { description: string; timestamp: number } | null;
  setChangeNotification: (n: { description: string } | null) => void;

  // Acciones de historial
  addMessage: (provider: AiProvider, message: AiMessage) => void;
  clearHistory: (provider: AiProvider) => void;
  setModel: (provider: AiProvider, model: string) => void;
  setLoading: (loading: boolean) => void;

  // Getter conveniente
  currentHistory: () => AiMessage[];
  currentModel: () => string;
}

export const useAiStore = create<AiStore>((set, get) => ({
  activeProvider: "openai",
  setActiveProvider: (p) => set({ activeProvider: p }),

  providers: {
    openai: { history: [], model: DEFAULT_MODELS.openai },
    claude: { history: [], model: DEFAULT_MODELS.claude },
    gemini: { history: [], model: DEFAULT_MODELS.gemini },
  },

  // API keys NUNCA se persisten — solo en memoria de sesión
  apiKeys: { openai: "", claude: "", gemini: "" },
  setApiKey: (provider, key) =>
    set((s) => ({ apiKeys: { ...s.apiKeys, [provider]: key } })),

  actionMode: "ask",
  setActionMode: (m) => set({ actionMode: m }),

  contextScope: "none",
  setContextScope: (s) => set({ contextScope: s }),

  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  pendingAction: null,
  setPendingAction: (a) => set({ pendingAction: a }),

  isPanelOpen: false,
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  openPanel: () => set({ isPanelOpen: true }),

  changeNotification: null,
  setChangeNotification: (n) =>
    set({ changeNotification: n ? { description: n.description, timestamp: Date.now() } : null }),

  addMessage: (provider, message) =>
    set((s) => ({
      providers: {
        ...s.providers,
        [provider]: {
          ...s.providers[provider],
          history: [...s.providers[provider].history, message],
        },
      },
    })),

  clearHistory: (provider) =>
    set((s) => ({
      providers: {
        ...s.providers,
        [provider]: { ...s.providers[provider], history: [] },
      },
    })),

  setModel: (provider, model) =>
    set((s) => ({
      providers: {
        ...s.providers,
        [provider]: { ...s.providers[provider], model },
      },
    })),

  currentHistory: () => {
    const { activeProvider, providers } = get();
    return providers[activeProvider].history;
  },

  currentModel: () => {
    const { activeProvider, providers } = get();
    return providers[activeProvider].model;
  },
}));
