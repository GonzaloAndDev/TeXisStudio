import { useCallback, useEffect, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconAcronym, IconAlgorithm, IconBuild, IconCheck, IconChevronD, IconCode, IconDrag, IconFile,
  IconGlossaryEntry, IconHeading, IconImage, IconList, IconMore, IconPlus, IconRefresh,
  IconSearch, IconSettings, IconSigma, IconSliders, IconTable, IconText, IconTheorem, IconTrash, IconX,
} from "../components/Icons";
import { LanguagePicker } from "../components/LanguagePicker";
import { SpellPanel } from "../components/SpellPanel";
import { GrammarPanel } from "../components/GrammarPanel";
import { applyAutocorrect } from "../services/autocorrect";
import type { GrammarMatch } from "../services/grammar";
import { useSettingsStore } from "../stores/settings";
import { api } from "../lib/tauri";
import { useProjectStore } from "../stores/project";
import type { BatchDoiResult, BibReference, CommitteeMember, ContentBlock, HeadingLevel, LatexTypography, ProjectModel, ProjectSection, SectionStatus, TheoremKind, ZoteroImportResult, ZoteroItem, ZoteroStatus } from "../types";

// ── Utilidades ────────────────────────────────────────────────────

const PLACEMENT_KEYS: Record<string, string> = {
  front_matter: "editor.placement_front",
  body: "editor.placement_body",
  back_matter: "editor.placement_back",
  appendix: "editor.placement_appendix",
};

function usePlacementGroup(sections: ProjectSection[]) {
  const { t } = useTranslation();
  const groups: Record<string, ProjectSection[]> = {};
  for (const s of sections) {
    const key = PLACEMENT_KEYS[s.placement];
    const g = key ? t(key as Parameters<typeof t>[0]) : s.placement;
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  }
  return groups;
}

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Block offset utilities ────────────────────────────────────────
// Used by SpellPanel (block-scoped errors) and GrammarPanel (offset mapping).

/**
 * Build a map from joined-text character offsets back to individual blocks.
 * Blocks are joined with `separator` (default "\n\n") — same as what we send to LanguageTool.
 */
function buildBlockOffsetMap(
  blocks: Array<{ id: string; content: string }>,
  separator = "\n\n",
): Array<{ id: string; start: number; end: number }> {
  const map: Array<{ id: string; start: number; end: number }> = [];
  let offset = 0;
  for (const b of blocks) {
    map.push({ id: b.id, start: offset, end: offset + b.content.length });
    offset += b.content.length + separator.length;
  }
  return map;
}

function countWords(blocks: ContentBlock[]): number {
  return blocks
    .filter((b) => b.type === "paragraph")
    .reduce((acc, b) => acc + (b.type === "paragraph" ? b.content.split(/\s+/).filter(Boolean).length : 0), 0);
}

// ── Componentes de bloque: modo edición ───────────────────────────

function ParagraphEditor({
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

function HeadingEditor({
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
function KaTeXPreview({ latex, displayMode = true }: { latex: string; displayMode?: boolean }) {
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

const STATUS_CONFIG: Record<SectionStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: "Borrador",   color: "#888",    bg: "rgba(136,136,136,0.12)" },
  in_review: { label: "En revisión",color: "#E09B2F", bg: "rgba(224,155,47,0.12)"  },
  revised:   { label: "Revisado",   color: "#4A90E2", bg: "rgba(74,144,226,0.12)"  },
  approved:  { label: "Aprobado",   color: "#52C41A", bg: "rgba(82,196,26,0.12)"   },
};

function SectionGuidance({ guidance }: { guidance?: string }) {
  const [open, setOpen] = useState(false);
  if (!guidance) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "var(--bg-subtle)", border: "1px solid var(--bg-paper-edge)",
          borderRadius: "var(--r-sm)", padding: "5px 10px",
          fontSize: "var(--fs-xs)", color: "var(--fg-muted)", cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}
      >
        <span style={{ fontSize: 12 }}>{open ? "▾" : "▸"}</span>
        Orientación de la sección
      </button>
      {open && (
        <div style={{
          marginTop: 6, padding: "10px 14px",
          background: "var(--bg-subtle)", border: "1px solid var(--bg-paper-edge)",
          borderRadius: "var(--r-sm)", fontSize: "var(--fs-sm)",
          color: "var(--fg-muted)", lineHeight: 1.6, whiteSpace: "pre-wrap",
        }}>
          {guidance}
        </div>
      )}
    </div>
  );
}

function SectionStatusBar({
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

function EquationEditor({
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

function ListEditor({
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

function FigureEditor({
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

function TableEditor({
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

function CitationEditor({
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

function GlossaryEntryEditor({
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

function AcronymEntryEditor({
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

const CODE_LANGUAGES = [
  "Python", "Java", "C", "C++", "C#", "JavaScript", "TypeScript",
  "MATLAB", "R", "Rust", "Go", "Bash", "SQL", "LaTeX", "Julia",
];

function CodeBlockEditor({
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

function AlgorithmBlockEditor({
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

const THEOREM_KINDS: { kind: TheoremKind; label: string; env: string }[] = [
  { kind: "theorem",    label: "Teorema",     env: "theorem"    },
  { kind: "lemma",      label: "Lema",        env: "lemma"      },
  { kind: "corollary",  label: "Corolario",   env: "corollary"  },
  { kind: "proposition",label: "Proposición", env: "proposition"},
  { kind: "definition", label: "Definición",  env: "definition" },
  { kind: "proof",      label: "Demostración",env: "proof"      },
  { kind: "remark",     label: "Observación", env: "remark"     },
];

function TheoremBlockEditor({
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

// ── BlockItem: combina preview + edición ──────────────────────────

function BlockItem({
  block, isEditing, onStartEdit, onUpdate, onDelete,
  dragging, dragOver,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
}: {
  block: ContentBlock;
  isEditing: boolean;
  onStartEdit: () => void;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDelete: () => void;
  dragging?: boolean;
  dragOver?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const renderEdit = () => {
    switch (block.type) {
      case "paragraph":
        return (
          <ParagraphEditor
            content={block.content}
            onChange={(content) => onUpdate({ content } as Partial<ContentBlock>)}
            onBlur={() => {}}
          />
        );
      case "heading":
        return (
          <HeadingEditor
            content={block.content}
            level={block.level}
            onChange={(content) => onUpdate({ content } as Partial<ContentBlock>)}
            onLevelChange={(level) => onUpdate({ level } as Partial<ContentBlock>)}
            onBlur={() => {}}
          />
        );
      case "equation":
        return (
          <EquationEditor
            latex_content={block.latex_content}
            numbered={block.numbered}
            onChange={(latex_content) => onUpdate({ latex_content } as Partial<ContentBlock>)}
            onNumberedChange={(numbered) => onUpdate({ numbered } as Partial<ContentBlock>)}
            onBlur={() => {}}
          />
        );
      case "list":
        return (
          <ListEditor
            items={block.items}
            list_type={block.list_type}
            onChange={(items) => onUpdate({ items } as Partial<ContentBlock>)}
            onTypeChange={(list_type) => onUpdate({ list_type } as Partial<ContentBlock>)}
            onBlur={() => {}}
          />
        );
      case "figure":
        return (
          <FigureEditor
            file={block.file}
            caption={block.caption}
            width={block.width}
            label={block.label}
            onChange={(u) => onUpdate(u as Partial<ContentBlock>)}
          />
        );
      case "table":
        return (
          <TableEditor
            caption={block.caption}
            label={block.label}
            headers={block.headers}
            rows={block.rows}
            onChange={(u) => onUpdate(u as Partial<ContentBlock>)}
          />
        );
      case "citation":
        return (
          <CitationEditor
            citation_key={block.citation_key}
            citation_type={block.citation_type}
            page={block.page}
            onChange={(u) => onUpdate(u as Partial<ContentBlock>)}
          />
        );
      case "raw_latex":
        return (
          <div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-warn)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
              ⚠ LaTeX manual — puede romper la compilación
            </div>
            <textarea
              autoFocus
              value={block.content}
              onChange={(e) => onUpdate({ content: e.target.value, user_confirmed: false } as Partial<ContentBlock>)}
              rows={4}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5",
                background: "var(--ink-900)", border: "none", outline: "none",
                padding: "10px 14px", borderRadius: "var(--r-sm)", resize: "vertical", width: "100%",
              }}
            />
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "var(--fs-xs)", color: block.user_confirmed ? "var(--build-ok)" : "var(--fg-faint)" }}>
                <input
                  type="checkbox"
                  checked={!!block.user_confirmed}
                  onChange={(e) => onUpdate({ user_confirmed: e.target.checked } as Partial<ContentBlock>)}
                  style={{ accentColor: "var(--build-ok)", cursor: "pointer" }}
                />
                Confirmo que este LaTeX manual puede afectar la compilación
              </label>
            </div>
            {!block.user_confirmed && (
              <div style={{ marginTop: 4, fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic" }}>
                No confirmado — este bloque no se incluirá en el PDF hasta que lo confirmes.
              </div>
            )}
          </div>
        );
      // ── Posgrado ──────────────────────────────────────────────────
      case "glossary_entry":
        return (
          <GlossaryEntryEditor
            term={block.term}
            definition={block.definition}
            onChange={(u) => onUpdate(u as Partial<ContentBlock>)}
          />
        );
      case "acronym_entry":
        return (
          <AcronymEntryEditor
            acronym={block.acronym}
            full_form={block.full_form}
            description={block.description}
            onChange={(u) => onUpdate(u as Partial<ContentBlock>)}
          />
        );
      case "code":
        return (
          <CodeBlockEditor
            language={block.language}
            caption={block.caption}
            label={block.label}
            content={block.content}
            show_line_numbers={block.show_line_numbers}
            onChange={(u) => onUpdate(u as Partial<ContentBlock>)}
          />
        );
      case "algorithm":
        return (
          <AlgorithmBlockEditor
            caption={block.caption}
            label={block.label}
            input={block.input}
            output={block.output}
            body={block.body}
            onChange={(u) => onUpdate(u as Partial<ContentBlock>)}
          />
        );
      case "theorem":
        return (
          <TheoremBlockEditor
            kind={block.kind}
            title={block.title}
            content={block.content}
            numbered={block.numbered}
            onChange={(u) => onUpdate(u as Partial<ContentBlock>)}
          />
        );
      default:
        return <div style={{ color: "var(--fg-faint)" }}>Bloque no editable</div>;
    }
  };

  const renderPreview = () => {
    switch (block.type) {
      case "paragraph":
        return (
          <p style={{ fontFamily: "var(--font-display)", fontSize: 15, color: block.content ? "var(--fg-default)" : "var(--fg-faint)", lineHeight: 1.65, margin: 0 }}>
            {block.content || "Párrafo vacío — clic para editar"}
          </p>
        );
      case "heading": {
        const fsMap: Record<HeadingLevel, number> = { section: 22, subsection: 18, subsubsection: 16 };
        return (
          <div style={{ fontFamily: "var(--font-display)", fontSize: fsMap[block.level], fontWeight: 500, color: block.content ? "var(--fg-strong)" : "var(--fg-faint)", lineHeight: 1.2 }}>
            {block.content || "Título vacío — clic para editar"}
          </div>
        );
      }
      case "equation":
        return block.latex_content ? (
          <div style={{ padding: "8px 16px", background: "var(--bg-app)", borderRadius: "var(--r-sm)" }}>
            <KaTeXPreview latex={block.latex_content} displayMode />
          </div>
        ) : (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-faint)", padding: "10px 16px", textAlign: "center" }}>
            Ecuación vacía — clic para editar
          </div>
        );
      case "list":
        return block.items.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {block.items.map((item, i) => (
              <li key={i} style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.65 }}>{item || "(ítem vacío)"}</li>
            ))}
          </ul>
        ) : <div style={{ color: "var(--fg-faint)" }}>Lista vacía</div>;
      case "figure":
        return (
          <div style={{ padding: "12px 16px", background: "var(--bg-app)", borderRadius: "var(--r-sm)", border: "1px dashed var(--border-firm)", textAlign: "center" }}>
            <div style={{ color: "var(--fg-faint)", fontSize: 13 }}>📷 {block.file || "sin archivo — clic para editar"}</div>
            {block.caption && <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>{block.caption}</div>}
          </div>
        );
      case "table":
        return block.headers.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "var(--fs-sm)", fontFamily: "var(--font-display)" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--fg-strong)" }}>
                  {block.headers.map((h, i) => <th key={i} style={{ textAlign: "left", padding: "5px 10px", fontWeight: 600 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    {row.map((cell, ci) => <td key={ci} style={{ padding: "4px 10px" }}>{cell || <span style={{ color: "var(--fg-faint)" }}>—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {block.caption && <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 5, textAlign: "center" }}>{block.caption}</div>}
          </div>
        ) : <div style={{ color: "var(--fg-faint)" }}>Tabla vacía — clic para editar</div>;
      case "citation":
        return (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-deep)", background: "var(--accent-tint)", padding: "2px 8px", borderRadius: "var(--r-xs)" }}>
            {block.citation_type === "narrative" ? "\\textcite" : block.citation_type === "footnote" ? "\\footcite" : "\\parencite"}
            {"{"}
            {block.citation_key || "?"}
            {"}"}
            {block.page ? `[p. ${block.page}]` : ""}
          </span>
        );
      case "raw_latex":
        return (
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5", padding: "10px 14px", background: "var(--ink-900)", borderRadius: "var(--r-sm)" }}>
              {block.content || "(LaTeX vacío)"}
            </div>
            {!block.user_confirmed && (
              <div style={{ marginTop: 4, fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic" }}>
                ⚠ No confirmado — no se incluirá en el PDF
              </div>
            )}
          </div>
        );
      // ── Posgrado previews ─────────────────────────────────────────
      case "glossary_entry":
        return (
          <div style={{ display: "flex", gap: 8, fontFamily: "var(--font-display)", fontSize: 14, lineHeight: 1.55 }}>
            <span style={{ fontWeight: 700, color: "var(--fg-strong)", whiteSpace: "nowrap", minWidth: 120 }}>
              {block.term || <em style={{ fontStyle: "normal", opacity: 0.4 }}>término</em>}
            </span>
            <span style={{ color: "var(--fg-default)" }}>
              {block.definition || <em style={{ opacity: 0.4 }}>definición…</em>}
            </span>
          </div>
        );
      case "acronym_entry":
        return (
          <div style={{ display: "flex", gap: 8, fontFamily: "var(--font-display)", fontSize: 14, lineHeight: 1.55 }}>
            <span style={{ fontWeight: 700, color: "var(--fg-strong)", fontFamily: "var(--font-mono)", minWidth: 60 }}>
              {block.acronym || <em style={{ fontStyle: "normal", opacity: 0.4 }}>ACR</em>}
            </span>
            <span style={{ color: "var(--fg-default)" }}>
              {block.full_form || <em style={{ opacity: 0.4 }}>forma completa…</em>}
              {block.description ? <span style={{ color: "var(--fg-muted)" }}>. {block.description}</span> : null}
            </span>
          </div>
        );
      case "code":
        return (
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", background: "var(--ink-800)", padding: "1px 6px", borderRadius: "var(--r-xs)" }}>
              {block.language || "código"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5", padding: "10px 14px", background: "var(--ink-900)", borderRadius: "var(--r-sm)", overflowX: "auto", whiteSpace: "pre" }}>
              {block.content || "(vacío)"}
            </div>
            {block.caption && <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4, textAlign: "center", fontStyle: "italic" }}>{block.caption}</div>}
          </div>
        );
      case "algorithm":
        return (
          <div style={{ border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", overflow: "hidden", fontSize: "var(--fs-sm)", fontFamily: "var(--font-display)" }}>
            <div style={{ background: "var(--bg-panel)", padding: "6px 12px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 600, color: "var(--fg-strong)", fontSize: 13 }}>
              Algoritmo: {block.caption || <em style={{ opacity: 0.5, fontWeight: 400 }}>sin nombre</em>}
            </div>
            {(block.input || block.output) && (
              <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--fg-muted)" }}>
                {block.input && <div><strong>Entrada:</strong> {block.input}</div>}
                {block.output && <div><strong>Salida:</strong> {block.output}</div>}
              </div>
            )}
            <div style={{ padding: "8px 12px", background: "var(--bg-app)", fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5", whiteSpace: "pre-wrap" }}>
              {block.body || <span style={{ opacity: 0.4 }}>(pseudocódigo vacío)</span>}
            </div>
          </div>
        );
      case "theorem": {
        const tk = THEOREM_KINDS.find((t) => t.kind === block.kind);
        const envLabel = tk?.label ?? block.kind;
        const envColor: Record<string, string> = {
          theorem: "#4A90E2", lemma: "#7B68EE", corollary: "#6A9FB5",
          proposition: "#5F9EA0", definition: "#52C41A", proof: "#888", remark: "#888",
        };
        const color = envColor[block.kind] ?? "var(--accent)";
        return (
          <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12, paddingRight: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 4, fontFamily: "var(--font-display)" }}>
              {envLabel}{block.title ? ` (${block.title})` : ""}{block.numbered && block.kind !== "proof" && block.kind !== "remark" ? " [numerado]" : ""}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.6, color: "var(--fg-default)", fontStyle: "italic" }}>
              {block.content || <span style={{ opacity: 0.4, fontStyle: "normal" }}>contenido vacío…</span>}
            </div>
          </div>
        );
      }
      default:
        return <div style={{ color: "var(--fg-faint)" }}>[bloque desconocido]</div>;
    }
  };

  return (
    <div
      draggable
      style={{
        position: "relative", margin: "4px -32px", padding: "6px 32px 6px 44px",
        borderRadius: 6,
        background: isEditing ? "var(--accent-tint)" : hovered ? "var(--bg-hover)" : "transparent",
        border: dragOver
          ? "1px solid var(--accent)"
          : isEditing
          ? "1px solid var(--accent-soft)"
          : "1px solid transparent",
        opacity: dragging ? 0.35 : 1,
        boxShadow: dragOver ? "0 -2px 0 var(--accent)" : "none",
        cursor: isEditing ? "default" : "text",
        transition: "opacity 0.12s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!isEditing) onStartEdit(); }}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart?.(); }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver?.(e); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop?.(); }}
    >
      {/* Drag handle */}
      <div
        style={{
          position: "absolute", left: 8, top: 12,
          color: "var(--fg-faint)", opacity: hovered ? 0.8 : 0,
          cursor: "grab",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <IconDrag size={12} />
      </div>

      {/* Tipo de bloque chip */}
      {(isEditing || hovered) && (
        <div style={{ position: "absolute", left: 24, top: -9, background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-xs)", padding: "1px 6px", fontSize: 9, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", zIndex: 1 }}>
          {block.type}
        </div>
      )}

      {/* Contenido */}
      {isEditing ? renderEdit() : renderPreview()}

      {/* Botón eliminar */}
      {(isEditing || hovered) && (
        <button
          className="btn btn-ghost btn-icon"
          style={{ position: "absolute", right: 6, top: 6, padding: 3, opacity: 0.6 }}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Eliminar bloque"
        >
          <IconTrash size={11} />
        </button>
      )}
    </div>
  );
}

// ── CommandPalette (Ctrl+K) ───────────────────────────────────────

const PALETTE_BLOCK_ITEMS = [
  { type: "paragraph"     as ContentBlock["type"],  label: "Párrafo",      icon: "¶",  hint: "Texto libre" },
  { type: "heading"       as ContentBlock["type"],  label: "Título",       icon: "H",  hint: "H1 / H2 / H3" },
  { type: "list"          as ContentBlock["type"],  label: "Lista",        icon: "•",  hint: "Viñetas o numerada" },
  { type: "equation"      as ContentBlock["type"],  label: "Ecuación",     icon: "∑",  hint: "LaTeX math" },
  { type: "figure"        as ContentBlock["type"],  label: "Figura",       icon: "🖼",  hint: "Imagen con leyenda" },
  { type: "table"         as ContentBlock["type"],  label: "Tabla",        icon: "⊞",  hint: "Tabla editable" },
  { type: "citation"      as ContentBlock["type"],  label: "Cita",         icon: "❞",  hint: "Referencia bibliográfica" },
  { type: "raw_latex"     as ContentBlock["type"],  label: "LaTeX directo",icon: "{}",  hint: "Fragmento LaTeX" },
  // Posgrado
  { type: "code"          as ContentBlock["type"],  label: "Código",       icon: "<>", hint: "Bloque de código fuente" },
  { type: "algorithm"     as ContentBlock["type"],  label: "Algoritmo",    icon: "∷",  hint: "Pseudocódigo numerado" },
  { type: "theorem"       as ContentBlock["type"],  label: "Teorema",      icon: "∀",  hint: "Teorema / Lema / Definición" },
  { type: "glossary_entry"as ContentBlock["type"],  label: "Glosario",     icon: "Gl", hint: "Entrada de glosario" },
  { type: "acronym_entry" as ContentBlock["type"],  label: "Acrónimo",     icon: "Ab", hint: "Lista de abreviaturas" },
];

function CommandPalette({
  sections,
  onInsertBlock,
  onJumpSection,
  onClose,
}: {
  sections: ProjectSection[];
  onInsertBlock: (type: ContentBlock["type"]) => void;
  onJumpSection: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.toLowerCase();

  const blockItems = PALETTE_BLOCK_ITEMS.filter(
    (b) => !q || b.label.toLowerCase().includes(q) || b.hint.toLowerCase().includes(q)
  );

  const sectionItems = sections
    .filter((s) => s.enabled && (!q || (s.title ?? s.id).toLowerCase().includes(q)))
    .map((s) => ({ id: s.id, label: s.title ?? s.id, placement: s.placement }));

  const allItems: { kind: "block" | "section"; label: string }[] = [
    ...blockItems.map((b) => ({ kind: "block" as const, ...b })),
    ...sectionItems.map((s) => ({ kind: "section" as const, ...s, type: undefined as never, icon: "§", hint: s.placement })),
  ];

  const total = allItems.length;

  function confirm(idx: number) {
    const item = allItems[idx];
    if (!item) return;
    if (item.kind === "block") onInsertBlock((item as unknown as typeof blockItems[0]).type);
    else onJumpSection((item as unknown as typeof sectionItems[0]).id);
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 120, zIndex: 900,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520, background: "var(--bg-chrome)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--border-firm)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de búsqueda */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
          <IconSearch size={14} style={{ color: "var(--fg-faint)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            placeholder="Insertar bloque o ir a sección…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: "var(--fs-md)", color: "var(--fg-strong)",
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, total - 1)); }
              if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter")     { e.preventDefault(); confirm(cursor); }
              if (e.key === "Escape")    { e.preventDefault(); onClose(); }
            }}
          />
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", flexShrink: 0 }}>Esc cierra</span>
        </div>

        {/* Resultados */}
        <div style={{ maxHeight: 340, overflow: "auto" }} className="scroll">
          {blockItems.length > 0 && (
            <>
              <div style={{ padding: "6px 16px 4px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)" }}>
                Insertar bloque
              </div>
              {blockItems.map((b, i) => {
                const globalIdx = i;
                return (
                  <div
                    key={b.type}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "8px 16px", cursor: "pointer",
                      background: cursor === globalIdx ? "var(--bg-selected)" : "transparent",
                    }}
                    onMouseEnter={() => setCursor(globalIdx)}
                    onClick={() => confirm(globalIdx)}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "var(--r-sm)", flexShrink: 0,
                      background: cursor === globalIdx ? "var(--accent)" : "var(--ink-100)",
                      color: cursor === globalIdx ? "white" : "var(--fg-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 600,
                    }}>
                      {b.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{b.label}</div>
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{b.hint}</div>
                    </div>
                    {cursor === globalIdx && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>↵</span>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {sectionItems.length > 0 && (
            <>
              <div style={{ padding: "6px 16px 4px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", borderTop: blockItems.length > 0 ? "1px solid var(--border-subtle)" : "none", marginTop: blockItems.length > 0 ? 4 : 0 }}>
                Ir a sección
              </div>
              {sectionItems.map((s, i) => {
                const globalIdx = blockItems.length + i;
                return (
                  <div
                    key={s.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "8px 16px", cursor: "pointer",
                      background: cursor === globalIdx ? "var(--bg-selected)" : "transparent",
                    }}
                    onMouseEnter={() => setCursor(globalIdx)}
                    onClick={() => confirm(globalIdx)}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "var(--r-sm)", flexShrink: 0,
                      background: cursor === globalIdx ? "var(--accent)" : "var(--ink-100)",
                      color: cursor === globalIdx ? "white" : "var(--fg-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14,
                    }}>
                      §
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{s.label}</div>
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{s.placement}</div>
                    </div>
                    {cursor === globalIdx && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>↵</span>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {total === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)" }}>
              Sin resultados para «{query}»
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── CitationPickerModal ───────────────────────────────────────────

function CitationPickerModal({
  refs,
  onInsert,
  onClose,
  projectPath,
  onBibUpdated,
}: {
  refs: BibReference[];
  onInsert: (ref: BibReference) => void;
  onClose: () => void;
  projectPath: string | null;
  onBibUpdated: () => void;
}) {
  const [query, setQuery] = useState("");
  const [citationType, setCitationType] = useState<"parenthetical" | "narrative" | "footnote">("parenthetical");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Panel importación: modo "single" | "batch" | "zotero"
  const [doiMode, setDoiMode] = useState<"single" | "batch" | "zotero">("single");

  // Single DOI
  const [doiInput, setDoiInput] = useState("");
  const [doiLoading, setDoiLoading] = useState(false);
  const [doiResult, setDoiResult] = useState<string | null>(null);
  const [doiError, setDoiError] = useState<string | null>(null);
  const [doiSaved, setDoiSaved] = useState(false);

  // Batch DOI
  const [batchInput, setBatchInput] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchDoiResult[]>([]);
  const [batchSaved, setBatchSaved] = useState<Set<string>>(new Set());

  // Zotero
  const [zoteroStatus, setZoteroStatus] = useState<ZoteroStatus | null>(null);
  const [zoteroChecked, setZoteroChecked] = useState(false);
  const [zoteroQuery, setZoteroQuery] = useState("");
  const [zoteroItems, setZoteroItems] = useState<ZoteroItem[]>([]);
  const [zoteroLoading, setZoteroLoading] = useState(false);
  const [zoteroSelected, setZoteroSelected] = useState<Set<string>>(new Set());
  const [zoteroImporting, setZoteroImporting] = useState(false);
  const [zoteroSaved, setZoteroSaved] = useState<Set<string>>(new Set());
  const [zoteroImportResults, setZoteroImportResults] = useState<ZoteroImportResult[]>([]);

  const checkZotero = async () => {
    setZoteroChecked(false);
    const status = await api.checkZoteroStatus().catch(() => ({ available: false, version: null, message: "Error al conectar." }));
    setZoteroStatus(status);
    setZoteroChecked(true);
    if (status.available) {
      handleZoteroSearch("");
    }
  };

  const handleZoteroSearch = async (q: string) => {
    setZoteroLoading(true);
    try {
      const items = await api.searchZotero(q);
      setZoteroItems(items);
    } catch {
      setZoteroItems([]);
    } finally {
      setZoteroLoading(false);
    }
  };

  const toggleZoteroSelect = (key: string) => {
    setZoteroSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleZoteroImport = async () => {
    if (!projectPath || zoteroSelected.size === 0) return;
    setZoteroImporting(true);
    try {
      const results = await api.importZoteroItems([...zoteroSelected]);
      setZoteroImportResults(results);
      const newSaved = new Set(zoteroSaved);
      for (const r of results) {
        if (r.bibtex && !r.error) {
          try {
            await api.appendBibEntry(projectPath, r.bibtex);
            newSaved.add(r.key);
          } catch { /* duplicado u otro error — no fatal */ }
        }
      }
      setZoteroSaved(newSaved);
      if (newSaved.size > 0) {
        onBibUpdated();
        setZoteroSelected(new Set());
      }
    } finally {
      setZoteroImporting(false);
    }
  };

  const handleDoiLookup = async () => {
    if (!doiInput.trim()) return;
    setDoiLoading(true);
    setDoiResult(null);
    setDoiError(null);
    setDoiSaved(false);
    try {
      const bibtex = await api.importDoi(doiInput.trim());
      setDoiResult(bibtex);
    } catch (e) {
      setDoiError(String(e));
    } finally {
      setDoiLoading(false);
    }
  };

  const handleDoiSave = async () => {
    if (!doiResult || !projectPath) return;
    try {
      await api.appendBibEntry(projectPath, doiResult);
      setDoiSaved(true);
      onBibUpdated();
    } catch (e) {
      setDoiError(String(e));
    }
  };

  const handleBatchImport = async () => {
    const dois = batchInput.split(/[\n,;]+/).map((d) => d.trim()).filter(Boolean);
    if (!dois.length) return;
    setBatchLoading(true);
    setBatchResults([]);
    setBatchSaved(new Set());
    try {
      const results = await api.importDoisBatch(dois);
      setBatchResults(results);
    } catch (e) {
      setBatchResults([{ doi: "—", error: String(e) }]);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchSaveOne = async (r: BatchDoiResult) => {
    if (!r.bibtex || !projectPath) return;
    try {
      await api.appendBibEntry(projectPath, r.bibtex);
      setBatchSaved((prev) => new Set([...prev, r.doi]));
      onBibUpdated();
    } catch (e) {
      setBatchResults((prev) =>
        prev.map((x) => x.doi === r.doi ? { ...x, error: String(e) } : x)
      );
    }
  };

  const handleBatchSaveAll = async () => {
    if (!projectPath) return;
    for (const r of batchResults) {
      if (r.bibtex && !batchSaved.has(r.doi)) {
        await handleBatchSaveOne(r);
      }
    }
  };

  const q = query.toLowerCase();
  const filtered = refs.filter(
    (r) =>
      !q ||
      r.key.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.author.toLowerCase().includes(q) ||
      r.year.includes(q)
  );

  const typeLabel: Record<string, string> = {
    parenthetical: "\\parencite",
    narrative:     "\\textcite",
    footnote:      "\\footcite",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: 100, zIndex: 900,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 580, background: "var(--bg-chrome)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--border-firm)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "70vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", flex: 1 }}>
            Insertar cita bibliográfica
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)" }}>
            <IconX size={14} />
          </button>
        </div>

        {/* Tipo de cita */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginRight: 4 }}>Tipo:</span>
          {(["parenthetical", "narrative", "footnote"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setCitationType(t)}
              className={`btn btn-sm ${citationType === t ? "btn-accent" : "btn-ghost"}`}
              style={{ fontSize: 11, fontFamily: "var(--font-mono)", padding: "3px 10px" }}
            >
              {citationType === t && <IconCheck size={9} sw={2.5} />}
              {typeLabel[t]}
            </button>
          ))}
        </div>

        {/* Búsqueda */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
          <IconSearch size={13} style={{ color: "var(--fg-faint)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por clave, título, autor o año…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: "var(--fs-sm)", color: "var(--fg-strong)",
            }}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          />
        </div>

        {/* Panel importar por DOI — tabulado: único / múltiples */}
        <div style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-subtle)" }}>
          {/* Pestañas */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", padding: "0 16px" }}>
            {(["single", "batch", "zotero"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setDoiMode(m);
                  if (m === "zotero" && !zoteroChecked) checkZotero();
                }}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "8px 12px", fontSize: "var(--fs-xs)", fontWeight: doiMode === m ? 600 : 400,
                  color: doiMode === m ? "var(--accent)" : "var(--fg-muted)",
                  borderBottom: doiMode === m ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                {m === "single" ? "Un DOI" : m === "batch" ? "Múltiples DOIs" : "Zotero"}
              </button>
            ))}
          </div>

          {doiMode === "single" && (
            <div style={{ padding: "10px 16px" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={doiInput}
                  onChange={(e) => { setDoiInput(e.target.value); setDoiResult(null); setDoiError(null); setDoiSaved(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleDoiLookup(); }}
                  placeholder="10.1000/xyz123 o https://doi.org/…"
                  style={{
                    flex: 1, border: "1px solid var(--border-subtle)", borderRadius: "var(--r-sm)",
                    padding: "5px 8px", fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
                    background: "var(--bg-chrome)", color: "var(--fg-strong)", outline: "none",
                  }}
                />
                <button
                  onClick={handleDoiLookup}
                  disabled={doiLoading || !doiInput.trim()}
                  className="btn btn-sm btn-accent"
                  style={{ fontSize: 11, whiteSpace: "nowrap" }}
                >
                  {doiLoading ? "Buscando…" : "Buscar"}
                </button>
              </div>
              {doiError && (
                <div style={{ marginTop: 6, fontSize: "var(--fs-xs)", color: "var(--build-err)", background: "var(--build-err-tint)", borderRadius: "var(--r-xs)", padding: "4px 8px" }}>
                  {doiError}
                </div>
              )}
              {doiResult && (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    readOnly value={doiResult} rows={4}
                    style={{
                      width: "100%", resize: "none", fontFamily: "var(--font-mono)",
                      fontSize: 10, background: "var(--bg-chrome)", border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--r-xs)", padding: "6px 8px", color: "var(--fg-default)", boxSizing: "border-box",
                    }}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button onClick={handleDoiSave} disabled={doiSaved || !projectPath} className="btn btn-sm btn-accent" style={{ fontSize: 11 }}>
                      {doiSaved ? "✓ Agregado" : "Agregar al .bib"}
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(doiResult!)} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}>
                      Copiar BibTeX
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {doiMode === "batch" && (
            <div style={{ padding: "10px 16px" }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 6 }}>
                Un DOI por línea (también separados por coma o punto y coma):
              </div>
              <textarea
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                rows={3}
                placeholder={"10.1038/nature12373\n10.1126/science.1260419\nhttps://doi.org/10.1145/3442188.3445922"}
                style={{
                  width: "100%", resize: "vertical", fontFamily: "var(--font-mono)",
                  fontSize: 10, background: "var(--bg-chrome)", border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--r-xs)", padding: "6px 8px", color: "var(--fg-default)",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <button
                  onClick={handleBatchImport}
                  disabled={batchLoading || !batchInput.trim()}
                  className="btn btn-sm btn-accent"
                  style={{ fontSize: 11 }}
                >
                  {batchLoading ? "Importando…" : "Buscar todos"}
                </button>
                {batchResults.some((r) => r.bibtex && !batchSaved.has(r.doi)) && (
                  <button onClick={handleBatchSaveAll} className="btn btn-sm btn-ghost" style={{ fontSize: 11 }} disabled={!projectPath}>
                    Agregar todos al .bib
                  </button>
                )}
              </div>
              {batchResults.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {batchResults.map((r) => (
                    <div key={r.doi} style={{
                      padding: "6px 8px", borderRadius: "var(--r-xs)",
                      background: r.error ? "var(--build-err-tint)" : batchSaved.has(r.doi) ? "var(--build-ok-tint)" : "var(--bg-chrome)",
                      border: `1px solid ${r.error ? "var(--build-err)" : batchSaved.has(r.doi) ? "var(--build-ok)" : "var(--border-subtle)"}`,
                      fontSize: "var(--fs-xs)", display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontFamily: "var(--font-mono)", flex: 1, color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.key ?? r.doi}
                      </span>
                      {r.error && <span style={{ color: "var(--build-err)", flexShrink: 0 }}>{r.error}</span>}
                      {r.bibtex && !r.error && !batchSaved.has(r.doi) && (
                        <button onClick={() => handleBatchSaveOne(r)} className="btn btn-xs btn-accent" disabled={!projectPath} style={{ flexShrink: 0 }}>
                          Agregar
                        </button>
                      )}
                      {batchSaved.has(r.doi) && <span style={{ color: "var(--build-ok)", flexShrink: 0 }}>✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

          {doiMode === "zotero" && (
            <div style={{ padding: "10px 16px" }}>
              {!zoteroChecked ? (
                <div style={{ textAlign: "center", padding: "12px 0" }}>
                  <button onClick={checkZotero} className="btn btn-sm btn-accent">
                    Detectar Zotero
                  </button>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 6 }}>
                    Requiere Zotero + plugin Better BibTeX en ejecución.
                  </div>
                </div>
              ) : !zoteroStatus?.available ? (
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", textAlign: "center", padding: "8px 0" }}>
                  <div style={{ marginBottom: 4 }}>Zotero no está disponible.</div>
                  <div style={{ color: "var(--fg-faint)" }}>{zoteroStatus?.message}</div>
                  <button onClick={checkZotero} className="btn btn-xs btn-ghost" style={{ marginTop: 8 }}>
                    Reintentar
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <input
                      value={zoteroQuery}
                      onChange={(e) => setZoteroQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleZoteroSearch(zoteroQuery); }}
                      placeholder="Buscar en tu librería Zotero…"
                      style={{
                        flex: 1, border: "1px solid var(--border-subtle)", borderRadius: "var(--r-sm)",
                        padding: "5px 8px", fontSize: "var(--fs-xs)",
                        background: "var(--bg-chrome)", color: "var(--fg-strong)", outline: "none",
                      }}
                    />
                    <button
                      onClick={() => handleZoteroSearch(zoteroQuery)}
                      disabled={zoteroLoading}
                      className="btn btn-xs btn-ghost"
                    >
                      {zoteroLoading ? "…" : "Buscar"}
                    </button>
                  </div>

                  {zoteroItems.length > 0 && (
                    <div style={{ maxHeight: 180, overflow: "auto", display: "flex", flexDirection: "column", gap: 2 }} className="scroll">
                      {zoteroItems.map((item) => {
                        const sel = zoteroSelected.has(item.key);
                        const saved = zoteroSaved.has(item.key);
                        return (
                          <div
                            key={item.key}
                            onClick={() => !saved && toggleZoteroSelect(item.key)}
                            style={{
                              padding: "5px 8px", borderRadius: "var(--r-xs)", cursor: saved ? "default" : "pointer",
                              background: saved ? "var(--build-ok-tint)" : sel ? "var(--accent-tint, #e8f0fe)" : "var(--bg-chrome)",
                              border: `1px solid ${saved ? "var(--build-ok)" : sel ? "var(--accent)" : "var(--border-subtle)"}`,
                              display: "flex", alignItems: "center", gap: 8,
                            }}
                          >
                            <input type="checkbox" checked={sel || saved} readOnly style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: "var(--fs-xs)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.title}
                            </span>
                            <span style={{ fontSize: 10, color: "var(--fg-faint)", flexShrink: 0 }}>
                              {item.author && `${item.author} `}{item.year}
                            </span>
                            {saved && <span style={{ color: "var(--build-ok)", fontSize: 10, flexShrink: 0 }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {zoteroSelected.size > 0 && (
                    <button
                      onClick={handleZoteroImport}
                      disabled={zoteroImporting || !projectPath}
                      className="btn btn-sm btn-accent"
                      style={{ marginTop: 8, fontSize: 11 }}
                    >
                      {zoteroImporting
                        ? "Importando…"
                        : `Importar ${zoteroSelected.size} referencia${zoteroSelected.size > 1 ? "s" : ""} al .bib`}
                    </button>
                  )}

                  {zoteroImportResults.some((r) => r.error) && (
                    <div style={{ marginTop: 6, fontSize: "var(--fs-xs)", color: "var(--build-err)" }}>
                      {zoteroImportResults.filter((r) => r.error).map((r) => (
                        <div key={r.key}>{r.cite_key ?? r.key}: {r.error}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Lista de referencias */}
        <div style={{ flex: 1, overflow: "auto" }} className="scroll">
          {refs.length === 0 && (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--fg-faint)" }}>
              <div style={{ fontSize: "var(--fs-sm)", marginBottom: 6 }}>No se encontró el archivo .bib</div>
              <div style={{ fontSize: "var(--fs-xs)" }}>
                Crea <span style={{ fontFamily: "var(--font-mono)" }}>content/bibliography/references.bib</span> en tu proyecto.
              </div>
            </div>
          )}
          {refs.length > 0 && filtered.length === 0 && (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)" }}>
              Sin resultados para «{query}»
            </div>
          )}
          {filtered.map((ref) => (
            <div
              key={ref.key}
              onClick={() => { onInsert(ref); onClose(); }}
              style={{
                padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)",
                cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-selected)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              {/* Chip de tipo */}
              <span style={{
                flexShrink: 0, padding: "2px 6px", borderRadius: "var(--r-xs)",
                background: "var(--ink-100)", fontFamily: "var(--font-mono)",
                fontSize: 9, color: "var(--fg-faint)", marginTop: 2,
              }}>
                {ref.entry_type}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--accent-deep)", marginBottom: 2 }}>
                  {ref.key}
                </div>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", lineHeight: 1.3, marginBottom: 3 }}>
                  {ref.title || <em style={{ color: "var(--fg-faint)" }}>Sin título</em>}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {ref.author && <span>{ref.author.split(" and ")[0]}{ref.author.includes(" and ") ? " et al." : ""}</span>}
                  {ref.year && <span style={{ fontFamily: "var(--font-mono)" }}>{ref.year}</span>}
                  {ref.journal && <span style={{ fontStyle: "italic" }}>{ref.journal}</span>}
                  {ref.doi && (
                    <span
                      title={ref.doi}
                      style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {ref.doi}
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                flexShrink: 0, fontSize: 10, fontFamily: "var(--font-mono)",
                color: "var(--fg-faint)", padding: "3px 7px",
                background: "var(--bg-panel)", borderRadius: "var(--r-xs)",
                border: "1px solid var(--border-subtle)", alignSelf: "center",
              }}>
                {typeLabel[citationType]}{"{"}…{"}"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MetaPanel: panel derecho con metadatos editables ─────────────

function MetaField({
  label, value, onChange, multiline = false, mono = false, large = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  mono?: boolean;
  large?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1px solid var(--accent-soft)", outline: "none",
    borderRadius: "var(--r-xs)", padding: "4px 6px", resize: "none",
    fontFamily: mono ? "var(--font-mono)" : large ? "var(--font-display)" : "var(--font-ui)",
    fontSize: large ? "var(--fs-md)" : "var(--fs-sm)",
    color: "var(--fg-strong)", background: "var(--bg-panel)",
    lineHeight: large ? 1.3 : 1.5,
  };

  return (
    <div>
      <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {label}
        {!editing && (
          <span style={{ cursor: "pointer", color: "var(--accent)", fontSize: 9 }} onClick={() => { setDraft(value); setEditing(true); }}>
            editar
          </span>
        )}
      </div>
      {editing ? (
        multiline ? (
          <textarea
            autoFocus
            value={draft}
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value); setEditing(false); } if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); } }}
            style={inputStyle}
          />
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value); setEditing(false); } if (e.key === "Enter") commit(); }}
            style={inputStyle}
          />
        )
      ) : (
        <div
          style={{
            color: value ? (large ? "var(--fg-strong)" : "var(--fg-default)") : "var(--fg-faint)",
            fontFamily: mono ? "var(--font-mono)" : large ? "var(--font-display)" : undefined,
            fontSize: large ? "var(--fs-md)" : "var(--fs-sm)",
            lineHeight: large ? 1.3 : 1.5,
            cursor: "text",
          }}
          onClick={() => { setDraft(value); setEditing(true); }}
        >
          {value || <em style={{ fontStyle: "normal", opacity: 0.5 }}>sin definir</em>}
        </div>
      )}
    </div>
  );
}

function MetaPanel({
  project, wordCount, blockCount, maxWords, onSave, onCompile,
}: {
  project: ProjectModel;
  wordCount: number;
  blockCount: number;
  maxWords?: number;
  onSave: (updates: Record<string, unknown>) => void;
  onCompile: () => void;
}) {
  return (
    <div style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", minHeight: 0, padding: 16, overflow: "auto" }} className="scroll">
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 12 }}>
        Proyecto
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "var(--fs-sm)" }}>
        <MetaField
          label="Título"
          value={project.metadata.title}
          onChange={(v) => onSave({ metadata: { ...project.metadata, title: v } })}
          multiline large
        />
        <MetaField
          label="Subtítulo"
          value={project.metadata.subtitle ?? ""}
          onChange={(v) => onSave({ metadata: { ...project.metadata, subtitle: v || undefined } })}
        />
        <MetaField
          label="Autor principal"
          value={project.student.full_name}
          onChange={(v) => onSave({ student: { ...project.student, full_name: v } })}
        />

        {/* Asesores dinámicos */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Asesores</span>
            <button
              type="button"
              onClick={() => {
                const next = [...(project.student.advisors ?? []), ""];
                onSave({ student: { ...project.student, advisors: next } });
              }}
              style={{
                fontSize: 11, padding: "1px 7px",
                border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
                background: "var(--bg-app)", color: "var(--fg-muted)", cursor: "pointer",
              }}
            >
              + Agregar
            </button>
          </div>
          {(project.student.advisors ?? []).length === 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic", padding: "4px 0" }}>
              Sin asesores — haz clic en + Agregar
            </div>
          )}
          {(project.student.advisors ?? []).map((adv, i) => (
            <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
              <input
                value={adv}
                onChange={(e) => {
                  const next = [...(project.student.advisors ?? [])];
                  next[i] = e.target.value;
                  onSave({ student: { ...project.student, advisors: next } });
                }}
                style={{
                  flex: 1, padding: "5px 8px", borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
                  fontSize: "var(--fs-xs)", color: "var(--fg-strong)", outline: "none",
                }}
                placeholder="Dra. Ana Torres"
              />
              <button
                type="button"
                onClick={() => {
                  const next = (project.student.advisors ?? []).filter((_, idx) => idx !== i);
                  onSave({ student: { ...project.student, advisors: next } });
                }}
                style={{
                  width: 22, height: 22, flexShrink: 0,
                  border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
                  background: "var(--bg-panel)", color: "var(--fg-faint)", cursor: "pointer",
                  fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >×</button>
            </div>
          ))}
        </div>

        {/* Co-autores dinámicos */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Co-autores</span>
            <button
              type="button"
              onClick={() => {
                const next = [...(project.student.co_authors ?? []), { full_name: "" }];
                onSave({ student: { ...project.student, co_authors: next } });
              }}
              style={{
                fontSize: 11, padding: "1px 7px",
                border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
                background: "var(--bg-app)", color: "var(--fg-muted)", cursor: "pointer",
              }}
            >
              + Agregar
            </button>
          </div>
          {(project.student.co_authors ?? []).map((ca, i) => (
            <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
              <input
                value={ca.full_name}
                onChange={(e) => {
                  const next = [...(project.student.co_authors ?? [])];
                  next[i] = { ...next[i], full_name: e.target.value };
                  onSave({ student: { ...project.student, co_authors: next } });
                }}
                style={{
                  flex: 1, padding: "5px 8px", borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
                  fontSize: "var(--fs-xs)", color: "var(--fg-strong)", outline: "none",
                }}
                placeholder="Luis Hernández"
              />
              <button
                type="button"
                onClick={() => {
                  const next = (project.student.co_authors ?? []).filter((_, idx) => idx !== i);
                  onSave({ student: { ...project.student, co_authors: next } });
                }}
                style={{
                  width: 22, height: 22, flexShrink: 0,
                  border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)",
                  background: "var(--bg-panel)", color: "var(--fg-faint)", cursor: "pointer",
                  fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >×</button>
            </div>
          ))}
        </div>
        {/* Comité sinodal (posgrado) */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Comité sinodal</span>
            <button
              type="button"
              onClick={() => {
                const next: CommitteeMember[] = [...(project.student.committee ?? []), { full_name: "" }];
                onSave({ student: { ...project.student, committee: next } });
              }}
              style={{ fontSize: 11, padding: "1px 7px", border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", background: "var(--bg-app)", color: "var(--fg-muted)", cursor: "pointer" }}
            >
              + Agregar
            </button>
          </div>
          {(project.student.committee ?? []).length === 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic", padding: "4px 0" }}>
              Sin comité — opcional para maestría, recomendado para doctorado
            </div>
          )}
          {(project.student.committee ?? []).map((m, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 4, marginBottom: 4, alignItems: "center" }}>
              <input
                value={m.full_name}
                onChange={(e) => {
                  const next = [...(project.student.committee ?? [])];
                  next[i] = { ...next[i], full_name: e.target.value };
                  onSave({ student: { ...project.student, committee: next } });
                }}
                placeholder="Dra. María García"
                style={{ padding: "5px 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-xs)", color: "var(--fg-strong)", outline: "none" }}
              />
              <input
                value={m.role ?? ""}
                onChange={(e) => {
                  const next = [...(project.student.committee ?? [])];
                  next[i] = { ...next[i], role: e.target.value || undefined };
                  onSave({ student: { ...project.student, committee: next } });
                }}
                placeholder="Presidenta"
                style={{ padding: "5px 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", outline: "none" }}
              />
              <button
                type="button"
                onClick={() => {
                  const next = (project.student.committee ?? []).filter((_, idx) => idx !== i);
                  onSave({ student: { ...project.student, committee: next } });
                }}
                style={{ width: 22, height: 22, flexShrink: 0, border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", color: "var(--fg-faint)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
              >×</button>
            </div>
          ))}
        </div>

        {/* ORCID */}
        <MetaField
          label="ORCID iD"
          value={project.student.orcid ?? ""}
          onChange={(v) => onSave({ student: { ...project.student, orcid: v || undefined } })}
          mono
        />

        <MetaField
          label="Institución"
          value={project.institution.name}
          onChange={(v) => onSave({ institution: { ...project.institution, name: v } })}
        />
        <MetaField
          label="Facultad"
          value={project.institution.faculty ?? ""}
          onChange={(v) => onSave({ institution: { ...project.institution, faculty: v || undefined } })}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Ciudad</div>
            <MetaField label="" value={project.metadata.city} onChange={(v) => onSave({ metadata: { ...project.metadata, city: v } })} />
          </div>
          <div>
            <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Año</div>
            <MetaField label="" value={String(project.metadata.year)} onChange={(v) => onSave({ metadata: { ...project.metadata, year: parseInt(v) || project.metadata.year } })} mono />
          </div>
        </div>

        <div>
          <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Perfil</div>
          <span className="chip tx-mono" style={{ fontSize: 11 }}>{project.profile_id}</span>
        </div>

        <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div>
            <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Palabras</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "var(--fs-md)" }}>{wordCount.toLocaleString("es")}</div>
            {maxWords && maxWords > 0 && (() => {
              const pct = Math.min(100, (wordCount / maxWords) * 100);
              const over = wordCount > maxWords;
              const near = pct >= 90;
              const barColor = over ? "var(--build-err)" : near ? "var(--build-warn)" : "var(--build-ok)";
              return (
                <div style={{ marginTop: 4 }}>
                  <div style={{
                    height: 4, borderRadius: 2,
                    background: "var(--border-subtle)", overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", width: `${pct}%`,
                      background: barColor,
                      transition: "width 0.3s, background 0.3s",
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: over ? "var(--build-err)" : "var(--fg-faint)", marginTop: 2 }}>
                    {over
                      ? `+${(wordCount - maxWords).toLocaleString("es")} sobre límite`
                      : `${(maxWords - wordCount).toLocaleString("es")} restantes`
                    }
                  </div>
                </div>
              );
            })()}
          </div>
          <div>
            <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Bloques</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "var(--fs-md)" }}>{blockCount}</div>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />

        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.9 }}>
          <div style={{ fontWeight: 600, color: "var(--fg-muted)", marginBottom: 2 }}>Atajos</div>
          {([
            ["Ctrl+K",  "Paleta de comandos"],
            ["Ctrl+[",  "Insertar cita"],
            ["Ctrl+S",  "Guardar"],
            ["Esc",     "Salir edición"],
            ["Enter",   "Lista: nuevo ítem"],
          ] as [string, string][]).map(([key, desc]) => (
            <div key={key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 9, background: "var(--bg-app)", border: "1px solid var(--border-firm)", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>{key}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 12 }}>
        <button className="btn btn-accent" style={{ width: "100%" }} onClick={onCompile}>
          <IconBuild size={13} /> Compilar PDF
        </button>
      </div>
    </div>
  );
}

// ── DocumentOptionsPanel ─────────────────────────────────────────

function DocumentOptionsPanel({
  typography,
  onSave,
  onClose,
}: {
  typography: LatexTypography;
  onSave: (t: LatexTypography) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<LatexTypography>({ ...typography });
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<LatexTypography>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(draft); onClose(); }
    finally { setSaving(false); }
  };

  const OptionRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );

  const Chip = ({ value, current, label, onClick }: { value: string; current?: string; label: string; onClick: () => void }) => (
    <button
      className={`btn btn-sm ${current === value ? "btn-accent" : "btn-ghost"}`}
      onClick={onClick}
      style={{ padding: "4px 14px", fontSize: "var(--fs-xs)" }}
    >
      {label}
      {current === value && <IconCheck size={9} sw={2.5} />}
    </button>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 900 }}
      onClick={onClose}
    >
      <div
        style={{ width: 440, background: "var(--bg-chrome)", borderRadius: "var(--r-lg)", border: "1px solid var(--border-firm)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center" }}>
          <span style={{ flex: 1, fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>
            Opciones del documento
          </span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX size={13} /></button>
        </div>

        {/* Opciones */}
        <div style={{ padding: "18px 18px 14px", display: "flex", flexDirection: "column", gap: 16 }}>
          <OptionRow label="Tamaño de fuente">
            {[["10pt","10pt"],["11pt","11pt"],["12pt","12pt (recomendado)"]].map(([v,l]) => (
              <Chip key={v} value={v} current={draft.font_size} label={l} onClick={() => update({ font_size: draft.font_size === v ? undefined : v })} />
            ))}
          </OptionRow>

          <OptionRow label="Tamaño de papel">
            {[["a4paper","A4"],["letterpaper","Carta (Letter)"]].map(([v,l]) => (
              <Chip key={v} value={v} current={draft.paper_size} label={l} onClick={() => update({ paper_size: draft.paper_size === v ? undefined : v })} />
            ))}
          </OptionRow>

          <OptionRow label="Interlineado">
            {[["single","Simple"],["onehalf","1.5 (recomendado)"],["double","Doble"]].map(([v,l]) => (
              <Chip key={v} value={v} current={draft.line_spacing} label={l} onClick={() => update({ line_spacing: draft.line_spacing === v ? undefined : v })} />
            ))}
          </OptionRow>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Márgenes — {draft.margin_cm ?? 2.5} cm
            </label>
            <input
              type="range"
              min={1.5} max={4.0} step={0.25}
              value={draft.margin_cm ?? 2.5}
              onChange={(e) => update({ margin_cm: parseFloat(e.target.value) })}
              style={{ accentColor: "var(--accent)", width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
              <span>1.5 cm (mínimo)</span>
              <span>4.0 cm (máximo)</span>
            </div>
          </div>
        </div>

        {/* Nota */}
        <div style={{ padding: "0 18px 10px", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.6 }}>
          Los cambios se aplicarán al compilar el siguiente PDF. Los valores sin seleccionar usarán los del perfil activo.
        </div>

        {/* Botones */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" disabled={saving} onClick={handleSave}>
            <IconCheck size={12} /> Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditorView principal ──────────────────────────────────────────

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export default function EditorView() {
  const { id: encodedPath } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeProject, activeProjectPath, activeSectionId, setActiveSectionId } = useProjectStore();

  const [localBlocks, setLocalBlocks] = useState<ContentBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag & drop state
  const [dragId, setDragId]   = useState<string | null>(null);
  const [dropId, setDropId]   = useState<string | null>(null);

  // Opciones del documento
  const [docOptionsOpen, setDocOptionsOpen] = useState(false);

  // Snapshots (versiones)
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<{ filename: string; timestamp: string; label: string }[]>([]);
  const [newSnapLabel, setNewSnapLabel] = useState("");
  const [snapBusy, setSnapBusy] = useState(false);

  // Navigation guard — bloquear si hay cambios sin guardar
  const isUnsaved = saveStatus === "unsaved" || saveStatus === "error";
  const blocker = useBlocker(isUnsaved);

  // Toolbar académico
  const [paletteOpen, setPaletteOpen]     = useState(false);
  const [citPickerOpen, setCitPickerOpen] = useState(false);
  const [bibRefs, setBibRefs]             = useState<BibReference[]>([]);

  // Paneles de revisión de texto
  const [spellPanelOpen, setSpellPanelOpen]     = useState(false);
  const [grammarPanelOpen, setGrammarPanelOpen] = useState(false);

  // Perfil activo: se carga para mostrar guidance por sección y límites
  const [profileSections, setProfileSections] = useState<import("../types").ProfileSectionInfo[]>([]);
  const [profileMaxWords, setProfileMaxWords] = useState<number | undefined>(undefined);
  useEffect(() => {
    const pid = activeProject?.profile_id;
    if (!pid) return;
    api.getProfileDetail(pid).then((p) => {
      setProfileSections(p.sections ?? []);
      setProfileMaxWords(p.max_words);
    }).catch(() => {});
  }, [activeProject?.profile_id]);

  // Sincronizar localBlocks cuando cambia la sección activa
  useEffect(() => {
    const section = activeProject?.sections.find((s) => s.id === activeSectionId);
    setLocalBlocks(section?.blocks ?? []);
    setEditingId(null);
    setSaveStatus("saved");
  }, [activeSectionId, activeProject]);

  const doSave = useCallback(async (blocks: ContentBlock[], sectionId: string) => {
    setSaveStatus("saving");
    useProjectStore.getState().updateSectionBlocks(sectionId, blocks);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv && activeProjectPath) {
      try {
        await api.saveSection(activeProjectPath, sectionId, blocks);
      } catch (e) {
        console.error("Error guardando:", e);
        setSaveStatus("error");
        return;
      }
    }
    setSaveStatus("saved");
  }, [activeProjectPath]);

  // Prevenir cierre de ventana/app con cambios sin guardar
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isUnsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isUnsaved]);

  // ── Snapshots ──────────────────────────────────────────────────
  const loadSnapshots = useCallback(async () => {
    if (!activeProjectPath) return;
    try {
      const list = await api.listSnapshots(activeProjectPath);
      setSnapshots(list);
    } catch {
      setSnapshots([]);
    }
  }, [activeProjectPath]);

  useEffect(() => {
    if (snapshotsOpen) loadSnapshots();
  }, [snapshotsOpen, loadSnapshots]);

  const handleCreateSnapshot = useCallback(async () => {
    if (!activeProjectPath || !newSnapLabel.trim()) return;
    setSnapBusy(true);
    try {
      await api.createSnapshot(activeProjectPath, newSnapLabel.trim());
      setNewSnapLabel("");
      await loadSnapshots();
    } catch (e) {
      console.error("Error creando snapshot:", e);
    } finally {
      setSnapBusy(false);
    }
  }, [activeProjectPath, newSnapLabel, loadSnapshots]);

  const handleRestoreSnapshot = useCallback(async (filename: string) => {
    if (!activeProjectPath) return;
    const ok = window.confirm(
      "¿Restaurar esta versión? El estado actual se guardará automáticamente como un snapshot de respaldo antes de restaurar."
    );
    if (!ok) return;
    setSnapBusy(true);
    try {
      await api.restoreSnapshot(activeProjectPath, filename);
      // Recargar el proyecto desde disco
      const model = await api.getProject(activeProjectPath);
      useProjectStore.getState().openProject(model, activeProjectPath);
      setSnapshotsOpen(false);
    } catch (e) {
      console.error("Error restaurando snapshot:", e);
    } finally {
      setSnapBusy(false);
    }
  }, [activeProjectPath]);

  const handleDeleteSnapshot = useCallback(async (filename: string) => {
    if (!activeProjectPath) return;
    const ok = window.confirm("¿Eliminar este snapshot? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      await api.deleteSnapshot(activeProjectPath, filename);
      await loadSnapshots();
    } catch (e) {
      console.error("Error eliminando snapshot:", e);
    }
  }, [activeProjectPath, loadSnapshots]);

  const scheduleAutoSave = useCallback((blocks: ContentBlock[]) => {
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!activeSectionId) return;
    saveTimer.current = setTimeout(() => doSave(blocks, activeSectionId), 1500);
  }, [activeSectionId, doSave]);

  const updateBlock = useCallback((id: string, updates: Record<string, unknown>) => {
    setLocalBlocks((prev) => {
      const next = prev.map((b) => b.id === id ? { ...b, ...updates } : b);
      scheduleAutoSave(next);
      return next;
    });
  }, [scheduleAutoSave]);

  const addBlock = useCallback((type: ContentBlock["type"]) => {
    const id = newId();
    let block: ContentBlock;
    switch (type) {
      case "paragraph":      block = { type, id, content: "" }; break;
      case "heading":        block = { type, id, level: "section", content: "" }; break;
      case "list":           block = { type, id, list_type: "itemize", items: [""] }; break;
      case "equation":       block = { type, id, latex_content: "", numbered: false }; break;
      case "raw_latex":      block = { type, id, content: "", user_confirmed: false }; break;
      case "figure":         block = { type, id, file: "", caption: "", width: "full", label: `fig:${id.slice(0, 6)}`, include_in_list: true }; break;
      case "table":          block = { type, id, caption: "", label: `tab:${id.slice(0, 6)}`, include_in_list: true, headers: ["Columna 1", "Columna 2"], rows: [["", ""], ["", ""]] }; break;
      case "citation":       block = { type, id, citation_key: "", citation_type: "parenthetical" }; break;
      case "glossary_entry": block = { type, id, term: "", definition: "" }; break;
      case "acronym_entry":  block = { type, id, acronym: "", full_form: "", description: undefined }; break;
      case "code":           block = { type, id, language: "Python", content: "", show_line_numbers: true }; break;
      case "algorithm":      block = { type, id, caption: "", body: "" }; break;
      case "theorem":        block = { type, id, kind: "theorem", content: "", numbered: true }; break;
      default: return;
    }
    setLocalBlocks((prev) => {
      const next = [...prev, block];
      scheduleAutoSave(next);
      return next;
    });
    setEditingId(id);
  }, [scheduleAutoSave]);

  const deleteBlock = useCallback((id: string) => {
    setLocalBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      scheduleAutoSave(next);
      return next;
    });
    setEditingId(null);
  }, [scheduleAutoSave]);

  // Insertar cita bibliográfica desde el picker
  const insertCitation = useCallback((ref: BibReference, citType: "parenthetical" | "narrative" | "footnote" = "parenthetical") => {
    const id = newId();
    const block: ContentBlock = {
      type: "citation",
      id,
      citation_key: ref.key,
      citation_type: citType,
    };
    setLocalBlocks((prev) => {
      const next = [...prev, block];
      scheduleAutoSave(next);
      return next;
    });
    setEditingId(id);
  }, [scheduleAutoSave]);

  // Reordenar bloques al soltar (dragId → antes de dropId)
  const handleDrop = useCallback((targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDropId(null); return; }
    setLocalBlocks((prev) => {
      const src = prev.find((b) => b.id === dragId);
      if (!src) return prev;
      const without = prev.filter((b) => b.id !== dragId);
      const targetIdx = without.findIndex((b) => b.id === targetId);
      if (targetIdx === -1) return prev;
      const next = [...without.slice(0, targetIdx), src, ...without.slice(targetIdx)];
      scheduleAutoSave(next);
      return next;
    });
    setDragId(null);
    setDropId(null);
  }, [dragId, scheduleAutoSave]);

  // Guardar metadatos del proyecto (título, autor, institución)
  const saveMetadata = useCallback(async (updates: Record<string, unknown>) => {
    if (!activeProject || !activeProjectPath) return;
    const updated = { ...activeProject, ...updates };
    useProjectStore.getState().updateProject(updates as Partial<import("../types").ProjectModel>);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      try { await api.saveProject(activeProjectPath, updated); }
      catch (e) { console.error("Error guardando metadatos:", e); }
    }
  }, [activeProject, activeProjectPath]);

  // ── Estado / notas de sección ──────────────────────────────────
  const handleSectionStatusChange = useCallback(async (sectionId: string, status: SectionStatus) => {
    if (!activeProjectPath) return;
    const section = activeProject?.sections.find((s) => s.id === sectionId);
    useProjectStore.getState().updateSectionMeta(sectionId, status, section?.notes);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      try { await api.updateSectionMeta(activeProjectPath, sectionId, status, section?.notes); }
      catch (e) { console.error("Error actualizando estado:", e); }
    }
  }, [activeProjectPath, activeProject]);

  const handleSectionNotesChange = useCallback(async (sectionId: string, notes: string) => {
    if (!activeProjectPath) return;
    const section = activeProject?.sections.find((s) => s.id === sectionId);
    const status = section?.status ?? "draft";
    useProjectStore.getState().updateSectionMeta(sectionId, status, notes || undefined);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      try { await api.updateSectionMeta(activeProjectPath, sectionId, status, notes || undefined); }
      catch (e) { console.error("Error actualizando notas:", e); }
    }
  }, [activeProjectPath, activeProject]);

  // ── Tipografía del documento ───────────────────────────────────
  const handleSaveTypography = useCallback(async (typo: LatexTypography) => {
    if (!activeProjectPath || !activeProject) return;
    // Actualizar en el store
    const updated = {
      ...activeProject,
      latex_config: {
        ...(activeProject.latex_config ?? { document_class: { name: "book", options: [] }, bibliography_style: "apa", typography: {} }),
        typography: typo,
      },
    };
    useProjectStore.getState().updateProject(updated);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      try {
        await api.updateTypography(
          activeProjectPath,
          typo.font_size,
          typo.paper_size,
          typo.line_spacing,
          typo.margin_cm,
        );
      } catch (e) {
        console.error("Error guardando tipografía:", e);
      }
    }
  }, [activeProjectPath, activeProject]);

  // Cargar referencias .bib — reutilizable tras agregar entradas por DOI
  const reloadBibRefs = useCallback(() => {
    if (!activeProjectPath) return;
    api.listReferences(activeProjectPath)
      .then(setBibRefs)
      .catch(() => setBibRefs([]));
  }, [activeProjectPath]);

  useEffect(() => { reloadBibRefs(); }, [reloadBibRefs]);

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K → paleta de comandos
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      // Ctrl+[ / Cmd+[ → picker de citas
      if ((e.ctrlKey || e.metaKey) && e.key === "[") {
        e.preventDefault();
        setCitPickerOpen((o) => !o);
        return;
      }
      // Ctrl+S / Cmd+S → guardar inmediatamente
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeSectionId) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          doSave(localBlocks, activeSectionId);
        }
        return;
      }
      // Esc → cerrar modales o salir del modo edición
      if (e.key === "Escape") {
        if (paletteOpen)    { setPaletteOpen(false); return; }
        if (citPickerOpen)  { setCitPickerOpen(false); return; }
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSectionId, localBlocks, doSave, paletteOpen, citPickerOpen]);

  if (!activeProject || !activeProjectPath) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--fg-muted)", background: "var(--bg-app)" }}>
        <p>Proyecto no cargado.</p>
        <button className="btn" onClick={() => navigate("/")}>← Inicio</button>
      </div>
    );
  }

  const groups = usePlacementGroup(activeProject.sections);
  const activeSection = activeProject.sections.find((s) => s.id === activeSectionId)
    ?? activeProject.sections.find((s) => s.placement === "body" && s.enabled)
    ?? activeProject.sections[0];

  const bodyWordCount = activeProject.sections
    .filter((s) => s.placement === "body")
    .reduce((acc, s) => acc + countWords(s.id === activeSectionId ? localBlocks : s.blocks), 0);

  const projectName = activeProject.metadata.title;

  const saveLabel =
    saveStatus === "saving"  ? t("editor.saving") :
    saveStatus === "unsaved" ? t("editor.unsaved_changes") :
    saveStatus === "error"   ? t("common.error") :
    t("editor.autosaved");
  const saveDot =
    saveStatus === "saving"  ? "var(--build-warn)" :
    saveStatus === "unsaved" ? "var(--build-err)" :
    saveStatus === "error"   ? "var(--build-err)" :
    "var(--build-ok)";

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><TxBreadcrumb parts={[projectName, activeSection?.title ?? "Sección"]} /></>}
        center={null}
        right={
          <>
            <button className="btn btn-ghost btn-sm"><IconSearch size={13} /></button>
            <button
              className={`btn btn-ghost btn-sm${snapshotsOpen ? " btn-active" : ""}`}
              onClick={() => setSnapshotsOpen((o) => !o)}
              title="Versiones guardadas del proyecto"
            >
              <IconRefresh size={13} /> Versiones
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/project/${encodedPath}/progress`)} title="Ver progreso y generar reporte de revisión">
              Progreso
            </button>
            <button className="btn btn-accent btn-sm" onClick={() => navigate(`/project/${encodedPath}/compile`)}>
              <IconBuild size={13} /> {t("editor.compile")}
            </button>
            <button
              className={`btn btn-ghost btn-icon${docOptionsOpen ? " btn-active" : ""}`}
              title="Opciones del documento"
              onClick={() => setDocOptionsOpen(true)}
            >
              <IconSettings size={14} />
            </button>
            <LanguagePicker />
            <button
              className="btn btn-ghost btn-icon"
              title={t("common.settings")}
              onClick={() => navigate("/settings")}
            >
              <IconSliders size={14} />
            </button>
          </>
        }
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)" }}>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr 340px", minHeight: 0 }}>

        {/* ── Árbol de secciones ─────────────────────────────────── */}
        <div style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "12px 14px 8px", fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            Secciones
            <button className="btn btn-ghost btn-icon" style={{ padding: 4 }}><IconPlus size={12} /></button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 6px 12px" }} className="scroll">
            {Object.entries(groups).map(([groupLabel, secs]) => (
              <div key={groupLabel}>
                <div style={{ margin: "6px 8px 2px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)", display: "flex", alignItems: "center", gap: 6 }}>
                  <IconChevronD size={10} /> {groupLabel}
                </div>
                {secs.filter((s) => s.enabled).map((s) => {
                  const sStatus = s.status ?? "draft";
                  const dotColor = STATUS_CONFIG[sStatus as SectionStatus]?.color ?? "#888";
                  return (
                    <div
                      key={s.id}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "var(--fs-base)", cursor: "pointer", background: s.id === activeSectionId ? "var(--bg-selected)" : "transparent", color: s.id === activeSectionId ? "var(--accent-deep)" : "var(--fg-default)", fontWeight: s.id === activeSectionId ? 500 : 400, minHeight: 26 }}
                      onClick={() => setActiveSectionId(s.id)}
                      title={`${s.title ?? s.element_id} · ${STATUS_CONFIG[sStatus as SectionStatus]?.label ?? sStatus}`}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title ?? s.element_id}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>
                        {(s.id === activeSectionId ? localBlocks.length : s.blocks.length) || ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Canvas editor ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Toolbar */}
          <div style={{ height: 38, flexShrink: 0, borderBottom: "1px solid var(--border-subtle)", padding: "0 14px", display: "flex", alignItems: "center", gap: 2, background: "var(--bg-panel)", fontSize: "var(--fs-sm)", overflowX: "auto" }}>
            {([
              ["paragraph",      <IconText size={12} />,           "Párrafo"],
              ["heading",        <IconHeading size={12} />,         "Título"],
              ["list",           <IconList size={12} />,            "Lista"],
              ["equation",       <IconSigma size={12} />,          "Ecuación"],
              ["figure",         <IconImage size={12} />,           "Figura"],
              ["table",          <IconTable size={12} />,           "Tabla"],
              ["raw_latex",      <IconCode size={12} />,            "LaTeX"],
              ["code",           <IconCode size={12} />,            "Código"],
              ["algorithm",      <IconAlgorithm size={12} />,       "Algoritmo"],
              ["theorem",        <IconTheorem size={12} />,         "Teorema"],
              ["glossary_entry", <IconGlossaryEntry size={12} />,   "Glosario"],
              ["acronym_entry",  <IconAcronym size={12} />,         "Acrónimo"],
            ] as [ContentBlock["type"], React.ReactNode, string][]).map(([type, icon, label]) => (
              <button
                key={type}
                className="btn btn-ghost btn-sm"
                onClick={() => addBlock(type)}
                title={`Agregar ${label}`}
                style={{ flexDirection: "column", gap: 1, padding: "5px 8px", height: "auto", fontSize: 9 }}
              >
                {icon}<span>{label}</span>
              </button>
            ))}

            {/* Separador */}
            <div style={{ width: 1, height: 22, background: "var(--border-subtle)", margin: "0 4px", flexShrink: 0 }} />

            {/* Picker de citas */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCitPickerOpen(true)}
              title="Insertar cita bibliográfica (Ctrl+[)"
              style={{ flexDirection: "column", gap: 1, padding: "5px 8px", height: "auto", fontSize: 9 }}
            >
              <IconMore size={12} /><span>Cita</span>
            </button>

            <div style={{ flex: 1 }} />

            {/* Botones de revisión */}
            <div style={{ width: 1, height: 22, background: "var(--border-subtle)", margin: "0 4px", flexShrink: 0 }} />
            <button
              className={`btn btn-sm ${spellPanelOpen ? "btn-accent" : "btn-ghost"}`}
              onClick={() => { setSpellPanelOpen((v) => !v); if (grammarPanelOpen) setGrammarPanelOpen(false); }}
              title={t("spell.panel_title")}
              style={{ fontSize: "var(--fs-xs)", padding: "4px 8px" }}
            >
              ABC✓
            </button>
            <button
              className={`btn btn-sm ${grammarPanelOpen ? "btn-accent" : "btn-ghost"}`}
              onClick={() => { setGrammarPanelOpen((v) => !v); if (spellPanelOpen) setSpellPanelOpen(false); }}
              title={t("grammar.panel_title")}
              style={{ fontSize: "var(--fs-xs)", padding: "4px 8px" }}
            >
              LT
            </button>

            <div style={{ display: "none" }} />

            {/* Paleta de comandos */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPaletteOpen(true)}
              title="Paleta de comandos (Ctrl+K)"
              style={{ fontSize: "var(--fs-xs)", gap: 5, padding: "4px 10px" }}
            >
              <IconSearch size={11} />
              <span>Comandos</span>
              <span className="kbd" style={{ fontSize: 9 }}>⌘K</span>
            </button>

            <div style={{ width: 1, height: 22, background: "var(--border-subtle)", margin: "0 6px", flexShrink: 0 }} />

            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--fs-xs)", color: saveStatus === "error" ? "var(--build-err)" : "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: saveDot }} />
              <IconRefresh size={11} /> {saveLabel}
              {saveStatus === "error" && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "var(--fs-xs)", padding: "1px 6px", marginLeft: 4 }}
                  onClick={() => activeProjectPath && doSave(localBlocks, activeSectionId ?? "")}
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>

          {/* Paper canvas */}
          <div
            style={{ flex: 1, overflow: "auto", padding: "32px 0", background: "var(--bg-app)" }}
            className="scroll"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null); }}
          >
            {activeSection ? (
              <div style={{ width: 680, margin: "0 auto", background: "var(--bg-paper)", borderRadius: 4, boxShadow: "var(--shadow-paper)", border: "1px solid var(--bg-paper-edge)", padding: "56px 72px 80px", minHeight: 800 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", letterSpacing: "0.05em", marginBottom: 4 }}>
                  {activeSection.element_id}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 500, color: "var(--fg-strong)", margin: "4px 0 16px", letterSpacing: "-0.015em", lineHeight: 1.15 }}>
                  {activeSection.title ?? activeSection.element_id}
                </div>

                <SectionGuidance
                  guidance={profileSections.find((ps) => ps.element_id === activeSection.element_id)?.guidance}
                />

                <SectionStatusBar
                  section={activeSection}
                  onChangeStatus={(s) => handleSectionStatusChange(activeSection.id, s)}
                  onChangeNotes={(n) => handleSectionNotesChange(activeSection.id, n)}
                />

                {localBlocks.length === 0 ? (
                  <div
                    style={{ textAlign: "center", padding: "60px 0", color: "var(--fg-faint)", fontSize: "var(--fs-md)", cursor: "text" }}
                    onClick={() => addBlock("paragraph")}
                  >
                    <p style={{ margin: 0 }}>Sección vacía.</p>
                    <p style={{ fontSize: "var(--fs-sm)", marginTop: 8, color: "var(--fg-faint)" }}>
                      Clic aquí para agregar un párrafo, o usa la barra de herramientas arriba.
                    </p>
                  </div>
                ) : (
                  <>
                    {localBlocks.map((block) => (
                      <BlockItem
                        key={block.id}
                        block={block}
                        isEditing={editingId === block.id}
                        onStartEdit={() => setEditingId(block.id)}
                        onUpdate={(updates) => updateBlock(block.id, updates as Record<string, unknown>)}
                        onDelete={() => deleteBlock(block.id)}
                        dragging={dragId === block.id}
                        dragOver={dropId === block.id}
                        onDragStart={() => { setDragId(block.id); setEditingId(null); }}
                        onDragEnd={() => { setDragId(null); setDropId(null); }}
                        onDragOver={() => { if (dragId && dragId !== block.id) setDropId(block.id); }}
                        onDragLeave={() => setDropId((prev) => prev === block.id ? null : prev)}
                        onDrop={() => handleDrop(block.id)}
                      />
                    ))}
                    {/* Zona de click al final para agregar párrafo */}
                    <div
                      style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)", cursor: "text", borderRadius: 6, marginTop: 8 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                      onClick={() => addBlock("paragraph")}
                    >
                      <IconPlus size={12} style={{ marginRight: 6 }} /> Nuevo párrafo
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--fg-faint)", marginTop: 80 }}>
                Selecciona una sección en el árbol
              </div>
            )}
          </div>
        </div>

        {/* ── Panel derecho: metadata editable ───────────────────── */}
        <MetaPanel
          project={activeProject}
          wordCount={bodyWordCount}
          blockCount={localBlocks.length}
          maxWords={profileMaxWords}
          onSave={saveMetadata}
          onCompile={() => navigate(`/project/${encodedPath}/compile`)}
        />
      </div>

      {/* Paneles de revisión ortográfica / gramatical */}
      {spellPanelOpen && (
        <SpellPanel
          blocks={localBlocks
            .filter((b) => b.type === "paragraph")
            .map((b) => ({ id: b.id, content: b.type === "paragraph" ? b.content : "" }))}
          onReplace={(blockId, start, end, replacement) => {
            setLocalBlocks((prev) => {
              const next = prev.map((b) => {
                if (b.id !== blockId || b.type !== "paragraph") return b;
                // Replace only the exact character range — never touches other blocks
                return {
                  ...b,
                  content: b.content.slice(0, start) + replacement + b.content.slice(end),
                };
              });
              scheduleAutoSave(next);
              return next;
            });
          }}
          onClose={() => setSpellPanelOpen(false)}
        />
      )}
      {grammarPanelOpen && (
        <GrammarPanel
          text={localBlocks
            .filter((b) => b.type === "paragraph")
            .map((b) => (b.type === "paragraph" ? b.content : ""))
            .join("\n\n")}
          onAccept={(match: GrammarMatch, replacement: string) => {
            setLocalBlocks((prev) => {
              // Build offset map using the same separator as the text we sent to LT
              const paraBlocks = prev
                .filter((b) => b.type === "paragraph")
                .map((b) => ({ id: b.id, content: b.type === "paragraph" ? b.content : "" }));
              const offsetMap = buildBlockOffsetMap(paraBlocks, "\n\n");

              // Find which block contains the match start offset
              const blockEntry = offsetMap.find(
                (e) => match.offset >= e.start && match.offset < e.end,
              );
              if (!blockEntry) return prev; // offset out of range — skip

              const localStart = match.offset - blockEntry.start;
              const localEnd = localStart + match.length;

              // Safety: reject cross-block corrections (extremely rare but possible)
              if (localEnd > blockEntry.end - blockEntry.start) return prev;

              const next = prev.map((b) => {
                if (b.id !== blockEntry.id || b.type !== "paragraph") return b;
                return {
                  ...b,
                  content:
                    b.content.slice(0, localStart) +
                    replacement +
                    b.content.slice(localEnd),
                };
              });
              scheduleAutoSave(next);
              return next;
            });
          }}
          onClose={() => setGrammarPanelOpen(false)}
        />
      )}
      </div>

      {/* Paleta de comandos (Ctrl+K) */}
      {paletteOpen && (
        <CommandPalette
          sections={activeProject.sections}
          onInsertBlock={(type) => addBlock(type)}
          onJumpSection={(id) => { setActiveSectionId(id); }}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {/* Picker de citas (Ctrl+[) */}
      {citPickerOpen && (
        <CitationPickerModal
          refs={bibRefs}
          onInsert={(ref) => insertCitation(ref, "parenthetical")}
          onClose={() => setCitPickerOpen(false)}
          projectPath={activeProjectPath}
          onBibUpdated={reloadBibRefs}
        />
      )}

      {/* ── Panel de versiones (snapshots) ───────────────────────── */}
      {snapshotsOpen && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", justifyContent: "flex-end", zIndex: 800,
          }}
          onClick={() => setSnapshotsOpen(false)}
        >
          <div
            style={{
              width: 380, height: "100%", background: "var(--bg-chrome)",
              borderLeft: "1px solid var(--border-firm)",
              display: "flex", flexDirection: "column",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--fg-strong)", flex: 1 }}>
                Versiones guardadas
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => setSnapshotsOpen(false)}>
                <IconX size={13} />
              </button>
            </div>

            {/* Crear nuevo snapshot */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 6 }}>
                Guardar versión actual
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={newSnapLabel}
                  onChange={(e) => setNewSnapLabel(e.target.value)}
                  placeholder="Nombre de la versión…"
                  disabled={snapBusy}
                  onKeyDown={(e) => { if (e.key === "Enter" && newSnapLabel.trim()) handleCreateSnapshot(); }}
                  style={{
                    flex: 1, padding: "6px 10px", borderRadius: "var(--r-sm)",
                    border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
                    fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none",
                  }}
                />
                <button
                  className="btn btn-accent btn-sm"
                  disabled={!newSnapLabel.trim() || snapBusy}
                  onClick={handleCreateSnapshot}
                >
                  <IconPlus size={11} /> Guardar
                </button>
              </div>
            </div>

            {/* Lista de snapshots */}
            <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }} className="scroll">
              {snapshots.length === 0 ? (
                <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
                  No hay versiones guardadas.
                  <br />
                  <span style={{ fontSize: "var(--fs-xs)" }}>Usa el campo de arriba para crear una.</span>
                </div>
              ) : (
                snapshots.map((snap) => (
                  <div
                    key={snap.filename}
                    style={{
                      padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {snap.label}
                      </div>
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                        {snap.timestamp}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={snapBusy}
                      onClick={() => handleRestoreSnapshot(snap.filename)}
                      title="Restaurar esta versión"
                      style={{ fontSize: "var(--fs-xs)", flexShrink: 0 }}
                    >
                      <IconRefresh size={10} /> Restaurar
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      disabled={snapBusy}
                      onClick={() => handleDeleteSnapshot(snap.filename)}
                      title="Eliminar versión"
                      style={{ padding: 4, opacity: 0.55, flexShrink: 0 }}
                    >
                      <IconTrash size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Panel de opciones del documento ──────────────────────── */}
      {docOptionsOpen && (
        <DocumentOptionsPanel
          typography={activeProject.latex_config?.typography ?? {}}
          onSave={handleSaveTypography}
          onClose={() => setDocOptionsOpen(false)}
        />
      )}

      {/* ── Modal: cambios sin guardar al navegar ─────────────────── */}
      {blocker.state === "blocked" && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            width: 430, background: "var(--bg-chrome)", borderRadius: "var(--r-lg)",
            border: "1px solid var(--border-firm)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            padding: "28px 28px 22px",
          }}>
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 10 }}>
              Cambios sin guardar
            </div>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.6, margin: "0 0 22px" }}>
              Tienes cambios sin guardar en esta sección. ¿Qué deseas hacer antes de salir?
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                className="btn btn-ghost"
                onClick={() => blocker.reset?.()}
              >
                Seguir editando
              </button>
              <button
                className="btn"
                style={{ color: "var(--build-err)", borderColor: "var(--build-err)" }}
                onClick={() => blocker.proceed?.()}
              >
                Salir sin guardar
              </button>
              <button
                className="btn btn-accent"
                onClick={async () => {
                  if (activeSectionId) await doSave(localBlocks, activeSectionId);
                  blocker.proceed?.();
                }}
              >
                <IconCheck size={12} /> Guardar y salir
              </button>
            </div>
          </div>
        </div>
      )}

      <TxStatusbar items={[
        { text: saveLabel, dot: saveDot },
        { icon: <IconFile size={11} />, text: projectName },
        { text: t("editor.words", { n: bodyWordCount.toLocaleString() }) },
        {
          right: true,
          text: bibRefs.length > 0 ? `${bibRefs.length} refs en .bib` : "sin .bib",
          icon: <span style={{ cursor: "pointer" }} onClick={() => setCitPickerOpen(true)} />,
        },
        { right: true, text: `${activeProject.sections.filter((s) => s.enabled).length} secciones` },
      ]} />
    </>
  );
}
