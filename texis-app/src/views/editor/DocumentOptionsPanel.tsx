import { useState } from "react";
import { IconCheck, IconX } from "../../components/Icons";
import type { LatexTypography } from "../../types";

// ── DocumentOptionsPanel ─────────────────────────────────────────

export function DocumentOptionsPanel({
  typography,
  onSave,
  onClose,
}: {
  typography: LatexTypography;
  onSave: (t: LatexTypography) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<LatexTypography>({ ...typography });
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<LatexTypography>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(draft); onClose(); }
    finally { setSaving(false); }
  };

  const OptionRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );

  const Chip = ({ value, current, label, onClick }: { value: string; current?: string; label: string; onClick: () => void }) => (
    <button
      className={`btn btn-sm ${current === value ? "btn-accent" : "btn-ghost"}`}
      onClick={onClick}
      style={{ padding: "4px 14px", fontSize: "var(--fs-xs)" }}
    >
      {label}
      {current === value && <IconCheck size={9} sw={2.5} />}
    </button>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 900 }}
      onClick={onClose}
    >
      <div
        style={{ width: 440, background: "var(--bg-chrome)", borderRadius: "var(--r-lg)", border: "1px solid var(--border-firm)", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center" }}>
          <span style={{ flex: 1, fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>
            Opciones del documento
          </span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><IconX size={13} /></button>
        </div>

        {/* Opciones */}
        <div style={{ padding: "18px 18px 14px", display: "flex", flexDirection: "column", gap: 16 }}>
          <OptionRow label="Tamaño de fuente">
            {[["10pt","10pt"],["11pt","11pt"],["12pt","12pt (recomendado)"]].map(([v,l]) => (
              <Chip key={v} value={v} current={draft.font_size} label={l} onClick={() => update({ font_size: draft.font_size === v ? undefined : v })} />
            ))}
          </OptionRow>

          <OptionRow label="Tamaño de papel">
            {[["a4paper","A4"],["letterpaper","Carta (Letter)"]].map(([v,l]) => (
              <Chip key={v} value={v} current={draft.paper_size} label={l} onClick={() => update({ paper_size: draft.paper_size === v ? undefined : v })} />
            ))}
          </OptionRow>

          <OptionRow label="Interlineado">
            {[["single","Simple"],["onehalf","1.5 (recomendado)"],["double","Doble"]].map(([v,l]) => (
              <Chip key={v} value={v} current={draft.line_spacing} label={l} onClick={() => update({ line_spacing: draft.line_spacing === v ? undefined : v })} />
            ))}
          </OptionRow>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Márgenes — {draft.margin_cm ?? 2.5} cm
            </label>
            <input
              type="range"
              min={1.5} max={4.0} step={0.25}
              value={draft.margin_cm ?? 2.5}
              onChange={(e) => update({ margin_cm: parseFloat(e.target.value) })}
              style={{ accentColor: "var(--accent)", width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
              <span>1.5 cm (mínimo)</span>
              <span>4.0 cm (máximo)</span>
            </div>
          </div>
        </div>

        {/* Nota */}
        <div style={{ padding: "0 18px 10px", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.6 }}>
          Los cambios se aplicarán al compilar el siguiente PDF. Los valores sin seleccionar usarán los del perfil activo.
        </div>

        {/* Botones */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" disabled={saving} onClick={handleSave}>
            <IconCheck size={12} /> Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

