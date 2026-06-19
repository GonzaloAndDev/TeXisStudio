import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ChemEngineDocument, ChemElement, ChemFormula, ChemReaction, ChemStructure, ChemStructureTemplate } from "../../types-engines";

interface Props {
  doc: ChemEngineDocument;
  onChange: (updated: ChemEngineDocument) => void;
}

const ARROW_OPTIONS = ["->", "<->", "<=>", "->[above][below]"] as const;
const STATE_OPTIONS = ["", "s", "l", "g", "aq"] as const;
// Plantillas chemfig integradas (todas verificadas como compilables en el
// motor). Deben coincidir con ChemStructureTemplate.
const STRUCTURE_TEMPLATES: ChemStructureTemplate[] = [
  "benzene", "cyclohexane", "cyclopentane", "naphthalene",
  "phenol", "toluene", "aniline", "benzoic-acid",
  "methane", "ethanol", "acetic-acid", "glucose-chain",
];

function newFormula(): ChemFormula {
  return { type: "formula", text: "H2O" };
}

function newReaction(): ChemReaction {
  return {
    type: "reaction",
    reactants: [{ type: "formula", text: "A" }],
    products: [{ type: "formula", text: "B" }],
    arrow: "->",
  };
}

function newStructure(): ChemStructure {
  return { type: "structure", template: "benzene" };
}

export function ChemistryEditor({ doc, onChange }: Props) {
  const { t } = useTranslation();

  const updateElement = useCallback((idx: number, updated: ChemElement) => {
    const elements = doc.elements.map((el, i) => i === idx ? updated : el);
    onChange({ ...doc, elements });
  }, [doc, onChange]);

  const deleteElement = useCallback((idx: number) => {
    onChange({ ...doc, elements: doc.elements.filter((_, i) => i !== idx) });
  }, [doc, onChange]);

  const addFormula = useCallback(() => {
    onChange({ ...doc, elements: [...doc.elements, newFormula()] });
  }, [doc, onChange]);

  const addReaction = useCallback(() => {
    onChange({ ...doc, elements: [...doc.elements, newReaction()] });
  }, [doc, onChange]);

  const addStructure = useCallback(() => {
    onChange({ ...doc, elements: [...doc.elements, newStructure()] });
  }, [doc, onChange]);

  const updateReactant = useCallback((elIdx: number, rIdx: number, text: string) => {
    const el = doc.elements[elIdx] as ChemReaction;
    updateElement(elIdx, {
      ...el,
      reactants: el.reactants.map((f, i) => i === rIdx ? { ...f, text } : f),
    });
  }, [doc, updateElement]);

  const updateProduct = useCallback((elIdx: number, pIdx: number, text: string) => {
    const el = doc.elements[elIdx] as ChemReaction;
    updateElement(elIdx, {
      ...el,
      products: el.products.map((f, i) => i === pIdx ? { ...f, text } : f),
    });
  }, [doc, updateElement]);

  const addReactant = useCallback((elIdx: number) => {
    const el = doc.elements[elIdx] as ChemReaction;
    updateElement(elIdx, { ...el, reactants: [...el.reactants, { type: "formula", text: "" }] });
  }, [doc, updateElement]);

  const addProduct = useCallback((elIdx: number) => {
    const el = doc.elements[elIdx] as ChemReaction;
    updateElement(elIdx, { ...el, products: [...el.products, { type: "formula", text: "" }] });
  }, [doc, updateElement]);

  const removeReactant = useCallback((elIdx: number, rIdx: number) => {
    const el = doc.elements[elIdx] as ChemReaction;
    if (el.reactants.length <= 1) return;
    updateElement(elIdx, { ...el, reactants: el.reactants.filter((_, i) => i !== rIdx) });
  }, [doc, updateElement]);

  const removeProduct = useCallback((elIdx: number, pIdx: number) => {
    const el = doc.elements[elIdx] as ChemReaction;
    if (el.products.length <= 1) return;
    updateElement(elIdx, { ...el, products: el.products.filter((_, i) => i !== pIdx) });
  }, [doc, updateElement]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {doc.elements.map((el, idx) => (
        <div key={idx} style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={badgeStyle}>
              {el.type === "formula" ? t("chem.formula", "Fórmula")
                : el.type === "reaction" ? t("chem.reaction", "Reacción")
                : t("chem.structure", "Estructura")}
            </span>
            <button onClick={() => deleteElement(idx)} style={deleteBtnStyle} title={t("visual_editor.delete")}>✕</button>
          </div>

          {el.type === "formula" && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <label style={labelStyle}>{t("chem.formula_text", "Fórmula")}</label>
              <input
                value={el.text}
                onChange={(e) => updateElement(idx, { ...el, text: e.target.value })}
                placeholder="H2SO4"
                style={inputStyle}
              />
              <label style={labelStyle}>{t("chem.charge", "Carga")}</label>
              <input
                value={el.charge ?? ""}
                onChange={(e) => updateElement(idx, { ...el, charge: e.target.value || undefined })}
                placeholder="+, -, 2+"
                style={{ ...inputStyle, maxWidth: 60 }}
              />
              <label style={labelStyle}>{t("chem.state", "Estado")}</label>
              <select
                value={el.state ?? ""}
                onChange={(e) => updateElement(idx, { ...el, state: (e.target.value || undefined) as ChemFormula["state"] })}
                style={selectStyle}
              >
                {STATE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s === "" ? "—" : `(${s})`}</option>
                ))}
              </select>
            </div>
          )}

          {el.type === "reaction" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                {/* Reactants */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <span style={labelStyle}>{t("chem.reactants", "Reactivos")}</span>
                  {el.reactants.map((r, rIdx) => (
                    <div key={rIdx} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {rIdx > 0 && <span style={{ color: "var(--fg-faint)", fontSize: 12 }}>+</span>}
                      <input
                        value={r.text}
                        onChange={(e) => updateReactant(idx, rIdx, e.target.value)}
                        placeholder="H2"
                        style={inputStyle}
                      />
                      {el.reactants.length > 1 && (
                        <button onClick={() => removeReactant(idx, rIdx)} style={deleteBtnStyle} title="✕">✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addReactant(idx)} style={addSmallBtnStyle}>+ {t("chem.add_reactant", "Reactivo")}</button>
                </div>

                {/* Arrow */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center", paddingTop: 18 }}>
                  <select
                    value={el.arrow}
                    onChange={(e) => updateElement(idx, { ...el, arrow: e.target.value as ChemReaction["arrow"] })}
                    style={{ ...selectStyle, fontSize: 16 }}
                  >
                    {ARROW_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                {/* Products */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                  <span style={labelStyle}>{t("chem.products", "Productos")}</span>
                  {el.products.map((p, pIdx) => (
                    <div key={pIdx} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {pIdx > 0 && <span style={{ color: "var(--fg-faint)", fontSize: 12 }}>+</span>}
                      <input
                        value={p.text}
                        onChange={(e) => updateProduct(idx, pIdx, e.target.value)}
                        placeholder="H2O"
                        style={inputStyle}
                      />
                      {el.products.length > 1 && (
                        <button onClick={() => removeProduct(idx, pIdx)} style={deleteBtnStyle} title="✕">✕</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addProduct(idx)} style={addSmallBtnStyle}>+ {t("chem.add_product", "Producto")}</button>
                </div>
              </div>

              {/* Conditions */}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label style={labelStyle}>{t("chem.conditions_above", "Encima")}</label>
                <input
                  value={el.conditionsAbove ?? ""}
                  onChange={(e) => updateElement(idx, { ...el, conditionsAbove: e.target.value || undefined })}
                  placeholder={t("chem.conditions_hint", "Δ, hν, cat.")}
                  style={{ ...inputStyle, maxWidth: 110 }}
                />
                <label style={labelStyle}>{t("chem.conditions_below", "Debajo")}</label>
                <input
                  value={el.conditionsBelow ?? ""}
                  onChange={(e) => updateElement(idx, { ...el, conditionsBelow: e.target.value || undefined })}
                  placeholder={t("chem.conditions_hint", "Δ, hν, cat.")}
                  style={{ ...inputStyle, maxWidth: 110 }}
                />
              </div>
            </div>
          )}

          {el.type === "structure" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <label style={labelStyle}>{t("chem.template", "Plantilla")}</label>
                <select
                  value={el.template ?? ""}
                  onChange={(e) => updateElement(idx, { ...el, template: (e.target.value || undefined) as ChemStructureTemplate | undefined })}
                  style={selectStyle}
                >
                  <option value="">{t("chem.template_custom", "— personalizada (chemfig) —")}</option>
                  {STRUCTURE_TEMPLATES.map((tpl) => (
                    <option key={tpl} value={tpl}>{t(`chem.tpl_${tpl}`, tpl)}</option>
                  ))}
                </select>
              </div>
              {/* Escape hatch: chemfig crudo. Tiene prioridad sobre la plantilla. */}
              <label style={labelStyle}>{t("chem.chemfig_source", "chemfig crudo (avanzado, opcional)")}</label>
              <textarea
                value={el.chemfigSource ?? ""}
                onChange={(e) => updateElement(idx, { ...el, chemfigSource: e.target.value || undefined })}
                placeholder={"\\chemfig{*6(=-=-=-)}"}
                spellCheck={false}
                rows={2}
                style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12, width: "100%", boxSizing: "border-box", resize: "vertical" }}
              />
              <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                {el.chemfigSource?.trim()
                  ? t("chem.chemfig_overrides", "El chemfig crudo se usará en vez de la plantilla.")
                  : t("chem.template_hint", "Elige una plantilla; o escribe chemfig crudo para estructuras a medida.")}
              </span>
            </div>
          )}
        </div>
      ))}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={addFormula} style={addBtnStyle}>+ {t("chem.add_formula", "Fórmula")}</button>
        <button onClick={addReaction} style={addBtnStyle}>+ {t("chem.add_reaction", "Reacción")}</button>
        <button onClick={addStructure} style={addBtnStyle}>+ {t("chem.add_structure", "Estructura")}</button>
      </div>

      {doc.elements.length === 0 && (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textAlign: "center", padding: "16px 0" }}>
          {t("chem.empty_hint", "Añade una fórmula o una reacción para empezar.")}
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-app)",
  border: "1px solid var(--border-soft)",
  borderRadius: "var(--r-sm)",
  padding: "8px 10px",
};
const badgeStyle: React.CSSProperties = {
  fontSize: 10, padding: "2px 6px", borderRadius: "var(--r-xs)",
  background: "var(--accent-dim, color-mix(in srgb, var(--accent) 15%, transparent))",
  color: "var(--accent)",
  flex: 1,
};
const labelStyle: React.CSSProperties = {
  fontSize: "var(--fs-xs)", color: "var(--fg-muted)", whiteSpace: "nowrap",
};
const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 60, padding: "4px 7px",
  borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)",
};
const selectStyle: React.CSSProperties = {
  padding: "4px 5px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)",
};
const deleteBtnStyle: React.CSSProperties = {
  padding: "2px 6px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "transparent", color: "var(--fg-faint)", cursor: "pointer", fontSize: 11, flexShrink: 0,
};
const addBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: "var(--r-sm)", border: "1px dashed var(--border-firm)",
  background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: "var(--fs-xs)",
};
const addSmallBtnStyle: React.CSSProperties = {
  padding: "3px 8px", borderRadius: "var(--r-xs)", border: "1px dashed var(--border-firm)",
  background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: "var(--fs-xs)",
  alignSelf: "flex-start",
};
