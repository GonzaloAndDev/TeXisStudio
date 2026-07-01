import { describe, it, expect } from "vitest";
import { seedSampleContent } from "../services/sampleContent";
import type { ProjectSection } from "../types";

function section(overrides: Partial<ProjectSection>): ProjectSection {
  return {
    id: "s1",
    element_id: "generic",
    title: "Generic",
    placement: "body",
    required: true,
    enabled: true,
    blocks: [],
    fields: {},
    children: [],
    ...overrides,
  };
}

describe("seedSampleContent", () => {
  it("seeds a paragraph into an empty enabled body section", () => {
    const [out] = seedSampleContent([section({ title: "Methods" })], "en");
    expect(out.blocks.length).toBe(1);
    expect(out.blocks[0].type).toBe("paragraph");
    expect((out.blocks[0] as { content: string }).content).toContain("Methods");
  });

  it("gives the introduction a richer template with a list and equation", () => {
    const [out] = seedSampleContent(
      [section({ id: "intro", element_id: "introduction", title: "Introduction" })],
      "en",
    );
    const types = out.blocks.map((b) => b.type);
    expect(types).toContain("list");
    expect(types).toContain("equation");
    expect(out.blocks.some((b) => b.type === "equation" && (b as { numbered: boolean }).numbered)).toBe(true);
  });

  it("localizes seeded prose by document language", () => {
    const [en] = seedSampleContent([section({ title: "Análisis" })], "en");
    const [es] = seedSampleContent([section({ title: "Análisis" })], "es");
    expect((en.blocks[0] as { content: string }).content).not.toEqual(
      (es.blocks[0] as { content: string }).content,
    );
    expect((es.blocks[0] as { content: string }).content).toContain("sección");
  });

  it("falls back to English for unknown document languages", () => {
    const [en] = seedSampleContent([section({ title: "X" })], "en");
    const [ja] = seedSampleContent([section({ title: "X" })], "ja");
    expect((ja.blocks[0] as { content: string }).content).toEqual(
      (en.blocks[0] as { content: string }).content,
    );
  });

  it("never overwrites sections that already have content", () => {
    const existing = section({
      blocks: [{ type: "paragraph", id: "x", content: "mine" }],
    });
    const [out] = seedSampleContent([existing], "en");
    expect(out.blocks).toHaveLength(1);
    expect((out.blocks[0] as { content: string }).content).toBe("mine");
  });

  it("leaves non-body and disabled sections untouched", () => {
    const front = section({ placement: "front_matter" });
    const disabled = section({ enabled: false });
    const appendix = section({ placement: "appendix" });
    const out = seedSampleContent([front, disabled, appendix], "en");
    expect(out.every((s) => s.blocks.length === 0)).toBe(true);
  });
});
