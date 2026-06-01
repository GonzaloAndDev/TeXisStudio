import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconCheck, IconX } from "../../components/Icons";
import type { ExtraTheorem, LatexTypography, PreambleConfig } from "../../types";
import { useSettingsStore } from "../../stores/settings";

// ── Tipos combinados ──────────────────────────────────────────────

export interface DocumentOptions {
  typography: LatexTypography;
  preamble: PreambleConfig;
}

const documentOptionsCopy = {
  es: {
    title: "Opciones del documento",
    typography: "Tipografía",
    fontSize: "Tamaño de fuente",
    paperSize: "Tamaño de papel",
    letter: "Carta",
    lineSpacing: "Interlineado",
    single: "Simple",
    double: "Doble",
    margins: "Márgenes",
    cjkFonts: "Fuentes CJK",
    cjkDetected: "Detectamos texto en chino o japonés en tu documento. xeCJK se activó automáticamente con",
    cjkChange: "Puedes cambiar la fuente aquí.",
    cjkMainFont: "Fuente principal (chino/coreano)",
    exactSystemName: "nombre exacto del sistema",
    japaneseFont: "Fuente japonesa",
    japaneseHint: "opcional, override para japonés",
    koreanFont: "Fuente coreana",
    documentFonts: "Fuentes del documento",
    mainFont: "Fuente principal",
    profileOverride: "override sobre el perfil",
    sansFont: "Fuente sans-serif",
    monoFont: "Fuente monoespaciada",
    example: "ej.",
    mathOperators: "Operadores matemáticos",
    mathHint: "Genera",
    inPreamble: "en el preámbulo.",
    add: "+ Añadir",
    extraTheorems: "Entornos de teoremas adicionales",
    hypothesis: "Hipótesis",
    extraPreamble: "Preámbulo adicional",
    latexWarning: "Este campo acepta LaTeX arbitrario. Un error aquí puede impedir que el documento compile.",
    latexPlaceholder: "% ej:\n\\hypersetup{colorlinks=true, linkcolor=blue}\n\\newcommand{\\R}{\\mathbb{R}}",
    footer: "Los cambios se aplican al compilar el siguiente PDF.",
    advancedHint: " Activa el modo avanzado para ver fuentes, operadores y preámbulo extra.",
    cancel: "Cancelar",
    apply: "Aplicar",
  },
  en: {
    title: "Document options",
    typography: "Typography",
    fontSize: "Font size",
    paperSize: "Paper size",
    letter: "Letter",
    lineSpacing: "Line spacing",
    single: "Single",
    double: "Double",
    margins: "Margins",
    cjkFonts: "CJK fonts",
    cjkDetected: "Chinese or Japanese text was detected in your document. xeCJK was enabled automatically with",
    cjkChange: "You can change the font here.",
    cjkMainFont: "Main font (Chinese/Korean)",
    exactSystemName: "exact system name",
    japaneseFont: "Japanese font",
    japaneseHint: "optional override for Japanese",
    koreanFont: "Korean font",
    documentFonts: "Document fonts",
    mainFont: "Main font",
    profileOverride: "override from the profile",
    sansFont: "Sans-serif font",
    monoFont: "Monospace font",
    example: "e.g.",
    mathOperators: "Math operators",
    mathHint: "Generates",
    inPreamble: "in the preamble.",
    add: "+ Add",
    extraTheorems: "Additional theorem environments",
    hypothesis: "Hypothesis",
    extraPreamble: "Additional preamble",
    latexWarning: "This field accepts arbitrary LaTeX. An error here can prevent the document from compiling.",
    latexPlaceholder: "% e.g.:\n\\hypersetup{colorlinks=true, linkcolor=blue}\n\\newcommand{\\R}{\\mathbb{R}}",
    footer: "Changes apply the next time you compile the PDF.",
    advancedHint: " Enable advanced mode to see fonts, operators, and extra preamble settings.",
    cancel: "Cancel",
    apply: "Apply",
  },
};

// ── Componentes pequeños ──────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.08em", color: "var(--fg-faint)",
      borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6,
    }}>
      {label}
    </div>
  );
}

function OptionRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", fontWeight: 600 }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: "var(--fg-faint)", marginLeft: 6 }}>{hint}</span>}
      </label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Chip({ value, current, label, onClick }: {
  value: string; current?: string; label: string; onClick: () => void;
}) {
  return (
    <button
      className={`btn btn-sm ${current === value ? "btn-accent" : "btn-ghost"}`}
      onClick={onClick}
      style={{ padding: "4px 14px", fontSize: "var(--fs-xs)" }}
    >
      {label}
      {current === value && <IconCheck size={9} sw={2.5} />}
    </button>
  );
}

function TextInput({ value, onChange, placeholder, mono }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "6px 10px", borderRadius: "var(--r-sm)",
        border: "1px solid var(--border-firm)", background: "var(--bg-surface)",
        color: "var(--fg-strong)", fontSize: mono ? 12 : "var(--fs-sm)",
        fontFamily: mono ? "var(--font-mono)" : undefined, outline: "none",
      }}
    />
  );
}

// ── Panel principal ───────────────────────────────────────────────

export function DocumentOptionsPanel({
  typography,
  preamble,
  hasCjkContent,
  onSave,
  onClose,
}: {
  typography: LatexTypography;
  preamble: PreambleConfig;
  /** true si el generador detectó caracteres CJK en el documento */
  hasCjkContent?: boolean;
  onSave: (opts: DocumentOptions) => void;
  onClose: () => void;
}) {
  const { userMode } = useSettingsStore();
  const { i18n } = useTranslation();
  const isAdvanced = userMode === "advanced";
  const copy = i18n.language?.startsWith("en") ? documentOptionsCopy.en : documentOptionsCopy.es;

  const [typo, setTypo] = useState<LatexTypography>({ ...typography });
  const [pc, setPc]     = useState<PreambleConfig>({ ...preamble });
  const [saving, setSaving] = useState(false);

  const updateTypo = (patch: Partial<LatexTypography>) =>
    setTypo((d) => ({ ...d, ...patch }));
  const updatePc = (patch: Partial<PreambleConfig>) =>
    setPc((d) => ({ ...d, ...patch }));

  const showCjkSection = hasCjkContent
    || !!(pc.cjk_main_font || pc.cjk_japanese_font || pc.cjk_korean_font);

  // Operadores matemáticos
  const [newOp, setNewOp] = useState({ command: "", text: "" });
  const addOp = () => {
    if (!newOp.command.trim()) return;
    updatePc({ math_operators: [...(pc.math_operators ?? []), { ...newOp }] });
    setNewOp({ command: "", text: "" });
  };
  const removeOp = (i: number) =>
    updatePc({ math_operators: (pc.math_operators ?? []).filter((_, j) => j !== i) });

  // Teoremas extra
  const [newThm, setNewThm] = useState<ExtraTheorem>({ id: "", label: "", numbered: true });
  const addThm = () => {
    if (!newThm.id.trim() || !newThm.label.trim()) return;
    updatePc({ extra_theorems: [...(pc.extra_theorems ?? []), { ...newThm }] });
    setNewThm({ id: "", label: "", numbered: true });
  };
  const removeThm = (i: number) =>
    updatePc({ extra_theorems: (pc.extra_theorems ?? []).filter((_, j) => j !== i) });

  const handleSave = async () => {
    setSaving(true);
    try { await onSave({ typography: typo, preamble: pc }); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 900,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 500, maxHeight: "88vh",
          background: "var(--bg-chrome)", borderRadius: "var(--r-lg)",
          border: "1px solid var(--border-firm)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", flexShrink: 0,
        }}>
          <span style={{ flex: 1, fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>
            {copy.title}
          </span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <IconX size={13} />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div style={{ flex: 1, overflow: "auto", padding: "18px" }} className="scroll">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Tipografía ── */}
            <SectionTitle label={copy.typography} />

            <OptionRow label={copy.fontSize}>
              {[["10pt","10"], ["11pt","11"], ["12pt","12 (rec.)"]] .map(([v, l]) => (
                <Chip key={v} value={v} current={typo.font_size} label={l}
                  onClick={() => updateTypo({ font_size: typo.font_size === v ? undefined : v })} />
              ))}
            </OptionRow>

            <OptionRow label={copy.paperSize}>
              {[["a4paper","A4"], ["letterpaper", copy.letter]].map(([v, l]) => (
                <Chip key={v} value={v} current={typo.paper_size} label={l}
                  onClick={() => updateTypo({ paper_size: typo.paper_size === v ? undefined : v })} />
              ))}
            </OptionRow>

            <OptionRow label={copy.lineSpacing}>
              {[["single", copy.single],["onehalf","1.5 (rec.)"],["double", copy.double]].map(([v, l]) => (
                <Chip key={v} value={v} current={typo.line_spacing} label={l}
                  onClick={() => updateTypo({ line_spacing: typo.line_spacing === v ? undefined : v })} />
              ))}
            </OptionRow>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", fontWeight: 600 }}>
                {copy.margins} - {typo.margin_cm ?? 2.5} cm
              </label>
              <input type="range" min={1.5} max={4.0} step={0.25}
                value={typo.margin_cm ?? 2.5}
                onChange={(e) => updateTypo({ margin_cm: parseFloat(e.target.value) })}
                style={{ accentColor: "var(--accent)", width: "100%" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
                <span>1.5 cm</span><span>4.0 cm</span>
              </div>
            </div>

            {/* ── Fuentes CJK ── */}
            {showCjkSection && (
              <>
                <SectionTitle label={copy.cjkFonts} />
                {hasCjkContent && (
                  <div style={{
                    padding: "8px 12px", borderRadius: "var(--r-sm)",
                    background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
                    fontSize: "var(--fs-xs)", color: "var(--accent-deep)",
                    display: "flex", gap: 8, alignItems: "flex-start",
                  }}>
                    <span style={{ flexShrink: 0 }}>✓</span>
                    <span>
                      {copy.cjkDetected} <strong>{pc.cjk_main_font || "Heiti SC"}</strong>.
                      {" "}{copy.cjkChange}
                    </span>
                  </div>
                )}
                <OptionRow label={copy.cjkMainFont} hint={copy.exactSystemName}>
                  <TextInput
                    value={pc.cjk_main_font ?? ""}
                    onChange={(v) => updatePc({ cjk_main_font: v || undefined })}
                    placeholder="Heiti SC"
                  />
                </OptionRow>
                <OptionRow label={copy.japaneseFont} hint={copy.japaneseHint}>
                  <TextInput
                    value={pc.cjk_japanese_font ?? ""}
                    onChange={(v) => updatePc({ cjk_japanese_font: v || undefined })}
                    placeholder="Hiragino Mincho ProN"
                  />
                </OptionRow>
                {isAdvanced && (
                  <OptionRow label={copy.koreanFont}>
                    <TextInput
                      value={pc.cjk_korean_font ?? ""}
                      onChange={(v) => updatePc({ cjk_korean_font: v || undefined })}
                      placeholder="AppleGothic"
                    />
                  </OptionRow>
                )}
              </>
            )}

            {/* ── Fuentes del documento (solo avanzado) ── */}
            {isAdvanced && (
              <>
                <SectionTitle label={copy.documentFonts} />
                <OptionRow label={copy.mainFont} hint={copy.profileOverride}>
                  <TextInput value={pc.main_font ?? ""} onChange={(v) => updatePc({ main_font: v || undefined })}
                    placeholder={`${copy.example} Times New Roman`} />
                </OptionRow>
                <OptionRow label={copy.sansFont}>
                  <TextInput value={pc.sans_font ?? ""} onChange={(v) => updatePc({ sans_font: v || undefined })}
                    placeholder={`${copy.example} Helvetica Neue`} />
                </OptionRow>
                <OptionRow label={copy.monoFont}>
                  <TextInput value={pc.mono_font ?? ""} onChange={(v) => updatePc({ mono_font: v || undefined })}
                    placeholder={`${copy.example} Fira Code`} />
                </OptionRow>
              </>
            )}

            {/* ── Operadores matemáticos ── */}
            {isAdvanced && (
              <>
                <SectionTitle label={copy.mathOperators} />
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.5, marginTop: -8 }}>
                  {copy.mathHint} <code style={{ fontFamily: "var(--font-mono)", background: "var(--bg-sunken)", padding: "1px 4px", borderRadius: 3 }}>
                    \DeclareMathOperator{`{\\cmd}{text}`}
                  </code> {copy.inPreamble}
                </div>
                {(pc.math_operators ?? []).map((op, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <code style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-strong)",
                      background: "var(--bg-sunken)", padding: "4px 8px", borderRadius: "var(--r-sm)" }}>
                      \{op.command} → {op.text}
                    </code>
                    <button className="btn btn-ghost btn-icon" onClick={() => removeOp(i)}>
                      <IconX size={11} />
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6 }}>
                  <TextInput value={newOp.command} onChange={(v) => setNewOp(o => ({ ...o, command: v }))}
                    placeholder="rank" mono />
                  <TextInput value={newOp.text} onChange={(v) => setNewOp(o => ({ ...o, text: v }))}
                    placeholder="rank" mono />
                  <button className="btn btn-ghost btn-sm" onClick={addOp}
                    style={{ flexShrink: 0, fontSize: "var(--fs-xs)" }}>{copy.add}</button>
                </div>
              </>
            )}

            {/* ── Teoremas adicionales ── */}
            {isAdvanced && (
              <>
                <SectionTitle label={copy.extraTheorems} />
                {(pc.extra_theorems ?? []).map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <code style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-strong)",
                      background: "var(--bg-sunken)", padding: "4px 8px", borderRadius: "var(--r-sm)" }}>
                      {t.id} → "{t.label}"{t.parent_counter ? ` [${t.parent_counter}]` : ""}
                    </code>
                    <button className="btn btn-ghost btn-icon" onClick={() => removeThm(i)}>
                      <IconX size={11} />
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6 }}>
                  <TextInput value={newThm.id} onChange={(v) => setNewThm(t => ({ ...t, id: v }))}
                    placeholder="hypothesis" mono />
                  <TextInput value={newThm.label} onChange={(v) => setNewThm(t => ({ ...t, label: v }))}
                    placeholder={copy.hypothesis} />
                  <button className="btn btn-ghost btn-sm" onClick={addThm}
                    style={{ flexShrink: 0, fontSize: "var(--fs-xs)" }}>{copy.add}</button>
                </div>
              </>
            )}

            {/* ── Preámbulo extra (solo avanzado) ── */}
            {isAdvanced && (
              <>
                <SectionTitle label={copy.extraPreamble} />
                <div style={{
                  padding: "8px 10px", borderRadius: "var(--r-sm)",
                  background: "color-mix(in srgb, var(--build-warn) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--build-warn) 30%, transparent)",
                  fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5,
                }}>
                  ⚠ {copy.latexWarning}
                </div>
                <textarea
                  value={pc.extra ?? ""}
                  onChange={(e) => updatePc({ extra: e.target.value || undefined })}
                  placeholder={copy.latexPlaceholder}
                  rows={5}
                  style={{
                    width: "100%", padding: "8px 10px", borderRadius: "var(--r-sm)",
                    border: "1px solid var(--border-firm)", background: "var(--bg-surface)",
                    color: "var(--fg-strong)", fontSize: 12, fontFamily: "var(--font-mono)",
                    resize: "vertical", outline: "none", lineHeight: 1.5, boxSizing: "border-box",
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 14px 10px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 10, lineHeight: 1.5 }}>
            {copy.footer}
            {!isAdvanced && (
              <span style={{ color: "var(--accent-deep)" }}>{copy.advancedHint}</span>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>{copy.cancel}</button>
            <button className="btn btn-accent" disabled={saving} onClick={handleSave}>
              <IconCheck size={12} /> {copy.apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
