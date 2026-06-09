// Validates that BROWSER_MOCKS in lib/tauri.ts satisfy the TypeScript types.
// These mocks are the fallback in web-dev mode and must match production shapes
// so a test in browser doesn't diverge from the Tauri build.

import { describe, it, expect } from "vitest";
import type { LatexInfo, DoctorReport, ProfileLockStatus } from "../types";

// We import the module in a way that works in Node (no window.__TAURI_INTERNALS__).
// The mock data is exercised via type-checking at compile time; here we verify
// runtime shapes for the most critical commands.

describe("BROWSER_MOCKS shape — detect_latex", () => {
  it("has all required fields of LatexInfo", async () => {
    // Dynamically import to avoid side-effects at module level
    const mod = await import("../lib/tauri");
    // Call detectLatex in non-Tauri mode — should return the mock
    const result = await mod.api.detectLatex() as LatexInfo;
    expect(typeof result.has_latexmk).toBe("boolean");
    expect(typeof result.has_xelatex).toBe("boolean");
    expect(typeof result.is_usable).toBe("boolean");
    expect(typeof result.has_tectonic).toBe("boolean");
    expect(Array.isArray(result.available_backends)).toBe(true);
  });
});

describe("BROWSER_MOCKS shape — run_system_doctor", () => {
  it("has all required fields of DoctorReport", async () => {
    const mod = await import("../lib/tauri");
    const result = await mod.api.runSystemDoctor("xelatex", "biber", "apa", false) as DoctorReport;
    expect(Array.isArray(result.checks)).toBe(true);
    expect(typeof result.environment_ok).toBe("boolean");
    expect(typeof result.has_critical_missing).toBe("boolean");
  });
});

describe("BROWSER_MOCKS shape — check_profile_lock", () => {
  it("has all required fields of ProfileLockStatus", async () => {
    const mod = await import("../lib/tauri");
    const result = await mod.api.checkProfileLock("/tmp/p") as ProfileLockStatus;
    expect(typeof result.locked).toBe("boolean");
    // lock can be null or an object
    expect("lock" in result).toBe(true);
  });
});

describe("BROWSER_MOCKS shape — list_references", () => {
  it("returns an array with properly shaped BibReference objects", async () => {
    const mod = await import("../lib/tauri");
    const refs = await mod.api.listReferences("/tmp/p");
    expect(Array.isArray(refs)).toBe(true);
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) {
      expect(typeof r.key).toBe("string");
      expect(typeof r.title).toBe("string");
      expect(typeof r.author).toBe("string");
      expect(typeof r.year).toBe("string");
      expect(typeof r.entry_type).toBe("string");
    }
  });
});

describe("BROWSER_MOCKS shape — get_profiles", () => {
  it("returns profiles with required fields", async () => {
    const mod = await import("../lib/tauri");
    const profiles = await mod.api.getProfiles();
    expect(Array.isArray(profiles)).toBe(true);
    for (const p of profiles) {
      expect(typeof p.id).toBe("string");
      expect(typeof p.name).toBe("string");
      expect(typeof p.description).toBe("string");
      expect(Array.isArray(p.sections)).toBe(true);
    }
  });
});
