/**
 * Visual table editor for timeline-gantt-engine documents.
 * Used by: GanttPlugin (start/end = positional month numbers like "1"–"27"),
 *          TimelinePlugin (start/end = year strings like "1944").
 *
 * The start/end fields are plain text: pgfgantt/tikz accept numeric offsets,
 * years, or ISO dates — we detect the document's existing format and render
 * an appropriate input so the user never needs to know LaTeX.
 */
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineGanttDocument, TimelineTask, TimelineGroup } from "../../types-engines";
import { deleteGanttGroup, deleteGanttTask } from "./transforms";

const TIME_UNITS = ["day", "week", "month", "year"] as const;

interface Props {
  doc: TimelineGanttDocument;
  onChange: (updated: TimelineGanttDocument) => void;
}

/** Detect the kind of start/end values stored in the document. */
function detectPositionFormat(tasks: TimelineTask[]): "iso-date" | "year" | "number" {
  if (tasks.length === 0) return "number";
  const sample = [...tasks.map((t) => t.start), ...tasks.map((t) => t.end)].filter(Boolean);
  if (sample.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))) return "iso-date";
  if (sample.every((v) => /^\d{4}$/.test(v))) return "year";
  return "number";
}

/** Collision-safe ID: scans existing IDs and picks next unused integer suffix. */
function nextId(prefix: string, existingIds: string[]): string {
  const used = new Set(existingIds);
  let i = 1;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

function defaultStart(fmt: "iso-date" | "year" | "number"): string {
  if (fmt === "iso-date") return new Date().toISOString().slice(0, 10);
  if (fmt === "year")     return String(new Date().getFullYear());
  return "1";
}
function defaultEnd(fmt: "iso-date" | "year" | "number"): string {
  if (fmt === "iso-date") {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  if (fmt === "year") return String(new Date().getFullYear() + 1);
  return "4";
}

export function GanttEditor({ doc, onChange }: Props) {
  const { t } = useTranslation();

  const fmt = useMemo(() => detectPositionFormat(doc.tasks), [doc.tasks]);

  const allTaskIds  = useMemo(() => doc.tasks.map((t) => t.id),  [doc.tasks]);
  const allGroupIds = useMemo(() => doc.groups.map((g) => g.id), [doc.groups]);

  const updateTask = useCallback((id: string, patch: Partial<TimelineTask>) => {
    onChange({ ...doc, tasks: doc.tasks.map((t) => t.id === id ? { ...t, ...patch } : t) });
  }, [doc, onChange]);

  const deleteTask = useCallback((id: string) => {
    onChange(deleteGanttTask(doc, id));
  }, [doc, onChange]);

  const addTask = useCallback(() => {
    const id = nextId("t", allTaskIds);
    onChange({
      ...doc,
      tasks: [...doc.tasks, {
        id,
        label: t("visual_editor.new_task"),
        start: defaultStart(fmt),
        end:   defaultEnd(fmt),
      }],
    });
  }, [doc, onChange, t, allTaskIds, fmt]);

  const updateGroup = useCallback((id: string, patch: Partial<TimelineGroup>) => {
    onChange({ ...doc, groups: doc.groups.map((g) => g.id === id ? { ...g, ...patch } : g) });
  }, [doc, onChange]);

  const addGroup = useCallback(() => {
    const id = nextId("g", allGroupIds);
    onChange({ ...doc, groups: [...doc.groups, { id, label: t("visual_editor.new_group") }] });
  }, [doc, onChange, t, allGroupIds]);

  const deleteGroup = useCallback((id: string) => {
    onChange(deleteGanttGroup(doc, id));
  }, [doc, onChange]);

  const posLabel =
    fmt === "iso-date" ? t("visual_editor.date_pos")
    : fmt === "year"   ? t("visual_editor.year_pos")
    :                    t("visual_editor.step_pos");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Global settings */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <LabeledInput
          label={t("visual_editor.title")}
          value={doc.title ?? ""}
          onChange={(v) => onChange({ ...doc, title: v || undefined })}
          placeholder={t("visual_editor.optional")}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={labelStyle}>{t("visual_editor.unit")}</span>
          <select
            value={doc.unit}
            onChange={(e) => onChange({ ...doc, unit: e.target.value as TimelineGanttDocument["unit"] })}
            style={selectStyle}
          >
            {TIME_UNITS.map((u) => (
              <option key={u} value={u}>{t(`visual_editor.unit_${u}`, u)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Hint about position format */}
      <div style={{ fontSize: 10, color: "var(--fg-faint)", padding: "4px 8px", background: "var(--bg-app)", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)" }}>
        {fmt === "iso-date" && t("visual_editor.gantt_fmt_date")}
        {fmt === "year"     && t("visual_editor.gantt_fmt_year")}
        {fmt === "number"   && t("visual_editor.gantt_fmt_number")}
      </div>

      {/* Groups */}
      {doc.groups.length > 0 && (
        <div>
          <div style={sectionTitle}>{t("visual_editor.groups")} ({doc.groups.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {doc.groups.map((g) => (
              <div key={g.id} style={rowStyle}>
                <span style={idStyle}>{g.id}</span>
                <input
                  value={g.label}
                  onChange={(e) => updateGroup(g.id, { label: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={() => deleteGroup(g.id)} style={deleteBtnStyle}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={addGroup} style={addBtnStyle}>+ {t("visual_editor.add_group")}</button>

      {/* Tasks */}
      <div>
        <div style={sectionTitle}>{t("visual_editor.tasks")} ({doc.tasks.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {doc.tasks.map((task) => (
            <div key={task.id} style={{ ...rowStyle, flexWrap: "wrap" }}>
              <span style={idStyle}>{task.id}</span>
              <input
                value={task.label}
                onChange={(e) => updateTask(task.id, { label: e.target.value })}
                placeholder={t("visual_editor.task_name")}
                style={{ ...inputStyle, flex: 2, minWidth: 100 }}
              />
              <PositionInput
                value={task.start}
                fmt={fmt}
                placeholder={posLabel}
                onChange={(v) => updateTask(task.id, { start: v })}
              />
              <span style={{ color: "var(--fg-faint)", fontSize: 11 }}>→</span>
              <PositionInput
                value={task.end}
                fmt={fmt}
                placeholder={posLabel}
                onChange={(v) => updateTask(task.id, { end: v })}
              />
              {doc.groups.length > 0 && (
                <select
                  value={task.group ?? ""}
                  onChange={(e) => updateTask(task.id, { group: e.target.value || undefined })}
                  style={selectStyle}
                >
                  <option value="">{t("visual_editor.no_group")}</option>
                  {doc.groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--fg-faint)", cursor: "pointer", flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={!!task.milestone}
                  onChange={(e) => updateTask(task.id, { milestone: e.target.checked })}
                  style={{ width: 12, height: 12 }}
                />
                {t("visual_editor.milestone")}
              </label>
              <button onClick={() => deleteTask(task.id)} style={deleteBtnStyle}>✕</button>
            </div>
          ))}
        </div>
        <button onClick={addTask} style={{ ...addBtnStyle, marginTop: 6 }}>
          + {t("visual_editor.add_task")}
        </button>
      </div>
    </div>
  );
}

// ── Position input: adapts to detected format ─────────────────────

function PositionInput({ value, fmt, placeholder, onChange }: {
  value: string;
  fmt: "iso-date" | "year" | "number";
  placeholder: string;
  onChange: (v: string) => void;
}) {
  if (fmt === "iso-date") {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, flex: "0 0 130px" }}
      />
    );
  }
  if (fmt === "year") {
    return (
      <input
        type="number"
        min={1}
        max={9999}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, flex: "0 0 70px", fontFamily: "var(--font-mono)" }}
      />
    );
  }
  // positional month/week/day number (pgfgantt default format)
  return (
    <input
      type="number"
      min={1}
      step={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...inputStyle, flex: "0 0 60px", fontFamily: "var(--font-mono)" }}
    />
  );
}

function LabeledInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 120 }}>
      <span style={labelStyle}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

const labelStyle: React.CSSProperties    = { fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em" };
const sectionTitle: React.CSSProperties  = { fontSize: 10, fontWeight: 600, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 };
const rowStyle: React.CSSProperties      = { display: "flex", gap: 6, alignItems: "center", background: "var(--bg-app)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "5px 8px" };
const idStyle: React.CSSProperties       = { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", minWidth: 24, flexShrink: 0 };
const inputStyle: React.CSSProperties    = { padding: "4px 7px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)", background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)" };
const selectStyle: React.CSSProperties   = { padding: "4px 5px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)", background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)" };
const deleteBtnStyle: React.CSSProperties = { padding: "2px 6px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)", background: "transparent", color: "var(--fg-faint)", cursor: "pointer", fontSize: 11, flexShrink: 0 };
const addBtnStyle: React.CSSProperties   = { padding: "5px 12px", borderRadius: "var(--r-sm)", border: "1px dashed var(--border-firm)", background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: "var(--fs-xs)", alignSelf: "flex-start" };
