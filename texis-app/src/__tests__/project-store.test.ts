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
