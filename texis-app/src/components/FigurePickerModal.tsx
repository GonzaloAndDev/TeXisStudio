import { useEffect, useMemo, useState } from "react";
import { listPlugins, groupPluginsByCategory, createPluginFigure } from "../services/figure-plugin-service";
import type { PluginInfo } from "../services/figure-plugin-service";
import type { PluginFigureBlock } from "../types";
import type { PluginCategory } from "@texisstudio/plugins";

// ── Category display metadata ──────────────────────────────────────

const CATEGORY_META: Record<PluginCategory, { label: string; icon: string }> = {
  "mathematics":       { label: "Matemáticas",         icon: "∑" },
  "physics":           { label: "Física",               icon: "⚡" },
  "chemistry":         { label: "Química",              icon: "⚗" },
  "biology-medicine":  { label: "Biología / Medicina",  icon: "🧬" },
  "engineering-cs":    { label: "Ingeniería / Comp.",   icon: "⚙" },
  "humanities-social": { label: "Humanidades / Social", icon: "📚" },
  "arts-visual":       { label: "Arte / Visual",        icon: "🎨" },
  "import-external":   { label: "Importar externo",     icon: "↑" },
};

const CATEGORY_ORDER: PluginCategory[] = [
  "mathematics", "physics", "chemistry", "biology-medicine",
  "engineering-cs", "humanities-social", "arts-visual", "import-external",
];

type QualityFilter = "all" | "official-core" | "official-extended" | "experimental";

const QUALITY_META: Record<QualityFilter, { label: string; color: string; dot: string }> = {
  "all":               { label: "Todos",       color: "var(--fg-muted)",   dot: "" },
  "official-core":     { label: "Core",        color: "var(--build-ok)",   dot: "●" },
  "official-extended": { label: "Extended",    color: "var(--accent)",     dot: "●" },
  "experimental":      { label: "Experimental",color: "var(--fg-faint)",   dot: "●" },
};

// ── Main modal ────────────────────────────────────────────────────

interface Props {
  projectPath: string;
  onInsert: (block: PluginFigureBlock) => void;
  onClose: () => void;
}

export function FigurePickerModal({ projectPath, onInsert, onClose }: Props) {
  const [search, setSearch]                 = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory | "all">("all");
  const [qualityFilter, setQualityFilter]   = useState<QualityFilter>("all");
  const [loading, setLoading]               = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);

  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  useEffect(() => {
    try { setPlugins(listPlugins()); }
    catch (e) { setError(`No se pudo cargar el catálogo de figuras: ${e}`); }
  }, []);

  const categoryGroups = useMemo(() => groupPluginsByCategory(plugins), [plugins]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return plugins.filter((p) => {
      const matchCat  = selectedCategory === "all" || p.category === selectedCategory;
      const matchQual = qualityFilter === "all"    || p.qualityLevel === qualityFilter;
      const matchQ    = !q
        || p.displayName.toLowerCase().includes(q)
        || p.description.toLowerCase().includes(q)
        || p.category.includes(q);
      return matchCat && matchQual && matchQ;
    });
  }, [plugins, search, selectedCategory, qualityFilter]);

  const grouped = useMemo(() => {
    const map = new Map<PluginCategory, PluginInfo[]>();
    for (const p of filtered) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [filtered]);

  // Count per quality level for badges
  const qualityCounts = useMemo(() => {
    const counts: Record<string, number> = { "all": plugins.length };
    for (const p of plugins) counts[p.qualityLevel] = (counts[p.qualityLevel] ?? 0) + 1;
    return counts;
  }, [plugins]);

  async function handleInsert(plugin: PluginInfo) {
    setLoading(plugin.pluginId); setError(null);
    try {
      const block = await createPluginFigure(plugin.pluginId, projectPath);
      onInsert(block);
    } catch (e) {
      setError(`Error al generar la figura: ${e}`);
      setLoading(null);
    }
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: "min(900px, 96vw)", height: "min(640px, 90vh)", background: "var(--bg-panel)", border: "1px solid var(--border-firm)", borderRadius: 10, boxShadow: "0 24px 64px rgba(0,0,0,0.45)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 20px 0", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>📊</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: "var(--fg-strong)" }}>Insertar figura generada</div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 1 }}>
                {plugins.length} figuras · sin código LaTeX
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose} title="Cerrar (Esc)">✕</button>
          </div>

          {/* Search */}
          <input
            autoFocus
            type="text"
            placeholder="Buscar figura… (nombre, descripción o disciplina)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "7px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-app)", color: "var(--fg-default)", fontSize: "var(--fs-sm)", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          />

          {/* Category tabs */}
          <div style={{ display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 0 }}>
            <CategoryTab label="Todas" icon="⬛" active={selectedCategory === "all"} count={filtered.length} onClick={() => setSelectedCategory("all")} />
            {CATEGORY_ORDER.filter((c) => categoryGroups.has(c)).map((c) => (
              <CategoryTab key={c} label={CATEGORY_META[c].label} icon={CATEGORY_META[c].icon} active={selectedCategory === c} count={filtered.filter((p) => p.category === c).length} onClick={() => setSelectedCategory(c)} />
            ))}
          </div>

          {/* Quality filter bar */}
          <div style={{ display: "flex", gap: 6, padding: "8px 0 10px", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--fg-faint)", marginRight: 2 }}>Nivel:</span>
            {(["all", "official-core", "official-extended", "experimental"] as QualityFilter[]).map((q) => {
              const meta = QUALITY_META[q];
              const active = qualityFilter === q;
              return (
                <button
                  key={q}
                  onClick={() => setQualityFilter(q)}
                  style={{
                    fontSize: 10, padding: "2px 9px", borderRadius: 10,
                    border: active ? `1px solid ${meta.color}` : "1px solid var(--border-soft)",
                    background: active ? `color-mix(in srgb, ${meta.color} 12%, transparent)` : "transparent",
                    color: active ? meta.color : "var(--fg-faint)",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: active ? 600 : 400,
                    transition: "all 0.12s",
                  }}
                >
                  {meta.dot && <span style={{ fontSize: 6, color: meta.color }}>{meta.dot}</span>}
                  {meta.label}
                  <span style={{ opacity: 0.7, fontFamily: "var(--font-mono)", fontSize: 9 }}>
                    {qualityCounts[q === "all" ? "all" : q] ?? 0}
                  </span>
                </button>
              );
            })}
            {(search || qualityFilter !== "all" || selectedCategory !== "all") && (
              <button
                onClick={() => { setSearch(""); setQualityFilter("all"); setSelectedCategory("all"); }}
                style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, border: "1px solid var(--border-soft)", background: "transparent", color: "var(--fg-faint)", cursor: "pointer", marginLeft: "auto" }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Plugin list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}>
          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(255,0,0,0.08)", borderRadius: "var(--r-sm)", color: "var(--build-err, #e55)", marginBottom: 10, fontSize: "var(--fs-sm)" }}>
              {error}
            </div>
          )}
          {filtered.length === 0 && !error && (
            <div style={{ textAlign: "center", color: "var(--fg-faint)", padding: 48, fontSize: "var(--fs-sm)" }}>
              Sin resultados{search ? ` para "${search}"` : ""}
              <div style={{ marginTop: 8, fontSize: "var(--fs-xs)" }}>Prueba con otro término o limpiar los filtros</div>
            </div>
          )}
          {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => (
            <div key={cat} style={{ marginBottom: 18 }}>
              {selectedCategory === "all" && (
                <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{CATEGORY_META[cat].icon}</span>
                  {CATEGORY_META[cat].label}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.6 }}>{grouped.get(cat)?.length}</span>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 }}>
                {(grouped.get(cat) ?? []).map((plugin) => (
                  <PluginCard
                    key={plugin.pluginId}
                    plugin={plugin}
                    loading={loading === plugin.pluginId}
                    disabled={loading !== null}
                    onInsert={handleInsert}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border-subtle)", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span>Clic en cualquier figura para insertarla directamente · los paquetes LaTeX se añaden automáticamente</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: "var(--font-mono)" }}>Esc para cerrar</span>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function CategoryTab({ label, icon, active, count, onClick }: { label: string; icon: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
        padding: "4px 10px", borderRadius: "var(--r-xs) var(--r-xs) 0 0",
        border: active ? "1px solid var(--accent)" : "1px solid transparent",
        borderBottom: active ? "1px solid var(--bg-panel)" : "1px solid transparent",
        background: active ? "var(--bg-panel)" : "transparent",
        color: active ? "var(--accent)" : "var(--fg-muted)",
        fontSize: "var(--fs-xs)", cursor: "pointer", fontWeight: active ? 600 : 400,
        marginBottom: active ? -1 : 0, position: "relative", zIndex: active ? 1 : 0,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
      {count > 0 && <span style={{ opacity: 0.6, fontFamily: "var(--font-mono)", fontSize: 9 }}>{count}</span>}
    </button>
  );
}

function PluginCard({ plugin, loading, disabled, onInsert }: {
  plugin: PluginInfo; loading: boolean; disabled: boolean; onInsert: (p: PluginInfo) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const qMeta: Record<string, { label: string; color: string }> = {
    "official-core":     { label: "Core",         color: "var(--build-ok)" },
    "official-extended": { label: "Extended",     color: "var(--accent)" },
    "experimental":      { label: "Experimental", color: "var(--fg-faint)" },
  };
  const q = qMeta[plugin.qualityLevel] ?? { label: plugin.qualityLevel, color: "var(--fg-faint)" };

  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onInsert(plugin)}
      style={{
        textAlign: "left", padding: "10px 12px", borderRadius: "var(--r-sm)",
        border: hovered && !disabled ? "1px solid var(--accent-soft)" : "1px solid var(--border-soft)",
        background: loading ? "var(--accent-tint)" : hovered && !disabled ? "var(--bg-hover)" : "var(--bg-app)",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled && !loading ? 0.5 : 1,
        transition: "all 0.12s", width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-strong)", flex: 1, lineHeight: 1.2 }}>
          {loading ? "Generando…" : plugin.displayName}
        </span>
        <span style={{ fontSize: 8, fontFamily: "var(--font-mono)", color: q.color, border: `1px solid ${q.color}`, borderRadius: "var(--r-xs)", padding: "1px 4px", flexShrink: 0 }}>
          {q.label}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {plugin.description}
      </div>
      {plugin.scopeWarning && hovered && (
        <div style={{ marginTop: 5, fontSize: 10, color: "var(--build-warn)", lineHeight: 1.35 }}>
          ⚠ {plugin.scopeWarning.slice(0, 110)}{plugin.scopeWarning.length > 110 ? "…" : ""}
        </div>
      )}
    </button>
  );
}
