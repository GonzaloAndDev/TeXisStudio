import React, { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useTranslation } from "react-i18next";
import { IconCheck, IconChevronD, IconPlus, IconX } from "../../components/Icons";
import { applyAutocorrect } from "../../services/autocorrect";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";
import type { HeadingLevel, ProjectSection, SectionStatus, TheoremKind } from "../../types";
import { mathInsertManager, findFirstEmptySlot, findNextEmptySlot, findPrevEmptySlot } from "../../lib/mathInsertManager";

// ── Componentes de bloque: modo edición ───────────────────────────

export function ParagraphEditor({
  content, onChange, onBlur, availableLabels,
}: {
  content: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  availableLabels?: Array<{ key: string; kind: string; caption: string }>;
}) {
  const { t } = useTranslation();
  const { autocorrectEnabled, spellLang } = useSettingsStore();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [refPickerOpen, setRefPickerOpen] = useState(false);

  function insertRef(key: string) {
    const el = ref.current;
    if (!el) return;
    const cursor = el.selectionStart ?? content.length;
    const inserted = `\\cref{${key}}`;
    const newContent = content.slice(0, cursor) + inserted + content.slice(cursor);
    onChange(newContent);
    setRefPickerOpen(false);
    requestAnimationFrame(() => {
      if (el) {
        const pos = cursor + inserted.length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
      const workspace = useWorkspaceStore.getState();
      const saved = workspace.activeFile
        ? workspace.getCursorPosition(workspace.activeFile)
        : undefined;
      if (saved) {
        const lines = ref.current.value.split("\n");
        const targetLine = Math.min(Math.max(saved.line, 1), lines.length);
        let offset = 0;
        for (let index = 0; index < targetLine - 1; index += 1) {
          offset += lines[index].length + 1;
        }
        offset += Math.min(saved.column, lines[targetLine - 1]?.length ?? 0);
        ref.current.setSelectionRange(offset, offset);
      }
    }
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") { onBlur(); return; }
    if (autocorrectEnabled && spellLang && (e.key === " " || e.key === "Enter")) {
      const el = e.currentTarget;
      const result = applyAutocorrect(el.value, el.selectionStart ?? el.value.length, spellLang);
      if (result) {
        e.preventDefault();
        const { newText, newCursor } = result;
        // Insertar el separador EN la posición del cursor, no al final del texto
        const sep = e.key === " " ? " " : "\n";
        const corrected = newText.slice(0, newCursor) + sep + newText.slice(newCursor);
        onChange(corrected);
        requestAnimationFrame(() => {
          if (ref.current) {
            const pos = newCursor + 1; // +1 por el separador insertado
            ref.current.setSelectionRange(pos, pos);
            ref.current.style.height = "auto";
            ref.current.style.height = ref.current.scrollHeight + "px";
          }
        });
      }
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={ref}
        value={content}
        spellCheck={!!spellLang}
        lang={spellLang ?? undefined}
        onChange={(e) => {
          onChange(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
        }}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        style={{
          width: "100%", border: "none", outline: "none", resize: "none",
          fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.65,
          color: "var(--fg-default)", background: "transparent",
          padding: 0, minHeight: 50,
        }}
        placeholder={t("editor.placeholder_paragraph")}
      />
      {availableLabels && availableLabels.length > 0 && (
        <div style={{ position: "relative", marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setRefPickerOpen((o) => !o)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--fg-faint)", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
          >
            {t("block_editor.insert_cross_reference", { count: availableLabels.length })}
          </button>
          {refPickerOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setRefPickerOpen(false)} />
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
                background: "var(--bg-chrome)", border: "1px solid var(--border-firm)",
                borderRadius: "var(--r-md)", boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
                minWidth: 260, maxHeight: 200, overflow: "auto",
              }} className="scroll">
                {availableLabels.map((lbl) => (
                  <button
                    key={lbl.key}
                    type="button"
                    onClick={() => insertRef(lbl.key)}
                    style={{
                      width: "100%", display: "flex", flexDirection: "column", gap: 1,
                      padding: "8px 12px", border: "none", background: "transparent",
                      cursor: "pointer", textAlign: "left",
                    }}
                    className="tx-card-action"
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-deep)" }}>{lbl.key}</span>
                    {lbl.caption && <span style={{ fontSize: 10, color: "var(--fg-muted)" }}>{lbl.caption}</span>}
                    <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>{lbl.kind}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function HeadingEditor({
  content, level, onChange, onLevelChange, onBlur,
}: {
  content: string; level: HeadingLevel;
  onChange: (v: string) => void;
  onLevelChange: (v: HeadingLevel) => void;
  onBlur: () => void;
}) {
  const { t } = useTranslation();
  const fontSizes: Record<HeadingLevel, number> = { section: 22, subsection: 18, subsubsection: 16 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(["section", "subsection", "subsubsection"] as HeadingLevel[]).map((l) => (
          <button
            key={l}
            className={`btn btn-sm ${level === l ? "btn-accent" : "btn-ghost"}`}
            onClick={() => onLevelChange(l)}
            style={{ fontSize: "var(--fs-xs)", padding: "3px 8px" }}
          >
            {l === "section" ? "H1" : l === "subsection" ? "H2" : "H3"}
          </button>
        ))}
      </div>
      <input
        autoFocus
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === "Escape") onBlur(); }}
        style={{
          border: "none", outline: "none",
          fontFamily: "var(--font-display)", fontSize: fontSizes[level], fontWeight: 500,
          color: "var(--fg-strong)", background: "transparent", padding: 0, width: "100%",
        }}
        placeholder={t("editor.placeholder_heading")}
      />
    </div>
  );
}

/** Renderiza LaTeX con KaTeX. En error de sintaxis muestra el mensaje del parser
 *  junto con la expresión cruda — el usuario necesita saber QUÉ está mal, no
 *  solo que algo está mal. KaTeX es un subconjunto de LaTeX, así que algunos
 *  entornos válidos en PDF (p.ej. `align`) no se previsualizan aquí: en ese
 *  caso el mensaje lo aclara explícitamente. */
export function KaTeXPreview({ latex, displayMode = true }: { latex: string; displayMode?: boolean }) {
  const { t } = useTranslation();
  if (!latex.trim()) return null;
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      output: "html",
    });
    return (
      <div
        // biome-ignore lint: KaTeX genera HTML de confianza propio
        dangerouslySetInnerHTML={{ __html: html }}
        style={{ textAlign: "center", padding: "8px 0", color: "var(--fg-strong)", overflowX: "auto" }}
      />
    );
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    // KaTeX prefixes its messages with "KaTeX parse error: " — trim that off
    // so the actual hint is the first thing the user reads.
    const detail = raw.replace(/^KaTeX parse error:\s*/i, "");
    return (
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 12, color: "#E07070",
        padding: "6px 10px", background: "rgba(224,80,80,0.08)",
        borderRadius: "var(--r-sm)", textAlign: "left",
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <div style={{ fontWeight: 600 }}>{t("equation_preview.error_title")}</div>
        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{detail}</div>
        <div style={{ opacity: 0.7, fontSize: 11 }}>{t("equation_preview.error_hint")}</div>
      </div>
    );
  }
}

// ── SectionStatusBar ─────────────────────────────────────────────

export const STATUS_CONFIG: Record<SectionStatus, { labelKey: string; color: string; bg: string }> = {
  draft:     { labelKey: "progress.status_draft",     color: "#888",    bg: "rgba(136,136,136,0.12)" },
  in_review: { labelKey: "progress.status_in_review", color: "#E09B2F", bg: "rgba(224,155,47,0.12)"  },
  revised:   { labelKey: "block_editor.status_revised", color: "#4A90E2", bg: "rgba(74,144,226,0.12)"  },
  approved:  { labelKey: "progress.status_approved",  color: "#52C41A", bg: "rgba(82,196,26,0.12)"   },
};

export function SectionStatusBar({
  section,
  onChangeStatus,
  onChangeNotes,
}: {
  section: ProjectSection;
  onChangeStatus: (s: SectionStatus) => void;
  onChangeNotes: (n: string) => void;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(section.notes ?? "");
  const status: SectionStatus = section.status ?? "draft";
  const cfg = STATUS_CONFIG[status];

  // Sincronizar draft cuando cambia la sección activa
  useEffect(() => { setNotesDraft(section.notes ?? ""); }, [section.id, section.notes]);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Fila de estado */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
        {/* Badge clickable */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: "var(--r-sm)",
            border: `1px solid ${cfg.color}40`,
            background: cfg.bg, color: cfg.color,
            fontSize: "var(--fs-xs)", fontWeight: 500, cursor: "pointer",
            fontFamily: "var(--font-ui)",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
          {t(cfg.labelKey)}
          <IconChevronD size={9} />
        </button>

        {/* Botón notas */}
        <button
          onClick={() => setNotesOpen((o) => !o)}
          title={t("block_editor.notes_title")}
          style={{
            fontSize: "var(--fs-xs)", color: notesOpen || section.notes ? "var(--accent)" : "var(--fg-faint)",
            background: "none", border: "none", cursor: "pointer", padding: "3px 6px",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          📝 {section.notes && !notesOpen ? t("block_editor.view_notes") : t("block_editor.notes")}
        </button>

        {/* Menú desplegable de estados */}
        {menuOpen && (
          <div
            style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
              background: "var(--bg-chrome)", border: "1px solid var(--border-firm)",
              borderRadius: "var(--r-md)", boxShadow: "0 6px 24px rgba(0,0,0,0.2)",
              overflow: "hidden", minWidth: 150,
            }}
          >
            {(Object.entries(STATUS_CONFIG) as [SectionStatus, typeof STATUS_CONFIG[SectionStatus]][]).map(([s, c]) => (
              <button
                key={s}
                onClick={() => { onChangeStatus(s); setMenuOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 14px", background: s === status ? "var(--bg-selected)" : "transparent",
                  border: "none", cursor: "pointer", color: c.color, fontSize: "var(--fs-sm)",
                  fontWeight: s === status ? 600 : 400, textAlign: "left",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                {t(c.labelKey)}
                {s === status && <IconCheck size={11} sw={2.5} style={{ marginLeft: "auto", color: c.color }} />}
              </button>
            ))}
          </div>
        )}

        {/* Cerrar menú al hacer clic fuera */}
        {menuOpen && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => setMenuOpen(false)}
          />
        )}
      </div>

      {/* Panel de notas (collapsible) */}
      {notesOpen && (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => { if (notesDraft !== (section.notes ?? "")) onChangeNotes(notesDraft); }}
            rows={3}
            placeholder={t("block_editor.notes_placeholder")}
            style={{
              width: "100%", resize: "vertical",
              border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
              padding: "8px 12px", fontSize: "var(--fs-sm)", lineHeight: 1.55,
              color: "var(--fg-default)", background: "var(--bg-app)",
              fontFamily: "var(--font-ui)", outline: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Label cleaner: keep a-z, A-Z, 0-9, "-", ":", "_". Strip everything else.
 *  Matches the spirit of `sanitize_latex_label` in the Rust generator so the
 *  preview the user sees is exactly the label that will land in the PDF. */
function sanitizeEquationLabel(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_:-]/g, "");
}

export function EquationEditor({
  latex_content, numbered, label, onChange, onNumberedChange, onLabelChange, onBlur,
}: {
  latex_content: string;
  numbered: boolean;
  label?: string;
  onChange: (v: string) => void;
  onNumberedChange: (v: boolean) => void;
  onLabelChange: (v: string | undefined) => void;
  onBlur: () => void;
}) {
  const { t } = useTranslation();
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Local draft for the label so the user can type characters that will be
  // sanitised on commit, instead of seeing each keystroke fight back.
  const [labelDraft, setLabelDraft] = useState(label ?? "");
  // Re-sync if the block's label changes externally (e.g., reset on regenerate).
  useEffect(() => { setLabelDraft(label ?? ""); }, [label]);

  // Layout: KaTeX preview is the primary visual; the LaTeX source line lives
  // below it as a compact monospace input. The user can collapse the source
  // entirely and work purely from the panel + live preview. The persisted
  // preference key keeps the choice across reloads of the same session.
  const SHOW_SRC_KEY = "tx.equation.showSource";
  const [showSource, setShowSource] = useState<boolean>(() => {
    try { return localStorage.getItem(SHOW_SRC_KEY) !== "false"; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(SHOW_SRC_KEY, showSource ? "true" : "false"); } catch { /* ignore */ }
  }, [showSource]);

  // Keep the latest onChange in a ref so the registration effect below
  // doesn't churn on every parent render — onChange is recreated on each
  // keystroke by the parent's inline lambda, but the textarea instance is
  // stable. We register once and read the live onChange when needed.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // The textarea is always focusable, even when the LaTeX source is hidden,
  // so the user's keyboard still types into this equation. When hidden, we
  // also wire up the math-panel target manually so the panel inserts here.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    mathInsertManager.register(el, (v) => onChangeRef.current(v), "equation");
    // Focus on mount so the cursor lands here regardless of showSource.
    // Already-focused textareas (autoFocus) no-op on extra focus calls.
    el.focus();
    // If the block was seeded with a snippet that has an empty `{}` slot
    // (e.g. spawned from `\frac{}{}`), drop the cursor INSIDE the first
    // slot so the user types directly into the placeholder.
    const slot = findFirstEmptySlot(el.value, 0, el.value.length);
    if (slot !== null) el.setSelectionRange(slot, slot);
    return () => mathInsertManager.unregister(el);
  }, []);

  // When the user toggles "Show LaTeX" back on, send focus to the now-visible
  // textarea so they can resume typing without an extra click.
  useEffect(() => {
    if (showSource && taRef.current) taRef.current.focus();
  }, [showSource]);

  // Hint for the empty equation: only really used when both source is hidden
  // and the equation is empty — gives the user something to click.
  const showEmptyHint = !latex_content.trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={numbered} onChange={(e) => onNumberedChange(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
          {t("block_editor.numbered_lower")}
        </label>
        {numbered && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <label htmlFor="eq-label" style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
              {t("block_editor.eq_label")}
            </label>
            <input
              id="eq-label"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={() => {
                const clean = sanitizeEquationLabel(labelDraft).trim();
                setLabelDraft(clean);
                onLabelChange(clean ? clean : undefined);
              }}
              placeholder={t("block_editor.eq_label_placeholder")}
              spellCheck={false}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 12,
                padding: "3px 8px", borderRadius: "var(--r-xs)",
                border: "1px solid var(--border-firm)", background: "var(--bg-app)",
                color: "var(--fg-default)", width: 160,
              }}
              title={t("block_editor.eq_label_hint")}
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          className="btn btn-ghost btn-sm"
          style={{ marginLeft: "auto", fontSize: "var(--fs-xs)", padding: "2px 8px" }}
          title={t("block_editor.eq_toggle_source_hint")}
        >
          {showSource ? t("block_editor.eq_hide_source") : t("block_editor.eq_show_source")}
        </button>
      </div>

      {/* Primary: live KaTeX render. Clicking it always focuses the textarea
          so the keyboard goes here, whether or not the source line is visible. */}
      <div
        onClick={() => taRef.current?.focus()}
        style={{
          padding: "16px 16px",
          background: "var(--bg-app)",
          borderRadius: "var(--r-sm)",
          minHeight: 56,
          cursor: "text",
          border: "1px solid transparent",
        }}
      >
        {showEmptyHint ? (
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-faint)", fontStyle: "italic", textAlign: "center" }}>
            {t("block_editor.eq_empty_hint")}
          </div>
        ) : (
          <KaTeXPreview latex={latex_content} displayMode />
        )}
      </div>

      {/* Secondary: compact LaTeX source. Hidden by default if the user has
          collapsed it via the toggle. We always keep the textarea mounted
          (just visually hidden) so the math-panel target stays attached and
          the cursor position survives toggling. */}
      <textarea
        ref={taRef}
        autoFocus
        value={latex_content}
        onChange={(e) => onChange(e.target.value)}
        // onFocus does NOT re-register: registration is centralised in the
        // mount effect above so the math panel stays pointed at this block
        // even when the textarea is visually hidden and never refocuses.
        onBlur={onBlur}
        // Key handling:
        //   * Esc: commits and steps OUT of the LaTeX source but does NOT
        //     exit edit mode. The global Esc handler in EditorView would
        //     close the whole block otherwise — too eager for a reflexive
        //     Esc. stopPropagation isolates this textarea.
        //   * Tab / Shift+Tab: jump to the next/previous empty `{}` slot —
        //     Wolfram-style "fill in the boxes" math input. If there's no
        //     slot ahead, fall through to the default tab behaviour so the
        //     user can still leave the field with the keyboard.
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            taRef.current?.blur();
            return;
          }
          if (e.key === "Tab") {
            const el = taRef.current;
            if (!el) return;
            const pos = el.selectionEnd ?? 0;
            // For forward Tab, look strictly past the current selection so
            // an in-slot caret advances to the NEXT slot instead of staying.
            const target = e.shiftKey
              ? findPrevEmptySlot(el.value, pos)
              : findNextEmptySlot(el.value, pos + 1);
            if (target !== null) {
              e.preventDefault();
              el.setSelectionRange(target, target);
            }
          }
        }}
        rows={2}
        spellCheck={false}
        // When the source is "hidden" we keep the element mounted, focusable
        // and able to receive keyboard input — just visually offscreen. Using
        // display:none would block focus and keyboard typing entirely.
        style={showSource ? {
          fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5",
          background: "var(--ink-900)", border: "none", outline: "none",
          padding: "8px 12px", borderRadius: "var(--r-sm)", resize: "vertical",
          width: "100%", boxSizing: "border-box",
        } : {
          // Offscreen but accessible to focus/keyboard. Not `display:none`
          // because that removes the element from the tab/focus order.
          position: "absolute", left: -9999, top: -9999,
          width: 1, height: 1, opacity: 0,
          padding: 0, margin: 0, border: 0,
        }}
        placeholder="\frac{d}{dx} f(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}"
      />
    </div>
  );
}

export function ListEditor({
  items, list_type, onChange, onTypeChange, onBlur,
}: {
  items: string[]; list_type: string;
  onChange: (items: string[]) => void;
  onTypeChange: (v: string) => void;
  onBlur: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {["itemize", "enumerate"].map((listKind) => (
          <button
            key={listKind}
            className={`btn btn-sm ${list_type === listKind ? "btn-accent" : "btn-ghost"}`}
            onClick={() => onTypeChange(listKind)}
            style={{ fontSize: "var(--fs-xs)", padding: "3px 8px" }}
          >
            {listKind === "itemize" ? t("block_editor.list_bulleted") : t("block_editor.list_numbered")}
          </button>
        ))}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12, minWidth: 16 }}>
            {list_type === "enumerate" ? `${i + 1}.` : "•"}
          </span>
          <input
            autoFocus={i === items.length - 1}
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); onChange([...items.slice(0, i + 1), "", ...items.slice(i + 1)]); }
              if (e.key === "Backspace" && item === "" && items.length > 1) { e.preventDefault(); onChange(items.filter((_, j) => j !== i)); }
              if (e.key === "Escape") onBlur();
            }}
            style={{
              flex: 1, border: "none", outline: "none",
              fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.65,
              color: "var(--fg-default)", background: "transparent", padding: 0,
            }}
            placeholder={t("block_editor.item_placeholder", { n: i + 1 })}
          />
          {items.length > 1 && (
            <button
              className="btn btn-ghost btn-icon"
              style={{ padding: 2, opacity: 0.5 }}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <IconX size={10} />
            </button>
          )}
        </div>
      ))}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onChange([...items, ""])}
        style={{ alignSelf: "flex-start", fontSize: "var(--fs-xs)" }}
      >
        <IconPlus size={11} /> {t("block_editor.add_item")}
      </button>
    </div>
  );
}

// ── FigureEditor ─────────────────────────────────────────────────

export function FigureEditor({
  file, caption, width, label, availableAssets,
  onChange,
}: {
  file: string; caption: string; width: string; label: string;
  availableAssets?: Array<{ name: string; path: string }>;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const assetsListId = "figure-assets-datalist";
  const fieldStyle = { border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)", color: "var(--fg-strong)", outline: "none", width: "100%" } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {availableAssets && availableAssets.length > 0 && (
        <datalist id={assetsListId}>
          {availableAssets.map((a) => <option key={a.path} value={a.name} />)}
        </datalist>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
          {availableAssets && availableAssets.length > 0
            ? t("block_editor.file_with_assets", { count: availableAssets.length })
            : t("block_editor.file_in_assets")}
        </label>
        <input
          autoFocus
          list={availableAssets && availableAssets.length > 0 ? assetsListId : undefined}
          value={file}
          onChange={(e) => onChange({ file: e.target.value })}
          placeholder="imagen.png"
          style={fieldStyle}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.caption")}</label>
        <input value={caption} onChange={(e) => onChange({ caption: e.target.value })} placeholder={t("block_editor.figure_caption_placeholder")} style={fieldStyle} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.latex_label")}</label>
        <input value={label} onChange={(e) => onChange({ label: e.target.value })} placeholder="fig:nombre" style={{ ...fieldStyle, fontFamily: "var(--font-mono)" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.width")}</label>
        <div style={{ display: "flex", gap: 6 }}>
          {(["half", "three_quarters", "full"] as const).map((w) => (
            <button key={w} className={`btn btn-sm ${width === w ? "btn-accent" : "btn-ghost"}`} onClick={() => onChange({ width: w })}>
              {w === "half" ? "50%" : w === "three_quarters" ? "75%" : "100%"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── TableEditor ───────────────────────────────────────────────────

export function TableEditor({
  caption, label, headers, rows,
  onChange,
}: {
  caption: string; label: string; headers: string[]; rows: string[][];
  onChange: (u: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const cellStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-xs)",
    padding: "4px 8px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.caption")}</label>
          <input value={caption} onChange={(e) => onChange({ caption: e.target.value })} placeholder={t("block_editor.table_caption_placeholder")} style={cellStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.latex_label")}</label>
          <input value={label} onChange={(e) => onChange({ label: e.target.value })} placeholder="tab:nombre" style={cellStyle} />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "var(--fs-sm)" }}>
          <thead>
            <tr>
              {headers.map((h, ci) => (
                <th key={ci} style={{ padding: 4 }}>
                  <input value={h} onChange={(e) => { const nh = [...headers]; nh[ci] = e.target.value; onChange({ headers: nh }); }} placeholder={t("block_editor.column_placeholder", { n: ci + 1 })} style={{ ...cellStyle, fontWeight: 600 }} />
                </th>
              ))}
              <th style={{ padding: 4 }}>
                <button className="btn btn-ghost btn-icon" style={{ padding: 3 }}
                  onClick={() => onChange({ headers: [...headers, ""], rows: rows.map((r) => [...r, ""]) })}>
                  <IconPlus size={10} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: 4 }}>
                    <input value={cell} onChange={(e) => { const nr = rows.map((r, i) => i === ri ? r.map((c, j) => j === ci ? e.target.value : c) : r); onChange({ rows: nr }); }} placeholder="…" style={cellStyle} />
                  </td>
                ))}
                <td style={{ padding: 4 }}>
                  <button className="btn btn-ghost btn-icon" style={{ padding: 3, opacity: 0.5 }}
                    onClick={() => onChange({ rows: rows.filter((_, i) => i !== ri) })}>
                    <IconX size={10} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: "var(--fs-xs)" }}
          onClick={() => onChange({ rows: [...rows, headers.map(() => "")] })}>
          <IconPlus size={11} /> {t("block_editor.add_row")}
        </button>
      </div>
    </div>
  );
}

// ── CitationEditor ────────────────────────────────────────────────

export function CitationEditor({
  citation_key, citation_type, page, availableCiteKeys,
  onChange,
}: {
  citation_key: string; citation_type: string; page?: string;
  availableCiteKeys?: string[];
  onChange: (u: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const listId = "cite-keys-datalist";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {availableCiteKeys && availableCiteKeys.length > 0 && (
        <datalist id={listId}>
          {availableCiteKeys.map((k) => <option key={k} value={k} />)}
        </datalist>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        {([
          ["parenthetical", "\\parencite"],
          ["narrative",     "\\textcite"],
          ["footnote",      "\\footcite"],
        ] as const).map(([t, cmd]) => (
          <button key={t} className={`btn btn-sm ${citation_type === t ? "btn-accent" : "btn-ghost"}`}
            onClick={() => onChange({ citation_type: t })}
            style={{ fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)" }}>
            {cmd}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
            {availableCiteKeys && availableCiteKeys.length > 0
              ? t("block_editor.citation_key_with_count", { count: availableCiteKeys.length })
              : t("block_editor.citation_key")}
          </label>
          <input
            autoFocus
            list={availableCiteKeys && availableCiteKeys.length > 0 ? listId : undefined}
            value={citation_key}
            onChange={(e) => onChange({ citation_key: e.target.value })}
            placeholder="apellido2024"
            style={{ border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)", color: "var(--fg-strong)", outline: "none", fontFamily: "var(--font-mono)" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.page")}</label>
          <input
            value={page ?? ""}
            onChange={(e) => onChange({ page: e.target.value })}
            placeholder="42"
            style={{ border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)", color: "var(--fg-strong)", outline: "none" }}
          />
        </div>
      </div>
    </div>
  );
}

// ── GlossaryEntryEditor ───────────────────────────────────────────

export function GlossaryEntryEditor({
  term, definition, onChange,
}: {
  term: string; definition: string;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
    padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.term")}</label>
        <input autoFocus value={term} onChange={(e) => onChange({ term: e.target.value })} placeholder={t("block_editor.term_placeholder")} style={fieldStyle} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.definition")}</label>
        <textarea value={definition} onChange={(e) => onChange({ definition: e.target.value })} placeholder={t("block_editor.definition_placeholder")} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
      </div>
    </div>
  );
}

// ── AcronymEntryEditor ────────────────────────────────────────────

export function AcronymEntryEditor({
  acronym, full_form, description, onChange,
}: {
  acronym: string; full_form: string; description?: string;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
    padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.acronym")}</label>
          <input autoFocus value={acronym} onChange={(e) => onChange({ acronym: e.target.value })} placeholder={t("block_editor.acronym_placeholder")} style={{ ...fieldStyle, fontWeight: 600 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.full_form")}</label>
          <input value={full_form} onChange={(e) => onChange({ full_form: e.target.value })} placeholder={t("block_editor.full_form_placeholder")} style={fieldStyle} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.additional_description_optional")}</label>
        <input value={description ?? ""} onChange={(e) => onChange({ description: e.target.value || undefined })} placeholder={t("block_editor.additional_description_placeholder")} style={fieldStyle} />
      </div>
    </div>
  );
}

// ── CodeBlockEditor ───────────────────────────────────────────────

export const CODE_LANGUAGES = [
  "Python", "Java", "C", "C++", "C#", "JavaScript", "TypeScript",
  "MATLAB", "R", "Rust", "Go", "Bash", "SQL", "LaTeX", "Julia",
];

export function CodeBlockEditor({
  language, caption, label, content, show_line_numbers, onChange,
}: {
  language: string; caption?: string; label?: string; content: string; show_line_numbers: boolean;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
    padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.language")}</span>
        {CODE_LANGUAGES.map((l) => (
          <button key={l} className={`btn btn-sm ${language === l ? "btn-accent" : "btn-ghost"}`} onClick={() => onChange({ language: l })} style={{ fontSize: "var(--fs-xs)", padding: "2px 8px" }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.caption_with_latex_name")}</label>
          <input value={caption ?? ""} onChange={(e) => onChange({ caption: e.target.value || undefined })} placeholder={t("block_editor.code_caption_placeholder")} style={fieldStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.latex_label")}</label>
          <input value={label ?? ""} onChange={(e) => onChange({ label: e.target.value || undefined })} placeholder="lst:nombre" style={{ ...fieldStyle, fontFamily: "var(--font-mono)" }} />
        </div>
      </div>
      <div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", cursor: "pointer", marginBottom: 6 }}>
          <input type="checkbox" checked={show_line_numbers} onChange={(e) => onChange({ show_line_numbers: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
          {t("block_editor.show_line_numbers")}
        </label>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={8}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5",
            background: "var(--ink-900)", border: "none", outline: "none",
            padding: "10px 14px", borderRadius: "var(--r-sm)", resize: "vertical", width: "100%",
          }}
          placeholder={t("block_editor.code_placeholder")}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ── AlgorithmBlockEditor ──────────────────────────────────────────

export function AlgorithmBlockEditor({
  caption, label, input, output, body, onChange,
}: {
  caption: string; label?: string; input?: string; output?: string; body: string;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
    padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.algorithm_name_required")}</label>
          <input autoFocus value={caption} onChange={(e) => onChange({ caption: e.target.value })} placeholder={t("block_editor.algorithm_name_placeholder")} style={fieldStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.latex_label")}</label>
          <input value={label ?? ""} onChange={(e) => onChange({ label: e.target.value || undefined })} placeholder="alg:nombre" style={{ ...fieldStyle, fontFamily: "var(--font-mono)" }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.algorithm_input")}</label>
          <input value={input ?? ""} onChange={(e) => onChange({ input: e.target.value || undefined })} placeholder={t("block_editor.algorithm_input_placeholder")} style={fieldStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.algorithm_output")}</label>
          <input value={output ?? ""} onChange={(e) => onChange({ output: e.target.value || undefined })} placeholder={t("block_editor.algorithm_output_placeholder")} style={fieldStyle} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
          {t("block_editor.pseudocode_label")}
        </label>
        <textarea
          value={body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={8}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5",
            background: "var(--ink-900)", border: "none", outline: "none",
            padding: "10px 14px", borderRadius: "var(--r-sm)", resize: "vertical", width: "100%",
          }}
          placeholder={t("block_editor.pseudocode_placeholder")}
        />
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic" }}>
          {t("block_editor.pseudocode_hint")}
        </div>
      </div>
    </div>
  );
}

// ── TheoremBlockEditor ────────────────────────────────────────────

export const THEOREM_KINDS: { kind: TheoremKind; labelKey: string; env: string }[] = [
  { kind: "theorem",     labelKey: "block_editor.theorem_theorem", env: "theorem"    },
  { kind: "lemma",       labelKey: "block_editor.theorem_lemma", env: "lemma"      },
  { kind: "corollary",   labelKey: "block_editor.theorem_corollary", env: "corollary"  },
  { kind: "proposition", labelKey: "block_editor.theorem_proposition", env: "proposition"},
  { kind: "definition",  labelKey: "block_editor.theorem_definition", env: "definition" },
  { kind: "proof",       labelKey: "block_editor.theorem_proof", env: "proof"      },
  { kind: "remark",      labelKey: "block_editor.theorem_remark", env: "remark"     },
];

export function TheoremBlockEditor({
  kind, title, content, numbered, onChange,
}: {
  kind: TheoremKind; title?: string; content: string; numbered: boolean;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
    padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  const isPureUnnumbered = kind === "proof" || kind === "remark";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {THEOREM_KINDS.map((theoremKind) => (
          <button key={theoremKind.kind} className={`btn btn-sm ${kind === theoremKind.kind ? "btn-accent" : "btn-ghost"}`} onClick={() => onChange({ kind: theoremKind.kind })} style={{ fontSize: "var(--fs-xs)", padding: "3px 10px" }}>{t(theoremKind.labelKey)}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr auto", gap: 8, alignItems: "end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.optional_title")}</label>
          <input value={title ?? ""} onChange={(e) => onChange({ title: e.target.value || undefined })} placeholder={t("block_editor.theorem_title_placeholder")} style={fieldStyle} />
        </div>
        {!isPureUnnumbered && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", cursor: "pointer", paddingBottom: 2 }}>
            <input type="checkbox" checked={numbered} onChange={(e) => onChange({ numbered: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
            {t("block_editor.numbered")}
          </label>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("block_editor.math_content")}</label>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={4}
          style={{ ...fieldStyle, fontFamily: "var(--font-display)", lineHeight: 1.6, resize: "vertical" }}
          placeholder={t("block_editor.theorem_content_placeholder")}
        />
      </div>
    </div>
  );
}
