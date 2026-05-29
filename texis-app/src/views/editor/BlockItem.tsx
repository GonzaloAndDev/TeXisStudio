import React, { useState } from "react";
import { IconDrag, IconTrash } from "../../components/Icons";
import type { ContentBlock, HeadingLevel } from "../../types";
import {
  ParagraphEditor, HeadingEditor, KaTeXPreview, EquationEditor, ListEditor,
  FigureEditor, TableEditor, CitationEditor, GlossaryEntryEditor,
  AcronymEntryEditor, CodeBlockEditor, AlgorithmBlockEditor, TheoremBlockEditor,
  THEOREM_KINDS,
} from "./BlockEditors";

// ── BlockItem: combina preview + edición ──────────────────────────

export function BlockItem({
  block, isEditing, onStartEdit, onUpdate, onDelete,
  dragging, dragOver, availableCiteKeys,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
}: {
  block: ContentBlock;
  isEditing: boolean;
  onStartEdit: () => void;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDelete: () => void;
  dragging?: boolean;
  dragOver?: boolean;
  availableCiteKeys?: string[];
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
            availableCiteKeys={availableCiteKeys}
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

