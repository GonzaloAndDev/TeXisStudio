/**
 * Round-trip tests: visual-editor transforms → serializer → LaTeX output.
 * Verifies that the pipeline edit → stringify → serialize produces correct LaTeX
 * without requiring Tauri or React.
 */
import { describe, it, expect } from "vitest";
import { serializePGFPlots } from "@texisstudio/plugins/engines/pgfplots-engine/serializer.js";
import { serializeGantt } from "@texisstudio/plugins/engines/timeline-gantt-engine/serializer.js";
import type { PGFPlotsDocument } from "@texisstudio/plugins/engines/pgfplots-engine/types.js";
import type { TimelineGanttDocument } from "@texisstudio/plugins/engines/timeline-gantt-engine/types.js";
import { applyPlotTypeChange, deleteGanttGroup, deleteGanttTask } from "../components/visual-editors/transforms";

// ── PGFPlots serializer ───────────────────────────────────────────────────────

const BASE_PGFPLOTS: PGFPlotsDocument = {
  engineId: "pgfplots-engine",
  version: "1",
  series: [],
  xLabel: "x", yLabel: "y",
  xScale: "linear", yScale: "linear",
  showLegend: false,
  grid: false,
};

describe("PGFPlots round-trip — scatter", () => {
  const doc: PGFPlotsDocument = {
    ...BASE_PGFPLOTS,
    series: [{
      id: "s1", label: "Data", plotType: "scatter",
      data: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
    }],
  };

  it("renders coordinates", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("(1, 2)");
    expect(latex).toContain("(3, 4)");
  });

  it("wraps in tikzpicture", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("\\begin{tikzpicture}");
    expect(latex).toContain("\\end{tikzpicture}");
  });
});

describe("PGFPlots round-trip — errorbar", () => {
  const doc: PGFPlotsDocument = {
    ...BASE_PGFPLOTS,
    series: [{
      id: "s1", label: "Measurements", plotType: "errorbar",
      data: [{ x: 1, y: 5, error: 0.5 }, { x: 2, y: 7, error: 1.2 }],
    }],
  };

  it("emits ± syntax for error bars", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("+- (0, 0.5)");
    expect(latex).toContain("+- (0, 1.2)");
  });

  it("uses error bars directive", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("error bars/.cd");
  });

  it("falls back to 0 when error is missing", () => {
    const docNoError: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{ id: "s1", label: "x", plotType: "errorbar", data: [{ x: 0, y: 1 }] }],
    };
    const latex = serializePGFPlots(docNoError);
    expect(latex).toContain("+- (0, 0)");
  });
});

describe("PGFPlots round-trip — heatmap", () => {
  const doc: PGFPlotsDocument = {
    ...BASE_PGFPLOTS,
    series: [{
      id: "s1", label: "Corr", plotType: "heatmap",
      data: [{ x: 0, y: 0, meta: 1 }, { x: 1, y: 0, meta: -0.5 }],
    }],
  };

  it("emits explicit meta values", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("[1.000]");
    expect(latex).toContain("[-0.500]");
  });

  it("uses point meta=explicit", () => {
    expect(serializePGFPlots(doc)).toContain("point meta=explicit");
  });

  it("falls back to y when meta is missing", () => {
    const docNoMeta: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{ id: "s1", label: "x", plotType: "heatmap", data: [{ x: 0, y: 0.75 }] }],
    };
    expect(serializePGFPlots(docNoMeta)).toContain("[0.750]");
  });

  it("includes colorbar axis option", () => {
    expect(serializePGFPlots(doc)).toContain("colorbar");
  });
});

describe("PGFPlots round-trip — bar", () => {
  const doc: PGFPlotsDocument = {
    ...BASE_PGFPLOTS,
    series: [{
      id: "s1", label: "Sales", plotType: "bar",
      data: [{ x: 1, y: 10 }, { x: 2, y: 20 }, { x: 3, y: 15 }],
      color: "red",
    }],
  };

  it("emits ybar in the addplot options", () => {
    expect(serializePGFPlots(doc)).toContain("ybar");
  });

  it("emits bar width", () => {
    expect(serializePGFPlots(doc)).toContain("bar width");
  });

  it("emits fill + fill opacity + draw styling", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("fill=red");
    expect(latex).toContain("fill opacity=0.4");
    expect(latex).toContain("draw=red");
  });

  it("renders coordinates", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("(1, 10)");
    expect(latex).toContain("(2, 20)");
  });

  it("emits coordinates block, not expression block", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("coordinates {");
    expect(latex).not.toMatch(/\\addplot(\[[^\]]*\])?\s*\{/);
  });
});

describe("PGFPlots round-trip — histogram", () => {
  const doc: PGFPlotsDocument = {
    ...BASE_PGFPLOTS,
    series: [{
      id: "s1", label: "Freq", plotType: "histogram",
      data: [{ x: 0, y: 3 }, { x: 1, y: 7 }, { x: 2, y: 5 }],
      color: "green",
    }],
  };

  it("emits ybar interval in the addplot options", () => {
    expect(serializePGFPlots(doc)).toContain("ybar interval");
  });

  it("emits fill + fill opacity + draw styling", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("fill=green");
    expect(latex).toContain("fill opacity=0.4");
    expect(latex).toContain("draw=green");
  });

  it("renders coordinates", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("(0, 3)");
    expect(latex).toContain("(1, 7)");
  });

  it("histogram does not emit plain ybar (only ybar interval)", () => {
    const latex = serializePGFPlots(doc);
    const bareYbar = /ybar(?! interval)/.test(latex);
    expect(bareYbar).toBe(false);
  });
});

describe("PGFPlots round-trip — empty color falls back to blue", () => {
  it("bar with color='' uses blue fill opacity, no fill=!40", () => {
    const doc: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{ id: "s1", label: "x", plotType: "bar", data: [{ x: 1, y: 5 }], color: "" }],
    };
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("fill=blue");
    expect(latex).toContain("fill opacity=0.4");
    expect(latex).not.toContain("fill=!40");
  });

  it("histogram with color='' uses blue fill opacity, no fill=!40", () => {
    const doc: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{ id: "s1", label: "x", plotType: "histogram", data: [{ x: 0, y: 2 }], color: "" }],
    };
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("fill=blue");
    expect(latex).toContain("fill opacity=0.4");
    expect(latex).not.toContain("fill=!40");
  });

  it("boxplot with color='' uses blue fill opacity, no fill=!20", () => {
    const doc: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{ id: "s1", label: "x", plotType: "boxplot", data: [{ x: 1, y: 5 }], color: "" }],
    };
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("fill=blue");
    expect(latex).toContain("fill opacity=0.2");
    expect(latex).not.toContain("fill=!20");
  });
});

describe("PGFPlots round-trip — compound xcolor expressions preserved", () => {
  it("bar with blue!60 preserves compound color, no double mix", () => {
    const doc: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{ id: "s1", label: "x", plotType: "bar", data: [{ x: 1, y: 5 }], color: "blue!60" }],
    };
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("fill=blue!60");
    expect(latex).not.toContain("blue!60!40");
    expect(latex).toContain("fill opacity=0.4");
  });

  it("histogram with orange!70 preserves compound color", () => {
    const doc: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{ id: "s1", label: "x", plotType: "histogram", data: [{ x: 0, y: 2 }], color: "orange!70" }],
    };
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("fill=orange!70");
    expect(latex).not.toContain("orange!70!40");
    expect(latex).toContain("fill opacity=0.4");
  });

  it("boxplot with red!50 preserves compound color", () => {
    const doc: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{ id: "s1", label: "x", plotType: "boxplot", data: [{ x: 1, y: 5 }], color: "red!50" }],
    };
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("fill=red!50");
    expect(latex).not.toContain("red!50!20");
    expect(latex).toContain("fill opacity=0.2");
  });
});

describe("PGFPlots round-trip — mixed bar + scatter", () => {
  const doc: PGFPlotsDocument = {
    ...BASE_PGFPLOTS,
    series: [
      { id: "s1", label: "Bars",   plotType: "bar",    data: [{ x: 1, y: 5 }], color: "blue" },
      { id: "s2", label: "Points", plotType: "scatter", data: [{ x: 1, y: 3 }], color: "red"  },
    ],
  };

  it("bar series carries ybar inside its addplot", () => {
    expect(serializePGFPlots(doc)).toContain("\\addplot[ybar,");
  });

  it("scatter series renders with mark, not ybar", () => {
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("mark=*");
    const scatterLine = latex.split("\n").find(l => l.includes("color=red") && l.includes("\\addplot"));
    expect(scatterLine).toBeDefined();
    expect(scatterLine).not.toContain("ybar");
  });

  it("axis block does not contain bare ybar global option", () => {
    const latex = serializePGFPlots(doc);
    const axisBlock = latex.match(/\\begin\{axis\}([\s\S]*?)\\addplot/)?.[1] ?? "";
    expect(axisBlock).not.toContain("ybar");
  });
});

describe("PGFPlots round-trip — horizontal bars (xbar via pgfplotsOptions)", () => {
  const docXbar: PGFPlotsDocument = {
    ...BASE_PGFPLOTS,
    pgfplotsOptions: "xbar",
    series: [
      { id: "s1", label: "Pop", plotType: "bar",       data: [{ x: 1, y: 10 }], color: "blue" },
      { id: "s2", label: "Cnt", plotType: "histogram",  data: [{ x: 0, y: 3  }], color: "red"  },
    ],
  };

  it("bar series emits xbar, not ybar", () => {
    const latex = serializePGFPlots(docXbar);
    expect(latex).toContain("\\addplot[xbar,");
    expect(latex).not.toContain("\\addplot[ybar,");
  });

  it("histogram series emits xbar interval, not ybar interval", () => {
    const latex = serializePGFPlots(docXbar);
    expect(latex).toContain("xbar interval");
    expect(latex).not.toContain("ybar interval");
  });

  it("bar coordinates are transposed (y, x) for xbar semantic", () => {
    // xbar expects (value, position): x=age-group stored as x, population as y
    // so the emitted pair must be (population, age-group) = (y, x)
    const doc: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      pgfplotsOptions: "xbar",
      series: [{
        id: "s1", label: "Population", plotType: "bar",
        data: [{ x: 1, y: 9.8 }, { x: 2, y: 8.3 }],
        color: "blue",
      }],
    };
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("(9.8, 1)");
    expect(latex).toContain("(8.3, 2)");
    expect(latex).not.toContain("(1, 9.8)");
  });

  it("vertical bar coordinates are NOT transposed", () => {
    const doc: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{
        id: "s1", label: "Sales", plotType: "bar",
        data: [{ x: 1, y: 9.8 }],
        color: "blue",
      }],
    };
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("(1, 9.8)");
    expect(latex).not.toContain("(9.8, 1)");
  });
});

describe("PGFPlots round-trip — function2d after type switch", () => {
  it("clears data and renders expression after scatter → function2d", () => {
    const scatterSeries = {
      id: "s1", label: "f", plotType: "scatter" as const,
      data: [{ x: 1, y: 2 }],
    };
    const fn2d = applyPlotTypeChange(scatterSeries, "function2d");
    const doc: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{ ...fn2d, expression: "x^2", domain: [-2, 2] }],
    };
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("{x^2}");
    expect(latex).not.toContain("coordinates");
  });

  it("clears expression and renders coordinates after function2d → scatter", () => {
    const fnSeries = {
      id: "s1", label: "f", plotType: "function2d" as const,
      expression: "x^2", domain: [-2, 2] as [number, number],
    };
    const scatter = applyPlotTypeChange(fnSeries, "scatter");
    const doc: PGFPlotsDocument = {
      ...BASE_PGFPLOTS,
      series: [{ ...scatter, data: [{ x: 1, y: 2 }] }],
    };
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("(1, 2)");
    expect(latex).not.toContain("{x^2}");
  });
});

// ── Gantt serializer ──────────────────────────────────────────────────────────

const BASE_GANTT: TimelineGanttDocument = {
  engineId: "timeline-gantt-engine",
  version: "1",
  mode: "gantt",
  unit: "month",
  groups: [
    { id: "g1", label: "Phase 1" },
    { id: "g2", label: "Phase 2" },
  ],
  tasks: [
    { id: "t1", label: "Analysis",   start: "1",  end: "3",  group: "g1" },
    { id: "t2", label: "Design",     start: "4",  end: "6",  group: "g2" },
    { id: "t3", label: "Standalone", start: "2",  end: "5"               },
    { id: "t4", label: "Review",     start: "6",  end: "8",  group: "g1", dependsOn: ["t1", "t2"] },
  ],
};

describe("Gantt round-trip — deleteGroup", () => {
  const doc = deleteGanttGroup(BASE_GANTT, "g1");

  it("group bar no longer in output", () => {
    const latex = serializeGantt(doc);
    expect(latex).not.toContain("Phase 1");
  });

  it("tasks that belonged to g1 are still rendered as independent", () => {
    const latex = serializeGantt(doc);
    expect(latex).toContain("Analysis");
    expect(latex).toContain("Review");
  });

  it("tasks in g2 are unaffected", () => {
    expect(serializeGantt(doc)).toContain("Phase 2");
    expect(serializeGantt(doc)).toContain("Design");
  });
});

describe("Gantt round-trip — deleteTask cleans dependsOn", () => {
  it("no dangling \\ganttlink after deleting a dependency", () => {
    const doc = deleteGanttTask(BASE_GANTT, "t1");
    const latex = serializeGantt(doc);
    // t4 still exists but dependsOn t1 was removed
    expect(latex).not.toContain("\\ganttlink{t1}");
    expect(latex).toContain("Review");
  });

  it("link to surviving task t2 is preserved", () => {
    const doc = deleteGanttTask(BASE_GANTT, "t1");
    const latex = serializeGantt(doc);
    expect(latex).toContain("\\ganttlink{t2}{t4}");
  });

  it("deleted task does not appear in output", () => {
    const doc = deleteGanttTask(BASE_GANTT, "t3");
    expect(serializeGantt(doc)).not.toContain("Standalone");
  });
});
