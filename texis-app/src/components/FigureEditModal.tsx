import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildLatexInputBlock } from "@texisstudio/plugins";
import { editPluginFigure, updatePluginFigureMeta, getPluginInfo } from "../services/figure-plugin-service";
import type { PluginFigureBlock } from "../types";

const QUALITY_BADGE: Record<string, { label: string; color: string }> = {
  "official-core":     { label: "Core",        color: "var(--build-ok)" },
  "official-extended": { label: "Extended",    color: "var(--accent)" },
  "experimental":      { label: "Experimental",color: "var(--fg-faint)" },
};

// Category labels are built from i18n inside the component

interface Props {
  block: PluginFigureBlock;
  projectPath: string;
  onUpdate: (updated: PluginFigureBlock) => void;
  onClose: () => void;
}

export function FigureEditModal({ block, projectPath, onUpdate, onClose }: Props) {
  const { t } = useTranslation();
  const categoryLabel = useMemo<Record<string, string>>(() => ({
    "mathematics":       t("figure_picker.cat_mathematics"),
    "physics":           t("figure_picker.cat_physics"),
    "chemistry":         t("figure_picker.cat_chemistry"),
    "biology-medicine":  t("figure_picker.cat_biology"),
    "engineering-cs":    t("figure_picker.cat_engineering"),
    "humanities-social": t("figure_picker.cat_humanities"),
    "arts-visual":       t("figure_picker.cat_arts"),
    "import-external":   t("figure_picker.cat_import"),
  }), [t]);
  const [caption, setCaption] = useState(block.caption);
  const [label, setLabel]     = useState(block.label);
  const [busy, setBusy]       = useState<"save" | "regen" | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);
  const [showLatex, setShowLatex] = useState(false);
  const captionRef = useRef<HTMLInputElement>(null);

  const info = getPluginInfo(block.pluginId);
  const quality = QUALITY_BADGE[info?.qualityLevel ?? ""] ?? { label: info?.qualityLevel ?? "", color: "var(--fg-faint)" };
  const dirty = caption !== block.caption || label !== block.label;

  // Preview LaTeX en tiempo real: reconstruye el bloque con los valores actuales del formulario
  const previewLatex = useMemo(() => {
    const texPath = `texisstudio-assets/figures/${block.figureId}/output.tex`;
    const currentCaption = caption.trim() || block.caption;
    const currentLabel   = label.trim()   || block.label;
    return buildLatexInputBlock({ figureId: block.figureId, inputPath: texPath, caption: currentCaption, label: currentLabel });
  }, [caption, label, block.figureId, block.caption, block.label]);

  useEffect(() => { captionRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onClose]);

  async function handleSave() {
    if (!dirty || busy) return;
    setBusy("save"); setError(null);
    try {
      const updated = await updatePluginFigureMeta(block, caption.trim() || block.caption, label.trim() || block.label, projectPath);
      onUpdate(updated);
      setDone(true);
      setTimeout(onClose, 600);
    } catch (e) { setError(`${e}`); }
    finally { setBusy(null); }
  }

  async function handleRegen() {
    if (busy) return;
    setBusy("regen"); setError(null);
    try {
      const updated = await editPluginFigure(block, projectPath, caption.trim() || block.caption, label.trim() || block.label);
      onUpdate(updated);
      setDone(true);
      setTimeout(onClose, 700);
    } catch (e) { setError(`${e}`); }
    finally { setBusy(null); }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div style={{ width: "min(560px, 94vw)", maxHeight: "92vh", background: "var(--bg-panel)", border: "1px solid var(--border-firm)", borderRadius: 10, boxShadow: "0 20px 56px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-strong)" }}>
                {info?.displayName ?? block.pluginId}
              </span>
              <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: quality.color, border: `1px solid ${quality.color}`, borderRadius: "var(--r-xs)", padding: "1px 5px" }}>
                {quality.label}
              </span>
            </div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
              {categoryLabel[info?.category ?? ""] ?? info?.category} · {block.figureId}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} disabled={!!busy} title={t("figure_edit.close_title")}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* Fields */}
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", display: "block", marginBottom: 4 }}>
                {t("figure_edit.caption_label")}
              </label>
              <input
                ref={captionRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={!!busy}
                onKeyDown={(e) => { if (e.key === "Enter" && dirty) handleSave(); }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-app)", color: "var(--fg-default)", fontSize: "var(--fs-sm)", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", display: "block", marginBottom: 4 }}>
                {t("figure_edit.label_latex")}
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={!!busy}
                onKeyDown={(e) => { if (e.key === "Enter" && dirty) handleSave(); }}
                style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-app)", color: "var(--fg-default)", fontSize: "var(--fs-sm)", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
              />
            </div>

            {/* Packages */}
            {block.requiredPackages.length > 0 && (
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
                {t("figure_edit.packages_label")} <span style={{ fontFamily: "var(--font-mono)" }}>{block.requiredPackages.join(", ")}</span>
              </div>
            )}

            {/* LaTeX preview accordion */}
            <div style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
              <button
                onClick={() => setShowLatex((v) => !v)}
                style={{ width: "100%", padding: "7px 12px", background: "var(--bg-app)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", textAlign: "left" }}
              >
                <span style={{ transform: showLatex ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block", fontSize: 10 }}>▶</span>
                {dirty ? t("figure_edit.latex_preview_dirty") : t("figure_edit.latex_preview")}
                {dirty && <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--accent)", fontWeight: 600 }}>{t("figure_edit.edited_badge")}</span>}
              </button>
              {showLatex && (
                <pre style={{
                  margin: 0, padding: "10px 12px",
                  background: "var(--ink-900, #14110f)",
                  color: "#C8C2B5",
                  fontSize: 11, fontFamily: "var(--font-mono)", lineHeight: 1.55,
                  overflowX: "auto", whiteSpace: "pre",
                  maxHeight: 220, overflowY: "auto",
                  borderTop: "1px solid var(--border-soft)",
                }}>
                  {previewLatex}
                </pre>
              )}
            </div>

            {/* Scope warning */}
            {info?.scopeWarning && (
              <div style={{ fontSize: 11, color: "var(--build-warn)", padding: "7px 10px", background: "var(--build-warn-tint, #ffcc0015)", borderRadius: "var(--r-xs)", lineHeight: 1.4 }}>
                ⚠ {info.scopeWarning}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ fontSize: 11, color: "var(--build-err, #e55)", padding: "7px 10px", background: "rgba(255,0,0,0.08)", borderRadius: "var(--r-xs)" }}>
                {error}
              </div>
            )}

            {/* Done */}
            {done && (
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-ok)", textAlign: "center" }}>
                Figura actualizada
              </div>
            )}
          </div>
        </div>

        {/* Actions — fijos al fondo */}
        <div style={{ padding: "12px 18px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={!!busy} style={{ marginRight: "auto" }}>
            {t("common.cancel")}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleRegen}
            disabled={!!busy}
            title={t("figure_edit.regen_title")}
            style={{ fontSize: "var(--fs-xs)" }}
          >
            {busy === "regen" ? t("figure_edit.regenerating") : t("figure_edit.regen_btn")}
          </button>
          <button
            className="btn btn-accent btn-sm"
            onClick={handleSave}
            disabled={!dirty || !!busy}
            title={dirty ? t("figure_edit.save_title_dirty") : t("figure_edit.save_title_clean")}
          >
            {busy === "save" ? t("figure_edit.saving") : t("figure_edit.save_btn")}
          </button>
        </div>
      </div>
    </div>
  );
}
