import { describe, it, expect } from "vitest";
import {
  treeToSystem,
  systemToTree,
  addRow,
  addCasesBlock,
  removeRow,
  parseVariables,
  sanitizeLabel,
  setCaseField,
  addCase,
  removeCase,
} from "../components/visual-editors/math-transforms";
import type { MathEngineDocument, SystemDocument, MathNode } from "../types-engines";

const baseDoc: MathEngineDocument = {
  engineId: "math-engine",
  version: "1.0.0",
  mode: "align",
  numbered: true,
  label: "eq:test",
  tree: [
    { type: "symbol", content: "x &= 1" },
    { type: "symbol", content: "y &= 2" },
  ],
};

// ── tree ↔ system migration ────────────────────────────────────────────────

describe("treeToSystem", () => {
  it("migrates symbol/text nodes into equations[]", () => {
    const next = treeToSystem(baseDoc);
    expect(next.mode).toBe("system");
    expect(next.equations).toEqual(["x &= 1", "y &= 2"]);
    expect(next.tree).toEqual([]);
    expect(next.numbered).toBe(true);
    expect(next.label).toBe("eq:test");
  });

  it("preserves provided variables", () => {
    const next = treeToSystem(baseDoc, ["x", "y"]);
    expect(next.variables).toEqual(["x", "y"]);
  });

  it("falls back to a placeholder when tree has no symbols", () => {
    const empty: MathEngineDocument = { ...baseDoc, tree: [] };
    const next = treeToSystem(empty);
    expect(next.equations.length).toBe(1);
    expect(next.equations[0]).toMatch(/&=/);
  });

  it("ignores non-symbol nodes (cases, etc.) — they don't fit system mode", () => {
    const mixed: MathEngineDocument = {
      ...baseDoc,
      tree: [
        { type: "symbol", content: "a &= b" },
        { type: "cases", content: "", options: { cases: [] } },
      ],
    };
    const next = treeToSystem(mixed);
    expect(next.equations).toEqual(["a &= b"]);
  });
});

describe("systemToTree", () => {
  const sys: SystemDocument = {
    engineId: "math-engine",
    version: "1.0.0",
    mode: "system",
    numbered: false,
    tree: [],
    equations: ["x + y &= 1", "x - y &= 0"],
    variables: ["x", "y"],
  };

  it("turns each equation into a symbol node and applies target mode", () => {
    const next = systemToTree(sys, "align");
    expect(next.mode).toBe("align");
    expect(next.tree).toEqual([
      { type: "symbol", content: "x + y &= 1" },
      { type: "symbol", content: "x - y &= 0" },
    ]);
  });

  it("preserves numbered + label flags", () => {
    const withLabel: SystemDocument = { ...sys, label: "eq:sys" };
    const next = systemToTree(withLabel, "gather");
    expect(next.label).toBe("eq:sys");
    expect(next.numbered).toBe(false);
  });
});

// ── row operations ─────────────────────────────────────────────────────────

describe("addRow / removeRow / addCasesBlock", () => {
  it("addRow appends a blank symbol node", () => {
    const next = addRow(baseDoc);
    expect(next.tree.length).toBe(3);
    expect(next.tree[2]).toEqual({ type: "symbol", content: "" });
  });

  it("removeRow drops the indexed entry", () => {
    const next = removeRow(baseDoc, 0);
    expect(next.tree.length).toBe(1);
    expect(next.tree[0].content).toBe("y &= 2");
  });

  it("removeRow no-ops on out-of-range index", () => {
    expect(removeRow(baseDoc, -1)).toBe(baseDoc);
    expect(removeRow(baseDoc, 99)).toBe(baseDoc);
  });

  it("addCasesBlock appends a cases node with 2 placeholder cases", () => {
    const next = addCasesBlock(baseDoc);
    const last = next.tree[next.tree.length - 1];
    expect(last.type).toBe("cases");
    const cases = last.options?.["cases"] as Array<unknown>;
    expect(cases.length).toBe(2);
  });
});

// ── parsers / sanitizers ───────────────────────────────────────────────────

describe("parseVariables", () => {
  it("splits, trims, drops empty", () => {
    expect(parseVariables("x_1, x_2 , , x_3,")).toEqual(["x_1", "x_2", "x_3"]);
  });
  it("returns [] for empty/whitespace input", () => {
    expect(parseVariables("")).toEqual([]);
    expect(parseVariables("   ,  ,")).toEqual([]);
  });
});

describe("sanitizeLabel", () => {
  it("strips disallowed characters", () => {
    expect(sanitizeLabel("eq:my equation #1!")).toBe("eq:myequation1");
  });
  it("keeps a-z A-Z 0-9 _ : -", () => {
    expect(sanitizeLabel("eq:foo_bar-1:2")).toBe("eq:foo_bar-1:2");
  });
});

// ── cases helpers ──────────────────────────────────────────────────────────

describe("cases helpers", () => {
  const node: MathNode = {
    type: "cases", content: "",
    options: { cases: [
      { expr: "x", cond: "\\text{if } x > 0" },
      { expr: "0", cond: "\\text{otherwise}" },
    ] },
  };

  it("setCaseField updates only the indexed case+field", () => {
    const next = setCaseField(node, 0, "expr", "2x");
    const cases = next.options?.["cases"] as Array<{ expr: string; cond: string }>;
    expect(cases[0].expr).toBe("2x");
    expect(cases[0].cond).toBe("\\text{if } x > 0");
    expect(cases[1]).toEqual({ expr: "0", cond: "\\text{otherwise}" });
  });

  it("addCase appends a new placeholder case", () => {
    const next = addCase(node);
    const cases = next.options?.["cases"] as Array<unknown>;
    expect(cases.length).toBe(3);
  });

  it("removeCase drops the indexed entry", () => {
    const next = removeCase(node, 0);
    const cases = next.options?.["cases"] as Array<{ expr: string }>;
    expect(cases.length).toBe(1);
    expect(cases[0].expr).toBe("0");
  });
});
