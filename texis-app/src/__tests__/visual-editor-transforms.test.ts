import { describe, it, expect } from "vitest";
import {
  applyPlotTypeChange,
  deleteGanttGroup,
  deleteGanttTask,
  nextColId,
  parseFiniteNumberDraft,
} from "../components/visual-editors/transforms";
import type { DataSeries } from "../types-engines";
import type { TimelineGanttDocument } from "../types-engines";

// ── applyPlotTypeChange ───────────────────────────────────────────────────────

describe("applyPlotTypeChange", () => {
  const fnSeries: DataSeries = {
    id: "s1", label: "f(x)", plotType: "function2d",
    expression: "x^2", domain: [-3, 3], color: "blue",
  };
  const scatterSeries: DataSeries = {
    id: "s2", label: "pts", plotType: "scatter",
    data: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
  };
  const parametricSeries: DataSeries = {
    id: "s3", label: "param", plotType: "parametric",
    expression: "({cos(t)},{sin(t)})", domain: [0, 6.28],
  };

  it("clears expression+domain when going from function2d → scatter", () => {
    const result = applyPlotTypeChange(fnSeries, "scatter");
    expect(result.plotType).toBe("scatter");
    expect(result.expression).toBeUndefined();
    expect(result.domain).toBeUndefined();
  });

  it("clears expression+domain when going from function2d → bar", () => {
    const result = applyPlotTypeChange(fnSeries, "bar");
    expect(result.expression).toBeUndefined();
    expect(result.domain).toBeUndefined();
  });

  it("clears expression+domain when going from parametric → scatter", () => {
    const result = applyPlotTypeChange(parametricSeries, "scatter");
    expect(result.expression).toBeUndefined();
    expect(result.domain).toBeUndefined();
  });

  it("clears data when going from scatter → function2d", () => {
    const result = applyPlotTypeChange(scatterSeries, "function2d");
    expect(result.plotType).toBe("function2d");
    expect(result.data).toBeUndefined();
  });

  it("does not touch data when going bar → histogram (both data-driven)", () => {
    const barSeries: DataSeries = { id: "s4", label: "bar", plotType: "bar", data: [{ x: 1, y: 5 }] };
    const result = applyPlotTypeChange(barSeries, "histogram");
    expect(result.data).toEqual([{ x: 1, y: 5 }]);
  });

  it("does not touch expression when going function2d → parametric (both expression-based)", () => {
    const result = applyPlotTypeChange(fnSeries, "parametric");
    expect(result.expression).toBe("x^2");
  });

  it("does not clear data when going scatter → heatmap (both data-driven)", () => {
    const result = applyPlotTypeChange(scatterSeries, "heatmap");
    expect(result.data).toEqual(scatterSeries.data);
  });

  it("clears expression+domain when going function2d → heatmap (expression → data-driven)", () => {
    const result = applyPlotTypeChange(fnSeries, "heatmap");
    expect(result.expression).toBeUndefined();
    expect(result.domain).toBeUndefined();
  });

  it("clears data when going heatmap → function2d (data-driven → expression)", () => {
    const heatmapSeries: DataSeries = { id: "s5", label: "heat", plotType: "heatmap", data: [{ x: 0, y: 0 }] };
    const result = applyPlotTypeChange(heatmapSeries, "function2d");
    expect(result.data).toBeUndefined();
  });

  it("preserves unrelated fields", () => {
    const result = applyPlotTypeChange(fnSeries, "scatter");
    expect(result.id).toBe("s1");
    expect(result.label).toBe("f(x)");
    expect(result.color).toBe("blue");
  });
});

// ── deleteGanttGroup ──────────────────────────────────────────────────────────

const BASE_DOC: TimelineGanttDocument = {
  engineId: "timeline-gantt-engine",
  version: "1",
  mode: "gantt",
  unit: "month",
  groups: [
    { id: "g1", label: "Phase 1" },
    { id: "g2", label: "Phase 2" },
  ],
  tasks: [
    { id: "t1", label: "Task A", start: "1", end: "3", group: "g1" },
    { id: "t2", label: "Task B", start: "4", end: "6", group: "g2" },
    { id: "t3", label: "Task C", start: "2", end: "5" },
  ],
};

describe("deleteGanttGroup", () => {
  it("removes the group from the groups array", () => {
    const result = deleteGanttGroup(BASE_DOC, "g1");
    expect(result.groups.map((g) => g.id)).toEqual(["g2"]);
  });

  it("sets group to undefined on tasks that referenced the deleted group", () => {
    const result = deleteGanttGroup(BASE_DOC, "g1");
    const t1 = result.tasks.find((t) => t.id === "t1")!;
    expect(t1.group).toBeUndefined();
  });

  it("does not affect tasks in other groups", () => {
    const result = deleteGanttGroup(BASE_DOC, "g1");
    const t2 = result.tasks.find((t) => t.id === "t2")!;
    expect(t2.group).toBe("g2");
  });

  it("does not affect tasks with no group", () => {
    const result = deleteGanttGroup(BASE_DOC, "g1");
    const t3 = result.tasks.find((t) => t.id === "t3")!;
    expect(t3.group).toBeUndefined();
  });

  it("does not mutate the original document", () => {
    deleteGanttGroup(BASE_DOC, "g1");
    expect(BASE_DOC.groups).toHaveLength(2);
    expect(BASE_DOC.tasks[0].group).toBe("g1");
  });
});

// ── deleteGanttTask ───────────────────────────────────────────────────────────

describe("deleteGanttTask", () => {
  const docWithDeps: TimelineGanttDocument = {
    ...BASE_DOC,
    tasks: [
      { id: "t1", label: "A", start: "1", end: "2" },
      { id: "t2", label: "B", start: "3", end: "4", dependsOn: ["t1"] },
      { id: "t3", label: "C", start: "5", end: "6", dependsOn: ["t1", "t2"] },
    ],
  };

  it("removes the task", () => {
    const result = deleteGanttTask(docWithDeps, "t1");
    expect(result.tasks.map((t) => t.id)).toEqual(["t2", "t3"]);
  });

  it("removes the deleted task ID from dependsOn of remaining tasks", () => {
    const result = deleteGanttTask(docWithDeps, "t1");
    expect(result.tasks.find((t) => t.id === "t2")!.dependsOn).toEqual([]);
    expect(result.tasks.find((t) => t.id === "t3")!.dependsOn).toEqual(["t2"]);
  });

  it("leaves dependsOn undefined when the task had none", () => {
    const result = deleteGanttTask(docWithDeps, "t2");
    expect(result.tasks.find((t) => t.id === "t1")!.dependsOn).toBeUndefined();
  });

  it("does not mutate the original", () => {
    deleteGanttTask(docWithDeps, "t1");
    expect(docWithDeps.tasks).toHaveLength(3);
  });
});

// ── nextColId ─────────────────────────────────────────────────────────────────

describe("nextColId", () => {
  it("returns col1 for an empty list", () => {
    expect(nextColId([])).toBe("col1");
  });

  it("skips existing IDs", () => {
    expect(nextColId(["col1", "col2"])).toBe("col3");
  });

  it("fills gaps", () => {
    expect(nextColId(["col1", "col3"])).toBe("col2");
  });

  it("handles non-col IDs gracefully", () => {
    expect(nextColId(["x", "y"])).toBe("col1");
  });

  it("handles large contiguous ranges", () => {
    const ids = Array.from({ length: 10 }, (_, i) => `col${i + 1}`);
    expect(nextColId(ids)).toBe("col11");
  });
});

// ── parseFiniteNumberDraft ────────────────────────────────────────────────────

describe("parseFiniteNumberDraft", () => {
  // Valid inputs — should return a finite number
  it("parses plain integer", () => expect(parseFiniteNumberDraft("42")).toBe(42));
  it("parses negative decimal", () => expect(parseFiniteNumberDraft("-3.5")).toBe(-3.5));
  it("parses with leading/trailing spaces", () => expect(parseFiniteNumberDraft(" 7 ")).toBe(7));
  it("parses zero", () => expect(parseFiniteNumberDraft("0")).toBe(0));
  it("parses trailing decimal '0.' as 0", () => expect(parseFiniteNumberDraft("0.")).toBe(0));
  it("parses scientific notation '1e3'", () => expect(parseFiniteNumberDraft("1e3")).toBe(1000));
  it("normalizes '01.20' to 1.2", () => expect(parseFiniteNumberDraft("01.20")).toBe(1.2));

  // Invalid inputs — should return null
  it("rejects empty string", () => expect(parseFiniteNumberDraft("")).toBeNull());
  it("rejects whitespace only", () => expect(parseFiniteNumberDraft("   ")).toBeNull());
  it("rejects partial '12abc'", () => expect(parseFiniteNumberDraft("12abc")).toBeNull());
  it("rejects lone minus sign", () => expect(parseFiniteNumberDraft("-")).toBeNull());
  it("rejects NaN literal", () => expect(parseFiniteNumberDraft("NaN")).toBeNull());
  it("rejects Infinity", () => expect(parseFiniteNumberDraft("Infinity")).toBeNull());
});
