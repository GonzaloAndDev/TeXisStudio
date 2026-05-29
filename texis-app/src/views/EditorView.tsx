import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import { EditorMetaPanel } from "../components/EditorMetaPanel";
import { SectionGuidancePanel } from "../components/SectionGuidancePanel";
import {
  IconAcronym, IconAlgorithm, IconBuild, IconCheck, IconChevronD, IconCode, IconDrag, IconFile,
  IconGlossaryEntry, IconHeading, IconImage, IconList, IconMore, IconPlus, IconRefresh,
  IconSearch, IconSettings, IconSigma, IconSliders, IconTable, IconText, IconTheorem, IconTrash, IconX,
} from "../components/Icons";
import { LanguagePicker } from "../components/LanguagePicker";
import { SpellPanel } from "../components/SpellPanel";
import { GrammarPanel } from "../components/GrammarPanel";
import { AiAssistantPanel } from "../components/AiAssistantPanel";
import { useAiStore } from "../stores/ai";
import type { GrammarMatch } from "../services/grammar";
import { useSettingsStore } from "../stores/settings";
import { api } from "../lib/tauri";
import { useProjectStore } from "../stores/project";
import type { BibReference, ContentBlock, HeadingLevel, LatexTypography, ProjectSection, SectionStatus } from "../types";
import { ParagraphEditor, HeadingEditor, KaTeXPreview, SectionStatusBar,
  EquationEditor, ListEditor, FigureEditor, TableEditor, CitationEditor,
  GlossaryEntryEditor, AcronymEntryEditor, CodeBlockEditor, AlgorithmBlockEditor,
  TheoremBlockEditor, THEOREM_KINDS, STATUS_CONFIG,
} from "./editor/BlockEditors";
import { CitationPickerModal } from "./editor/CitationPickerModal";

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
  userMode,
  onInsertBlock,
  onJumpSection,
  onClose,
}: {
  sections: ProjectSection[];
  userMode: "basic" | "advanced";
  onInsertBlock: (type: ContentBlock["type"]) => void;
  onJumpSection: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.toLowerCase();
  const allowedBlockTypes = userMode === "basic"
    ? new Set<ContentBlock["type"]>(["paragraph", "heading", "list", "citation", "figure", "table", "equation"])
    : null;

  const blockItems = PALETTE_BLOCK_ITEMS.filter(
    (b) => !q || b.label.toLowerCase().includes(q) || b.hint.toLowerCase().includes(q)
  ).filter((b) => !allowedBlockTypes || allowedBlockTypes.has(b.type));

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
            placeholder={userMode === "basic" ? "Agregar contenido o ir a una sección…" : "Insertar bloque o ir a sección…"}
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
                {userMode === "basic" ? "Agregar contenido" : "Insertar bloque"}
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
  const { userMode } = useSettingsStore();

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
  const aiPanel = useAiStore();

  // Selección de texto real para el panel de IA
  // Se actualiza cada vez que el usuario selecciona texto en el editor
  const [aiSelection, setAiSelection] = useState<{
    text: string;
    blockId: string;
    start: number;
    end: number;
  } | null>(null);
  const [lastAiUndoBlocks, setLastAiUndoBlocks] = useState<ContentBlock[] | null>(null);

  const captureSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setAiSelection(null);
      return;
    }
    const selectedText = sel.toString();
    // Buscar en qué bloque está la selección comparando con el contenido
    const block = localBlocks.find(
      (b) => b.type === "paragraph" && b.content.includes(selectedText)
    );
    if (block && block.type === "paragraph") {
      const start = block.content.indexOf(selectedText);
      setAiSelection({ text: selectedText, blockId: block.id, start, end: start + selectedText.length });
    } else {
      // Selección sin bloque exacto identificable (por ej. texto heading)
      setAiSelection({ text: selectedText, blockId: "", start: 0, end: selectedText.length });
    }
  }, [localBlocks]);

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
    // Actualizar contexto de UI para el asistente de IA
    useAiStore.getState().setUiContext({
      activePanel: "editor",
      activeSectionType: section?.element_id,
      profileId: activeProject?.profile_id,
    });
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
  const toolbarItems: [ContentBlock["type"], React.ReactNode, string][] = userMode === "basic"
    ? [
        ["paragraph", <IconText size={12} />, "Párrafo"],
        ["heading", <IconHeading size={12} />, "Título"],
        ["list", <IconList size={12} />, "Lista"],
        ["citation", <IconMore size={12} />, "Cita"],
        ["figure", <IconImage size={12} />, "Figura"],
        ["table", <IconTable size={12} />, "Tabla"],
        ["equation", <IconSigma size={12} />, "Ecuación"],
      ]
    : [
        ["paragraph", <IconText size={12} />, "Párrafo"],
        ["heading", <IconHeading size={12} />, "Título"],
        ["list", <IconList size={12} />, "Lista"],
        ["equation", <IconSigma size={12} />, "Ecuación"],
        ["figure", <IconImage size={12} />, "Figura"],
        ["table", <IconTable size={12} />, "Tabla"],
        ["raw_latex", <IconCode size={12} />, "LaTeX"],
        ["code", <IconCode size={12} />, "Código"],
        ["algorithm", <IconAlgorithm size={12} />, "Algoritmo"],
        ["theorem", <IconTheorem size={12} />, "Teorema"],
        ["glossary_entry", <IconGlossaryEntry size={12} />, "Glosario"],
        ["acronym_entry", <IconAcronym size={12} />, "Acrónimo"],
      ];

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
            {userMode === "advanced" && (
              <button
                className={`btn btn-ghost btn-icon${docOptionsOpen ? " btn-active" : ""}`}
                title="Opciones del documento"
                onClick={() => setDocOptionsOpen(true)}
              >
                <IconSettings size={14} />
              </button>
            )}
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
            {userMode === "basic" ? "Ruta del documento" : "Secciones"}
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
            {toolbarItems.map(([type, icon, label]) => (
              <button
                key={type}
                className="btn btn-ghost btn-sm"
                onClick={() => addBlock(type)}
                title={`${userMode === "basic" ? "Agregar" : "Insertar"} ${label}`}
                style={{ flexDirection: "column", gap: 1, padding: "5px 8px", height: "auto", fontSize: 9 }}
              >
                {icon}<span>{userMode === "basic" && type === "citation" ? "Agregar cita" : label}</span>
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
            <button
              className={`btn btn-sm ${aiPanel.isPanelOpen ? "btn-accent" : "btn-ghost"}`}
              onClick={() => aiPanel.togglePanel()}
              title="Asistente IA"
              style={{ fontSize: "var(--fs-xs)", padding: "4px 8px" }}
            >
              ✦ IA
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
            onMouseUp={captureSelection}
            onKeyUp={captureSelection}
          >
            {activeSection ? (
              <div style={{ width: 680, margin: "0 auto", background: "var(--bg-paper)", borderRadius: 4, boxShadow: "var(--shadow-paper)", border: "1px solid var(--bg-paper-edge)", padding: "56px 72px 80px", minHeight: 800 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", letterSpacing: "0.05em", marginBottom: 4 }}>
                  {userMode === "advanced" ? activeSection.element_id : "Sección activa"}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 500, color: "var(--fg-strong)", margin: "4px 0 16px", letterSpacing: "-0.015em", lineHeight: 1.15 }}>
                  {activeSection.title ?? activeSection.element_id}
                </div>

                {userMode === "basic" && (
                  <div style={{
                    marginBottom: 16, padding: "10px 12px",
                    borderRadius: "var(--r-md)", background: "var(--accent-tint)",
                    border: "1px solid var(--accent-soft)", fontSize: "var(--fs-sm)",
                    color: "var(--accent-deep)", lineHeight: 1.6,
                  }}>
                    Empieza escribiendo el contenido principal de esta sección. Si usas una fuente, agrega una cita. Si necesitas material visual, agrega una figura o una tabla.
                  </div>
                )}

                <SectionGuidancePanel
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
                    <p style={{ margin: 0 }}>{userMode === "basic" ? "Empieza a escribir aquí." : "Sección vacía."}</p>
                    <p style={{ fontSize: "var(--fs-sm)", marginTop: 8, color: "var(--fg-faint)" }}>
                      {userMode === "basic"
                        ? "Haz clic para agregar tu primer párrafo. Después podrás sumar citas, figuras o tablas."
                        : "Clic aquí para agregar un párrafo, o usa la barra de herramientas arriba."}
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
        <EditorMetaPanel
          project={activeProject}
          wordCount={bodyWordCount}
          blockCount={localBlocks.length}
          maxWords={profileMaxWords}
          activeSection={activeSection}
          userMode={userMode}
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

      {/* Panel de asistente IA */}
      {aiPanel.isPanelOpen && (
        <AiAssistantPanel
          currentSelection={aiSelection?.text}
          aiSelection={aiSelection}
          currentFileName={activeSection ? `${activeSection.element_id}.tex` : undefined}
          currentFileContent={localBlocks
            .filter((b) => b.type === "paragraph" || b.type === "heading")
            .map((b) => ("content" in b ? b.content : ""))
            .join("\n\n")}
          onApplyReplacement={(original, replacement) => {
            // Reemplazar SOLO usando la selección y posición exactas capturadas por el editor.
            // Si no hay selección ordinaria identificable, no aplicar nada.
            setLocalBlocks((prev) => {
              const sel = aiSelection;
              if (!sel?.blockId) {
                return prev;
              }

              const sourceBlock = prev.find((b) => b.id === sel.blockId && b.type === "paragraph");
              if (!sourceBlock || sourceBlock.type !== "paragraph") {
                return prev;
              }

              const selectedSlice = sourceBlock.content.slice(sel.start, sel.end);
              if (!selectedSlice || selectedSlice !== original) {
                return prev;
              }

              setLastAiUndoBlocks(prev);
              const next = prev.map((b) => {
                if (b.id !== sel.blockId || b.type !== "paragraph") return b;
                return {
                  ...b,
                  content:
                    b.content.slice(0, sel.start) +
                    replacement +
                    b.content.slice(sel.end),
                };
              });

              scheduleAutoSave(next);
              setAiSelection(null);
              return next;
            });
          }}
          onInsertAtCursor={(content) => {
            // Insertar después del bloque activo (editingId) o del último bloque de la sección
            const newBlock: ContentBlock = {
              type: "raw_latex",
              id: `ai-${Date.now()}`,
              content,
              user_confirmed: false,
            };
            setLocalBlocks((prev) => {
              setLastAiUndoBlocks(prev);
              const insertAfter = editingId ?? (prev.length > 0 ? prev[prev.length - 1].id : null);
              let next: ContentBlock[];
              if (insertAfter) {
                const idx = prev.findIndex((b) => b.id === insertAfter);
                if (idx !== -1) {
                  next = [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)];
                } else {
                  next = [...prev, newBlock];
                }
              } else {
                next = [...prev, newBlock];
              }
              scheduleAutoSave(next);
              return next;
            });
          }}
          onUndoLastChange={() => {
            if (!lastAiUndoBlocks) return;
            setLocalBlocks(lastAiUndoBlocks);
            scheduleAutoSave(lastAiUndoBlocks);
            setLastAiUndoBlocks(null);
            setAiSelection(null);
          }}
        />
      )}

      {/* Paleta de comandos (Ctrl+K) */}
      {paletteOpen && (
        <CommandPalette
          sections={activeProject.sections}
          userMode={userMode}
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
