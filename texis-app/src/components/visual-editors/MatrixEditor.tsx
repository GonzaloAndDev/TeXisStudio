/**
 * Visual grid editor for math-engine MatrixDocument.
 * Lets users fill cell values directly — no LaTeX syntax.
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { MatrixDocument } from "../../types-engines";

const DELIMITERS = ["paren", "bracket", "brace", "vert", "none"] as const;

interface Props {
  doc: MatrixDocument;
  onChange: (updated: MatrixDocument) => void;
}

export function MatrixEditor({ doc, onChange }: Props) {
  const { t } = useTranslation();

  const setCell = useCallback((row: number, col: number, value: string) => {
    const cells = doc.cells.map((r, ri) => r.map((c, ci) => ri === row && ci === col ? value : c));
    onChange({ ...doc, cells });
  }, [doc, onChange]);

  const setRows = useCallback((rows: number) => {
    if (rows < 1 || rows > 12) return;
    const cells: string[][] = Array.from({ length: rows }, (_, ri) =>
      Array.from({ length: doc.cols }, (__, ci) => doc.cells[ri]?.[ci] ?? "0")
    );
    onChange({ ...doc, rows, cells });
  }, [doc, onChange]);

  const setCols = useCallback((cols: number) => {
    if (cols < 1 || cols > 12) return;
    const cells = doc.cells.map((row) =>
      Array.from({ length: cols }, (_, ci) => row[ci] ?? "0")
    );
    onChange({ ...doc, cols, cells });
  }, [doc, onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Size + delimiter controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <NumericInput label={t("visual_editor.rows")} value={doc.rows} onChange={setRows} min={1} max={12} />
        <NumericInput label={t("visual_editor.cols")} value={doc.cols} onChange={setCols} min={1} max={12} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{t("visual_editor.delimiter")}</span>
          <select
            value={doc.delimiter}
            onChange={(e) => onChange({ ...doc, delimiter: e.target.value as MatrixDocument["delimiter"] })}
            style={selectStyle}
          >
            {DELIMITERS.map((d) => <option key={d} value={d}>{t(`visual_editor.delim_${d}`, d)}</option>)}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 4 }}>
          <tbody>
            {Array.from({ length: doc.rows }, (_, ri) => (
              <tr key={ri}>
                {Array.from({ length: doc.cols }, (__, ci) => (
                  <td key={ci}>
                    <input
                      value={doc.cells[ri]?.[ci] ?? ""}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      style={{
                        width: 60, padding: "4px 6px", textAlign: "center",
                        borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
                        background: "var(--bg-panel)", color: "var(--fg-default)",
                        fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)",
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
        {t("visual_editor.matrix_hint")}
      </div>
    </div>
  );
}

function NumericInput({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, width: 70 }}>
      <span style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <input
        type="number" min={min} max={max} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        style={selectStyle}
      />
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "4px 5px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)",
};
