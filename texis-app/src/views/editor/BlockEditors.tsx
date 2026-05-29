import React, { useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useTranslation } from "react-i18next";
import { IconCheck, IconChevronD, IconPlus, IconX } from "../../components/Icons";
import { applyAutocorrect } from "../../services/autocorrect";
import { useSettingsStore } from "../../stores/settings";
import type { HeadingLevel, ProjectSection, SectionStatus, TheoremKind } from "../../types";

// ── Componentes de bloque: modo edición ───────────────────────────

export function ParagraphEditor({
  content, onChange, onBlur,
}: {
  content: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const { t } = useTranslation();
  const { autocorrectEnabled, spellLang } = useSettingsStore();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
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
        placeholder="Título de la sección…"
      />
    </div>
  );
}

/** Renderiza LaTeX con KaTeX. Muestra un mensaje de error si la sintaxis es inválida. */
export function KaTeXPreview({ latex, displayMode = true }: { latex: string; displayMode?: boolean }) {
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
  } catch {
    // KaTeX parse error — mostrar la expresión cruda en rojo
    return (
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 12, color: "#E07070",
        padding: "6px 10px", background: "rgba(224,80,80,0.08)",
        borderRadius: "var(--r-sm)", textAlign: "center",
      }}>
        {latex}
      </div>
    );
  }
}

// ── SectionStatusBar ─────────────────────────────────────────────

export const STATUS_CONFIG: Record<SectionStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: "Borrador",   color: "#888",    bg: "rgba(136,136,136,0.12)" },
  in_review: { label: "En revisión",color: "#E09B2F", bg: "rgba(224,155,47,0.12)"  },
  revised:   { label: "Revisado",   color: "#4A90E2", bg: "rgba(74,144,226,0.12)"  },
  approved:  { label: "Aprobado",   color: "#52C41A", bg: "rgba(82,196,26,0.12)"   },
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
          {cfg.label}
          <IconChevronD size={9} />
        </button>

        {/* Botón notas */}
        <button
          onClick={() => setNotesOpen((o) => !o)}
          title="Notas internas (no se incluyen en el PDF)"
          style={{
            fontSize: "var(--fs-xs)", color: notesOpen || section.notes ? "var(--accent)" : "var(--fg-faint)",
            background: "none", border: "none", cursor: "pointer", padding: "3px 6px",
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          📝 {section.notes && !notesOpen ? "ver notas" : "notas"}
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
                {c.label}
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
            placeholder="Notas internas para esta sección (no se incluyen en el PDF)…"
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

export function EquationEditor({
  latex_content, numbered, onChange, onNumberedChange, onBlur,
}: {
  latex_content: string; numbered: boolean;
  onChange: (v: string) => void;
  onNumberedChange: (v: boolean) => void;
  onBlur: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>LaTeX</span>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={numbered} onChange={(e) => onNumberedChange(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
          numerada
        </label>
      </div>
      <textarea
        autoFocus
        value={latex_content}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === "Escape") onBlur(); }}
        rows={3}
        style={{
          fontFamily: "var(--font-mono)", fontSize: 13, color: "#C8C2B5",
          background: "var(--ink-900)", border: "none", outline: "none",
          padding: "10px 14px", borderRadius: "var(--r-sm)", resize: "vertical",
          width: "100%",
        }}
        placeholder="\frac{d}{dx} f(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}"
      />
      {/* Preview en tiempo real */}
      <KaTeXPreview latex={latex_content} displayMode />
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {["itemize", "enumerate"].map((t) => (
          <button
            key={t}
            className={`btn btn-sm ${list_type === t ? "btn-accent" : "btn-ghost"}`}
            onClick={() => onTypeChange(t)}
            style={{ fontSize: "var(--fs-xs)", padding: "3px 8px" }}
          >
            {t === "itemize" ? "• Lista" : "1. Numerada"}
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
            placeholder={`Ítem ${i + 1}…`}
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
        <IconPlus size={11} /> Agregar ítem
      </button>
    </div>
  );
}

// ── FigureEditor ─────────────────────────────────────────────────

export function FigureEditor({
  file, caption, width, label,
  onChange,
}: {
  file: string; caption: string; width: string; label: string;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const input = (lbl: string, key: string, val: string, ph: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{lbl}</label>
      <input
        value={val}
        onChange={(e) => onChange({ [key]: e.target.value })}
        placeholder={ph}
        style={{ border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)", color: "var(--fg-strong)", outline: "none" }}
      />
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {input("Archivo (en content/figures/)", "file", file, "diagrama.png")}
      {input("Leyenda", "caption", caption, "Descripción de la figura")}
      {input("Label LaTeX", "label", label, "fig:nombre")}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Ancho</label>
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
  const cellStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-xs)",
    padding: "4px 8px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Leyenda</label>
          <input value={caption} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Descripción de la tabla" style={cellStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Label LaTeX</label>
          <input value={label} onChange={(e) => onChange({ label: e.target.value })} placeholder="tab:nombre" style={cellStyle} />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "var(--fs-sm)" }}>
          <thead>
            <tr>
              {headers.map((h, ci) => (
                <th key={ci} style={{ padding: 4 }}>
                  <input value={h} onChange={(e) => { const nh = [...headers]; nh[ci] = e.target.value; onChange({ headers: nh }); }} placeholder={`Col ${ci + 1}`} style={{ ...cellStyle, fontWeight: 600 }} />
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
          <IconPlus size={11} /> Agregar fila
        </button>
      </div>
    </div>
  );
}

// ── CitationEditor ────────────────────────────────────────────────

export function CitationEditor({
  citation_key, citation_type, page,
  onChange,
}: {
  citation_key: string; citation_type: string; page?: string;
  onChange: (u: Record<string, unknown>) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Clave bibliográfica</label>
          <input
            autoFocus
            value={citation_key}
            onChange={(e) => onChange({ citation_key: e.target.value })}
            placeholder="apellido2024"
            style={{ border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)", color: "var(--fg-strong)", outline: "none", fontFamily: "var(--font-mono)" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Página</label>
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
  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
    padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Término</label>
        <input autoFocus value={term} onChange={(e) => onChange({ term: e.target.value })} placeholder="Ontología" style={fieldStyle} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Definición</label>
        <textarea value={definition} onChange={(e) => onChange({ definition: e.target.value })} placeholder="Rama de la filosofía que estudia el ser en cuanto ser." rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
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
  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
    padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Acrónimo</label>
          <input autoFocus value={acronym} onChange={(e) => onChange({ acronym: e.target.value })} placeholder="IA" style={{ ...fieldStyle, fontWeight: 600 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Forma completa</label>
          <input value={full_form} onChange={(e) => onChange({ full_form: e.target.value })} placeholder="Inteligencia Artificial" style={fieldStyle} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Descripción adicional (opcional)</label>
        <input value={description ?? ""} onChange={(e) => onChange({ description: e.target.value || undefined })} placeholder="Contexto o aclaración opcional…" style={fieldStyle} />
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
  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
    padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Lenguaje:</span>
        {CODE_LANGUAGES.map((l) => (
          <button key={l} className={`btn btn-sm ${language === l ? "btn-accent" : "btn-ghost"}`} onClick={() => onChange({ language: l })} style={{ fontSize: "var(--fs-xs)", padding: "2px 8px" }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Leyenda (caption)</label>
          <input value={caption ?? ""} onChange={(e) => onChange({ caption: e.target.value || undefined })} placeholder="Algoritmo de clasificación" style={fieldStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Label LaTeX</label>
          <input value={label ?? ""} onChange={(e) => onChange({ label: e.target.value || undefined })} placeholder="lst:nombre" style={{ ...fieldStyle, fontFamily: "var(--font-mono)" }} />
        </div>
      </div>
      <div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", cursor: "pointer", marginBottom: 6 }}>
          <input type="checkbox" checked={show_line_numbers} onChange={(e) => onChange({ show_line_numbers: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
          Mostrar números de línea
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
          placeholder={`# Escribe tu código aquí\ndef ejemplo():\n    pass`}
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
  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
    padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Nombre del algoritmo *</label>
          <input autoFocus value={caption} onChange={(e) => onChange({ caption: e.target.value })} placeholder="Clasificador por vecinos más cercanos" style={fieldStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Label LaTeX</label>
          <input value={label ?? ""} onChange={(e) => onChange({ label: e.target.value || undefined })} placeholder="alg:nombre" style={{ ...fieldStyle, fontFamily: "var(--font-mono)" }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Entrada (Require)</label>
          <input value={input ?? ""} onChange={(e) => onChange({ input: e.target.value || undefined })} placeholder="dataset D, umbral θ" style={fieldStyle} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Salida (Ensure)</label>
          <input value={output ?? ""} onChange={(e) => onChange({ output: e.target.value || undefined })} placeholder="clasificación C" style={fieldStyle} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
          Pseudocódigo — una instrucción por línea
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
          placeholder={"Inicializar modelo M\nPara cada muestra x en D:\n  Calcular distancia d(x, centroide)\n  Asignar etiqueta más cercana\nRetornar M"}
        />
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic" }}>
          Cada línea se convierte en un paso numerado en el PDF. Usa LaTeX matemático si necesitas: $x_i$, $\theta$, etc.
        </div>
      </div>
    </div>
  );
}

// ── TheoremBlockEditor ────────────────────────────────────────────

export const THEOREM_KINDS: { kind: TheoremKind; label: string; env: string }[] = [
  { kind: "theorem",    label: "Teorema",     env: "theorem"    },
  { kind: "lemma",      label: "Lema",        env: "lemma"      },
  { kind: "corollary",  label: "Corolario",   env: "corollary"  },
  { kind: "proposition",label: "Proposición", env: "proposition"},
  { kind: "definition", label: "Definición",  env: "definition" },
  { kind: "proof",      label: "Demostración",env: "proof"      },
  { kind: "remark",     label: "Observación", env: "remark"     },
];

export function TheoremBlockEditor({
  kind, title, content, numbered, onChange,
}: {
  kind: TheoremKind; title?: string; content: string; numbered: boolean;
  onChange: (u: Record<string, unknown>) => void;
}) {
  const fieldStyle: React.CSSProperties = {
    border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
    padding: "6px 10px", fontSize: "var(--fs-sm)", background: "var(--bg-panel)",
    color: "var(--fg-strong)", outline: "none", width: "100%",
  };
  const isPureUnnumbered = kind === "proof" || kind === "remark";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {THEOREM_KINDS.map((t) => (
          <button key={t.kind} className={`btn btn-sm ${kind === t.kind ? "btn-accent" : "btn-ghost"}`} onClick={() => onChange({ kind: t.kind })} style={{ fontSize: "var(--fs-xs)", padding: "3px 10px" }}>{t.label}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr auto", gap: 8, alignItems: "end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Título opcional</label>
          <input value={title ?? ""} onChange={(e) => onChange({ title: e.target.value || undefined })} placeholder="Teorema de Pitágoras" style={fieldStyle} />
        </div>
        {!isPureUnnumbered && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", cursor: "pointer", paddingBottom: 2 }}>
            <input type="checkbox" checked={numbered} onChange={(e) => onChange({ numbered: e.target.checked })} style={{ accentColor: "var(--accent)" }} />
            Numerado
          </label>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Contenido (acepta LaTeX matemático)</label>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => onChange({ content: e.target.value })}
          rows={4}
          style={{ ...fieldStyle, fontFamily: "var(--font-display)", lineHeight: 1.6, resize: "vertical" }}
          placeholder="Sea $a^2 + b^2 = c^2$ donde $c$ es la hipotenusa..."
        />
      </div>
    </div>
  );
}

