import { describe, it, expect, beforeEach } from "vitest";
import {
  buildCheckpoint,
  diffAgainstCheckpoint,
  saveCheckpoint,
  loadCheckpoint,
  clearCheckpoint,
} from "../services/reviewCheckpoint";
import type { ProjectModel, ProjectSection, ContentBlock } from "../types";

function para(content: string): ContentBlock {
  return { type: "paragraph", id: Math.random().toString(36).slice(2), content };
}

function section(id: string, blocks: ContentBlock[], overrides: Partial<ProjectSection> = {}): ProjectSection {
  return {
    id,
    element_id: id,
    title: id,
    placement: "body",
    required: false,
    enabled: true,
    status: "draft",
    blocks,
    fields: {},
    children: [],
    ...overrides,
  };
}

function model(sections: ProjectSection[]): ProjectModel {
  return { sections } as unknown as ProjectModel;
}

describe("reviewCheckpoint diff", () => {
  it("reports no baseline when there is no checkpoint", () => {
    const diff = diffAgainstCheckpoint(model([section("intro", [para("hello world")])]), null);
    expect(diff.since).toBeNull();
    expect(diff.hasChanges).toBe(false);
  });

  it("detects growth in a section", () => {
    const before = buildCheckpoint(model([section("intro", [para("one two")])]));
    const after = model([section("intro", [para("one two three four five")])]);
    const diff = diffAgainstCheckpoint(after, before);
    expect(diff.hasChanges).toBe(true);
    const change = diff.changes.find((c) => c.id === "intro");
    expect(change?.kind).toBe("grew");
    expect(change?.wordDelta).toBe(3);
  });

  it("detects shrink", () => {
    const before = buildCheckpoint(model([section("m", [para("a b c d")])]));
    const after = model([section("m", [para("a b")])]);
    const change = diffAgainstCheckpoint(after, before).changes.find((c) => c.id === "m");
    expect(change?.kind).toBe("shrank");
    expect(change?.wordDelta).toBe(-2);
  });

  it("detects a status transition with no word change", () => {
    const before = buildCheckpoint(model([section("m", [para("a b")], { status: "draft" })]));
    const after = model([section("m", [para("a b")], { status: "approved" })]);
    const change = diffAgainstCheckpoint(after, before).changes.find((c) => c.id === "m");
    expect(change?.kind).toBe("status");
    expect(change?.fromStatus).toBe("draft");
    expect(change?.toStatus).toBe("approved");
  });

  it("detects an added section", () => {
    const before = buildCheckpoint(model([section("a", [para("x")])]));
    const after = model([section("a", [para("x")]), section("b", [para("new words here")])]);
    const change = diffAgainstCheckpoint(after, before).changes.find((c) => c.id === "b");
    expect(change?.kind).toBe("added");
  });

  it("detects a removed section", () => {
    const before = buildCheckpoint(model([section("a", [para("x")]), section("b", [para("y z")])]));
    const after = model([section("a", [para("x")])]);
    const change = diffAgainstCheckpoint(after, before).changes.find((c) => c.id === "b");
    expect(change?.kind).toBe("removed");
  });

  it("reports no changes when nothing moved", () => {
    const m = model([section("a", [para("stable text")])]);
    const diff = diffAgainstCheckpoint(m, buildCheckpoint(m));
    expect(diff.hasChanges).toBe(false);
    expect(diff.since).not.toBeNull();
  });

  it("ignores non-body and disabled sections", () => {
    const before = buildCheckpoint(model([
      section("body", [para("a")]),
      section("front", [para("b")], { placement: "front_matter" }),
    ]));
    // front matter grew, but it must not appear in the diff
    const after = model([
      section("body", [para("a")]),
      section("front", [para("b c d e")], { placement: "front_matter" }),
    ]);
    const diff = diffAgainstCheckpoint(after, before);
    expect(diff.changes.find((c) => c.id === "front")).toBeUndefined();
  });

  it("persists and reloads a checkpoint by project path", () => {
    const path = "/tmp/proj-A";
    clearCheckpoint(path);
    expect(loadCheckpoint(path)).toBeNull();
    saveCheckpoint(path, model([section("a", [para("one two three")])]));
    const loaded = loadCheckpoint(path);
    expect(loaded?.sections["a"].words).toBe(3);
    clearCheckpoint(path);
    expect(loadCheckpoint(path)).toBeNull();
  });

  it("keeps checkpoints isolated per project path", () => {
    saveCheckpoint("/tmp/proj-1", model([section("a", [para("one")])]));
    saveCheckpoint("/tmp/proj-2", model([section("a", [para("one two three four")])]));
    expect(loadCheckpoint("/tmp/proj-1")?.sections["a"].words).toBe(1);
    expect(loadCheckpoint("/tmp/proj-2")?.sections["a"].words).toBe(4);
    clearCheckpoint("/tmp/proj-1");
    clearCheckpoint("/tmp/proj-2");
  });
});

// The vitest node runtime ships an experimental localStorage that does not
// actually persist without a backing file, so we install a deterministic
// in-memory shim for this file's tests regardless of what's already there.
beforeEach(() => {
  const store = new Map<string, string>();
  // @ts-expect-error minimal shim
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
});
