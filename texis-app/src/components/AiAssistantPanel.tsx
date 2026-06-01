/**
 * AIAssistantPanel — panel lateral de asistente de IA.
 *
 * Pestañas independientes por proveedor.
 * Ningún cambio se aplica al documento sin confirmación explícita del usuario.
 */

import { useEffect, useRef, useState } from "react";
import {
  useAiStore,
  type AiAccessMode,
  type AiActionMode,
  type AiContextScope,
  type AiProvider,
  type AiReasoningLevel,
} from "../stores/ai";
import { useSettingsStore } from "../stores/settings";
import { sendAiMessage, buildErrorMessage } from "../services/aiService";
import type { AiPendingAction } from "../stores/ai";

// ── Iconos inline mínimos ─────────────────────────────────────────────────────

function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Configuración de proveedores ──────────────────────────────────────────────

const PROVIDERS: { id: AiProvider; name: string; color: string; webUrl: string; keyUrl: string }[] = [
  { id: "openai", name: "OpenAI", color: "#10a37f", webUrl: "https://chatgpt.com/", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "claude", name: "Claude", color: "#d97706", webUrl: "https://claude.ai/", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "gemini", name: "Gemini", color: "#4f46e5", webUrl: "https://gemini.google.com/", keyUrl: "https://aistudio.google.com/app/apikey" },
];

type ActionGroup = { group: string; modes: { id: AiActionMode; label: string; needsSelection?: boolean }[] };

const ACTION_GROUPS: ActionGroup[] = [
  {
    group: "Consultar",
    modes: [
      { id: "ask", label: "Preguntar" },
      { id: "explain_latex_error", label: "Explicar error LaTeX" },
      { id: "learn_latex", label: "Entender el LaTeX" },
      { id: "app_help", label: "Ayuda de la app" },
      { id: "review_content", label: "Revisar contenido" },
      { id: "suggest_sources", label: "Sugerir fuentes" },
      { id: "analyze_argument", label: "Analizar argumento" },
      { id: "check_consistency", label: "Verificar consistencia" },
      { id: "suggest_structure", label: "Sugerir estructura" },
      { id: "simulate_examiner", label: "Sinodal simulado" },
    ],
  },
  {
    group: "Editar texto",
    modes: [
      { id: "improve_writing", label: "Mejorar redacción", needsSelection: true },
      { id: "shorten_text", label: "Acortar", needsSelection: true },
      { id: "expand_text", label: "Ampliar", needsSelection: true },
      { id: "rewrite_text", label: "Reescribir", needsSelection: true },
      { id: "convert_to_latex", label: "→ LaTeX", needsSelection: true },
      { id: "add_paragraph", label: "Añadir párrafo" },
    ],
  },
  {
    group: "Insertar (requiere confirmación)",
    modes: [
      { id: "insert_citation", label: "Cita bibliográfica" },
      { id: "add_bibliography_entry", label: "Referencia al .bib" },
      { id: "insert_cross_reference", label: "Referencia cruzada" },
      { id: "insert_table", label: "Tabla" },
      { id: "insert_figure_placeholder", label: "Figura placeholder" },
      { id: "insert_equation", label: "Ecuación" },
      { id: "add_glossary_entry", label: "Término de glosario" },
      { id: "add_acronym", label: "Acrónimo" },
      { id: "insert_code_block", label: "Bloque de código" },
      { id: "generate_abstract", label: "Generar abstract" },
      { id: "generate_caption", label: "Generar caption" },
    ],
  },
];

// Acciones disponibles en modo básico (sin terminología técnica de LaTeX)
const BASIC_ACTION_IDS = new Set<AiActionMode>([
  "ask", "explain_latex_error", "app_help", "review_content", "suggest_sources",
  "improve_writing", "shorten_text", "expand_text", "rewrite_text", "add_paragraph",
  "insert_citation", "insert_table", "insert_figure_placeholder", "insert_equation",
  "generate_abstract", "generate_caption",
]);

const CONTEXT_SCOPES: { id: AiContextScope; label: string }[] = [
  { id: "none", label: "Sin contexto" },
  { id: "current_selection", label: "Selección" },
  { id: "current_file", label: "Archivo actual" },
  { id: "diagnostics", label: "Diagnósticos" },
  { id: "build_log", label: "Log de build" },
];

const ACCESS_MODES: { id: AiAccessMode; label: string; desc: string }[] = [
  { id: "web_free", label: "Gratis web", desc: "Abre el agente gratuito del proveedor en tu navegador." },
  { id: "account", label: "Iniciar sesión", desc: "Requiere OAuth/backend de TeXisStudio; preparado, no activo aún." },
  { id: "api_key", label: "API key", desc: "Modo integrado disponible hoy usando tu propia clave." },
];

const REASONING_LEVELS: { id: AiReasoningLevel; label: string }[] = [
  { id: "fast", label: "Rápido" },
  { id: "balanced", label: "Balanceado" },
  { id: "deep", label: "Profundo" },
];

const MODEL_OPTIONS: Record<AiProvider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4o", "o4-mini"],
  claude: ["claude-sonnet-4-6", "claude-opus-4-1", "claude-haiku-3-5"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
};

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function emptyStateForMode(mode: AiAccessMode, providerName: string): string {
  if (mode === "web_free") {
    return `Abre ${providerName} gratis en tu navegador. Para usarlo dentro de TeXisStudio necesitas API key o inicio de sesión integrado.`;
  }
  if (mode === "account") {
    return "El inicio de sesión integrado está reservado para cuando exista el backend OAuth de TeXisStudio.";
  }
  return `Configura tu API key de ${providerName} para empezar.`;
}

// ── Preview de acción propuesta ───────────────────────────────────────────────

function ActionPreviewDialog({
  pending,
  onApply,
  onDismiss,
}: {
  pending: AiPendingAction;
  onApply: (content: string, kind: string) => void;
  onDismiss: () => void;
}) {
  const { proposed } = pending;
  const content =
    proposed.kind === "replace_selection" ? proposed.replacement :
    proposed.kind === "insert_at_cursor" ? proposed.content : "";

  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
      zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "var(--bg-base)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--border-soft)", padding: 18, maxWidth: 500, width: "100%",
        maxHeight: "80vh", overflow: "auto",
      }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: "var(--fg-strong)" }}>
          {proposed.kind === "replace_selection" ? "Reemplazar selección" : "Insertar en cursor"}
        </div>

        {proposed.kind === "replace_selection" && proposed.original && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4 }}>ORIGINAL</div>
            <pre style={{
              background: "var(--bg-panel)", padding: 10, borderRadius: "var(--r-md)",
              fontSize: "var(--fs-sm)", whiteSpace: "pre-wrap", wordBreak: "break-word",
              borderLeft: "3px solid var(--build-warn)", maxHeight: 120, overflow: "auto",
            }}>{proposed.original}</pre>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4 }}>
            {proposed.kind === "replace_selection" ? "PROPUESTO" : "CONTENIDO A INSERTAR"}
          </div>
          <pre style={{
            background: "var(--bg-panel)", padding: 10, borderRadius: "var(--r-md)",
            fontSize: "var(--fs-sm)", whiteSpace: "pre-wrap", wordBreak: "break-word",
            borderLeft: "3px solid var(--build-ok)", maxHeight: 200, overflow: "auto",
          }}>{content}</pre>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onDismiss} style={{ fontSize: "var(--fs-sm)" }}>
            Cancelar
          </button>
          <button
            className="btn btn-accent"
            onClick={() => onApply(content ?? "", proposed.kind)}
            style={{ fontSize: "var(--fs-sm)" }}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function AiAssistantPanel({
  currentSelection,
  aiSelection,
  currentFileName,
  currentFileContent,
  diagnosticsSummary,
  buildLog,
  onApplyReplacement,
  onInsertAtCursor,
  onUndoLastChange,
  wide = false,
  onToggleWide,
}: {
  currentSelection?: string;
  aiSelection?: { text: string; blockId: string; start: number; end: number } | null;
  currentFileName?: string;
  currentFileContent?: string;
  diagnosticsSummary?: string;
  buildLog?: string;
  onApplyReplacement?: (original: string, replacement: string) => void;
  onInsertAtCursor?: (content: string) => void;
  onUndoLastChange?: () => void;
  wide?: boolean;
  onToggleWide?: () => void;
}) {
  const store = useAiStore();
  const { userMode } = useSettingsStore();
  const [input, setInput] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [pastedContext, setPastedContext] = useState("");
  const [localFiles, setLocalFiles] = useState<Array<{ name: string; text: string }>>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const visibleGroups = userMode === "basic"
    ? ACTION_GROUPS
        .map((g) => ({ ...g, modes: g.modes.filter((m) => BASIC_ACTION_IDS.has(m.id)) }))
        .filter((g) => g.modes.length > 0)
    : ACTION_GROUPS;

  const provider = store.activeProvider;
  const providerInfo = PROVIDERS.find((p) => p.id === provider)!;
  const history = store.currentHistory();
  const apiKey = store.apiKeys[provider];
  const providerSettings = store.settings[provider];
  const model = store.currentModel();
  const isConfigured = providerSettings.accessMode === "api_key" && apiKey.trim().length > 0;
  const attachedContext = [
    pastedContext.trim() ? `## Contexto pegado\n${pastedContext.trim()}` : "",
    ...localFiles.map((f) => `## Archivo local: ${f.name}\n${f.text.slice(0, 6000)}`),
  ].filter(Boolean).join("\n\n");
  const tokenEstimate = estimateTokens([
    input,
    currentSelection ?? "",
    providerSettings.webSearch ? "web_search" : "",
    providerSettings.imageGeneration ? "image_generation" : "",
    attachedContext,
  ].join("\n\n"));
  const promptPackage = [
    input.trim(),
    attachedContext ? `Contexto adicional:\n${attachedContext}` : "",
  ].filter(Boolean).join("\n\n---\n\n");

  useEffect(() => {
    if (store.draftInput) {
      setInput(store.draftInput);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [store.draftInput]);

  async function handleSend() {
    if (!input.trim() || store.isLoading) return;

    if (providerSettings.accessMode !== "api_key") {
      store.addMessage(provider, {
        role: "assistant",
        content: providerSettings.accessMode === "web_free"
          ? `Para usar el modo gratuito, abre ${providerInfo.name} en el navegador. La integración dentro de TeXisStudio requiere API key o un backend de inicio de sesión.`
          : "El inicio de sesión integrado requiere un backend OAuth de TeXisStudio. Esta pantalla ya reserva el flujo, pero todavía no autentica cuentas.",
        timestamp: Date.now(),
      });
      return;
    }

    if (!isConfigured) {
      store.addMessage(provider, {
        role: "assistant",
        content: "Configura una API key para usar el modo integrado dentro de TeXisStudio.",
        timestamp: Date.now(),
      });
      return;
    }

    const selectedMode = ACTION_GROUPS
      .flatMap((group) => group.modes)
      .find((mode) => mode.id === store.actionMode);
    if (selectedMode?.needsSelection && (!aiSelection?.blockId || !currentSelection?.trim())) {
      store.addMessage(provider, {
        role: "assistant",
        content: "⚠️ Este modo requiere que selecciones primero un fragmento de texto normal dentro del editor.",
        timestamp: Date.now(),
      });
      return;
    }

    let userMessage = input.trim();
    const requestedTools: string[] = [];
    if (providerSettings.webSearch) requestedTools.push("búsqueda web");
    if (providerSettings.imageGeneration) requestedTools.push("generación de imagen");
    if (requestedTools.length > 0) {
      userMessage = `[Preferencias solicitadas: ${requestedTools.join(", ")}. Si esta integración no puede ejecutar esas herramientas directamente, explica qué falta y ofrece una alternativa segura.]\n\n${userMessage}`;
    }
    userMessage = `[Nivel de pensamiento: ${providerSettings.reasoningLevel}]\n\n${userMessage}`;
    if (attachedContext) {
      userMessage += `\n\n---\nContexto adicional elegido por el usuario:\n${attachedContext}`;
    }

    // Para AppHelp, inyectar contexto de UI al inicio del mensaje
    // para que la IA sepa dónde está el usuario sin que él tenga que explicarlo.
    if (store.actionMode === "app_help" && Object.keys(store.uiContext).length > 0) {
      const ctx = store.uiContext;
      const ctxParts: string[] = [];
      if (ctx.activePanel) ctxParts.push(`Panel activo: ${ctx.activePanel}`);
      if (ctx.activeSectionType) ctxParts.push(`Sección activa: ${ctx.activeSectionType}`);
      if (ctx.profileId) ctxParts.push(`Perfil: ${ctx.profileId}`);
      if (ctx.hasErrors && ctx.lastErrorMessage) ctxParts.push(`Error reciente: ${ctx.lastErrorMessage}`);
      if (ctxParts.length > 0) {
        userMessage = `[Contexto: ${ctxParts.join(" | ")}]\n\n${userMessage}`;
      }
    }

    setInput("");
    store.setDraftInput("");

    // Añadir el mensaje original (sin el contexto técnico) al historial visible
    store.addMessage(provider, { role: "user", content: input.trim(), timestamp: Date.now() });
    store.setLoading(true);

    try {
      const result = await sendAiMessage({
        provider,
        modelId: model,
        apiKey,
        actionMode: store.actionMode,
        userMessage,
        contextScope: store.contextScope,
        history: history.slice(-10), // máximo 10 mensajes de historial
        selection: currentSelection,
        currentFileName,
        currentFileContent,
        diagnostics: diagnosticsSummary,
        buildLog,
      });

      if (!result.ok) {
        const errMsg = result.error || buildErrorMessage(result.error_kind);
        store.addMessage(provider, {
          role: "assistant",
          content: `⚠️ ${errMsg}`,
          timestamp: Date.now(),
        });
        return;
      }

      const text = result.text ?? "";
      store.addMessage(provider, { role: "assistant", content: text, timestamp: Date.now() });

      const riskLevel = result.safety?.risk_level;

      if (result.proposed_action && riskLevel === "auto_with_notification") {
        // Aunque el backend lo clasifique como auto-notify, en la app exigimos
        // preview y confirmación antes de persistir cualquier cambio AI.
        store.setPendingAction({
          proposed: result.proposed_action as any,
          safety: {
            ...(result.safety as any),
            requires_preview: true,
            requires_user_confirmation: true,
            can_apply_automatically: false,
            reason: "TeXisStudio te muestra el cambio antes de aplicarlo para evitar escrituras directas al documento.",
          },
          messageIndex: history.length + 1,
        });
      } else if (result.proposed_action && result.safety?.requires_user_confirmation) {
        // Mostrar preview y pedir confirmación
        store.setPendingAction({
          proposed: result.proposed_action as any,
          safety: result.safety as any,
          messageIndex: history.length + 1,
        });
      }
    } catch (err) {
      store.addMessage(provider, {
        role: "assistant",
        content: `⚠️ Error inesperado: ${String(err)}`,
        timestamp: Date.now(),
      });
    } finally {
      store.setLoading(false);
      // Scroll al final
      setTimeout(() => {
        messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
      }, 50);
    }
  }

  function handleApply(content: string, kind: string) {
    const pending = store.pendingAction;
    if (!pending) return;

    if (kind === "replace_selection" && pending.proposed.original) {
      onApplyReplacement?.(pending.proposed.original, content);
    } else if (kind === "insert_at_cursor") {
      onInsertAtCursor?.(content);
    }

    if (pending.safety.risk_level === "auto_with_notification") {
      const description =
        kind === "replace_selection"
          ? `Texto editado: "${store.actionMode.replace(/_/g, " ")}"`
          : "Contenido insertado tras tu confirmación";
      store.setChangeNotification({ description });
      setTimeout(() => store.setChangeNotification(null), 5000);
    }

    store.setPendingAction(null);
  }

  async function handleLocalFiles(files: FileList | null) {
    if (!files?.length) return;

    const readableFiles = Array.from(files).slice(0, 8);
    const loaded = await Promise.all(readableFiles.map(async (file) => ({
      name: file.name,
      text: (await file.text()).slice(0, 12000),
    })));
    setLocalFiles((current) => [...current, ...loaded]);
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      borderLeft: "1px solid var(--border-soft)", background: "var(--bg-base)",
      height: "100%", minHeight: 0, position: "relative", fontSize: "var(--fs-sm)",
    }} className={`editor-ai-panel${wide ? " editor-ai-panel-wide" : ""}`}>
      {/* Preview dialog */}
      {store.pendingAction && (
        <ActionPreviewDialog
          pending={store.pendingAction}
          onApply={handleApply}
          onDismiss={() => store.setPendingAction(null)}
        />
      )}

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)",
        gap: 8,
      }}>
        <span style={{ fontWeight: 600, color: "var(--fg-strong)", fontSize: "var(--fs-sm)" }}>
          Asistente IA
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {onToggleWide && (
          <button
            className="btn btn-ghost"
            onClick={onToggleWide}
            title={wide ? "Reducir panel" : "Ampliar panel"}
            style={{ padding: "2px 6px", fontSize: 11 }}
          >
            {wide ? "↔" : "⟷"}
          </button>
        )}
        <button
          className="btn btn-ghost"
          onClick={store.togglePanel}
          title="Minimizar panel"
          style={{ padding: "2px 6px", fontSize: 11 }}
        >
          <IconX />
        </button>
        </div>
      </div>

      {/* Principio de responsabilidad — visible siempre */}
      <div style={{
        padding: "7px 12px",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: 10,
        color: "var(--fg-faint)",
        lineHeight: 1.6,
        background: "var(--bg-panel)",
      }}>
        El asistente apoya tu trabajo como redactor, editor, revisor, asesor y sinodal simulado.
        {" "}<strong style={{ color: "var(--fg-muted)" }}>No reemplaza a ningún actor real.</strong>
        {" "}La autoría, la corrección y la responsabilidad del trabajo son del autor.
      </div>

      {/* Pestañas de proveedor */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)" }}>
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => store.setActiveProvider(p.id)}
            style={{
              flex: 1, padding: "7px 4px", fontSize: "var(--fs-xs)", fontWeight: 500,
              border: "none", cursor: "pointer", transition: "background 0.15s",
              background: store.activeProvider === p.id ? "var(--bg-panel)" : "transparent",
              color: store.activeProvider === p.id ? p.color : "var(--fg-muted)",
              borderBottom: store.activeProvider === p.id ? `2px solid ${p.color}` : "2px solid transparent",
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Modo de acceso */}
      <div style={{
        padding: "8px 10px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "grid",
        gap: 7,
      }}>
        <div style={{ fontSize: 10, color: "var(--fg-faint)", textTransform: "uppercase" }}>
          Modo de acceso
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5 }}>
          {ACCESS_MODES.map((mode) => {
            const active = providerSettings.accessMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => store.setAccessMode(provider, mode.id)}
                title={mode.desc}
                style={{
                  minHeight: 32,
                  padding: "5px 6px",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid",
                  borderColor: active ? providerInfo.color : "var(--border-soft)",
                  background: active ? "var(--accent-tint)" : "var(--bg-panel)",
                  color: active ? "var(--accent-deep)" : "var(--fg-muted)",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>
      </div>

      {providerSettings.accessMode === "web_free" && (
        <div style={{
          margin: 10, padding: 10, borderRadius: "var(--r-md)",
          background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
          display: "grid", gap: 8,
        }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
            Usa la versión gratuita de {providerInfo.name} en su sitio. TeXisStudio no puede leer tu sesión del navegador ni enviar archivos automáticamente en este modo.
          </div>
          <button
            type="button"
            className="btn btn-accent"
            onClick={() => window.open(providerInfo.webUrl, "_blank", "noopener,noreferrer")}
            style={{ justifySelf: "start", fontSize: 11, padding: "5px 9px" }}
          >
            Abrir {providerInfo.name}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!promptPackage}
            onClick={() => navigator.clipboard?.writeText(promptPackage)}
            style={{ justifySelf: "start", fontSize: 11, padding: "5px 9px" }}
          >
            Copiar prompt para pegar
          </button>
        </div>
      )}

      {providerSettings.accessMode === "account" && (
        <div style={{
          margin: 10, padding: 10, borderRadius: "var(--r-md)",
          background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
          display: "grid", gap: 7,
        }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
            Preparado para inicio de sesión con cuenta, pero falta el backend OAuth de TeXisStudio. Cuando exista, aquí se conectarán ChatGPT, Claude o Gemini sin pegar claves.
          </div>
          <button type="button" className="btn btn-ghost" disabled style={{ justifySelf: "start", fontSize: 11, padding: "5px 9px" }}>
            Inicio de sesión no disponible aún
          </button>
        </div>
      )}

      {/* API Key — modo integrado */}
      {providerSettings.accessMode === "api_key" && !isConfigured && (
        <div style={{
          margin: 10, padding: 10, borderRadius: "var(--r-md)",
          background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
        }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: 6 }}>
            API Key de {providerInfo.name}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type={keyVisible ? "text" : "password"}
              placeholder="Pega tu API key aquí"
              style={{
                flex: 1, fontSize: "var(--fs-xs)", padding: "5px 8px",
                borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)",
                background: "var(--bg-base)", color: "var(--fg-default)",
              }}
              value={apiKey}
              onChange={(e) => store.setApiKey(provider, e.target.value)}
            />
            <button
              className="btn btn-ghost"
              onClick={() => setKeyVisible((v) => !v)}
              style={{ fontSize: 10, padding: "4px 7px" }}
            >
              {keyVisible ? "Ocultar" : "Ver"}
            </button>
          </div>
          <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 5 }}>
            La clave no se guarda en disco. Solo dura esta sesión.
            {" "}
            <button
              type="button"
              onClick={() => window.open(providerInfo.keyUrl, "_blank", "noopener,noreferrer")}
              style={{ border: "none", background: "transparent", color: "var(--accent-deep)", padding: 0, cursor: "pointer", fontSize: 10 }}
            >
              Crear clave
            </button>
          </div>
        </div>
      )}

      {/* Si está configurado: modelo + herramientas */}
      {providerSettings.accessMode === "api_key" && isConfigured && (
        <div style={{
          display: "grid", gap: 8,
          padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 6, alignItems: "center" }}>
            <select
              value={model}
              onChange={(e) => store.setModel(provider, e.target.value)}
              style={{
                minWidth: 0, fontSize: 11, padding: "4px 7px",
                borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)",
                background: "var(--bg-panel)", color: "var(--fg-muted)",
              }}
              title="Motor / modelo"
            >
              {MODEL_OPTIONS[provider].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              onClick={() => store.clearHistory(provider)}
              title="Limpiar historial"
              style={{ padding: "4px 6px" }}
            >
              <IconTrash />
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => store.setApiKey(provider, "")}
              style={{ fontSize: 10, padding: "4px 6px" }}
              title="Cambiar clave"
            >
              Clave
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
            {REASONING_LEVELS.map((level) => {
              const active = providerSettings.reasoningLevel === level.id;
              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => store.setReasoningLevel(provider, level.id)}
                  style={{
                    fontSize: 10, padding: "3px 7px", borderRadius: 999, cursor: "pointer",
                    border: "1px solid",
                    borderColor: active ? "var(--accent)" : "var(--border-soft)",
                    background: active ? "var(--accent-tint)" : "transparent",
                    color: active ? "var(--accent-deep)" : "var(--fg-muted)",
                  }}
                >
                  {level.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: 5 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "var(--fg-muted)" }}>
              <input
                type="checkbox"
                checked={providerSettings.webSearch}
                onChange={(e) => store.setWebSearch(provider, e.target.checked)}
              />
              Búsqueda web solicitada
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, color: "var(--fg-muted)" }}>
              <input
                type="checkbox"
                checked={providerSettings.imageGeneration}
                onChange={(e) => store.setImageGeneration(provider, e.target.checked)}
              />
              Crear imagen solicitado
            </label>
            <div style={{ fontSize: 10, color: "var(--fg-faint)", lineHeight: 1.4 }}>
              Estas herramientas se envían como preferencia al modelo; aún no ejecutan búsqueda ni generación nativa desde TeXisStudio.
            </div>
          </div>
        </div>
      )}

      {/* Selector de modo agrupado */}
      <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", maxHeight: 160, overflowY: "auto" }}>
        {visibleGroups.map((group) => (
          <div key={group.group} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {group.group}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {group.modes.map((m) => {
                const disabled = m.needsSelection && !currentSelection;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => store.setActionMode(m.id)}
                    title={disabled ? "Selecciona texto en el editor primero" : undefined}
                    style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 999, cursor: disabled ? "default" : "pointer",
                      opacity: disabled ? 0.4 : 1,
                      border: "1px solid",
                      borderColor: store.actionMode === m.id ? "var(--accent)" : "var(--border-soft)",
                      background: store.actionMode === m.id ? "var(--accent-tint)" : "transparent",
                      color: store.actionMode === m.id ? "var(--accent-deep)" : "var(--fg-muted)",
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selector de contexto */}
      <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontSize: 10, color: "var(--fg-faint)", marginBottom: 5 }}>CONTEXTO</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {CONTEXT_SCOPES.map((s) => {
            const available =
              s.id === "none" ||
              (s.id === "current_selection" && !!currentSelection) ||
              (s.id === "current_file" && !!currentFileContent) ||
              (s.id === "diagnostics" && !!diagnosticsSummary) ||
              (s.id === "build_log" && !!buildLog);

            return (
              <button
                key={s.id}
                type="button"
                disabled={!available}
                onClick={() => store.setContextScope(s.id)}
                style={{
                  fontSize: 10, padding: "3px 8px", borderRadius: 999, cursor: available ? "pointer" : "default",
                  border: "1px solid",
                  opacity: available ? 1 : 0.4,
                  borderColor: store.contextScope === s.id ? "var(--accent)" : "var(--border-soft)",
                  background: store.contextScope === s.id ? "var(--accent-tint)" : "transparent",
                  color: store.contextScope === s.id ? "var(--accent-deep)" : "var(--fg-muted)",
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 10, color: "var(--fg-muted)" }}>
            Archivos y texto pegado
          </summary>
          <div style={{ display: "grid", gap: 7, marginTop: 7 }}>
            <textarea
              value={pastedContext}
              onChange={(e) => setPastedContext(e.target.value)}
              placeholder="Pega aquí instrucciones, fragmentos o contexto extra"
              style={{
                resize: "vertical", minHeight: 52, maxHeight: 130,
                fontSize: 11, padding: "7px 8px", lineHeight: 1.4,
                borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)",
                background: "var(--bg-panel)", color: "var(--fg-default)",
                fontFamily: "inherit",
              }}
            />
            <input
              type="file"
              multiple
              accept=".txt,.tex,.bib,.md,.csv,.json,.yaml,.yml,.log"
              onChange={(e) => {
                handleLocalFiles(e.currentTarget.files);
                e.currentTarget.value = "";
              }}
              style={{ fontSize: 10, color: "var(--fg-muted)" }}
            />
            {localFiles.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {localFiles.map((file, index) => (
                  <button
                    key={`${file.name}-${index}`}
                    type="button"
                    onClick={() => setLocalFiles((files) => files.filter((_, i) => i !== index))}
                    title="Quitar archivo"
                    style={{
                      fontSize: 10, padding: "3px 7px", borderRadius: 999,
                      border: "1px solid var(--border-soft)", background: "var(--bg-panel)",
                      color: "var(--fg-muted)", cursor: "pointer",
                    }}
                  >
                    {file.name} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>

      {/* Banner de cambio automático (AutoWithNotification) */}
      {store.changeNotification && (
        <div style={{
          margin: "6px 10px 0",
          padding: "6px 10px",
          borderRadius: "var(--r-md)",
          background: "var(--build-ok-tint, #e6f4ea)",
          border: "1px solid var(--build-ok, #34a853)",
          fontSize: 11,
          color: "var(--build-ok, #1e7e34)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}>
          <span>✓ {store.changeNotification.description} — puedes deshacer con Ctrl+Z</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onUndoLastChange && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onUndoLastChange();
                  store.setChangeNotification(null);
                }}
                style={{ fontSize: 11, padding: "2px 6px" }}
              >
                Deshacer
              </button>
            )}
            <button
              onClick={() => store.setChangeNotification(null)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", padding: 0 }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Historial de mensajes */}
      <div
        ref={messagesRef}
        className="scroll"
        style={{ flex: 1, overflowY: "auto", padding: "10px 10px 4px" }}
      >
        {history.length === 0 && (
          <div style={{
            textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-xs)",
            paddingTop: 40, lineHeight: 1.8,
          }}>
            {isConfigured
              ? "Escribe una pregunta o selecciona un modo de asistencia."
              : emptyStateForMode(providerSettings.accessMode, providerInfo.name)}
          </div>
        )}
        {history.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{
              maxWidth: "90%", padding: "8px 11px", borderRadius: "var(--r-md)",
              fontSize: "var(--fs-sm)", lineHeight: 1.55,
              background: msg.role === "user" ? "var(--accent-tint)" : "var(--bg-panel)",
              color: msg.role === "user" ? "var(--accent-deep)" : "var(--fg-default)",
              border: "1px solid",
              borderColor: msg.role === "user" ? "var(--accent-soft)" : "var(--border-soft)",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {store.isLoading && (
          <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", paddingLeft: 2 }}>
            Generando respuesta…
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: "5px 10px 0",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 10,
        color: tokenEstimate > 8000 ? "var(--build-warn)" : "var(--fg-faint)",
      }}>
        <span>{tokenEstimate.toLocaleString()} tokens aprox.</span>
        {localFiles.length > 0 && <span>{localFiles.length} archivo(s)</span>}
      </div>
      <div style={{
        padding: "6px 10px 8px",
        display: "flex", gap: 6, alignItems: "flex-end",
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={store.isLoading}
          placeholder={
            isConfigured
              ? "Escribe tu mensaje… (Enter para enviar)"
              : providerSettings.accessMode === "web_free"
                ? "Prepara un prompt para copiarlo al agente web"
                : "Elige API key para usar el chat integrado"
          }
          style={{
            flex: 1, resize: "none", minHeight: 38, maxHeight: 120,
            fontSize: "var(--fs-sm)", padding: "8px 10px", lineHeight: 1.4,
            borderRadius: "var(--r-md)", border: "1px solid var(--border-soft)",
            background: "var(--bg-panel)", color: "var(--fg-default)",
            fontFamily: "inherit",
          }}
          rows={2}
        />
        <button
          className="btn btn-accent"
          onClick={handleSend}
          disabled={!isConfigured || !input.trim() || store.isLoading}
          style={{ padding: "8px 10px", flexShrink: 0 }}
        >
          <IconSend />
        </button>
      </div>
    </div>
  );
}
