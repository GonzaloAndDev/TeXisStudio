import { useEffect, useMemo, useState } from "react";
import { listPlugins, groupPluginsByCategory, createPluginFigure } from "../services/figure-plugin-service";
import type { PluginInfo } from "../services/figure-plugin-service";
import type { PluginFigureBlock } from "../types";
import type { PluginCategory } from "@texisstudio/plugins";

// ── Category display metadata ──────────────────────────────────────

const CATEGORY_META: Record<PluginCategory, { label: string; icon: string }> = {
  "mathematics":      { label: "Matemáticas",          icon: "∑" },
  "physics":          { label: "Física",                icon: "⚡" },
  "chemistry":        { label: "Química",               icon: "⚗" },
  "biology-medicine": { label: "Biología / Medicina",   icon: "🧬" },
  "engineering-cs":   { label: "Ingeniería / Comp.",    icon: "⚙" },
  "humanities-social":{ label: "Humanidades / Social",  icon: "📚" },
  "arts-visual":      { label: "Arte / Visual",         icon: "🎨" },
  "import-external":  { label: "Importar externo",      icon: "↑" },
};

const CATEGORY_ORDER: PluginCategory[] = [
  "mathematics", "physics", "chemistry", "biology-medicine",
  "engineering-cs", "humanities-social", "arts-visual", "import-external",
];

// ── Main modal ────────────────────────────────────────────────────

interface Props {
  projectPath: string;
  onInsert: (block: PluginFigureBlock) => void;
  onClose: () => void;
}

export function FigurePickerModal({ projectPath, onInsert, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory | "all">("all");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load plugin list (sync, but kept inside effect to avoid render-blocking)
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  useEffect(() => {
    try {
      setPlugins(listPlugins());
    } catch (e) {
      setError(`No se pudo cargar el catálogo de figuras: ${e}`);
    }
  }, []);

  const categoryGroups = useMemo(() => groupPluginsByCategory(plugins), [plugins]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return plugins.filter((p) => {
      const matchCat = selectedCategory === "all" || p.category === selectedCategory;
      const matchQ = !q || p.displayName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.includes(q);
      return matchCat && matchQ;
    });
  }, [plugins, search, selectedCategory]);

  const grouped = useMemo(() => {
    const map = new Map<PluginCategory, PluginInfo[]>();
    for (const p of filtered) {
      const list = map.get(p.category) ?? [];
      list.push(p);
      map.set(p.category, list);
    }
    return map;
  }, [filtered]);

  async function handleInsert(plugin: PluginInfo) {
    setLoading(plugin.pluginId);
    setError(null);
    try {
      const block = await createPluginFigure(plugin.pluginId, projectPath);
      onInsert(block);
    } catch (e) {
      setError(`Error al generar la figura: ${e}`);
      setLoading(null);
    }
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "min(860px, 94vw)", height: "min(620px, 88vh)",
        background: "var(--bg-panel)", border: "1px solid var(--border-firm)",
        borderRadius: 10, boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px 12px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>📊</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: "var(--fg-strong)" }}>Insertar figura generada</div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
              {plugins.length} figuras disponibles — el LaTeX se genera automáticamente
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Cerrar (Esc)">✕</button>
        </div>

        {/* Search + category bar */}
        <div style={{ padding: "10px 16px 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <input
            autoFocus
            type="text"
            placeholder="Buscar figura…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "7px 12px", borderRadius: "var(--r-sm)",
              border: "1px solid var(--border-firm)", background: "var(--bg-app)",
              color: "var(--fg-default)", fontSize: "var(--fs-sm)", outline: "none", boxSizing: "border-box",
            }}
          />
          {/* Category tabs */}
          <div style={{ display: "flex", gap: 4, overflowX: "auto", padding: "8px 0 0", scrollbarWidth: "none" }}>
            <CategoryTab label="Todas" icon="⬛" active={selectedCategory === "all"} count={plugins.length} onClick={() => setSelectedCategory("all")} />
            {CATEGORY_ORDER.filter((c) => categoryGroups.has(c)).map((c) => (
              <CategoryTab
                key={c}
                label={CATEGORY_META[c].label}
                icon={CATEGORY_META[c].icon}
                active={selectedCategory === c}
                count={categoryGroups.get(c)?.length ?? 0}
                onClick={() => setSelectedCategory(c)}
              />
            ))}
          </div>
        </div>

        {/* Plugin list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}>
          {error && (
            <div style={{ padding: "10px 14px", background: "var(--build-err-tint, #ff000020)", borderRadius: "var(--r-sm)", color: "var(--build-err)", marginBottom: 10, fontSize: "var(--fs-sm)" }}>
              {error}
            </div>
          )}
          {filtered.length === 0 && !error && (
            <div style={{ textAlign: "center", color: "var(--fg-faint)", padding: 40, fontSize: "var(--fs-sm)" }}>
              Sin resultados para "{search}"
            </div>
          )}
          {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              {(selectedCategory === "all") && (
                <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{CATEGORY_META[cat].icon}</span>
                  {CATEGORY_META[cat].label}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
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
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border-subtle)", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>Haz clic en una figura para insertarla directamente en tu sección</span>
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
        padding: "4px 10px", borderRadius: "var(--r-xs)",
        border: active ? "1px solid var(--accent)" : "1px solid transparent",
        background: active ? "var(--accent-tint)" : "transparent",
        color: active ? "var(--accent)" : "var(--fg-muted)",
        fontSize: "var(--fs-xs)", cursor: "pointer", fontWeight: active ? 600 : 400,
        transition: "all 0.15s",
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span style={{ opacity: 0.6, fontFamily: "var(--font-mono)", fontSize: 10 }}>{count}</span>
    </button>
  );
}

function PluginCard({ plugin, loading, disabled, onInsert }: {
  plugin: PluginInfo;
  loading: boolean;
  disabled: boolean;
  onInsert: (p: PluginInfo) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const qualityBadge = { "official-core": { label: "Core", color: "var(--build-ok)" }, "official-extended": { label: "Extended", color: "var(--accent)" }, "experimental": { label: "Experimental", color: "var(--fg-faint)" } }[plugin.qualityLevel] ?? { label: plugin.qualityLevel, color: "var(--fg-faint)" };

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
        transition: "all 0.15s", width: "100%",
      }}
    >
      {/* Name + quality badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-strong)", flex: 1, lineHeight: 1.2 }}>
          {loading ? "Generando…" : plugin.displayName}
        </span>
        <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: qualityBadge.color, border: `1px solid ${qualityBadge.color}`, borderRadius: "var(--r-xs)", padding: "1px 5px", flexShrink: 0 }}>
          {qualityBadge.label}
        </span>
      </div>
      {/* Description */}
      <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {plugin.description}
      </div>
      {/* Scope warning */}
      {plugin.scopeWarning && hovered && (
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--build-warn)", lineHeight: 1.35 }}>
          ⚠ {plugin.scopeWarning.slice(0, 120)}{plugin.scopeWarning.length > 120 ? "…" : ""}
        </div>
      )}
    </button>
  );
}
