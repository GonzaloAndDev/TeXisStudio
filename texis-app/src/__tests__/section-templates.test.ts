import { describe, it, expect } from "vitest";
import { getSuggestions, KIND_KEY } from "../views/editor/sectionTemplates";

describe("getSuggestions", () => {
  it("returns all tesis templates when nothing is present", () => {
    const suggestions = getSuggestions("tesis", new Set());
    expect(suggestions.length).toBeGreaterThan(0);
    const ids = suggestions.map((s) => s.element_id);
    expect(ids).toContain("introduction");
    expect(ids).toContain("methodology");
    expect(ids).toContain("conclusions");
    expect(ids).toContain("references");
  });

  it("returns all tesina templates when nothing is present", () => {
    const suggestions = getSuggestions("tesina", new Set());
    const ids = suggestions.map((s) => s.element_id);
    expect(ids).toContain("introduction");
    expect(ids).toContain("development");
    expect(ids).toContain("conclusions");
    expect(ids).toContain("references");
  });

  it("returns all tesis_posgrado templates when nothing is present", () => {
    const suggestions = getSuggestions("tesis_posgrado", new Set());
    const ids = suggestions.map((s) => s.element_id);
    expect(ids).toContain("literature_review");
    expect(ids).toContain("theoretical_framework");
  });

  it("tesis_posgrado has more suggestions than tesina", () => {
    const posgrado = getSuggestions("tesis_posgrado", new Set());
    const tesina   = getSuggestions("tesina",         new Set());
    expect(posgrado.length).toBeGreaterThan(tesina.length);
  });

  it("filters out sections already present by element_id", () => {
    const existing = new Set(["introduction", "methodology"]);
    const suggestions = getSuggestions("tesis", existing);
    const ids = suggestions.map((s) => s.element_id);
    expect(ids).not.toContain("introduction");
    expect(ids).not.toContain("methodology");
    expect(ids).toContain("conclusions");
  });

  it("returns empty when all suggestions are already present", () => {
    const tesisSuggestions = getSuggestions("tesis", new Set());
    const allIds = new Set(tesisSuggestions.map((s) => s.element_id));
    const suggestions = getSuggestions("tesis", allIds);
    expect(suggestions).toHaveLength(0);
  });

  it("every suggestion has a titleKey, element_id, and placement", () => {
    for (const kind of ["tesis", "tesina", "tesis_posgrado"] as const) {
      for (const tmpl of getSuggestions(kind, new Set())) {
        expect(tmpl.element_id).toBeTruthy();
        expect(tmpl.titleKey).toMatch(/^editor\.tmpl_/);
        expect(["front_matter", "body", "back_matter", "appendix"]).toContain(tmpl.placement);
      }
    }
  });
});

describe("KIND_KEY", () => {
  it("has an i18n key for every document kind", () => {
    expect(KIND_KEY.tesis).toBe("editor.tmpl_kind_tesis");
    expect(KIND_KEY.tesina).toBe("editor.tmpl_kind_tesina");
    expect(KIND_KEY.tesis_posgrado).toBe("editor.tmpl_kind_tesis_posgrado");
  });
});
