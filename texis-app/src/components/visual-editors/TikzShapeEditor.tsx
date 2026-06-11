import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TikzShapeDocument, TikzShape, ShapeType, LineStyle, Coordinate } from "../../types-engines";

interface Props {
  doc: TikzShapeDocument;
  onChange: (updated: TikzShapeDocument) => void;
}

const SHAPE_TYPES: ShapeType[] = [
  "point", "line", "arrow", "rectangle", "circle", "ellipse",
  "polygon", "arc", "bezier", "label", "axis", "vector", "angle",
];

const LINE_STYLES: LineStyle[] = ["solid", "dashed", "dotted", "densely-dashed"];

const COORD_UNITS = ["cm", "pt", "mm"] as const;

function nextId(existing: string[]): string {
  const used = new Set(existing);
  let i = 1;
  while (used.has(`s${i}`)) i++;
  return `s${i}`;
}

function defaultCoordsForType(type: ShapeType): Coordinate[] {
  switch (type) {
    case "point":   return [{ x: 0, y: 0 }];
    case "label":   return [{ x: 0, y: 0 }];
    case "circle":  return [{ x: 0, y: 0 }];
    case "ellipse": return [{ x: 0, y: 0 }];
    case "axis":    return [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 4 }];
    default:        return [{ x: 0, y: 0 }, { x: 2, y: 2 }];
  }
}

export function TikzShapeEditor({ doc, onChange }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"shapes" | "canvas">("shapes");

  const shapeIds = doc.shapes.map((s) => s.id);

  // ── Shape CRUD ──────────────────────────────────────────────────

  const updateShape = useCallback((id: string, patch: Partial<TikzShape>) => {
    onChange({ ...doc, shapes: doc.shapes.map((s) => s.id === id ? { ...s, ...patch } : s) });
  }, [doc, onChange]);

  const deleteShape = useCallback((id: string) => {
    onChange({ ...doc, shapes: doc.shapes.filter((s) => s.id !== id) });
  }, [doc, onChange]);

  const addShape = useCallback(() => {
    const id = nextId(shapeIds);
    const type: ShapeType = "line";
    onChange({ ...doc, shapes: [...doc.shapes, { id, type, coords: defaultCoordsForType(type) }] });
  }, [doc, onChange, shapeIds]);

  const changeShapeType = useCallback((id: string, type: ShapeType) => {
    updateShape(id, { type, coords: defaultCoordsForType(type) });
  }, [updateShape]);

  // ── Coordinate editing ──────────────────────────────────────────

  const updateCoord = useCallback((shapeId: string, coordIdx: number, field: keyof Coordinate, val: string | number) => {
    const shape = doc.shapes.find((s) => s.id === shapeId);
    if (!shape) return;
    const coords = shape.coords.map((c, i) =>
      i === coordIdx ? { ...c, [field]: field === "unit" ? val : Number(val) } : c
    );
    updateShape(shapeId, { coords });
  }, [doc.shapes, updateShape]);

  const addCoord = useCallback((shapeId: string) => {
    const shape = doc.shapes.find((s) => s.id === shapeId);
    if (!shape) return;
    const last = shape.coords[shape.coords.length - 1] ?? { x: 0, y: 0 };
    updateShape(shapeId, { coords: [...shape.coords, { x: last.x + 1, y: last.y }] });
  }, [doc.shapes, updateShape]);

  const removeCoord = useCallback((shapeId: string, coordIdx: number) => {
    const shape = doc.shapes.find((s) => s.id === shapeId);
    if (!shape || shape.coords.length <= 1) return;
    updateShape(shapeId, { coords: shape.coords.filter((_, i) => i !== coordIdx) });
  }, [doc.shapes, updateShape]);

  // ── Canvas settings ─────────────────────────────────────────────

  const updateViewBox = useCallback((field: "width" | "height" | "unit", val: string) => {
    const vb = { ...doc.viewBox, [field]: field === "unit" ? val : Number(val) };
    onChange({ ...doc, viewBox: vb });
  }, [doc, onChange]);

  const updateLibraries = useCallback((val: string) => {
    onChange({ ...doc, tikzLibraries: val.split(",").map((s) => s.trim()).filter(Boolean) });
  }, [doc, onChange]);

  const tabs = ["shapes", "canvas"] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-soft)", marginBottom: 10 }}>
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "5px 14px", border: "none",
            borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
            background: "transparent",
            color: activeTab === tab ? "var(--accent)" : "var(--fg-muted)",
            fontSize: "var(--fs-sm)", cursor: "pointer",
            fontWeight: activeTab === tab ? 600 : 400,
          }}>
            {tab === "shapes"
              ? `${t("tikz.shapes", "Formas")} (${doc.shapes.length})`
              : t("tikz.canvas", "Lienzo")}
          </button>
        ))}
      </div>

      {activeTab === "shapes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {doc.shapes.map((shape) => (
            <div key={shape.id} style={cardStyle}>
              {/* Header row: id + type + line style + color + delete */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={idBadge}>{shape.id}</span>
                <select
                  value={shape.type}
                  onChange={(e) => changeShapeType(shape.id, e.target.value as ShapeType)}
                  style={selectStyle}
                >
                  {SHAPE_TYPES.map((st) => (
                    <option key={st} value={st}>{t(`tikz.type_${st}`, st)}</option>
                  ))}
                </select>
                <select
                  value={shape.lineStyle ?? "solid"}
                  onChange={(e) => updateShape(shape.id, { lineStyle: e.target.value as LineStyle })}
                  style={{ ...selectStyle, minWidth: 90 }}
                >
                  {LINE_STYLES.map((ls) => (
                    <option key={ls} value={ls}>{t(`tikz.ls_${ls.replace("-", "_")}`, ls)}</option>
                  ))}
                </select>
                <input
                  type="color"
                  value={shape.color ?? "#000000"}
                  onChange={(e) => updateShape(shape.id, { color: e.target.value })}
                  style={{ width: 28, height: 24, padding: 1, border: "1px solid var(--border-soft)", borderRadius: "var(--r-xs)", cursor: "pointer", background: "none" }}
                  title={t("tikz.color", "Color")}
                />
                <button onClick={() => deleteShape(shape.id)} style={deleteBtnStyle} title={t("visual_editor.delete")}>✕</button>
              </div>

              {/* Label + options */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                <span style={labelStyleSmall}>{t("tikz.label", "Etiq.")}</span>
                <input
                  value={shape.label ?? ""}
                  onChange={(e) => updateShape(shape.id, { label: e.target.value || undefined })}
                  placeholder={t("tikz.label_hint", "Texto (opc.)")}
                  style={{ ...inputStyle, maxWidth: 110 }}
                />
                <span style={labelStyleSmall}>{t("tikz.options", "Opciones")}</span>
                <input
                  value={shape.options ?? ""}
                  onChange={(e) => updateShape(shape.id, { options: e.target.value || undefined })}
                  placeholder="thick, fill=blue!20..."
                  style={inputStyle}
                />
              </div>

              {/* Coordinates */}
              <div style={{ marginTop: 6, paddingLeft: 6, borderLeft: "2px solid var(--border-soft)" }}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4 }}>
                  {t("tikz.coords", "Coordenadas")}
                </div>
                {shape.coords.map((coord, ci) => (
                  <div key={ci} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 3 }}>
                    <span style={{ ...labelStyleSmall, minWidth: 14 }}>P{ci + 1}</span>
                    <span style={labelStyleSmall}>x</span>
                    <input
                      type="number"
                      value={coord.x}
                      onChange={(e) => updateCoord(shape.id, ci, "x", e.target.value)}
                      style={{ ...inputStyle, maxWidth: 52 }}
                    />
                    <span style={labelStyleSmall}>y</span>
                    <input
                      type="number"
                      value={coord.y}
                      onChange={(e) => updateCoord(shape.id, ci, "y", e.target.value)}
                      style={{ ...inputStyle, maxWidth: 52 }}
                    />
                    <select
                      value={coord.unit ?? "cm"}
                      onChange={(e) => updateCoord(shape.id, ci, "unit", e.target.value)}
                      style={{ ...selectStyle, minWidth: 46 }}
                    >
                      {COORD_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                    {shape.coords.length > 1 && (
                      <button onClick={() => removeCoord(shape.id, ci)} style={deleteBtnStyle}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => addCoord(shape.id)} style={{ ...addBtnStyle, fontSize: 10, padding: "3px 8px" }}>
                  + {t("tikz.add_coord", "Coord.")}
                </button>
              </div>
            </div>
          ))}
          <button onClick={addShape} style={addBtnStyle}>+ {t("tikz.add_shape", "Forma")}</button>
        </div>
      )}

      {activeTab === "canvas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: 8, fontWeight: 600 }}>
              {t("tikz.viewbox", "Tamaño del lienzo")}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={labelStyleSmall}>{t("tikz.width", "Ancho")}</span>
              <input
                type="number"
                value={doc.viewBox.width}
                onChange={(e) => updateViewBox("width", e.target.value)}
                style={{ ...inputStyle, maxWidth: 60 }}
              />
              <span style={labelStyleSmall}>{t("tikz.height", "Alto")}</span>
              <input
                type="number"
                value={doc.viewBox.height}
                onChange={(e) => updateViewBox("height", e.target.value)}
                style={{ ...inputStyle, maxWidth: 60 }}
              />
              <select
                value={doc.viewBox.unit}
                onChange={(e) => updateViewBox("unit", e.target.value)}
                style={selectStyle}
              >
                {["cm", "pt", "mm", "in"].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: 6, fontWeight: 600 }}>
              {t("tikz.libraries", "Bibliotecas TikZ")}
            </div>
            <input
              value={doc.tikzLibraries.join(", ")}
              onChange={(e) => updateLibraries(e.target.value)}
              placeholder="arrows.meta, shapes.geometric..."
              style={inputStyle}
            />
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 4 }}>
              {t("tikz.libraries_hint", "Separadas por coma. Se añaden a \\usetikzlibrary{...}.")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-app)", border: "1px solid var(--border-soft)",
  borderRadius: "var(--r-sm)", padding: "6px 8px",
};
const idBadge: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10,
  color: "var(--fg-faint)", minWidth: 28, flexShrink: 0,
};
const labelStyleSmall: React.CSSProperties = {
  fontSize: "var(--fs-xs)", color: "var(--fg-muted)", whiteSpace: "nowrap", flexShrink: 0,
};
const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 50, padding: "4px 7px",
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
  alignSelf: "flex-start",
};
