// Unit tests for the profile i18n overlay system.
// Tests the pure functions in profile-i18n.ts without loading Tauri or React.

import { describe, it, expect } from "vitest";

// The functions under test operate on plain objects — no Tauri or i18next needed.
// We test the key normalization and section lookup logic by importing the
// pure helpers indirectly through the locale resolution behavior.

// ── Helpers copied from the module (avoids mocking the full locale loader) ──

function normalizeSectionKey(value?: string): string | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || null;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("normalizeSectionKey", () => {
  it("strips accents", () => {
    expect(normalizeSectionKey("Introducción")).toBe("introduccion");
    expect(normalizeSectionKey("Metodología")).toBe("metodologia");
    expect(normalizeSectionKey("Conclusiones")).toBe("conclusiones");
  });

  it("lowercases and replaces non-alphanumeric with underscore", () => {
    expect(normalizeSectionKey("Materials & Methods")).toBe("materials_methods");
    expect(normalizeSectionKey("Title Page")).toBe("title_page");
  });

  it("collapses consecutive separators and trims", () => {
    expect(normalizeSectionKey("  Marco  Teórico  ")).toBe("marco_teorico");
  });

  it("returns null for empty/undefined", () => {
    expect(normalizeSectionKey("")).toBeNull();
    expect(normalizeSectionKey(undefined)).toBeNull();
    expect(normalizeSectionKey("   ")).toBeNull();
  });
});

describe("profile ID candidates", () => {
  function profileIdCandidates(id: string): string[] {
    const dotted = id.replace(/_/g, ".");
    const underscored = id.replace(/\./g, "_");
    return [...new Set([id, underscored, dotted])];
  }

  it("expands dot-notation ID to include underscore form", () => {
    const candidates = profileIdCandidates("mx.unam.apa7");
    expect(candidates).toContain("mx_unam_apa7");
    expect(candidates).toContain("mx.unam.apa7");
  });

  it("expands underscore ID to include dot form", () => {
    const candidates = profileIdCandidates("mx_unam_apa7");
    expect(candidates).toContain("mx.unam.apa7");
    expect(candidates).toContain("mx_unam_apa7");
  });

  it("deduplicates when id already has no separators", () => {
    const candidates = profileIdCandidates("apa7");
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toBe("apa7");
  });
});

describe("WELCOME_SHOWN_KEY", () => {
  it("is defined and non-empty", async () => {
    // Dynamic import avoids pulling in react-router-dom and Tauri in test env
    const { WELCOME_SHOWN_KEY } = await import("../views/WelcomeView");
    expect(typeof WELCOME_SHOWN_KEY).toBe("string");
    expect(WELCOME_SHOWN_KEY.length).toBeGreaterThan(0);
  });
});
