/**
 * Visual editor for pgfplots-engine documents.
 * Used by: FunctionPlots2D, BasicStatistics, BarCharts, HeatMaps,
 *          ScatterRegression, ErrorBars, TimeSeriesPlugin, etc.
 *
 * No LaTeX required: users fill in expressions and options with plain text.
 * Data-driven series (bar, scatter, histogram) get a mini x/y table editor.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { PGFPlotsDocument, DataSeries } from "../../types-engines";
import { applyPlotTypeChange, parseFiniteNumberDraft, EXTRA_COL_FOR_TYPE } from "./transforms";

const AXIS_SCALES = ["linear", "log", "semilogx", "semilogy"] as const;
const PLOT_TYPES  = ["function2d", "scatter", "bar", "histogram", "boxplot", "errorbar", "heatmap"] as const;
const COLORS      = ["blue", "red", "green", "orange", "purple", "teal", "black", "gray"] as const;

interface Props {
  doc: PGFPlotsDocument;
  onChange: (updated: PGFPlotsDocument) => void;
}

function nextSeriesId(existingIds: string[]): string {
  const used = new Set(existingIds);
  let i = 1;
  while (used.has(`s${i}`)) i++;
  return `s${i}`;
}

export function PGFPlotsEditor({ doc, onChange }: Props) {
  const { t } = useTranslation();

  const updateSeries = useCallback((id: string, patch: Partial<DataSeries>) => {
    onChange({ ...doc, series: doc.series.map((s) => s.id === id ? { ...s, ...patch } : s) });
  }, [doc, onChange]);

  const deleteSeries = useCallback((id: string) => {
    onChange({ ...doc, series: doc.series.filter((s) => s.id !== id) });
  }, [doc, onChange]);

  const addSeries = useCallback(() => {
    const id = nextSeriesId(doc.series.map((s) => s.id));
    onChange({
      ...doc,
      series: [...doc.series, { id, label: t("visual_editor.series_default"), plotType: "function2d", expression: "x^2", domain: [-3, 3] }],
    });
  }, [doc, onChange, t]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Axis settings */}
      <div style={{ background: "var(--bg-app)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "8px 10px" }}>
        <div style={sectionTitle}>{t("visual_editor.axes")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <LabeledInput label={t("visual_editor.x_label")} value={doc.xLabel} onChange={(v) => onChange({ ...doc, xLabel: v })} placeholder="x" />
          <LabeledInput label={t("visual_editor.y_label")} value={doc.yLabel} onChange={(v) => onChange({ ...doc, yLabel: v })} placeholder="y" />
          <LabeledSelect label={t("visual_editor.x_scale")} value={doc.xScale} onChange={(v) => onChange({ ...doc, xScale: v as PGFPlotsDocument["xScale"] })} options={AXIS_SCALES} />
          <LabeledSelect label={t("visual_editor.y_scale")} value={doc.yScale} onChange={(v) => onChange({ ...doc, yScale: v as PGFPlotsDocument["yScale"] })} options={AXIS_SCALES} />
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <CheckRow label={t("visual_editor.show_legend")} checked={doc.showLegend} onChange={(v) => onChange({ ...doc, showLegend: v })} />
          <CheckRow label={t("visual_editor.show_grid")} checked={!!doc.grid} onChange={(v) => onChange({ ...doc, grid: v })} />
        </div>
      </div>

      {/* Series list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={sectionTitle}>{t("visual_editor.series")} ({doc.series.length})</div>
        {doc.series.map((s) => (
          <div key={s.id} style={{ background: "var(--bg-app)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", minWidth: 20 }}>{s.id}</span>
              <input
                value={s.label}
                onChange={(e) => updateSeries(s.id, { label: e.target.value })}
                placeholder={t("visual_editor.series_label")}
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={s.plotType}
                onChange={(e) => {
                  const newType = e.target.value as DataSeries["plotType"];
                  updateSeries(s.id, applyPlotTypeChange(s, newType));
                }}
                style={selectStyle}
              >
                {PLOT_TYPES.map((pt) => <option key={pt} value={pt}>{t(`visual_editor.plot_${pt}`, pt)}</option>)}
              </select>
              <select value={s.color ?? ""} onChange={(e) => updateSeries(s.id, { color: e.target.value || undefined })} style={selectStyle}>
                <option value="">{t("visual_editor.auto_color")}</option>
                {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => deleteSeries(s.id)} style={deleteBtnStyle}>✕</button>
            </div>
            {/* Function2D: expression + domain */}
            {s.plotType === "function2d" && (
              <div style={{ display: "flex", gap: 6 }}>
                <LabeledInput label={t("visual_editor.expression")} value={s.expression ?? ""} onChange={(v) => updateSeries(s.id, { expression: v })} placeholder="sin(x)" mono />
                <LabeledInput label={t("visual_editor.domain_from")} value={String(s.domain?.[0] ?? -5)} onChange={(v) => updateSeries(s.id, { domain: [parseFloat(v) || 0, s.domain?.[1] ?? 5] })} placeholder="-5" mono small />
                <LabeledInput label={t("visual_editor.domain_to")} value={String(s.domain?.[1] ?? 5)} onChange={(v) => updateSeries(s.id, { domain: [s.domain?.[0] ?? -5, parseFloat(v) || 0] })} placeholder="5" mono small />
              </div>
            )}
            {/* Data-driven series: editable x/y(+extra) table */}
            {(s.plotType === "scatter" || s.plotType === "bar" || s.plotType === "histogram" ||
              s.plotType === "boxplot" || s.plotType === "errorbar" || s.plotType === "heatmap") && (
              <DataPointsEditor series={s} onChange={(patch) => updateSeries(s.id, patch)} t={t} />
            )}
            {/* Types with no visual editor — show hint instead of breaking */}
            {(s.plotType === "surface" || s.plotType === "contour" || s.plotType === "parametric" || s.plotType === "polar") && (
              <div style={{ fontSize: 10, color: "var(--build-warn, #f5a623)", padding: "3px 0" }}>
                {t("visual_editor.plot_type_advanced", { type: s.plotType })}
              </div>
            )}
          </div>
        ))}
        <button onClick={addSeries} style={addBtnStyle}>+ {t("visual_editor.add_series")}</button>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function LabeledInput({ label, value, onChange, placeholder, mono, small }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; small?: boolean; }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: small ? "0 0 70px" : 1 }}>
      <span style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, fontFamily: mono ? "var(--font-mono)" : undefined }} />
    </div>
  );
}

/** Mini table editor for data-driven series. Supports an optional third column
 *  (error for errorbar/boxplot, meta for heatmap). */
function DataPointsEditor({
  series,
  onChange,
  t,
}: {
  series: DataSeries;
  onChange: (patch: Partial<DataSeries>) => void;
  t: TFunction;
}) {
  const points = series.data ?? [];
  const extraCol = EXTRA_COL_FOR_TYPE[series.plotType] ?? null;

  type DraftRow = { x: string; y: string; z?: string };

  const rowFromPoint = (p: NonNullable<DataSeries["data"]>[number]): DraftRow => ({
    x: String(p.x),
    y: String(p.y),
    ...(extraCol ? { z: String(p[extraCol.field] ?? extraCol.defaultValue(p)) } : {}),
  });

  const [draftRows, setDraftRows] = useState<DraftRow[]>(() => points.map(rowFromPoint));

  // Resync when external data or plotType changes (undo, regeneration, type switch).
  useEffect(() => {
    setDraftRows((series.data ?? []).map(rowFromPoint));
  // rowFromPoint is recreated each render but depends only on series.plotType
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series.data, series.plotType]);

  const writeData = (newData: NonNullable<DataSeries["data"]>) => onChange({ data: newData });

  const handleChange = (idx: number, col: "x" | "y" | "z", raw: string) => {
    setDraftRows((prev) => prev.map((r, i) => i === idx ? { ...r, [col]: raw } : r));
  };

  const handleBlur = (idx: number, col: "x" | "y" | "z") => {
    const raw = draftRows[idx]?.[col];
    if (raw === undefined) return;
    const value = parseFiniteNumberDraft(raw);
    if (value !== null) {
      const docField = col === "z" ? extraCol!.field : col;
      writeData(points.map((p, i) => i === idx ? { ...p, [docField]: value } : p));
      setDraftRows((prev) => prev.map((r, i) => i === idx ? { ...r, [col]: String(value) } : r));
    } else {
      const p = points[idx] ?? { x: 0, y: 0 };
      const committed = col === "z"
        ? (extraCol ? (p[extraCol.field] ?? extraCol.defaultValue(p)) : 0)
        : p[col];
      setDraftRows((prev) => prev.map((r, i) =>
        i === idx ? { ...r, [col]: String(committed) } : r
      ));
    }
  };

  const addPoint = () => {
    const last = points[points.length - 1];
    const nextX = typeof last?.x === "number" ? last.x + 1 : points.length;
    const seed = { x: nextX, y: 0 };
    const extraVal = extraCol ? extraCol.defaultValue(seed) : undefined;
    const newPoint: NonNullable<DataSeries["data"]>[number] = {
      ...seed,
      ...(extraCol && extraVal !== undefined ? { [extraCol.field]: extraVal } : {}),
    };
    const newDraft: DraftRow = {
      x: String(nextX), y: "0",
      ...(extraCol && extraVal !== undefined ? { z: String(extraVal) } : {}),
    };
    setDraftRows((prev) => [...prev, newDraft]);
    writeData([...points, newPoint]);
  };

  const deletePoint = (idx: number) => {
    setDraftRows((prev) => prev.filter((_, i) => i !== idx));
    writeData(points.filter((_, i) => i !== idx));
  };

  const cols = extraCol ? "60px 60px 60px auto" : "60px 60px auto";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("visual_editor.data_points")}</span>
      {points.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 160, overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4 }}>
            <span style={{ fontSize: 9, color: "var(--fg-faint)", textAlign: "center" }}>x</span>
            <span style={{ fontSize: 9, color: "var(--fg-faint)", textAlign: "center" }}>y</span>
            {extraCol && <span style={{ fontSize: 9, color: "var(--fg-faint)", textAlign: "center" }}>{t(extraCol.labelKey)}</span>}
            <span />
          </div>
          {points.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: cols, gap: 4, alignItems: "center" }}>
              <input type="text" inputMode="decimal"
                value={draftRows[i]?.x ?? String(p.x)}
                onChange={(e) => handleChange(i, "x", e.target.value)}
                onBlur={() => handleBlur(i, "x")}
                style={{ ...cellInputStyle }}
              />
              <input type="text" inputMode="decimal"
                value={draftRows[i]?.y ?? String(p.y)}
                onChange={(e) => handleChange(i, "y", e.target.value)}
                onBlur={() => handleBlur(i, "y")}
                style={{ ...cellInputStyle }}
              />
              {extraCol && (
                <input type="text" inputMode="decimal"
                  value={draftRows[i]?.z ?? String(p[extraCol.field] ?? extraCol.defaultValue(p))}
                  onChange={(e) => handleChange(i, "z", e.target.value)}
                  onBlur={() => handleBlur(i, "z")}
                  style={{ ...cellInputStyle }}
                />
              )}
              <button onClick={() => deletePoint(i)} style={{ fontSize: 9, border: "none", background: "transparent", color: "var(--fg-faint)", cursor: "pointer" }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={addPoint}
        style={{ padding: "3px 8px", borderRadius: "var(--r-xs)", border: "1px dashed var(--border-firm)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: "var(--fs-xs)", alignSelf: "flex-start" }}
      >
        + {t("visual_editor.add_point")}
      </button>
    </div>
  );
}

const cellInputStyle: React.CSSProperties = {
  padding: "3px 5px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)",
  fontFamily: "var(--font-mono)", width: "100%",
};

function LabeledSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[]; }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={selectStyle}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void; }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 13, height: 13 }} />
      {label}
    </label>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase",
  letterSpacing: "0.06em", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  padding: "4px 7px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)", width: "100%",
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
