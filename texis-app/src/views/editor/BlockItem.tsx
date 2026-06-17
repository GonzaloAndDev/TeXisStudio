import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc } from "@tauri-apps/api/core";
import { IconDrag, IconTrash } from "../../components/Icons";
import { HelpLink } from "../../components/help/HelpLink";
import { PdfPagePreview } from "../../components/PdfPagePreview";
import type { ContentBlock, HeadingLevel, PluginFigureBlock } from "../../types";
import {
  ParagraphEditor, HeadingEditor, KaTeXPreview, EquationEditor, ListEditor,
  FigureEditor, TableEditor, CitationEditor, GlossaryEntryEditor,
  AcronymEntryEditor, CodeBlockEditor, AlgorithmBlockEditor, TheoremBlockEditor,
  THEOREM_KINDS,
} from "./BlockEditors";
import { VisualBlockEditor } from "./VisualBlockEditor";

// ── Plugin figure inline preview ──────────────────────────────────

function PluginFigurePdfPreview({
  block, projectPath, onEdit,
}: {
  block: PluginFigureBlock;
  projectPath: string;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPdfUrl(null);

    const path = `${projectPath}/texisstudio-assets/figures/${block.figureId}/preview.pdf`;
    const url = convertFileSrc(path);

    // Poll briefly so a just-triggered background compile can finish.
    let attempt = 0;
    const check = () => {
      if (cancelled) return;
      fetch(url, { method: "HEAD", cache: "no-store" })
        .then((r) => {
          if (!cancelled && r.ok) {
            setPdfUrl(url + `?t=${Date.now()}`);
            return true;
          }
          return false;
        })
        .catch(() => {})
        .then((found) => {
          if (!cancelled && !found && attempt < 10) {
            attempt++;
            setTimeout(check, 800);
          }
        });
    };
    check();

    return () => { cancelled = true; };
  }, [projectPath, block.figureId, block.sourceJson]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Render the first PDF page ourselves so WebKit never creates native PDF chrome. */}
      {pdfUrl ? (
        <div style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", overflow: "hidden", background: "#fff" }}>
          <PdfPagePreview
            src={pdfUrl}
            title={block.caption}
            maxHeight={240}
            errorLabel={t("compile_widgets.pdf_viewer_error")}
          />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "4px 0" }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: "var(--accent-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
            📊
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 2 }}>
              {block.caption || block.pluginId}
            </div>
            <div style={{ fontSize: 10, color: "var(--fg-faint)", fontStyle: "italic" }}>
              {t("block_item.preview_pending")}
            </div>
          </div>
        </div>
      )}
      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {pdfUrl && (
            <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 1 }}>
              {block.caption || block.pluginId}
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
            {block.label} · <span style={{ color: "var(--fg-faint)" }}>{block.figureId}</span>
          </div>
          {block.requiredPackages.length > 0 && (
            <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>
              {t("block_item.packages")}: {block.requiredPackages.join(", ")}
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
          title={t("block_item.edit_figure_title")}
          style={{ fontSize: 10, padding: "3px 8px", flexShrink: 0 }}
        >
          {t("block_item.edit_figure")}
        </button>
      </div>
      {block.warnings.length > 0 && (
        <div style={{ fontSize: 10, color: "var(--build-warn)" }}>⚠ {block.warnings[0]}</div>
      )}
    </div>
  );
}

// ── Raw-LaTeX syntax heuristics ───────────────────────────────────

type LatexErrorKey =
  | { key: "latex_err_open_brace"; n: number }
  | { key: "latex_err_close_brace" }
  | { key: "latex_err_math" }
  | { key: "latex_err_begin"; env: string }
  | { key: "latex_err_end"; env: string };

function validateRawLatex(content: string): LatexErrorKey[] {
  const errs: LatexErrorKey[] = [];
  if (!content.trim()) return errs;

  let depth = 0;
  let extraClose = false;
  for (const ch of content) {
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth < 0) { extraClose = true; break; } }
  }
  if (extraClose) errs.push({ key: "latex_err_close_brace" });
  else if (depth > 0) errs.push({ key: "latex_err_open_brace", n: depth });

  const dollars = (content.match(/(?<!\\)\$/g) ?? []).length;
  if (dollars % 2 !== 0) errs.push({ key: "latex_err_math" });

  const begins = [...content.matchAll(/\\begin\{([^}]+)\}/g)].map((m) => m[1]);
  const ends   = [...content.matchAll(/\\end\{([^}]+)\}/g)].map((m) => m[1]);
  const remaining = [...ends];
  for (const env of begins) {
    const idx = remaining.indexOf(env);
    if (idx === -1) errs.push({ key: "latex_err_begin", env });
    else remaining.splice(idx, 1);
  }
  for (const env of remaining) errs.push({ key: "latex_err_end", env });

  return errs;
}

// ── BlockItem: combina preview + edición ──────────────────────────

export function BlockItem({
  block, isEditing, onStartEdit, onUpdate, onDelete,
  dragging, dragOver, highlighted,
  availableCiteKeys, availableLabels, availableAssets,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop,
  onEditPluginFigure, projectPath,
}: {
  block: ContentBlock;
  isEditing: boolean;
  onStartEdit: () => void;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDelete: () => void;
  dragging?: boolean;
  dragOver?: boolean;
  /** Se activa brevemente al saltar a este bloque desde la búsqueda. */
  highlighted?: boolean;
  availableCiteKeys?: string[];
  availableLabels?: Array<{ key: string; kind: string; caption: string }>;
  availableAssets?: Array<{ name: string; path: string }>;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  /** Abre el modal de edición para un PluginFigureBlock. */
  onEditPluginFigure?: () => void;
  /** Ruta raíz del proyecto activo — usada para cargar preview.pdf inline. */
  projectPath?: string;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const rawLatexRef = useRef<HTMLTextAreaElement>(null);

  const renderEdit = () => {
    switch (block.type) {
      case "paragraph":
        return (
          <ParagraphEditor
            content={block.content}
            onChange={(content) => onUpdate({ content } as Partial<ContentBlock>)}
            onBlur={() => {}}
            availableLabels={availableLabels}
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
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
              <HelpLink topic="latex" />
            </div>
            <EquationEditor
              latex_content={block.latex_content}
              numbered={block.numbered}
              label={block.label}
              onChange={(latex_content) => onUpdate({ latex_content } as Partial<ContentBlock>)}
              onNumberedChange={(numbered) => onUpdate({ numbered } as Partial<ContentBlock>)}
              onLabelChange={(label) => onUpdate({ label } as Partial<ContentBlock>)}
              onBlur={() => {}}
            />
          </div>
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
            availableAssets={availableAssets}
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
      case "raw_latex": {
        const latexErrs = validateRawLatex(block.content ?? "");
        const confirmed = !!block.user_confirmed;
        // Colores según estado: ámbar = incluido, rojo = bloqueado del PDF
        const accentColor = confirmed ? "#C8922A" : "var(--build-err)";
        const accentBg    = confirmed ? "rgba(200,146,42,0.07)" : "rgba(220,50,50,0.06)";
        const accentBorder = confirmed ? "rgba(200,146,42,0.35)" : "rgba(220,50,50,0.4)";
        return (
          <div style={{
            borderLeft: `3px solid ${accentColor}`,
            borderRadius: "0 var(--r-sm) var(--r-sm) 0",
            background: accentBg,
            overflow: "hidden",
          }}>
            {/* Banner de contexto — siempre visible */}
            <div style={{
              padding: "8px 12px",
              borderBottom: `1px solid ${accentBorder}`,
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13 }}>{confirmed ? "⚙" : "⚠"}</span>
                <span style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: accentColor, letterSpacing: "0.01em" }}>
                  {confirmed ? t("block_item.raw_native_title") : t("block_item.raw_unconfirmed_title")}
                </span>
                <HelpLink topic="latex" style={{ marginLeft: "auto", opacity: 0.6 }} />
              </div>
              <p style={{ margin: 0, fontSize: "10px", lineHeight: 1.5, color: "var(--fg-muted)", paddingLeft: 19 }}>
                {confirmed ? t("block_item.raw_native_desc") : t("block_item.raw_unconfirmed_desc")}
              </p>
            </div>

            {/* Editor de código */}
            <div style={{ position: "relative" }}>
              <textarea
                ref={rawLatexRef}
                autoFocus
                value={block.content}
                onChange={(e) => onUpdate({ content: e.target.value } as Partial<ContentBlock>)}
                rows={Math.max(3, (block.content ?? "").split("\n").length)}
                spellCheck={false}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: "#C8C2B5",
                  background: "var(--ink-900)",
                  border: "none",
                  borderBottom: latexErrs.length > 0 ? `2px solid var(--build-err)` : "none",
                  outline: "none",
                  padding: "10px 14px",
                  resize: "vertical",
                  width: "100%",
                  boxSizing: "border-box",
                  display: "block",
                  tabSize: 2,
                }}
              />
              {/* Errores de validación inline */}
              {latexErrs.length > 0 && (
                <div style={{ background: "rgba(220,50,50,0.08)", padding: "6px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
                  {latexErrs.map((e, i) => (
                    <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--build-err)", display: "flex", alignItems: "center", gap: 4 }}>
                      ✕ {e.key === "latex_err_open_brace" ? t("block_item.latex_err_open_brace", { n: e.n })
                        : e.key === "latex_err_close_brace" ? t("block_item.latex_err_close_brace")
                        : e.key === "latex_err_math" ? t("block_item.latex_err_math")
                        : e.key === "latex_err_begin" ? t("block_item.latex_err_begin", { env: e.env })
                        : t("block_item.latex_err_end", { env: e.env })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer: confirmación (solo si no confirmado) */}
            {!confirmed && (
              <div style={{ padding: "8px 12px", borderTop: `1px solid ${accentBorder}`, display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={(e) => onUpdate({ user_confirmed: e.target.checked } as Partial<ContentBlock>)}
                    style={{ accentColor: "var(--build-ok)", cursor: "pointer" }}
                  />
                  {t("block_item.confirm_manual_latex")}
                </label>
              </div>
            )}
          </div>
        );
      }
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
      case "visual":
        return (
          <VisualBlockEditor
            block={block}
            onChange={(updates) => onUpdate({ ...block, ...updates } as Partial<ContentBlock>)}
          />
        );
      case "plugin_figure":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
                {t("figure_edit.plugin_figure_hint", { pluginId: block.pluginId })}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={(e) => { e.stopPropagation(); onEditPluginFigure?.(); }}
                title={t("block_item.edit_figure_title")}
                style={{ fontSize: 10, padding: "3px 8px", flexShrink: 0 }}
              >
                {t("block_item.edit_figure")}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", display: "block", marginBottom: 3 }}>{t("editor.meta_title")}</label>
                <input
                  value={block.caption}
                  onChange={(e) => onUpdate({ caption: e.target.value } as Partial<ContentBlock>)}
                  style={{ width: "100%", padding: "5px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-app)", color: "var(--fg-default)", fontSize: "var(--fs-sm)", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", display: "block", marginBottom: 3 }}>{t("visual.label_ref")}</label>
                <input
                  value={block.label}
                  onChange={(e) => onUpdate({ label: e.target.value } as Partial<ContentBlock>)}
                  style={{ width: "100%", padding: "5px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-app)", color: "var(--fg-default)", fontSize: "var(--fs-sm)", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
                />
              </div>
            </div>
            {block.warnings.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--build-warn)", padding: "6px 10px", background: "var(--build-warn-tint, #ffcc0015)", borderRadius: "var(--r-xs)" }}>
                {block.warnings[0]}
              </div>
            )}
          </div>
        );
      default:
        return <div style={{ color: "var(--fg-faint)" }}>{t("block_item.not_editable")}</div>;
    }
  };

  const renderPreview = () => {
    switch (block.type) {
      case "paragraph":
        return (
          <p style={{ fontFamily: "var(--font-display)", fontSize: 15, color: block.content ? "var(--fg-default)" : "var(--fg-faint)", lineHeight: 1.65, margin: 0 }}>
            {block.content || t("block_item.empty_paragraph")}
          </p>
        );
      case "heading": {
        const fsMap: Record<HeadingLevel, number> = { section: 22, subsection: 18, subsubsection: 16 };
        return (
          <div style={{ fontFamily: "var(--font-display)", fontSize: fsMap[block.level], fontWeight: 500, color: block.content ? "var(--fg-strong)" : "var(--fg-faint)", lineHeight: 1.2 }}>
            {block.content || t("block_item.empty_heading")}
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
            {t("block_item.empty_equation")}
          </div>
        );
      case "list":
        return block.items.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {block.items.map((item, i) => (
              <li key={i} style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.65 }}>{item || t("block_item.empty_item")}</li>
            ))}
          </ul>
        ) : <div style={{ color: "var(--fg-faint)" }}>{t("block_item.empty_list")}</div>;
      case "figure":
        return (
          <div style={{ padding: "12px 16px", background: "var(--bg-app)", borderRadius: "var(--r-sm)", border: "1px dashed var(--border-firm)", textAlign: "center" }}>
            <div style={{ color: "var(--fg-faint)", fontSize: 13 }}>📷 {block.file || t("block_item.no_file")}</div>
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
        ) : <div style={{ color: "var(--fg-faint)" }}>{t("block_item.empty_table")}</div>;
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
      case "raw_latex": {
        const confirmed = !!block.user_confirmed;
        const accentColor = confirmed ? "#C8922A" : "var(--build-err)";
        const accentBg    = confirmed ? "rgba(200,146,42,0.07)" : "rgba(220,50,50,0.06)";
        const accentBorder = confirmed ? "rgba(200,146,42,0.35)" : "rgba(220,50,50,0.4)";
        return (
          <div style={{
            borderLeft: `3px solid ${accentColor}`,
            borderRadius: "0 var(--r-sm) var(--r-sm) 0",
            background: accentBg,
            overflow: "hidden",
          }}>
            {/* Banner compacto — siempre visible en preview */}
            <div style={{
              padding: "5px 10px",
              borderBottom: `1px solid ${accentBorder}`,
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              flexWrap: "wrap",
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: accentColor, whiteSpace: "nowrap" }}>
                {confirmed ? `⚙ ${t("block_item.raw_native_title")}` : `⚠ ${t("block_item.raw_unconfirmed_title")}`}
              </span>
              <span style={{ fontSize: "10px", color: "var(--fg-faint)", lineHeight: 1.4 }}>
                {confirmed ? t("block_item.raw_native_desc_short") : t("block_item.raw_unconfirmed_desc_short")}
              </span>
            </div>
            {/* Código */}
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.6,
              color: "#C8C2B5",
              padding: "8px 14px",
              background: "var(--ink-900)",
              whiteSpace: "pre-wrap",
              overflowX: "auto",
              maxHeight: 200,
              overflowY: "auto",
            }}>
              {block.content || <span style={{ opacity: 0.4 }}>{t("block_item.empty_latex")}</span>}
            </div>
          </div>
        );
      }
      // ── Posgrado previews ─────────────────────────────────────────
      case "glossary_entry":
        return (
          <div style={{ display: "flex", gap: 8, fontFamily: "var(--font-display)", fontSize: 14, lineHeight: 1.55 }}>
            <span style={{ fontWeight: 700, color: "var(--fg-strong)", whiteSpace: "nowrap", minWidth: 120 }}>
              {block.term || <em style={{ fontStyle: "normal", opacity: 0.4 }}>{t("block_item.term_placeholder")}</em>}
            </span>
            <span style={{ color: "var(--fg-default)" }}>
              {block.definition || <em style={{ opacity: 0.4 }}>{t("block_item.definition_placeholder")}</em>}
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
              {block.full_form || <em style={{ opacity: 0.4 }}>{t("block_item.full_form_placeholder")}</em>}
              {block.description ? <span style={{ color: "var(--fg-muted)" }}>. {block.description}</span> : null}
            </span>
          </div>
        );
      case "code":
        return (
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", top: 6, right: 8, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", background: "var(--ink-800)", padding: "1px 6px", borderRadius: "var(--r-xs)" }}>
              {block.language || t("block_item.code_language")}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5", padding: "10px 14px", background: "var(--ink-900)", borderRadius: "var(--r-sm)", overflowX: "auto", whiteSpace: "pre" }}>
              {block.content || t("block_item.empty_content")}
            </div>
            {block.caption && <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 4, textAlign: "center", fontStyle: "italic" }}>{block.caption}</div>}
          </div>
        );
      case "algorithm":
        return (
          <div style={{ border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", overflow: "hidden", fontSize: "var(--fs-sm)", fontFamily: "var(--font-display)" }}>
            <div style={{ background: "var(--bg-panel)", padding: "6px 12px", borderBottom: "1px solid var(--border-subtle)", fontWeight: 600, color: "var(--fg-strong)", fontSize: 13 }}>
              {t("block_item.algorithm")}: {block.caption || <em style={{ opacity: 0.5, fontWeight: 400 }}>{t("block_item.unnamed")}</em>}
            </div>
            {(block.input || block.output) && (
              <div style={{ padding: "6px 12px", borderBottom: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--fg-muted)" }}>
                {block.input && <div><strong>{t("block_item.input")}:</strong> {block.input}</div>}
                {block.output && <div><strong>{t("block_item.output")}:</strong> {block.output}</div>}
              </div>
            )}
            <div style={{ padding: "8px 12px", background: "var(--bg-app)", fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5", whiteSpace: "pre-wrap" }}>
              {block.body || <span style={{ opacity: 0.4 }}>{t("block_item.empty_pseudocode")}</span>}
            </div>
          </div>
        );
      case "theorem": {
        const tk = THEOREM_KINDS.find((t) => t.kind === block.kind);
        const envLabel = tk?.labelKey ? t(tk.labelKey) : block.kind;
        const envColor: Record<string, string> = {
          theorem: "#4A90E2", lemma: "#7B68EE", corollary: "#6A9FB5",
          proposition: "#5F9EA0", definition: "#52C41A", proof: "#888", remark: "#888",
        };
        const color = envColor[block.kind] ?? "var(--accent)";
        return (
          <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 12, paddingRight: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 4, fontFamily: "var(--font-display)" }}>
              {envLabel}{block.title ? ` (${block.title})` : ""}{block.numbered && block.kind !== "proof" && block.kind !== "remark" ? ` [${t("block_item.numbered")}]` : ""}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.6, color: "var(--fg-default)", fontStyle: "italic" }}>
              {block.content || <span style={{ opacity: 0.4, fontStyle: "normal" }}>{t("block_item.empty_block_content")}</span>}
            </div>
          </div>
        );
      }
      case "visual": {
        const vk = block.config.kind;
        const kindLabels: Record<string, string> = {
          venn_euler: t("block_item.visual_venn"), flow_diagram: t("block_item.visual_flow"),
          timeline: t("block_item.visual_timeline"), chem_reaction: t("block_item.visual_reaction"),
          molecule: t("block_item.visual_molecule"), circuit: t("block_item.visual_circuit"),
          feynman: t("block_item.visual_feynman"), bio_pathway: t("block_item.visual_bio_pathway"),
          music_fragment: t("block_item.visual_music"),
        };
        const kindIcons: Record<string, string> = {
          venn_euler:"⬤⬤", flow_diagram:"→", timeline:"──", chem_reaction:"⇌",
          molecule:"⬡", circuit:"⚡", feynman:"∿", bio_pathway:"⟳", music_fragment:"♩",
        };
        return (
          <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 0" }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>{kindIcons[vk] ?? "📊"}</span>
            <div>
              <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>
                {kindLabels[vk] ?? vk}
              </div>
              {block.caption && (
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
                  {block.caption}
                </div>
              )}
              <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                {t("block_item.visual_compile_hint")}
              </div>
            </div>
          </div>
        );
      }
      case "plugin_figure":
        return projectPath ? (
          <PluginFigurePdfPreview block={block} projectPath={projectPath} onEdit={onEditPluginFigure} />
        ) : (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0" }}>
            <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: "var(--accent-tint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
              📊
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 2 }}>
                {block.caption || block.pluginId}
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)", marginBottom: 3 }}>
                {block.label} · <span style={{ color: "var(--fg-faint)" }}>{block.figureId}</span>
              </div>
              {block.requiredPackages.length > 0 && (
                <div style={{ fontSize: 10, color: "var(--fg-faint)", marginBottom: 3 }}>
                  {t("block_item.packages")}: {block.requiredPackages.join(", ")}
                </div>
              )}
              {block.warnings.length > 0 && (
                <div style={{ fontSize: 10, color: "var(--build-warn)" }}>⚠ {block.warnings[0]}</div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); onEditPluginFigure?.(); }}
              title={t("block_item.edit_figure_title")}
              style={{ fontSize: 10, padding: "3px 8px", flexShrink: 0 }}
            >
              {t("block_item.edit_figure")}
            </button>
          </div>
        );
      default:
        return <div style={{ color: "var(--fg-faint)" }}>{t("block_item.unknown_block")}</div>;
    }
  };

  return (
    <div
      draggable
      data-block-id={block.id}
      style={{
        position: "relative", margin: "4px -32px", padding: "6px 32px 6px 44px",
        borderRadius: 6,
        background: highlighted
          ? "color-mix(in srgb, var(--accent) 12%, transparent)"
          : isEditing
          ? "var(--accent-tint)"
          : hovered
          ? "var(--bg-hover)"
          : "transparent",
        border: dragOver
          ? "1px solid var(--accent)"
          : highlighted
          ? "1px solid var(--accent-soft)"
          : isEditing
          ? "1px solid var(--accent-soft)"
          : "1px solid transparent",
        opacity: dragging ? 0.35 : 1,
        boxShadow: dragOver ? "0 -2px 0 var(--accent)" : highlighted ? "0 0 0 2px var(--accent-soft)" : "none",
        cursor: isEditing ? "default" : "text",
        transition: "background 0.3s, border 0.3s, box-shadow 0.3s, opacity 0.12s",
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
          title={t("block_item.delete_block")}
        >
          <IconTrash size={11} />
        </button>
      )}
    </div>
  );
}
