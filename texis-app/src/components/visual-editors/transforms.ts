/**
 * Pure document-transform helpers for visual editors.
 * Exported so they can be unit-tested without React overhead.
 */
import type { DataSeries } from "../../types-engines";
import type { TimelineGanttDocument } from "../../types-engines";

const EXPRESSION_TYPES = new Set(["function2d", "parametric", "polar", "surface", "contour"]);
const DATA_TYPES       = new Set(["scatter", "bar", "histogram", "boxplot", "heatmap", "errorbar"]);

type DataPoint = NonNullable<DataSeries["data"]>[number];

/** Third column config for data-driven series types that carry an extra numeric field.
 *  `defaultValue` mirrors the serializer's fallback so the UI shows what the chart will render. */
export const EXTRA_COL_FOR_TYPE: Partial<Record<string, {
  field: "error" | "meta";
  labelKey: string;
  /** Must match the serializer's `field ?? fallback` expression. */
  defaultValue: (p: DataPoint) => number;
}>> = {
  errorbar: { field: "error", labelKey: "visual_editor.col_y_error", defaultValue: ()  => 0   },
  boxplot:  { field: "error", labelKey: "visual_editor.col_iqr",     defaultValue: ()  => 5   },
  heatmap:  { field: "meta",  labelKey: "visual_editor.col_meta",    defaultValue: (p) => p.y },
};

/** Returns a patched DataSeries after a plot-type switch, clearing stale fields. */
export function applyPlotTypeChange(
  series: DataSeries,
  newType: DataSeries["plotType"],
): DataSeries {
  const patch: Partial<DataSeries> = { plotType: newType };
  if (DATA_TYPES.has(newType) && EXPRESSION_TYPES.has(series.plotType)) {
    patch.expression = undefined;
    patch.domain = undefined;
  }
  if (EXPRESSION_TYPES.has(newType) && DATA_TYPES.has(series.plotType)) {
    patch.data = undefined;
  }
  return { ...series, ...patch };
}

/** Removes a group and unlinks all tasks that referenced it. */
export function deleteGanttGroup(
  doc: TimelineGanttDocument,
  groupId: string,
): TimelineGanttDocument {
  return {
    ...doc,
    groups: doc.groups.filter((g) => g.id !== groupId),
    tasks:  doc.tasks.map((t) => t.group === groupId ? { ...t, group: undefined } : t),
  };
}

/** Removes a task and clears any dependsOn references to it. */
export function deleteGanttTask(
  doc: TimelineGanttDocument,
  taskId: string,
): TimelineGanttDocument {
  return {
    ...doc,
    tasks: doc.tasks
      .filter((t) => t.id !== taskId)
      .map((t) => t.dependsOn ? { ...t, dependsOn: t.dependsOn.filter((d) => d !== taskId) } : t),
  };
}

/**
 * Parses a string typed into a numeric input field.
 * Returns the finite number if the input is valid, or null otherwise.
 * Used by DataPointsEditor; exported so tests verify the same function.
 */
export function parseFiniteNumberDraft(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Collision-safe column ID: scans existing IDs and picks the next unused col<n>. */
export function nextColId(existingIds: string[]): string {
  const used = new Set(existingIds);
  let i = 1;
  while (used.has(`col${i}`)) i++;
  return `col${i}`;
}
