/**
 * Metadata round-trip tests.
 * Verifies that each engine's registered metadata produces a defaultDoc that:
 * 1. Passes through the serializer without throwing.
 * 2. Contains the expected LaTeX structure markers.
 * 3. Survives JSON stringify → parse and still serializes correctly.
 *
 * This is the "edit → save → reopen → regenerate" scenario compressed
 * into a pure-TS test (no Tauri, no React).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { getEditorMetadata } from "@texisstudio/plugins";

// Side-effect: registers all engine metadata
import "@texisstudio/plugins/engines/metadata-init.js";

import { serializePGFPlots } from "@texisstudio/plugins/engines/pgfplots-engine/serializer.js";
import { serializeGantt } from "@texisstudio/plugins/engines/timeline-gantt-engine/serializer.js";
import { serializeGraphNode } from "@texisstudio/plugins/engines/graph-node-engine/serializer.js";
import { serializeForest } from "@texisstudio/plugins/engines/tree-forest-engine/serializer.js";
import { serializeTableData } from "@texisstudio/plugins/engines/table-data-engine/serializer.js";
import type { PGFPlotsDocument } from "@texisstudio/plugins/engines/pgfplots-engine/types.js";
import type { TimelineGanttDocument } from "@texisstudio/plugins/engines/timeline-gantt-engine/types.js";
import type { GraphNodeDocument } from "@texisstudio/plugins/engines/graph-node-engine/types.js";
import type { TreeForestDocument } from "@texisstudio/plugins/engines/tree-forest-engine/types.js";
import type { TableDataDocument } from "@texisstudio/plugins/engines/table-data-engine/types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Simulate the JSON round-trip that happens when a project is saved and reopened. */
function jsonRoundTrip<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

// ── pgfplots-engine ───────────────────────────────────────────────────────────

describe("metadata round-trip — pgfplots-engine", () => {
  let meta: ReturnType<typeof getEditorMetadata>;

  beforeAll(() => {
    meta = getEditorMetadata("pgfplots-engine");
  });

  it("metadata is registered", () => {
    expect(meta).toBeDefined();
  });

  it("defaultDoc has correct engineId", () => {
    const doc = meta!.defaultDoc() as PGFPlotsDocument;
    expect(doc.engineId).toBe("pgfplots-engine");
  });

  it("defaultDoc serializes without throwing", () => {
    const doc = meta!.defaultDoc() as PGFPlotsDocument;
    expect(() => serializePGFPlots(doc)).not.toThrow();
  });

  it("serialized latex contains \\begin{tikzpicture}", () => {
    const doc = meta!.defaultDoc() as PGFPlotsDocument;
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("\\begin{tikzpicture}");
  });

  it("serialized latex contains \\begin{axis}", () => {
    const doc = meta!.defaultDoc() as PGFPlotsDocument;
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("\\begin{axis}");
  });

  it("defaultDoc survives JSON round-trip and still serializes", () => {
    const doc = jsonRoundTrip(meta!.defaultDoc() as PGFPlotsDocument);
    expect(() => serializePGFPlots(doc)).not.toThrow();
    const latex = serializePGFPlots(doc);
    expect(latex).toContain("\\addplot");
  });

  it("technicalFields contains pgfplotsOptions", () => {
    expect(meta!.technicalFields.some((f) => f.key === "pgfplotsOptions")).toBe(true);
  });

  it("capabilities.historySupported is true", () => {
    expect(meta!.capabilities.historySupported).toBe(true);
  });

  it("capabilities.restoreSupported is true", () => {
    expect(meta!.capabilities.restoreSupported).toBe(true);
  });
});

// ── timeline-gantt-engine ─────────────────────────────────────────────────────

describe("metadata round-trip — timeline-gantt-engine", () => {
  let meta: ReturnType<typeof getEditorMetadata>;

  beforeAll(() => {
    meta = getEditorMetadata("timeline-gantt-engine");
  });

  it("metadata is registered", () => {
    expect(meta).toBeDefined();
  });

  it("defaultDoc has correct engineId", () => {
    const doc = meta!.defaultDoc() as TimelineGanttDocument;
    expect(doc.engineId).toBe("timeline-gantt-engine");
  });

  it("defaultDoc serializes without throwing", () => {
    const doc = meta!.defaultDoc() as TimelineGanttDocument;
    expect(() => serializeGantt(doc)).not.toThrow();
  });

  it("serialized latex contains \\begin{ganttchart}", () => {
    const doc = meta!.defaultDoc() as TimelineGanttDocument;
    const latex = serializeGantt(doc);
    expect(latex).toMatch(/\\begin\{ganttchart\}/);
  });

  it("defaultDoc has at least one task", () => {
    const doc = meta!.defaultDoc() as TimelineGanttDocument;
    expect(doc.tasks.length).toBeGreaterThanOrEqual(1);
  });

  it("survives JSON round-trip", () => {
    const doc = jsonRoundTrip(meta!.defaultDoc() as TimelineGanttDocument);
    expect(() => serializeGantt(doc)).not.toThrow();
  });
});

// ── graph-node-engine ─────────────────────────────────────────────────────────

describe("metadata round-trip — graph-node-engine", () => {
  let meta: ReturnType<typeof getEditorMetadata>;

  beforeAll(() => {
    meta = getEditorMetadata("graph-node-engine");
  });

  it("metadata is registered", () => {
    expect(meta).toBeDefined();
  });

  it("defaultDoc has correct engineId", () => {
    const doc = meta!.defaultDoc() as GraphNodeDocument;
    expect(doc.engineId).toBe("graph-node-engine");
  });

  it("defaultDoc serializes without throwing", () => {
    const doc = meta!.defaultDoc() as GraphNodeDocument;
    expect(() => serializeGraphNode(doc)).not.toThrow();
  });

  it("serialized latex contains \\begin{tikzpicture}", () => {
    const doc = meta!.defaultDoc() as GraphNodeDocument;
    const latex = serializeGraphNode(doc);
    expect(latex).toContain("\\begin{tikzpicture}");
  });

  it("serialized latex contains node labels from defaultDoc", () => {
    const doc = meta!.defaultDoc() as GraphNodeDocument;
    const latex = serializeGraphNode(doc);
    for (const node of doc.nodes) {
      expect(latex).toContain(node.label);
    }
  });

  it("technicalFields contains tikzLibraries", () => {
    expect(meta!.technicalFields.some((f) => f.key === "tikzLibraries")).toBe(true);
  });

  it("survives JSON round-trip", () => {
    const doc = jsonRoundTrip(meta!.defaultDoc() as GraphNodeDocument);
    expect(() => serializeGraphNode(doc)).not.toThrow();
  });
});

// ── tree-forest-engine ────────────────────────────────────────────────────────

describe("metadata round-trip — tree-forest-engine", () => {
  let meta: ReturnType<typeof getEditorMetadata>;

  beforeAll(() => {
    meta = getEditorMetadata("tree-forest-engine");
  });

  it("metadata is registered", () => {
    expect(meta).toBeDefined();
  });

  it("defaultDoc has correct engineId", () => {
    const doc = meta!.defaultDoc() as TreeForestDocument;
    expect(doc.engineId).toBe("tree-forest-engine");
  });

  it("defaultDoc serializes without throwing", () => {
    const doc = meta!.defaultDoc() as TreeForestDocument;
    expect(() => serializeForest(doc)).not.toThrow();
  });

  it("serialized latex contains \\begin{forest}", () => {
    const doc = meta!.defaultDoc() as TreeForestDocument;
    const latex = serializeForest(doc);
    expect(latex).toContain("\\begin{forest}");
  });

  it("serialized latex contains root label", () => {
    const doc = meta!.defaultDoc() as TreeForestDocument;
    const latex = serializeForest(doc);
    expect(latex).toContain(doc.root.label);
  });

  it("technicalFields contains forestOptions", () => {
    expect(meta!.technicalFields.some((f) => f.key === "forestOptions")).toBe(true);
  });

  it("survives JSON round-trip", () => {
    const doc = jsonRoundTrip(meta!.defaultDoc() as TreeForestDocument);
    expect(() => serializeForest(doc)).not.toThrow();
  });
});

// ── table-data-engine ─────────────────────────────────────────────────────────

describe("metadata round-trip — table-data-engine", () => {
  let meta: ReturnType<typeof getEditorMetadata>;

  beforeAll(() => {
    meta = getEditorMetadata("table-data-engine");
  });

  it("metadata is registered", () => {
    expect(meta).toBeDefined();
  });

  it("defaultDoc has correct engineId", () => {
    const doc = meta!.defaultDoc() as TableDataDocument;
    expect(doc.engineId).toBe("table-data-engine");
  });

  it("defaultDoc has columns and rows", () => {
    const doc = meta!.defaultDoc() as TableDataDocument;
    expect(doc.columns.length).toBeGreaterThanOrEqual(1);
    expect(doc.rows.length).toBeGreaterThanOrEqual(1);
  });

  it("defaultDoc serializes without throwing", () => {
    const doc = meta!.defaultDoc() as TableDataDocument;
    expect(() => serializeTableData(doc)).not.toThrow();
  });

  it("booktabs mode contains \\begin{tabular}", () => {
    const doc = { ...(meta!.defaultDoc() as TableDataDocument), exportTarget: "booktabs" as const, booktabsStyle: true };
    const latex = serializeTableData(doc);
    expect(latex).toContain("\\begin{tabular}");
    expect(latex).toContain("\\toprule");
    expect(latex).toContain("\\midrule");
    expect(latex).toContain("\\bottomrule");
    expect(latex).toContain("\\end{tabular}");
  });

  it("longtable mode contains \\begin{longtable}", () => {
    const doc = { ...(meta!.defaultDoc() as TableDataDocument), exportTarget: "longtable" as const, booktabsStyle: true };
    const latex = serializeTableData(doc);
    expect(latex).toContain("\\begin{longtable}");
    expect(latex).toContain("\\endfirsthead");
    expect(latex).toContain("\\endhead");
    expect(latex).toContain("\\end{longtable}");
  });

  it("pgfplots mode contains \\pgfplotstableread", () => {
    const doc = { ...(meta!.defaultDoc() as TableDataDocument), exportTarget: "pgfplots" as const };
    const latex = serializeTableData(doc);
    expect(latex).toContain("\\pgfplotstableread");
  });

  it("hline style uses \\hline instead of booktabs rules", () => {
    const doc = { ...(meta!.defaultDoc() as TableDataDocument), exportTarget: "booktabs" as const, booktabsStyle: false };
    const latex = serializeTableData(doc);
    expect(latex).toContain("\\hline");
    expect(latex).not.toContain("\\toprule");
  });

  it("special chars in headers are escaped", () => {
    const doc: TableDataDocument = {
      ...(meta!.defaultDoc() as TableDataDocument),
      columns: [{ id: "c1", header: "Cost & Fee", type: "number" }],
      rows: [{ c1: 42 }],
      exportTarget: "booktabs",
      booktabsStyle: true,
    };
    const latex = serializeTableData(doc);
    expect(latex).toContain("\\&");
  });

  it("empty columns produces a comment", () => {
    const doc: TableDataDocument = {
      ...(meta!.defaultDoc() as TableDataDocument),
      columns: [],
      rows: [],
    };
    const latex = serializeTableData(doc);
    expect(latex).toMatch(/^% TableData:/);
  });

  it("defaultDoc survives JSON round-trip and still serializes", () => {
    const doc = jsonRoundTrip(meta!.defaultDoc() as TableDataDocument);
    expect(() => serializeTableData(doc)).not.toThrow();
    expect(serializeTableData(doc)).toContain("\\begin{tabular}");
  });
});

// ── Registry completeness ─────────────────────────────────────────────────────

describe("metadata registry — all visual engines registered", () => {
  const VISUAL_ENGINES = [
    "pgfplots-engine",
    "graph-node-engine",
    "timeline-gantt-engine",
    "table-data-engine",
    "tree-forest-engine",
  ];

  for (const engineId of VISUAL_ENGINES) {
    it(`${engineId} is registered`, () => {
      expect(getEditorMetadata(engineId)).toBeDefined();
    });

    it(`${engineId} defaultDoc() returns an object with engineId`, () => {
      const meta = getEditorMetadata(engineId)!;
      const doc = meta.defaultDoc() as { engineId: string };
      expect(doc.engineId).toBe(engineId);
    });
  }

  it("unregistered engine returns undefined", () => {
    expect(getEditorMetadata("nonexistent-engine")).toBeUndefined();
  });
});
