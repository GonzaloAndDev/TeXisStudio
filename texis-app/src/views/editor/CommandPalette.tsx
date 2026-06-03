import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconSearch } from "../../components/Icons";
import type { ContentBlock, ProjectSection } from "../../types";

// ── CommandPalette (Ctrl+K) ───────────────────────────────────────

export const PALETTE_BLOCK_ITEMS = [
  { type: "paragraph"     as ContentBlock["type"],  labelKey: "editor.block_paragraph",      icon: "¶",  hintKey: "command_palette.hint_free_text" },
  { type: "heading"       as ContentBlock["type"],  labelKey: "editor.block_heading",       icon: "H",  hintKey: "command_palette.hint_heading_levels" },
  { type: "list"          as ContentBlock["type"],  labelKey: "editor.block_list",        icon: "•",  hintKey: "command_palette.hint_list" },
  { type: "equation"      as ContentBlock["type"],  labelKey: "editor.block_equation",     icon: "∑",  hintKey: "command_palette.hint_latex_math" },
  { type: "figure"        as ContentBlock["type"],  labelKey: "editor.block_figure",       icon: "🖼",  hintKey: "command_palette.hint_image_caption" },
  { type: "table"         as ContentBlock["type"],  labelKey: "editor.block_table",        icon: "⊞",  hintKey: "command_palette.hint_editable_table" },
  { type: "citation"      as ContentBlock["type"],  labelKey: "editor.block_citation",         icon: "❞",  hintKey: "command_palette.hint_bibliographic_ref" },
  { type: "raw_latex"     as ContentBlock["type"],  labelKey: "editor.block_rawlatex",icon: "{}",  hintKey: "command_palette.hint_latex_fragment" },
  // Posgrado
  { type: "code"          as ContentBlock["type"],  labelKey: "editor.block_code",       icon: "<>", hintKey: "command_palette.hint_source_code" },
  { type: "algorithm"     as ContentBlock["type"],  labelKey: "editor.block_algorithm",    icon: "∷",  hintKey: "command_palette.hint_numbered_pseudocode" },
  { type: "theorem"       as ContentBlock["type"],  labelKey: "editor.block_theorem",      icon: "∀",  hintKey: "command_palette.hint_theorem" },
  { type: "glossary_entry"as ContentBlock["type"],  labelKey: "editor.block_glossary",     icon: "Gl", hintKey: "command_palette.hint_glossary_entry" },
  { type: "acronym_entry" as ContentBlock["type"],  labelKey: "editor.block_acronym",     icon: "Ab", hintKey: "command_palette.hint_acronym_list" },
  // ── Visuales ──
  { type: "visual"        as ContentBlock["type"],  labelKey: "command_palette.visual_venn",   icon: "⬤⬤", hintKey: "command_palette.hint_set_diagram" },
  { type: "visual"        as ContentBlock["type"],  labelKey: "command_palette.visual_flow",        icon: "→",  hintKey: "command_palette.hint_process_diagram" },
  { type: "visual"        as ContentBlock["type"],  labelKey: "command_palette.visual_timeline",     icon: "──", hintKey: "command_palette.hint_timeline" },
  { type: "visual"        as ContentBlock["type"],  labelKey: "command_palette.visual_reaction",     icon: "⇌",  hintKey: "command_palette.hint_chemical_reaction" },
  { type: "visual"        as ContentBlock["type"],  labelKey: "command_palette.visual_molecule",     icon: "⬡",  hintKey: "command_palette.hint_molecule" },
  { type: "visual"        as ContentBlock["type"],  labelKey: "command_palette.visual_circuit",     icon: "⚡", hintKey: "command_palette.hint_circuit" },
  { type: "visual"        as ContentBlock["type"],  labelKey: "command_palette.visual_feynman",      icon: "∿",  hintKey: "command_palette.hint_feynman" },
  { type: "visual"        as ContentBlock["type"],  labelKey: "command_palette.visual_bio_pathway",icon: "⟳",  hintKey: "command_palette.hint_bio_pathway" },
  { type: "visual"        as ContentBlock["type"],  labelKey: "command_palette.visual_score",    icon: "♩",  hintKey: "command_palette.hint_music_fragment" },
];

// ── Utilidades de búsqueda de contenido ──────────────────────────

function blockSearchText(block: ContentBlock): string {
  switch (block.type) {
    case "paragraph":      return block.content ?? "";
    case "heading":        return block.content ?? "";
    case "figure":         return [block.caption, block.file].filter(Boolean).join(" ");
    case "table":          return [block.caption, ...(block.headers ?? []), ...(block.rows ?? []).flat()].join(" ");
    case "citation":       return block.citation_key ?? "";
    case "equation":       return block.latex_content ?? "";
    case "raw_latex":      return block.content ?? "";
    case "glossary_entry": return [block.term, block.definition].filter(Boolean).join(" ");
    case "acronym_entry":  return [block.acronym, block.full_form].filter(Boolean).join(" ");
    case "code":           return [block.caption, block.content].filter(Boolean).join(" ");
    case "algorithm":      return [block.caption, block.body].filter(Boolean).join(" ");
    case "theorem":        return [block.title, block.content].filter(Boolean).join(" ");
    case "list":           return (block.items ?? []).join(" ");
    default:               return "";
  }
}

function blockIcon(type: ContentBlock["type"]): string {
  return PALETTE_BLOCK_ITEMS.find(b => b.type === type)?.icon ?? "¶";
}

interface Excerpt { pre: string; match: string; post: string }

function makeExcerpt(text: string, matchIdx: number, matchLen: number): Excerpt {
  const radius = 45;
  const start = Math.max(0, matchIdx - radius);
  const end   = Math.min(text.length, matchIdx + matchLen + radius);
  return {
    pre:   (start > 0 ? "…" : "") + text.slice(start, matchIdx),
    match: text.slice(matchIdx, matchIdx + matchLen),
    post:  text.slice(matchIdx + matchLen, end) + (end < text.length ? "…" : ""),
  };
}

interface ContentMatch {
  kind: "content";
  sectionId: string;
  sectionTitle: string;
  blockId: string;
  blockType: ContentBlock["type"];
  icon: string;
  excerpt: Excerpt;
}

function searchBlockContent(sections: ProjectSection[], q: string): ContentMatch[] {
  if (q.length < 2) return [];
  const results: ContentMatch[] = [];
  for (const section of sections) {
    if (!section.enabled) continue;
    for (const block of section.blocks ?? []) {
      const text = blockSearchText(block);
      const idx = text.toLowerCase().indexOf(q);
      if (idx === -1) continue;
      results.push({
        kind: "content",
        sectionId: section.id,
        sectionTitle: section.title ?? section.id,
        blockId: block.id,
        blockType: block.type,
        icon: blockIcon(block.type),
        excerpt: makeExcerpt(text, idx, q.length),
      });
      if (results.length >= 12) return results; // evitar resultados excesivos
    }
  }
  return results;
}

// ── Componente ────────────────────────────────────────────────────

export function CommandPalette({
  sections,
  userMode,
  onInsertBlock,
  onJumpSection,
  onJumpToBlock,
  onClose,
}: {
  sections: ProjectSection[];
  userMode: "basic" | "advanced";
  onInsertBlock: (type: ContentBlock["type"]) => void;
  onJumpSection: (id: string) => void;
  onJumpToBlock: (sectionId: string, blockId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.toLowerCase().trim();
  const allowedBlockTypes = userMode === "basic"
    ? new Set<ContentBlock["type"]>(["paragraph", "heading", "list", "citation", "figure", "table", "equation"])
    : null;

  // Bloques (insertar) — se muestran solo si no hay query o la query coincide
  const blockItems = PALETTE_BLOCK_ITEMS.filter(
    (b) => !q || t(b.labelKey).toLowerCase().includes(q) || t(b.hintKey).toLowerCase().includes(q)
  ).filter((b) => !allowedBlockTypes || allowedBlockTypes.has(b.type));

  // Secciones (saltar a) — coincidencia por título
  const sectionItems = sections
    .filter((s) => s.enabled && (!q || (s.title ?? s.id).toLowerCase().includes(q)))
    .map((s) => ({ id: s.id, label: s.title ?? s.id, placement: s.placement }));

  // Contenido (búsqueda dentro de bloques) — solo cuando hay query >= 2 chars
  const contentMatches: ContentMatch[] = q.length >= 2 ? searchBlockContent(sections, q) : [];

  // Lista unificada para navegación por teclado
  type AnyItem =
    | { kind: "block"; type: ContentBlock["type"]; labelKey: string; icon: string; hintKey: string }
    | { kind: "section"; id: string; label: string; placement: string }
    | ContentMatch;

  const allItems: AnyItem[] = [
    // Cuando hay búsqueda de contenido, no mostramos los tipos de bloque
    ...(contentMatches.length > 0 || q.length >= 2 ? [] : blockItems.map(b => ({ kind: "block" as const, ...b }))),
    ...sectionItems.map(s => ({ kind: "section" as const, ...s })),
    ...contentMatches,
  ];

  const total = allItems.length;

  function confirm(idx: number) {
    const item = allItems[idx];
    if (!item) return;
    if (item.kind === "block")    { onInsertBlock(item.type); }
    else if (item.kind === "section") { onJumpSection(item.id); }
    else if (item.kind === "content") { onJumpToBlock(item.sectionId, item.blockId); }
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
          width: 560, background: "var(--bg-chrome)", borderRadius: "var(--r-lg)",
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
            placeholder={t("command_palette.placeholder")}
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
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", flexShrink: 0 }}>{t("command_palette.esc_closes")}</span>
        </div>

        {/* Resultados */}
        <div style={{ maxHeight: 380, overflow: "auto" }} className="scroll">

          {/* Insertar bloque (solo cuando no hay búsqueda o la query coincide con un tipo) */}
          {allItems.some(i => i.kind === "block") && (
            <>
              <SectionHeader label={userMode === "basic" ? t("command_palette.add_content") : t("command_palette.insert_block")} hasBorder={false} />
              {allItems.filter(i => i.kind === "block").map((item) => {
                const b = item as { kind: "block"; type: ContentBlock["type"]; icon: string; labelKey: string; hintKey: string };
                const globalIdx = allItems.indexOf(item);
                return (
                  <PaletteRow
                    key={b.type}
                    icon={b.icon}
                    label={t(b.labelKey)}
                    hint={t(b.hintKey)}
                    selected={cursor === globalIdx}
                    onHover={() => setCursor(globalIdx)}
                    onClick={() => confirm(globalIdx)}
                  />
                );
              })}
            </>
          )}

          {/* Ir a sección */}
          {sectionItems.length > 0 && (
            <>
              <SectionHeader label={t("command_palette.go_to_section")} hasBorder={allItems.some(i => i.kind === "block")} />
              {allItems.filter(i => i.kind === "section").map((item) => {
                const s = item as { kind: "section"; id: string; label: string; placement: string };
                const globalIdx = allItems.indexOf(item);
                const placementLabel = {
                  front_matter: t("command_palette.placement_front"),
                  body: t("command_palette.placement_body"),
                  back_matter: t("command_palette.placement_back"),
                  appendix: t("command_palette.placement_appendix"),
                }[s.placement] ?? s.placement;
                return (
                  <PaletteRow
                    key={s.id}
                    icon="§"
                    label={s.label}
                    hint={placementLabel}
                    selected={cursor === globalIdx}
                    onHover={() => setCursor(globalIdx)}
                    onClick={() => confirm(globalIdx)}
                  />
                );
              })}
            </>
          )}

          {/* Resultados de contenido */}
          {contentMatches.length > 0 && (
            <>
              <SectionHeader
                label={new Set(contentMatches.map(m => m.sectionId)).size === 1 ? t("command_palette.found_in_one", { section: contentMatches[0].sectionTitle }) : t("command_palette.found_in_many", { count: new Set(contentMatches.map(m => m.sectionId)).size })}
                hasBorder={sectionItems.length > 0 || allItems.some(i => i.kind === "block")}
              />
              {contentMatches.map((match) => {
                const globalIdx = allItems.indexOf(match);
                return (
                  <div
                    key={`${match.sectionId}-${match.blockId}`}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "8px 16px", cursor: "pointer",
                      background: cursor === globalIdx ? "var(--bg-selected)" : "transparent",
                    }}
                    onMouseEnter={() => setCursor(globalIdx)}
                    onClick={() => confirm(globalIdx)}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: "var(--r-sm)", flexShrink: 0, marginTop: 2,
                      background: cursor === globalIdx ? "var(--accent)" : "var(--ink-100)",
                      color: cursor === globalIdx ? "white" : "var(--fg-muted)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 600,
                    }}>
                      {match.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 2 }}>
                        {match.sectionTitle}
                      </div>
                      <div style={{
                        fontSize: "var(--fs-sm)", color: "var(--fg-default)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        lineHeight: 1.4,
                      }}>
                        {match.excerpt.pre}
                        <mark style={{ background: "var(--accent-tint)", color: "var(--accent-deep)", borderRadius: 2, padding: "0 2px", fontWeight: 600 }}>
                          {match.excerpt.match}
                        </mark>
                        {match.excerpt.post}
                      </div>
                    </div>
                    {cursor === globalIdx && (
                      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", flexShrink: 0, marginTop: 6 }}>↵</span>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* Sin resultados */}
          {total === 0 && q.length > 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)" }}>
              {t("command_palette.no_results", { query })}
            </div>
          )}

          {/* Estado inicial: mostrar hint de búsqueda */}
          {total === 0 && q.length === 0 && (
            <div style={{ padding: "20px 16px", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
              {t("command_palette.initial_hint_line_1")}<br />{t("command_palette.initial_hint_line_2")}
            </div>
          )}
        </div>

        {/* Footer hint */}
        {q.length >= 2 && contentMatches.length === 0 && sectionItems.length === 0 && (
          <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border-subtle)", fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
            {t("command_palette.searching_all_text")}
          </div>
        )}
        {contentMatches.length > 0 && (
          <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border-subtle)", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", display: "flex", gap: 12 }}>
            <span>{t("command_palette.footer_navigate")}</span>
            <span>{t("command_palette.footer_go_block")}</span>
            <span>{t("command_palette.footer_cancel")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────

function SectionHeader({ label, hasBorder }: { label: string; hasBorder: boolean }) {
  return (
    <div style={{
      padding: "6px 16px 4px",
      fontSize: 10, fontWeight: 600, textTransform: "uppercase",
      letterSpacing: "0.08em", color: "var(--fg-faint)",
      borderTop: hasBorder ? "1px solid var(--border-subtle)" : "none",
      marginTop: hasBorder ? 4 : 0,
    }}>
      {label}
    </div>
  );
}

function PaletteRow({
  icon, label, hint, selected, onHover, onClick,
}: {
  icon: string; label: string; hint: string;
  selected: boolean; onHover: () => void; onClick: () => void;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 16px", cursor: "pointer",
        background: selected ? "var(--bg-selected)" : "transparent",
      }}
      onMouseEnter={onHover}
      onClick={onClick}
    >
      <div style={{
        width: 28, height: 28, borderRadius: "var(--r-sm)", flexShrink: 0,
        background: selected ? "var(--accent)" : "var(--ink-100)",
        color: selected ? "white" : "var(--fg-muted)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 600,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{label}</div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{hint}</div>
      </div>
      {selected && (
        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)" }}>↵</span>
      )}
    </div>
  );
}
