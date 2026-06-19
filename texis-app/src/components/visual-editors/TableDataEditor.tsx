/**
 * Spreadsheet-style editor for table-data-engine documents.
 * Used by: BasicStatistics tables and any plugin using table-data-engine.
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TableDataDocument, DataColumn } from "../../types-engines";
import { nextColId } from "./transforms";

const COL_TYPES = ["number", "text", "label", "category"] as const;
// "auto" = sin override (se infiere del tipo). "decimal" = columna S de siunitx.
const COL_ALIGNS = ["auto", "left", "center", "right", "decimal"] as const;

interface Props {
  doc: TableDataDocument;
  onChange: (updated: TableDataDocument) => void;
}

export function TableDataEditor({ doc, onChange }: Props) {
  const { t } = useTranslation();

  const updateColumn = useCallback((id: string, patch: Partial<DataColumn>) => {
    onChange({ ...doc, columns: doc.columns.map((c) => c.id === id ? { ...c, ...patch } : c) });
  }, [doc, onChange]);

  const deleteColumn = useCallback((id: string) => {
    const columns = doc.columns.filter((c) => c.id !== id);
    const rows = doc.rows.map((r) => { const nr = { ...r }; delete nr[id]; return nr; });
    onChange({ ...doc, columns, rows });
  }, [doc, onChange]);

  const addColumn = useCallback(() => {
    const id = nextColId(doc.columns.map((c) => c.id));
    onChange({
      ...doc,
      columns: [...doc.columns, { id, header: t("visual_editor.new_col"), type: "number" }],
      rows: doc.rows.map((r) => ({ ...r, [id]: "" })),
    });
  }, [doc, onChange, t]);

  const addRow = useCallback(() => {
    const row: Record<string, string | number> = {};
    for (const col of doc.columns) row[col.id] = col.type === "number" ? 0 : "";
    onChange({ ...doc, rows: [...doc.rows, row] });
  }, [doc, onChange]);

  const deleteRow = useCallback((idx: number) => {
    onChange({ ...doc, rows: doc.rows.filter((_, i) => i !== idx) });
  }, [doc, onChange]);

  const updateCell = useCallback((rowIdx: number, colId: string, value: string) => {
    const rows = doc.rows.map((r, i) => {
      if (i !== rowIdx) return r;
      const col = doc.columns.find((c) => c.id === colId);
      return { ...r, [colId]: col?.type === "number" ? (parseFloat(value) || value) : value };
    });
    onChange({ ...doc, rows });
  }, [doc, onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Column headers */}
      <div style={{ overflowX: "auto" }}>
        {doc.columns.length > 0 && (
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {doc.columns.map((col) => (
                  <th key={col.id} style={{ padding: "4px 6px", borderBottom: "1px solid var(--border-firm)", verticalAlign: "bottom" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <input
                        value={col.header}
                        onChange={(e) => updateColumn(col.id, { header: e.target.value })}
                        style={{ ...cellInputStyle, fontWeight: 600, minWidth: 70 }}
                      />
                      <select
                        value={col.type}
                        onChange={(e) => updateColumn(col.id, { type: e.target.value as DataColumn["type"] })}
                        style={{ ...cellInputStyle, fontSize: 9, padding: "2px 4px" }}
                      >
                        {COL_TYPES.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
                      </select>
                      <select
                        value={col.align ?? "auto"}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateColumn(col.id, { align: v === "auto" ? undefined : (v as NonNullable<DataColumn["align"]>) });
                        }}
                        title={t("visual_editor.col_align_hint")}
                        style={{ ...cellInputStyle, fontSize: 9, padding: "2px 4px" }}
                      >
                        {COL_ALIGNS.map((a) => <option key={a} value={a}>{t(`visual_editor.align_${a}`)}</option>)}
                      </select>
                      <button onClick={() => deleteColumn(col.id)} style={{ fontSize: 9, border: "none", background: "transparent", color: "var(--fg-faint)", cursor: "pointer" }}>✕ {t("visual_editor.delete_col")}</button>
                    </div>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {doc.rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "var(--bg-hover)" }}>
                  {doc.columns.map((col) => (
                    <td key={col.id} style={{ padding: "3px 4px" }}>
                      <input
                        value={String(row[col.id] ?? "")}
                        onChange={(e) => updateCell(ri, col.id, e.target.value)}
                        style={{ ...cellInputStyle, fontFamily: col.type === "number" ? "var(--font-mono)" : undefined }}
                      />
                    </td>
                  ))}
                  <td style={{ padding: "3px 4px" }}>
                    <button onClick={() => deleteRow(ri)} style={{ fontSize: 9, border: "none", background: "transparent", color: "var(--fg-faint)", cursor: "pointer" }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {doc.columns.length === 0 && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", padding: "10px 0" }}>{t("visual_editor.add_col_first")}</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={addColumn} style={addBtnStyle}>+ {t("visual_editor.add_col")}</button>
        {doc.columns.length > 0 && <button onClick={addRow} style={addBtnStyle}>+ {t("visual_editor.add_row")}</button>}
      </div>
    </div>
  );
}

const cellInputStyle: React.CSSProperties = {
  padding: "3px 6px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)", width: "100%",
};
const addBtnStyle: React.CSSProperties = {
  padding: "4px 10px", borderRadius: "var(--r-sm)", border: "1px dashed var(--border-firm)",
  background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: "var(--fs-xs)",
};
