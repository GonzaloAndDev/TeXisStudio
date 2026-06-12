import type { LatexInfo } from "../types";

export type LatexBackend = "tectonic" | "latexmk";

/** Returns the most capable backend available on this system. */
export function getBestAvailableBackend(info: LatexInfo | null): LatexBackend {
  if (!info) return "tectonic";
  return info.latexmk_usable ? "latexmk" : "tectonic";
}

export function resolvePreferredLatexBackend(
  primary: LatexBackend,
  allowFallback: boolean,
  info: LatexInfo | null,
): LatexBackend {
  if (!info || !allowFallback) return primary;

  const primaryAvailable = primary === "tectonic" ? info.has_tectonic : info.latexmk_usable;
  if (primaryAvailable) return primary;

  const fallback: LatexBackend = primary === "tectonic" ? "latexmk" : "tectonic";
  const fallbackAvailable = fallback === "tectonic" ? info.has_tectonic : info.latexmk_usable;
  return fallbackAvailable ? fallback : primary;
}
