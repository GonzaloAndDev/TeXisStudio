/**
 * AIAssistantPanel — panel lateral de asistente de IA.
 *
 * Pestañas independientes por proveedor.
 * Ningún cambio se aplica al documento sin confirmación explícita del usuario.
 */

import { useRef, useState } from "react";
import { useAiStore, type AiActionMode, type AiContextScope, type AiProvider, DEFAULT_MODELS } from "../stores/ai";
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

const PROVIDERS: { id: AiProvider; name: string; color: string }[] = [
  { id: "openai", name: "OpenAI", color: "#10a37f" },
  { id: "claude", name: "Claude", color: "#d97706" },
  { id: "gemini", name: "Gemini", color: "#4f46e5" },
];

type ActionGroup = { group: string; modes: { id: AiActionMode; label: string; needsSelection?: boolean }[] };

const ACTION_GROUPS: ActionGroup[] = [
  {
    group: "Consultar",
    modes: [
      { id: "ask", label: "Preguntar" },
      { id: "explain_latex_error", label: "Explicar error LaTeX" },
      { id: "review_content", label: "Revisar contenido" },
      { id: "suggest_sources", label: "Sugerir fuentes" },
      { id: "analyze_argument", label: "Analizar argumento" },
      { id: "check_consistency", label: "Verificar consistencia" },
      { id: "suggest_structure", label: "Sugerir estructura" },
      { id: "simulate_examiner", label: "Sinodal simulado" },
      { id: "app_help", label: "Ayuda de la app" },
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

const CONTEXT_SCOPES: { id: AiContextScope; label: string }[] = [
  { id: "none", label: "Sin contexto" },
  { id: "current_selection", label: "Selección" },
  { id: "current_file", label: "Archivo actual" },
  { id: "diagnostics", label: "Diagnósticos" },
  { id: "build_log", label: "Log de build" },
];

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
}: {
  currentSelection?: string;
  aiSelection?: { text: string; blockId: string; start: number; end: number } | null;
  currentFileName?: string;
  currentFileContent?: string;
  diagnosticsSummary?: string;
  buildLog?: string;
  onApplyReplacement?: (original: string, replacement: string) => void;
  onInsertAtCursor?: (content: string) => void;
}) {
  const store = useAiStore();
  const [input, setInput] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const provider = store.activeProvider;
  const providerInfo = PROVIDERS.find((p) => p.id === provider)!;
  const history = store.currentHistory();
  const apiKey = store.apiKeys[provider];
  const model = store.currentModel();
  const isConfigured = apiKey.trim().length > 0;

  async function handleSend() {
    if (!input.trim() || store.isLoading) return;

    const userMessage = input.trim();
    setInput("");

    // Añadir mensaje del usuario al historial
    store.addMessage(provider, { role: "user", content: userMessage, timestamp: Date.now() });
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
        // Aplicar inmediatamente y notificar — sin diálogo de confirmación
        const action = result.proposed_action as any;
        if (action.kind === "replace_selection" && onApplyReplacement && aiSelection) {
          onApplyReplacement(action.original ?? "", action.replacement ?? "");
          store.setChangeNotification({ description: `Texto editado: "${store.actionMode.replace(/_/g, " ")}"` });
        } else if (action.kind === "insert_at_cursor" && onInsertAtCursor) {
          onInsertAtCursor(action.content ?? "");
          store.setChangeNotification({ description: action.description ?? "Contenido insertado por el asistente" });
        }
        // Auto-dismiss notification after 5 seconds
        setTimeout(() => store.setChangeNotification(null), 5000);
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

    store.setPendingAction(null);
  }

  return (
    <div style={{
      width: 340, minWidth: 280, display: "flex", flexDirection: "column",
      borderLeft: "1px solid var(--border-soft)", background: "var(--bg-base)",
      height: "100%", position: "relative", fontSize: "var(--fs-sm)",
    }}>
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
        <button
          className="btn btn-ghost"
          onClick={store.togglePanel}
          style={{ padding: "2px 6px", fontSize: 11 }}
        >
          <IconX />
        </button>
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

      {/* API Key — si no está configurado */}
      {!isConfigured && (
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
          </div>
        </div>
      )}

      {/* Si está configurado: modelo + limpiar */}
      {isConfigured && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)",
        }}>
          <input
            type="text"
            value={model}
            onChange={(e) => store.setModel(provider, e.target.value)}
            style={{
              flex: 1, fontSize: 11, padding: "3px 7px",
              borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)",
              background: "var(--bg-panel)", color: "var(--fg-muted)",
            }}
            title="Modelo"
          />
          <button
            className="btn btn-ghost"
            onClick={() => store.clearHistory(provider)}
            title="Limpiar historial"
            style={{ padding: "3px 6px" }}
          >
            <IconTrash />
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => store.setApiKey(provider, "")}
            style={{ fontSize: 10, padding: "3px 6px" }}
            title="Cambiar clave"
          >
            Clave
          </button>
        </div>
      )}

      {/* Selector de modo agrupado */}
      <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", maxHeight: 160, overflowY: "auto" }}>
        {ACTION_GROUPS.map((group) => (
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
          <button
            onClick={() => store.setChangeNotification(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "inherit", padding: 0 }}
          >
            ×
          </button>
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
              : `Configura tu API key de ${providerInfo.name} para empezar.`}
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
        padding: "8px 10px", borderTop: "1px solid var(--border-subtle)",
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
          disabled={!isConfigured || store.isLoading}
          placeholder={isConfigured ? "Escribe tu mensaje… (Enter para enviar)" : "Configura tu API key primero"}
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
