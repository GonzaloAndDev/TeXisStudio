import { useEffect, useRef, useState } from "react";
import { IconSearch } from "../../components/Icons";
import type { ContentBlock, ProjectSection } from "../../types";

// ── CommandPalette (Ctrl+K) ───────────────────────────────────────

export const PALETTE_BLOCK_ITEMS = [
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

export function CommandPalette({
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

