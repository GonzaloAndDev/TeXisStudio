import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/settings";
import { buildLatexInputBlock } from "@texisstudio/plugins";
import { editPluginFigure, editPluginFigureWithSource, updatePluginFigureMeta, getPluginInfo } from "../services/figure-plugin-service";
import { VisualEditorRouter, hasVisualEditor } from "./visual-editors/VisualEditorRouter";
import { HelpLink } from "./help/HelpLink";
import { PdfPagePreview } from "./PdfPagePreview";
import { api } from "../lib/tauri";
import type { PluginFigureBlock } from "../types";

const QUALITY_BADGE: Record<string, { label: string; color: string }> = {
  "official-core":     { label: "Core",        color: "var(--build-ok)" },
  "official-extended": { label: "Extended",    color: "var(--accent)" },
  "experimental":      { label: "Experimental",color: "var(--fg-faint)" },
};

const DIFFICULTY_BADGE: Record<string, { label: string; color: string }> = {
  easy:         { label: "●", color: "var(--build-ok)" },
  intermediate: { label: "●", color: "var(--build-warn, #f5a623)" },
  advanced:     { label: "●", color: "var(--build-err, #e55)" },
};

interface Props {
  block: PluginFigureBlock;
  projectPath: string;
  onUpdate: (updated: PluginFigureBlock) => void;
  onClose: () => void;
}

type ActiveTab = "visual" | "meta" | "preview";

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
  const [busy, setBusy]       = useState<"save" | "regen" | "visual" | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);
  const [showLatex, setShowLatex] = useState(false);
  const [editedSourceJson, setEditedSourceJson] = useState(block.sourceJson ?? "");
  const [previewPdfPath, setPreviewPdfPath] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    hasVisualEditor(block.sourceJson, getPluginInfo(block.pluginId)?.editorType) ? "visual" : "meta"
  );

  const captionRef = useRef<HTMLInputElement>(null);

  // Tracks mount state so we don't setState after the modal is closed mid-await.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const latexPrimaryBackend = useSettingsStore((s) => s.latexPrimaryBackend);
  const info = getPluginInfo(block.pluginId);
  const quality = QUALITY_BADGE[info?.qualityLevel ?? ""] ?? { label: info?.qualityLevel ?? "", color: "var(--fg-faint)" };
  const difficulty = DIFFICULTY_BADGE[info?.userLevel ?? "intermediate"] ?? DIFFICULTY_BADGE.intermediate;
  const userLevelLabel = info?.userLevel
    ? t(`figure_picker.level_${info.userLevel}`, info.userLevel)
    : "";

  const metaDirty = caption !== block.caption || label !== block.label;
  const visualDirty = editedSourceJson !== (block.sourceJson ?? "");
  const anyDirty = metaDirty || visualDirty;

  const previewLatex = useMemo(() => {
    const texPath = `texisstudio-assets/figures/${block.figureId}/output.tex`;
    const currentCaption = caption.trim() || block.caption;
    const currentLabel   = label.trim()   || block.label;
    return buildLatexInputBlock({ figureId: block.figureId, inputPath: texPath, caption: currentCaption, label: currentLabel });
  }, [caption, label, block.figureId, block.caption, block.label]);

  useEffect(() => {
    if (activeTab === "meta") captionRef.current?.focus();
  }, [activeTab]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [busy, onClose]);

  const handleSourceChange = useCallback((json: string) => {
    setEditedSourceJson(json);
  }, []);

  async function handleSaveMeta() {
    if (!metaDirty || busy) return;
    setBusy("save"); setError(null);
    try {
      const updated = await updatePluginFigureMeta(block, caption.trim() || block.caption, label.trim() || block.label, projectPath);
      if (!mountedRef.current) return;
      onUpdate(updated);
      setDone(true);
      setTimeout(() => { if (mountedRef.current) onClose(); }, 600);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(`${e}`);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  async function handleApplyVisual() {
    if (!visualDirty && !metaDirty) return;
    if (busy) return;
    setBusy("visual"); setError(null);
    try {
      const updated = await editPluginFigureWithSource(
        block,
        editedSourceJson,
        projectPath,
        caption.trim() || block.caption,
        label.trim() || block.label,
      );
      if (!mountedRef.current) return;
      onUpdate(updated);
      setDone(true);
      setTimeout(() => { if (mountedRef.current) onClose(); }, 700);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(`${e}`);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  // Monotonic preview compile id — only the latest compile's result is shown.
  // Without this, a fast Recompile click after editing could let the older
  // preview overwrite the newer one when the older compile finishes second.
  const previewCompileIdRef = useRef(0);
  const handleCompilePreview = useCallback(async () => {
    const myId = ++previewCompileIdRef.current;
    setPreviewBusy(true); setPreviewError(null);
    try {
      const path = await api.compileSnippetPreview(projectPath, block.figureId, latexPrimaryBackend);
      if (!mountedRef.current) return;
      if (myId !== previewCompileIdRef.current) return; // newer compile won
      if (!path) {
        setPreviewError(t("figure_edit.preview_no_tectonic"));
        setPreviewPdfPath(null);
      } else {
        setPreviewPdfPath(path);
        setPreviewVersion(Date.now()); // cache-bust the rendered preview
      }
    } catch (e) {
      if (!mountedRef.current) return;
      if (myId !== previewCompileIdRef.current) return;
      setPreviewError(`${t("figure_edit.preview_error_prefix")} ${e}`);
      setPreviewPdfPath(null);
    } finally {
      if (mountedRef.current && myId === previewCompileIdRef.current) {
        setPreviewBusy(false);
      }
    }
  }, [projectPath, block.figureId, latexPrimaryBackend, t]);

  // Invalidate a stale preview whenever the figure source changes, so the next
  // visit to the Preview tab recompiles instead of showing an outdated PDF.
  useEffect(() => {
    setPreviewPdfPath(null);
    setPreviewError(null);
  }, [editedSourceJson]);

  // Auto-compile the preview when the user opens the Preview tab — mirrors the
  // inline document block, which renders the figure PDF without an extra click.
  useEffect(() => {
    if (activeTab !== "preview" || visualDirty || previewBusy) return;
    if (previewPdfPath !== null || previewError !== null) return;
    void handleCompilePreview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, visualDirty, previewPdfPath, previewError]);

  async function handleRegen() {
    if (busy) return;
    setBusy("regen"); setError(null);
    try {
      const updated = await editPluginFigure(block, projectPath, caption.trim() || block.caption, label.trim() || block.label);
      if (!mountedRef.current) return;
      onUpdate(updated);
      setDone(true);
      setTimeout(() => { if (mountedRef.current) onClose(); }, 700);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(`${e}`);
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  }

  const showVisualTab = hasVisualEditor(block.sourceJson, info?.editorType);
  const tabs: ActiveTab[] = showVisualTab ? ["visual", "meta", "preview"] : ["meta", "preview"];

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div style={{ width: showVisualTab ? "min(700px, 96vw)" : "min(560px, 94vw)", maxHeight: "92vh", background: "var(--bg-panel)", border: "1px solid var(--border-firm)", borderRadius: 10, boxShadow: "0 20px 56px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px 0", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-strong)" }}>
                  {info?.displayName ?? block.pluginId}
                </span>
                <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: quality.color, border: `1px solid ${quality.color}`, borderRadius: "var(--r-xs)", padding: "1px 5px" }}>
                  {quality.label}
                </span>
                {info?.userLevel && (
                  <span
                    title={t("figure_picker.level_label") + " " + userLevelLabel}
                    style={{ fontSize: 9, color: difficulty.color, display: "flex", alignItems: "center", gap: 2 }}
                  >
                    {difficulty.label} {userLevelLabel}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                {categoryLabel[info?.category ?? ""] ?? info?.category} · {block.figureId}
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose} disabled={!!busy} title={t("figure_edit.close_title")}>✕</button>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0 }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "5px 14px",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                  background: "transparent",
                  color: activeTab === tab ? "var(--accent)" : "var(--fg-muted)",
                  fontSize: "var(--fs-sm)",
                  cursor: "pointer",
                  fontWeight: activeTab === tab ? 600 : 400,
                }}
              >
                {tab === "visual" ? t("figure_edit.tab_visual")
                  : tab === "preview" ? t("figure_edit.tab_preview")
                  : t("figure_edit.tab_meta")}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* ── Visual editor tab ── */}
          {activeTab === "visual" && showVisualTab && (
            <div style={{ padding: "14px 18px" }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                {t("figure_edit.visual_hint")}
                <HelpLink topic="figures" style={{ marginLeft: "auto" }} />
              </div>
              <VisualEditorRouter sourceJson={editedSourceJson} onSourceChange={handleSourceChange} />

              {/* Caption / label mini-form below the visual editor */}
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--border-soft)", paddingTop: 12 }}>
                <div>
                  <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", display: "block", marginBottom: 3 }}>
                    {t("figure_edit.caption_label")}
                  </label>
                  <input
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    disabled={!!busy}
                    style={{ width: "100%", padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-app)", color: "var(--fg-default)", fontSize: "var(--fs-sm)", boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Meta tab (caption / label / LaTeX) ── */}
          {activeTab === "meta" && (
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
                  onKeyDown={(e) => { if (e.key === "Enter" && metaDirty) handleSaveMeta(); }}
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
                  onKeyDown={(e) => { if (e.key === "Enter" && metaDirty) handleSaveMeta(); }}
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
                  {metaDirty ? t("figure_edit.latex_preview_dirty") : t("figure_edit.latex_preview")}
                  {metaDirty && <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--accent)", fontWeight: 600 }}>{t("figure_edit.edited_badge")}</span>}
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
            </div>
          )}

          {/* ── Preview tab ── */}
          {activeTab === "preview" && (
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {latexPrimaryBackend === "tectonic" && (
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", padding: "6px 10px", background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-xs)", lineHeight: 1.5 }}>
                  ⚙ {t("figure_edit.preview_tectonic_note")}
                </div>
              )}
              {visualDirty && (
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-warn)", padding: "6px 10px", background: "var(--build-warn-tint, #ffcc0015)", borderRadius: "var(--r-xs)" }}>
                  {t("figure_edit.preview_apply_first")}
                </div>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCompilePreview}
                disabled={previewBusy || visualDirty}
              >
                {previewBusy ? t("figure_edit.preview_compiling") : t("figure_edit.preview_compile_btn")}
              </button>
              {previewError && (
                <div style={{ fontSize: 11, color: "var(--build-err, #e55)", padding: "7px 10px", background: "rgba(255,0,0,0.08)", borderRadius: "var(--r-xs)", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)" }}>
                  {previewError}
                </div>
              )}
              {previewPdfPath && (
                <div style={{ overflow: "hidden", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", background: "#fff" }}>
                  <PdfPagePreview
                    src={`${convertFileSrc(previewPdfPath)}?t=${previewVersion}`}
                    title={t("figure_edit.tab_preview")}
                    maxHeight={420}
                    errorLabel={t("compile_widgets.pdf_viewer_error")}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Shared: warnings + feedback ── */}
          <div style={{ padding: "0 18px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {info?.scopeWarning && (
              <div style={{ fontSize: 11, color: "var(--build-warn)", padding: "7px 10px", background: "var(--build-warn-tint, #ffcc0015)", borderRadius: "var(--r-xs)", lineHeight: 1.4 }}>
                ⚠ {info.scopeWarning}
              </div>
            )}
            {error && (
              <div style={{ fontSize: 11, color: "var(--build-err, #e55)", padding: "7px 10px", background: "rgba(255,0,0,0.08)", borderRadius: "var(--r-xs)" }}>
                {error}
              </div>
            )}
            {done && (
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-ok)", textAlign: "center" }}>
                {t("figure_edit.done_msg")}
              </div>
            )}
          </div>
        </div>

        {/* Actions — fijos al fondo */}
        <div style={{ padding: "12px 18px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={!!busy} style={{ marginRight: "auto" }}>
            {t("common.cancel")}
          </button>

          {/* Regen only on meta/preview tab or non-visual plugins */}
          {(activeTab === "meta" || activeTab === "preview" || !showVisualTab) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleRegen}
              disabled={!!busy}
              title={t("figure_edit.regen_title")}
              style={{ fontSize: "var(--fs-xs)" }}
            >
              {busy === "regen" ? t("figure_edit.regenerating") : t("figure_edit.regen_btn")}
            </button>
          )}

          {/* Primary action differs by tab */}
          {activeTab === "visual" && showVisualTab && (
            <button
              className="btn btn-accent btn-sm"
              onClick={handleApplyVisual}
              disabled={(!anyDirty) || !!busy}
              title={t("figure_edit.apply_visual_title")}
            >
              {busy === "visual" ? t("figure_edit.applying") : t("figure_edit.apply_visual_btn")}
            </button>
          )}
          {activeTab === "meta" && (
            <button
              className="btn btn-accent btn-sm"
              onClick={handleSaveMeta}
              disabled={!metaDirty || !!busy}
              title={metaDirty ? t("figure_edit.save_title_dirty") : t("figure_edit.save_title_clean")}
            >
              {busy === "save" ? t("figure_edit.saving") : t("figure_edit.save_btn")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
