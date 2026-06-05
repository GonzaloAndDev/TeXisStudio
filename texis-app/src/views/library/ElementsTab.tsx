import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconX } from "../../components/Icons";
import { BLOCK_CATALOG } from "./constants";

// ── ElementsTab ───────────────────────────────────────────────────────────────

export function ElementsTab() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const sel = BLOCK_CATALOG.find((b) => b.type === selected);
  const blockName = (type: string) => t(`elements_tab.blocks.${type}.name`);
  const blockDescription = (type: string) => t(`elements_tab.blocks.${type}.description`);
  const blockLatexOutput = (type: string) => t(`elements_tab.blocks.${type}.latex_output`);
  const tagLabel = (tag: string) => t(`elements_tab.tags.${tag}`);
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }} className="scroll">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>{t("elements_tab.title")}</h1>
          <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>{t("elements_tab.subtitle")}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {BLOCK_CATALOG.map((b) => (
            <div key={b.type} onClick={() => setSelected(b.type === selected ? null : b.type)} style={{ background: selected === b.type ? "var(--accent-tint)" : "var(--bg-panel)", border: `1px solid ${selected === b.type ? "var(--accent)" : "var(--border-soft)"}`, boxShadow: selected === b.type ? "0 0 0 3px var(--accent-soft)" : "none", borderRadius: "var(--r-lg)", padding: 16, cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "var(--r-md)", background: selected === b.type ? "var(--accent)" : "var(--ink-100)", color: selected === b.type ? "white" : "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>{b.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", marginBottom: 3 }}>{blockName(b.type)}</div>
                <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>{blockDescription(b.type)}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {b.tags.map((tag) => <span key={tag} className="chip" style={{ fontSize: 9 }}>{tagLabel(tag)}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {sel && (
        <div style={{ width: 280, flexShrink: 0, borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", padding: 20, overflow: "auto" }} className="scroll">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: "var(--r-md)", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>{sel.icon}</div>
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{blockName(sel.type)}</span>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)" }}><IconX size={13} /></button>
          </div>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 14 }}>{blockDescription(sel.type)}</p>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 6 }}>{t("elements_tab.latex_output_label")}</div>
            <div style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-app)", border: "1px solid var(--border-firm)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-default)", lineHeight: 1.6 }}>{blockLatexOutput(sel.type)}</div>
          </div>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 6 }}>{t("elements_tab.internal_type_label")}</div>
          <span className="chip tx-mono" style={{ fontSize: 11 }}>{sel.type}</span>
        </div>
      )}
    </div>
  );
}
