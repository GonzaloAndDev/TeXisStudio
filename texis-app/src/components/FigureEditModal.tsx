import { useEffect, useRef, useState } from "react";
import { editPluginFigure, updatePluginFigureMeta, getPluginInfo } from "../services/figure-plugin-service";
import type { PluginFigureBlock } from "../types";

const QUALITY_BADGE: Record<string, { label: string; color: string }> = {
  "official-core":     { label: "Core",        color: "var(--build-ok)" },
  "official-extended": { label: "Extended",    color: "var(--accent)" },
  "experimental":      { label: "Experimental",color: "var(--fg-faint)" },
};

const CATEGORY_LABEL: Record<string, string> = {
  "mathematics":       "Matemáticas",
  "physics":           "Física",
  "chemistry":         "Química",
  "biology-medicine":  "Biología / Medicina",
  "engineering-cs":    "Ingeniería / Comp.",
  "humanities-social": "Humanidades / Social",
  "arts-visual":       "Arte / Visual",
  "import-external":   "Importar externo",
};

interface Props {
  block: PluginFigureBlock;
  projectPath: string;
  onUpdate: (updated: PluginFigureBlock) => void;
  onClose: () => void;
}

export function FigureEditModal({ block, projectPath, onUpdate, onClose }: Props) {
  const [caption, setCaption] = useState(block.caption);
  const [label, setLabel]     = useState(block.label);
  const [busy, setBusy]       = useState<"save" | "regen" | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);
  const captionRef = useRef<HTMLInputElement>(null);

  const info = getPluginInfo(block.pluginId);
  const quality = QUALITY_BADGE[info?.qualityLevel ?? ""] ?? { label: info?.qualityLevel ?? "", color: "var(--fg-faint)" };
  const dirty = caption !== block.caption || label !== block.label;

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
      <div style={{ width: "min(520px, 94vw)", background: "var(--bg-panel)", border: "1px solid var(--border-firm)", borderRadius: 10, boxShadow: "0 20px 56px rgba(0,0,0,0.4)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", gap: 10 }}>
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
              {CATEGORY_LABEL[info?.category ?? ""] ?? info?.category} · {block.figureId}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} disabled={!!busy} title="Cerrar (Esc)">✕</button>
        </div>

        {/* Fields */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", display: "block", marginBottom: 4 }}>
              Título / Caption
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
              Etiqueta LaTeX (<code style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>\ref</code> / <code style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>\cref</code>)
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
              Paquetes LaTeX: <span style={{ fontFamily: "var(--font-mono)" }}>{block.requiredPackages.join(", ")}</span>
            </div>
          )}

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

        {/* Actions */}
        <div style={{ padding: "12px 18px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={!!busy} style={{ marginRight: "auto" }}>
            Cancelar
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleRegen}
            disabled={!!busy}
            title="Re-ejecuta el plugin desde los datos originales guardados. Útil si el motor fue actualizado."
            style={{ fontSize: "var(--fs-xs)" }}
          >
            {busy === "regen" ? "Regenerando…" : "Regenerar figura"}
          </button>
          <button
            className="btn btn-accent btn-sm"
            onClick={handleSave}
            disabled={!dirty || !!busy}
            title={dirty ? "Guarda el nuevo título y etiqueta sin re-ejecutar el plugin" : "Sin cambios pendientes"}
          >
            {busy === "save" ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
