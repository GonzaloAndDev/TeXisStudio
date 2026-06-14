// Integration-level tests for the Zustand project store.
// These exercise the core state transitions without needing a Tauri context.

import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "../stores/project";
import type { ProjectModel, ProjectSection, ContentBlock } from "../types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSection(
  id: string,
  placement: ProjectSection["placement"] = "body",
  enabled = true,
  overrides: Partial<ProjectSection> = {},
): ProjectSection {
  return {
    id,
    element_id: id,
    title: `Section ${id}`,
    placement,
    required: false,
    enabled,
    blocks: [],
    fields: {},
    children: [],
    status: "draft",
    ...overrides,
  };
}

function makeProject(sections: ProjectSection[] = []): ProjectModel {
  return {
    id: "test-project-001",
    schema_version: "1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    profile_id: "generic.thesis",
    metadata: {
      title: "Test Thesis",
      document_kind: "tesis",
      academic_level: "licenciatura",
      language: "spanish",
      city: "CDMX",
      year: 2024,
      keywords: [],
    },
    institution: {
      name: "UNAM",
      country: "México",
    },
    student: {
      full_name: "Test Author",
    },
    sections,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetStore() {
  useProjectStore.setState({
    recentProjects: [],
    activeProject: null,
    activeProjectPath: null,
    activeSectionId: null,
    latexInfo: null,
    theme: "light",
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("project store — openProject", () => {
  beforeEach(resetStore);

  it("stores the project and path", () => {
    const project = makeProject([makeSection("intro")]);
    useProjectStore.getState().openProject(project, "/tmp/test");
    const { activeProject, activeProjectPath } = useProjectStore.getState();
    expect(activeProject?.profile_id).toBe("generic.thesis");
    expect(activeProjectPath).toBe("/tmp/test");
  });

  it("auto-selects the first enabled body section", () => {
    const sections = [
      makeSection("front", "front_matter"),
      makeSection("ch1", "body"),
      makeSection("ch2", "body"),
    ];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    expect(useProjectStore.getState().activeSectionId).toBe("ch1");
  });

  it("selects null when there are no enabled body sections", () => {
    const sections = [makeSection("ch1", "body", false)];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    expect(useProjectStore.getState().activeSectionId).toBeNull();
  });

  it("normalizes sections with missing blocks/fields/children", () => {
    const bare = {
      id: "s1",
      element_id: "s1",
      placement: "body" as const,
      required: false,
      enabled: true,
      status: "draft" as const,
    } as unknown as ProjectSection;
    useProjectStore.getState().openProject(makeProject([bare]), "/tmp/p");
    const s = useProjectStore.getState().activeProject!.sections[0];
    expect(Array.isArray(s.blocks)).toBe(true);
    expect(s.fields).toBeDefined();
    expect(Array.isArray(s.children)).toBe(true);
  });
});

describe("project store — closeProject", () => {
  beforeEach(resetStore);

  it("clears all active project state", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1")]), "/tmp/p");
    useProjectStore.getState().closeProject();
    const { activeProject, activeProjectPath, activeSectionId } = useProjectStore.getState();
    expect(activeProject).toBeNull();
    expect(activeProjectPath).toBeNull();
    expect(activeSectionId).toBeNull();
  });
});

describe("project store — updateSectionBlocks", () => {
  beforeEach(resetStore);

  it("replaces blocks only for the target section", () => {
    const sections = [makeSection("ch1"), makeSection("ch2")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");

    const newBlocks: ContentBlock[] = [
      { type: "paragraph", id: "b1", content: "Hello world" },
    ];
    useProjectStore.getState().updateSectionBlocks("ch1", newBlocks);

    const { activeProject } = useProjectStore.getState();
    expect(activeProject!.sections.find(s => s.id === "ch1")!.blocks).toEqual(newBlocks);
    expect(activeProject!.sections.find(s => s.id === "ch2")!.blocks).toEqual([]);
  });

  it("is a no-op when no project is open", () => {
    expect(() =>
      useProjectStore.getState().updateSectionBlocks("ch1", [])
    ).not.toThrow();
    expect(useProjectStore.getState().activeProject).toBeNull();
  });
});

describe("project store — updateSectionMeta", () => {
  beforeEach(resetStore);

  it("updates status for the target section", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1")]), "/tmp/p");
    useProjectStore.getState().updateSectionMeta("ch1", "approved");
    const s = useProjectStore.getState().activeProject!.sections[0];
    expect(s.status).toBe("approved");
  });

  it("updates notes when provided", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1")]), "/tmp/p");
    useProjectStore.getState().updateSectionMeta("ch1", "in_review", "Needs citations");
    const s = useProjectStore.getState().activeProject!.sections[0];
    expect(s.notes).toBe("Needs citations");
  });

  it("does not overwrite existing notes when none provided", () => {
    const s = makeSection("ch1", "body", true, { notes: "Keep this" });
    useProjectStore.getState().openProject(makeProject([s]), "/tmp/p");
    useProjectStore.getState().updateSectionMeta("ch1", "revised");
    const updated = useProjectStore.getState().activeProject!.sections[0];
    expect(updated.notes).toBe("Keep this");
  });
});

describe("project store — updateProject", () => {
  beforeEach(resetStore);

  it("merges partial updates into the active project", () => {
    useProjectStore.getState().openProject(makeProject([]), "/tmp/p");
    useProjectStore.getState().updateProject({ profile_id: "generic.tesina" });
    expect(useProjectStore.getState().activeProject!.profile_id).toBe("generic.tesina");
  });

  it("is a no-op when no project is open", () => {
    expect(() =>
      useProjectStore.getState().updateProject({ profile_id: "x" })
    ).not.toThrow();
    expect(useProjectStore.getState().activeProject).toBeNull();
  });
});

describe("project store — latexInfo", () => {
  beforeEach(resetStore);

  it("stores latex detection result", () => {
    const info = {
      has_latexmk: true,
      has_xelatex: true,
      has_biber: true,
      is_usable: true,
      latexmk_usable: true,
      has_tectonic: false,
      available_backends: [],
    };
    useProjectStore.getState().setLatexInfo(info as Parameters<typeof useProjectStore.getState.apply>[0] extends never ? never : ReturnType<typeof useProjectStore.getState>["setLatexInfo"] extends (a: infer A) => void ? A : never);
    expect(useProjectStore.getState().latexInfo!.is_usable).toBe(true);
  });
});

// ── Section tree actions ───────────────────────────────────────────────────────

describe("project store — addSection", () => {
  beforeEach(resetStore);

  it("appends the new section to the end", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1")]), "/tmp/p");
    useProjectStore.getState().addSection(makeSection("ch2"));
    const { sections } = useProjectStore.getState().activeProject!;
    expect(sections).toHaveLength(2);
    expect(sections[1].id).toBe("ch2");
  });

  it("is a no-op when no project is open", () => {
    expect(() => useProjectStore.getState().addSection(makeSection("ch1"))).not.toThrow();
    expect(useProjectStore.getState().activeProject).toBeNull();
  });
});

describe("project store — removeSection", () => {
  beforeEach(resetStore);

  it("removes only the target section", () => {
    const sections = [makeSection("ch1"), makeSection("ch2"), makeSection("ch3")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().removeSection("ch2");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch1", "ch3"]);
  });

  it("is a no-op for an unknown id", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1")]), "/tmp/p");
    useProjectStore.getState().removeSection("nonexistent");
    expect(useProjectStore.getState().activeProject!.sections).toHaveLength(1);
  });
});

describe("project store — insertSectionAt", () => {
  beforeEach(resetStore);

  it("inserts at the specified index", () => {
    const sections = [makeSection("ch1"), makeSection("ch3")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().insertSectionAt(makeSection("ch2"), 1);
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch1", "ch2", "ch3"]);
  });

  it("appends when index exceeds length", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1")]), "/tmp/p");
    useProjectStore.getState().insertSectionAt(makeSection("ch2"), 99);
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch1", "ch2"]);
  });

  it("inserts at position 0 correctly", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch2")]), "/tmp/p");
    useProjectStore.getState().insertSectionAt(makeSection("ch1"), 0);
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch1", "ch2"]);
  });
});

describe("project store — toggleSectionEnabled", () => {
  beforeEach(resetStore);

  it("disables an enabled section", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1", "body", true)]), "/tmp/p");
    useProjectStore.getState().toggleSectionEnabled("ch1");
    expect(useProjectStore.getState().activeProject!.sections[0].enabled).toBe(false);
  });

  it("enables a disabled section", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1", "body", false)]), "/tmp/p");
    useProjectStore.getState().toggleSectionEnabled("ch1");
    expect(useProjectStore.getState().activeProject!.sections[0].enabled).toBe(true);
  });

  it("does not affect other sections", () => {
    const sections = [makeSection("ch1"), makeSection("ch2")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().toggleSectionEnabled("ch1");
    expect(useProjectStore.getState().activeProject!.sections[1].enabled).toBe(true);
  });
});

describe("project store — moveSectionUp / moveSectionDown", () => {
  beforeEach(resetStore);

  it("moveSectionUp swaps with the previous section in the same group", () => {
    const sections = [makeSection("ch1"), makeSection("ch2"), makeSection("ch3")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().moveSectionUp("ch2");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch2", "ch1", "ch3"]);
  });

  it("moveSectionDown swaps with the next section in the same group", () => {
    const sections = [makeSection("ch1"), makeSection("ch2"), makeSection("ch3")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().moveSectionDown("ch2");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch1", "ch3", "ch2"]);
  });

  it("moveSectionUp is a no-op for the first section in its group", () => {
    const sections = [makeSection("ch1"), makeSection("ch2")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().moveSectionUp("ch1");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch1", "ch2"]);
  });

  it("moveSectionDown is a no-op for the last section in its group", () => {
    const sections = [makeSection("ch1"), makeSection("ch2")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().moveSectionDown("ch2");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch1", "ch2"]);
  });

  it("moveSectionUp does not cross placement boundaries", () => {
    const sections = [
      makeSection("front1", "front_matter"),
      makeSection("body1", "body"),
    ];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().moveSectionUp("body1");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["front1", "body1"]);
  });

  it("moveSectionDown does not cross placement boundaries", () => {
    const sections = [
      makeSection("body1", "body"),
      makeSection("back1", "back_matter"),
    ];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().moveSectionDown("body1");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["body1", "back1"]);
  });
});

describe("project store — renameSection", () => {
  beforeEach(resetStore);

  it("sets the title", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1")]), "/tmp/p");
    useProjectStore.getState().renameSection("ch1", "My Chapter");
    expect(useProjectStore.getState().activeProject!.sections[0].title).toBe("My Chapter");
  });

  it("sets title to undefined when empty string passed", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1")]), "/tmp/p");
    useProjectStore.getState().renameSection("ch1", "");
    expect(useProjectStore.getState().activeProject!.sections[0].title).toBeUndefined();
  });
});

describe("project store — patchSection", () => {
  beforeEach(resetStore);

  it("merges a partial patch into the section", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1")]), "/tmp/p");
    useProjectStore.getState().patchSection("ch1", { status: "approved", notes: "Done" });
    const s = useProjectStore.getState().activeProject!.sections[0];
    expect(s.status).toBe("approved");
    expect(s.notes).toBe("Done");
  });

  it("does not affect other sections", () => {
    const sections = [makeSection("ch1"), makeSection("ch2")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().patchSection("ch1", { status: "in_review" });
    const ch2 = useProjectStore.getState().activeProject!.sections[1];
    expect(ch2.status).toBe("draft");
  });

  it("can change placement", () => {
    useProjectStore.getState().openProject(makeProject([makeSection("ch1", "body")]), "/tmp/p");
    useProjectStore.getState().patchSection("ch1", { placement: "appendix" });
    expect(useProjectStore.getState().activeProject!.sections[0].placement).toBe("appendix");
  });
});

describe("project store — reorderSection", () => {
  beforeEach(resetStore);

  it("moves a section before the target in the same group", () => {
    const sections = [makeSection("ch1"), makeSection("ch2"), makeSection("ch3")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().reorderSection("ch3", "ch1", "before");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch3", "ch1", "ch2"]);
  });

  it("moves a section after the target in the same group", () => {
    const sections = [makeSection("ch1"), makeSection("ch2"), makeSection("ch3")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().reorderSection("ch1", "ch3", "after");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch2", "ch3", "ch1"]);
  });

  it("is a no-op when source and target are the same", () => {
    const sections = [makeSection("ch1"), makeSection("ch2")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().reorderSection("ch1", "ch1", "before");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["ch1", "ch2"]);
  });

  it("is a no-op when sections are in different placement groups", () => {
    const sections = [makeSection("body1", "body"), makeSection("back1", "back_matter")];
    useProjectStore.getState().openProject(makeProject(sections), "/tmp/p");
    useProjectStore.getState().reorderSection("body1", "back1", "before");
    const ids = useProjectStore.getState().activeProject!.sections.map((s) => s.id);
    expect(ids).toEqual(["body1", "back1"]);
  });
});
