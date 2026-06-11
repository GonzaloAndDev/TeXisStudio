import { describe, expect, it } from "vitest";
import { resolvePreferredLatexBackend } from "../lib/latexBackendPreference";
import type { LatexInfo } from "../types";

function info(tectonic: boolean, latexmk: boolean): LatexInfo {
  return {
    has_latexmk: latexmk,
    has_xelatex: latexmk,
    has_biber: latexmk,
    is_usable: tectonic || latexmk,
    latexmk_usable: latexmk,
    has_tectonic: tectonic,
    available_backends: [],
  };
}

describe("LaTeX backend preference", () => {
  it("uses the configured primary backend when available", () => {
    expect(resolvePreferredLatexBackend("tectonic", true, info(true, true))).toBe("tectonic");
    expect(resolvePreferredLatexBackend("latexmk", true, info(true, true))).toBe("latexmk");
  });

  it("uses the other backend when fallback is enabled and primary is unavailable", () => {
    expect(resolvePreferredLatexBackend("tectonic", true, info(false, true))).toBe("latexmk");
    expect(resolvePreferredLatexBackend("latexmk", true, info(true, false))).toBe("tectonic");
  });

  it("keeps the configured backend when fallback is disabled", () => {
    expect(resolvePreferredLatexBackend("tectonic", false, info(false, true))).toBe("tectonic");
  });
});
