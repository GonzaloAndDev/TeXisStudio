import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconCode, IconGrid, IconSearch, IconX } from "../../components/Icons";
import { groupPluginsByCategory, listPlugins, type PluginInfo } from "../../services/figure-plugin-service";
import type { PluginCategory } from "@texisstudio/plugins";

const CATEGORY_KEYS: Record<PluginCategory, string> = {
  mathematics: "figure_picker.cat_mathematics",
  physics: "figure_picker.cat_physics",
  chemistry: "figure_picker.cat_chemistry",
  "biology-medicine": "figure_picker.cat_biology",
  "engineering-cs": "figure_picker.cat_engineering",
  "humanities-social": "figure_picker.cat_humanities",
  "arts-visual": "figure_picker.cat_arts",
  "import-external": "figure_picker.cat_import",
};

function packageSummary(plugin: PluginInfo) {
  return plugin.requiredPackages.length ? plugin.requiredPackages.join(", ") : "LaTeX";
}

export function PluginsTab() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");

  const plugins = useMemo(() => listPlugins(), [i18n.language, i18n.resolvedLanguage]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return plugins;
    return plugins.filter((plugin) =>
      plugin.displayName.toLowerCase().includes(q)
      || plugin.description.toLowerCase().includes(q)
      || plugin.pluginId.toLowerCase().includes(q)
      || plugin.requiredPackages.some((pkg) => pkg.toLowerCase().includes(q))
      || t(CATEGORY_KEYS[plugin.category]).toLowerCase().includes(q)
    );
  }, [plugins, search, t]);
  const grouped = useMemo(() => groupPluginsByCategory(filtered), [filtered]);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 40px" }} className="scroll">
      <div style={{ maxWidth: 940 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>{t("plugins_tab.title")}</h1>
            <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>{t("plugins_tab.subtitle", { count: plugins.length })}</p>
          </div>
        </div>

        <div style={{ position: "relative", maxWidth: 420, marginBottom: 20 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("plugins_tab.search_placeholder")} style={{ width: "100%", padding: "7px 32px 7px 32px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none" }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}><IconX size={12} /></button>}
        </div>

        {filtered.length === 0 ? (
          <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "36px 0" }}>{t("plugins_tab.no_results")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {[...grouped.entries()].map(([category, categoryPlugins]) => (
              <section key={category}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <IconGrid size={14} style={{ color: "var(--fg-muted)" }} />
                  <h2 style={{ margin: 0, fontSize: "var(--fs-sm)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)" }}>
                    {t(CATEGORY_KEYS[category])}
                  </h2>
                  <span className="chip" style={{ fontSize: 10 }}>{categoryPlugins.length}</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                  {categoryPlugins.map((plugin) => (
                    <div key={plugin.pluginId} style={{ background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "var(--r-md)", background: "var(--ink-100)", color: "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <IconCode size={15} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>{plugin.displayName}</div>
                          <div style={{ fontSize: 10, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{plugin.pluginId}</div>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.55 }}>{plugin.description}</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        <span className="chip" style={{ fontSize: 9 }}>{t(`plugins_tab.quality.${plugin.qualityLevel}`, { defaultValue: plugin.qualityLevel })}</span>
                        <span className="chip tx-mono" style={{ fontSize: 9 }}>{packageSummary(plugin)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
