/**
 * AIAssistantPanel — panel lateral de asistente de IA.
 *
 * Pestañas independientes por proveedor.
 * Ningún cambio se aplica al documento sin confirmación explícita del usuario.
 */

import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useAiStore, type AiActionMode, type AiContextScope, type AiProvider } from "../stores/ai";
import { useSettingsStore } from "../stores/settings";
import { sendAiMessage, aiErrorKey } from "../services/aiService";
import type { AiPendingAction } from "../stores/ai";
import { AppDialog } from "./AppDialog";
import { IconTrash, IconX, IconUpload } from "./Icons";

// ── Configuración de proveedores ──────────────────────────────────────────────

const PROVIDERS: { id: AiProvider; name: string; color: string }[] = [
  { id: "openai", name: "OpenAI", color: "#10a37f" },
  { id: "claude", name: "Claude", color: "#d97706" },
  { id: "gemini", name: "Gemini", color: "#4f46e5" },
];

type ActionGroup = { groupKey: string; modes: { id: AiActionMode; labelKey: string; needsSelection?: boolean }[] };

const ACTION_GROUPS: ActionGroup[] = [
  {
    groupKey: "ai.group_consult",
    modes: [
      { id: "ask", labelKey: "ai.mode_ask" },
      { id: "explain_latex_error", labelKey: "ai.mode_explain_latex_error" },
      { id: "learn_latex", labelKey: "ai.mode_learn_latex" },
      { id: "app_help", labelKey: "ai.mode_app_help" },
      { id: "review_content", labelKey: "ai.mode_review_content" },
      { id: "suggest_sources", labelKey: "ai.mode_suggest_sources" },
      { id: "analyze_argument", labelKey: "ai.mode_analyze_argument" },
      { id: "check_consistency", labelKey: "ai.mode_check_consistency" },
      { id: "suggest_structure", labelKey: "ai.mode_suggest_structure" },
      { id: "simulate_examiner", labelKey: "ai.mode_simulate_examiner" },
    ],
  },
  {
    groupKey: "ai.group_edit_text",
    modes: [
      { id: "improve_writing", labelKey: "ai.mode_improve_writing", needsSelection: true },
      { id: "shorten_text", labelKey: "ai.mode_shorten_text", needsSelection: true },
      { id: "expand_text", labelKey: "ai.mode_expand_text", needsSelection: true },
      { id: "rewrite_text", labelKey: "ai.mode_rewrite_text", needsSelection: true },
      { id: "convert_to_latex", labelKey: "ai.mode_convert_to_latex", needsSelection: true },
      { id: "add_paragraph", labelKey: "ai.mode_add_paragraph" },
    ],
  },
  {
    groupKey: "ai.group_insert",
    modes: [
      { id: "insert_citation", labelKey: "ai.mode_insert_citation" },
      { id: "add_bibliography_entry", labelKey: "ai.mode_add_bibliography_entry" },
      { id: "insert_cross_reference", labelKey: "ai.mode_insert_cross_reference" },
      { id: "insert_table", labelKey: "ai.mode_insert_table" },
      { id: "insert_figure_placeholder", labelKey: "ai.mode_insert_figure_placeholder" },
      { id: "insert_equation", labelKey: "ai.mode_insert_equation" },
      { id: "add_glossary_entry", labelKey: "ai.mode_add_glossary_entry" },
      { id: "add_acronym", labelKey: "ai.mode_add_acronym" },
      { id: "insert_code_block", labelKey: "ai.mode_insert_code_block" },
      { id: "generate_abstract", labelKey: "ai.mode_generate_abstract" },
      { id: "generate_caption", labelKey: "ai.mode_generate_caption" },
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
  { id: "none", label: "ai.context_none" },
  { id: "current_selection", label: "ai.context_selection" },
  { id: "current_file", label: "ai.context_current_file" },
  { id: "diagnostics", label: "ai.context_diagnostics" },
  { id: "build_log", label: "ai.context_build_log" },
];

// ── Preview de acción propuesta ───────────────────────────────────────────────

function ActionPreviewDialog({
  pending,
  onApply,
  onDismiss,
  t,
}: {
  pending: AiPendingAction;
  onApply: (content: string, kind: string) => void;
  onDismiss: () => void;
  t: TFunction;
}) {
  const { proposed } = pending;
  const content =
    proposed.kind === "replace_selection" ? proposed.replacement :
    proposed.kind === "insert_at_cursor" ? proposed.content : "";

  const title = proposed.kind === "replace_selection"
    ? t("ai.preview_replace_selection")
    : t("ai.preview_insert_at_cursor");

  return (
    <AppDialog
      title={title}
      width={500}
      onClose={onDismiss}
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onDismiss}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-accent btn-sm"
            onClick={() => onApply(content ?? "", proposed.kind)}
          >
            {t("ai.apply")}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {proposed.kind === "replace_selection" && proposed.original && (
          <div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4 }}>{t("ai.preview_original")}</div>
            <pre style={{
              background: "var(--bg-panel)", padding: 10, borderRadius: "var(--r-md)",
              fontSize: "var(--fs-sm)", whiteSpace: "pre-wrap", wordBreak: "break-word",
              borderLeft: "3px solid var(--build-warn)", maxHeight: 120, overflow: "auto", margin: 0,
            }}>{proposed.original}</pre>
          </div>
        )}
        <div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4 }}>
            {proposed.kind === "replace_selection" ? t("ai.preview_proposed") : t("ai.preview_content_to_insert")}
          </div>
          <pre style={{
            background: "var(--bg-panel)", padding: 10, borderRadius: "var(--r-md)",
            fontSize: "var(--fs-sm)", whiteSpace: "pre-wrap", wordBreak: "break-word",
            borderLeft: "3px solid var(--build-ok)", maxHeight: 200, overflow: "auto", margin: 0,
          }}>{content}</pre>
        </div>
      </div>
    </AppDialog>
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
}) {
  const { t } = useTranslation();
  const store = useAiStore();
  const { userMode } = useSettingsStore();
  const [input, setInput] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
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
  const model = store.currentModel();
  const isConfigured = apiKey.trim().length > 0;

  useEffect(() => {
    if (store.draftInput) {
      setInput(store.draftInput);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [store.draftInput]);

  async function handleSend() {
    if (!input.trim() || store.isLoading) return;

    const selectedMode = ACTION_GROUPS
      .flatMap((group) => group.modes)
      .find((mode) => mode.id === store.actionMode);
    if (selectedMode?.needsSelection && (!aiSelection?.blockId || !currentSelection?.trim())) {
      store.addMessage(provider, {
        role: "assistant",
        content: `⚠️ ${t("ai.selection_required_message")}`,
        timestamp: Date.now(),
      });
      return;
    }

    let userMessage = input.trim();

    // Para AppHelp, inyectar contexto de UI al inicio del mensaje
    // para que la IA sepa dónde está el usuario sin que él tenga que explicarlo.
    if (store.actionMode === "app_help" && Object.keys(store.uiContext).length > 0) {
      const ctx = store.uiContext;
      const ctxParts: string[] = [];
      if (ctx.activePanel) ctxParts.push(`${t("ai.ctx_active_panel")}: ${ctx.activePanel}`);
      if (ctx.activeSectionType) ctxParts.push(`${t("ai.ctx_active_section")}: ${ctx.activeSectionType}`);
      if (ctx.profileId) ctxParts.push(`${t("ai.ctx_profile")}: ${ctx.profileId}`);
      if (ctx.hasErrors && ctx.lastErrorMessage) ctxParts.push(`${t("ai.ctx_recent_error")}: ${ctx.lastErrorMessage}`);
      if (ctxParts.length > 0) {
        userMessage = `[${t("ai.context_label")}: ${ctxParts.join(" | ")}]\n\n${userMessage}`;
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
        const errMsg = result.error || t(aiErrorKey(result.error_kind));
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
            reason: t("ai.preview_required_reason"),
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
        content: `⚠️ ${t("ai.unexpected_error", { error: String(err) })}`,
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
          ? t("ai.change_text_edited", { mode: store.actionMode.replace(/_/g, " ") })
          : t("ai.change_content_inserted");
      store.setChangeNotification({ description });
      setTimeout(() => store.setChangeNotification(null), 5000);
    }

    store.setPendingAction(null);
  }

  return (
    <div style={{
      width: 340, minWidth: 280, display: "flex", flexDirection: "column",
      borderLeft: "1px solid var(--border-soft)", background: "var(--bg-panel)",
      height: "100%", position: "relative", fontSize: "var(--fs-sm)",
    }}>
      {/* Preview dialog */}
      {store.pendingAction && (
        <ActionPreviewDialog
          pending={store.pendingAction}
          onApply={handleApply}
          onDismiss={() => store.setPendingAction(null)}
          t={t}
        />
      )}

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)",
        gap: 8,
      }}>
        <span style={{ fontWeight: 600, color: "var(--fg-strong)", fontSize: "var(--fs-sm)" }}>
          {t("ai.panel_title")}
        </span>
        <button
          className="btn btn-ghost"
          onClick={store.togglePanel}
          aria-label={t("common.close")}
          style={{ padding: "2px 6px", fontSize: 11 }}
        >
          <IconX size={13} />
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
        {t("ai.responsibility_prefix")}
        {" "}<strong style={{ color: "var(--fg-muted)" }}>{t("ai.responsibility_strong")}</strong>
        {" "}{t("ai.responsibility_suffix")}
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
            {t("ai.api_key_label", { provider: providerInfo.name })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type={keyVisible ? "text" : "password"}
              placeholder={t("ai.api_key_placeholder")}
              style={{
                flex: 1, fontSize: "var(--fs-xs)", padding: "5px 8px",
                borderRadius: "var(--r-sm)", border: "1px solid var(--border-soft)",
                background: "var(--bg-panel)", color: "var(--fg-default)",
              }}
              value={apiKey}
              onChange={(e) => store.setApiKey(provider, e.target.value)}
            />
            <button
              className="btn btn-ghost"
              onClick={() => setKeyVisible((v) => !v)}
              style={{ fontSize: 10, padding: "4px 7px" }}
            >
              {keyVisible ? t("ai.hide_key") : t("ai.show_key")}
            </button>
          </div>
          <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 5 }}>
            {t("ai.key_session_only")}
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
            title={t("ai.model_title")}
          />
          <button
            className="btn btn-ghost"
            onClick={() => store.clearHistory(provider)}
            aria-label={t("ai.clear_history")}
            title={t("ai.clear_history")}
            style={{ padding: "3px 6px" }}
          >
            <IconTrash size={12} />
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => store.setApiKey(provider, "")}
            style={{ fontSize: 10, padding: "3px 6px" }}
            title={t("ai.change_key")}
          >
            {t("ai.key")}
          </button>
        </div>
      )}

      {/* Selector de modo agrupado */}
      <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)", maxHeight: 160, overflowY: "auto" }}>
        {visibleGroups.map((group) => (
          <div key={group.groupKey} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
              {t(group.groupKey)}
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
                    title={disabled ? t("ai.select_text_first") : undefined}
                    style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 999, cursor: disabled ? "default" : "pointer",
                      opacity: disabled ? 0.4 : 1,
                      border: "1px solid",
                      borderColor: store.actionMode === m.id ? "var(--accent)" : "var(--border-soft)",
                      background: store.actionMode === m.id ? "var(--accent-tint)" : "transparent",
                      color: store.actionMode === m.id ? "var(--accent-deep)" : "var(--fg-muted)",
                    }}
                  >
                    {t(m.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selector de contexto */}
      <div style={{ padding: "6px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ fontSize: 10, color: "var(--fg-faint)", marginBottom: 5 }}>{t("ai.context_heading")}</div>
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
                {t(s.label)}
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
          <span>✓ {store.changeNotification.description} — {t("ai.undo_hint")}</span>
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
                {t("ai.undo")}
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
              ? t("ai.empty_configured")
              : t("ai.empty_needs_key", { provider: providerInfo.name })}
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
            {t("ai.generating_response")}
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
          placeholder={isConfigured ? t("ai.message_placeholder") : t("ai.configure_key_first")}
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
          aria-label={t("ai.send")}
          style={{ padding: "8px 10px", flexShrink: 0 }}
        >
          <IconUpload size={14} />
        </button>
      </div>
    </div>
  );
}
