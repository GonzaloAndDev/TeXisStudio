// Tests for the citation search/filter flow.
// The citation picker is the primary way users insert bibliography references.
// Regression here means users can't find citations → broken document authoring.

import { describe, it, expect } from "vitest";
import { matchesCitationQuery } from "../views/editor/CitationPickerModal";
import type { BibReference } from "../types";

function ref(overrides: Partial<BibReference> = {}): BibReference {
  return {
    key: "doe2024example",
    entry_type: "article",
    title: "Example Paper on Machine Learning",
    author: "Doe, John and Smith, Jane",
    year: "2024",
    journal: "Nature",
    ...overrides,
  };
}

describe("matchesCitationQuery — empty query", () => {
  it("matches everything when query is empty string", () => {
    expect(matchesCitationQuery(ref(), "")).toBe(true);
  });

  it("matches everything when query is only whitespace", () => {
    // trim() makes whitespace-only behave like empty — accidental spaces show all results
    expect(matchesCitationQuery(ref(), " ")).toBe(true);
    expect(matchesCitationQuery(ref(), "   ")).toBe(true);
  });
});

describe("matchesCitationQuery — search by key", () => {
  it("matches on exact key", () => {
    expect(matchesCitationQuery(ref({ key: "goodfellow2016deep" }), "goodfellow2016deep")).toBe(true);
  });

  it("matches on partial key", () => {
    expect(matchesCitationQuery(ref({ key: "goodfellow2016deep" }), "goodfellow")).toBe(true);
  });

  it("is case-insensitive on key", () => {
    expect(matchesCitationQuery(ref({ key: "Goodfellow2016deep" }), "GOODFELLOW")).toBe(true);
  });
});

describe("matchesCitationQuery — search by title", () => {
  it("matches on partial title", () => {
    expect(matchesCitationQuery(ref({ title: "Deep Learning Fundamentals" }), "deep learning")).toBe(true);
  });

  it("does not match when title does not contain query", () => {
    expect(matchesCitationQuery(ref({ title: "Deep Learning Fundamentals" }), "quantum")).toBe(false);
  });

  it("is case-insensitive on title", () => {
    expect(matchesCitationQuery(ref({ title: "Attention Is All You Need" }), "ATTENTION")).toBe(true);
  });
});

describe("matchesCitationQuery — search by author", () => {
  it("matches on last name", () => {
    expect(matchesCitationQuery(ref({ author: "Vaswani, Ashish and Shazeer, Noam" }), "vaswani")).toBe(true);
  });

  it("matches on partial author name mid-string", () => {
    expect(matchesCitationQuery(ref({ author: "LeCun, Yann and Bengio, Yoshua" }), "bengio")).toBe(true);
  });
});

describe("matchesCitationQuery — search by year", () => {
  it("matches on exact year", () => {
    expect(matchesCitationQuery(ref({ year: "2017" }), "2017")).toBe(true);
  });

  it("does not match a different year", () => {
    expect(matchesCitationQuery(ref({ year: "2017" }), "2023")).toBe(false);
  });
});

describe("matchesCitationQuery — no false positives", () => {
  it("returns false when query matches none of the fields", () => {
    const r = ref({ key: "abc", title: "intro to stats", author: "Jones", year: "2020" });
    expect(matchesCitationQuery(r, "quantum computing 1999")).toBe(false);
  });

  it("does not match journal field (not indexed)", () => {
    // Journal is NOT in the filter — users search by key/title/author/year only.
    const r = ref({ key: "x", title: "x", author: "x", year: "2020", journal: "NeurIPS" });
    expect(matchesCitationQuery(r, "neurips")).toBe(false);
  });
});
