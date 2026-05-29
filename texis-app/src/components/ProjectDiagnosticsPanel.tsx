/**
 * ProjectDiagnosticsPanel — estado de salud del proyecto.
 * Muestra issues de paquetes, glosario y estructura sin necesidad de compilar.
 */

import { useEffect, useState } from "react";
import { api } from "../lib/tauri";

interface PackageIssue {
  package_name: string;
  priority: string;
  already_declared: boolean;
}
interface PackageConflict {
  package_a: string;
  package_b: string;
  description: string;
  is_blocking: boolean;
}
interface GlossaryEntry {
  key: string;
  status: string;
}

export function ProjectDiagnosticsPanel({ projectPath }: { projectPath: string | null }) {
  const [pkgMissing, setPkgMissing]     = useState<PackageIssue[]>([]);
  const [pkgConflicts, setPkgConflicts] = useState<PackageConflict[]>([]);
  const [glsUndefined, setGlsUndefined] = useState<string[]>([]);
  const [glsUnused, setGlsUnused]       = useState<number>(0);
  const [loading, setLoading]           = useState(false);
  const [open, setOpen]                 = useState(true);

  useEffect(() => {
    if (!projectPath) return;
    setLoading(true);

    Promise.allSettled([
      api.analyzePackages(projectPath),
      api.analyzeGlossary(projectPath),
    ]).then(([pkgResult, glsResult]) => {
      if (pkgResult.status === "fulfilled") {
        const p = pkgResult.value;
        setPkgMissing(p.missing.filter((m) => m.priority === "required" && !m.already_declared));
        setPkgConflicts(p.conflicts);
      }
      if (glsResult.status === "fulfilled") {
        const g = glsResult.value;
        setGlsUndefined(g.undefined_references);
        const allEntries: GlossaryEntry[] = [...g.entries, ...g.acronyms];
        setGlsUnused(allEntries.filter((e) => e.status === "defined_unused").length);
      }
    }).finally(() => setLoading(false));
  }, [projectPath]);

  const total = pkgMissing.length + pkgConflicts.length + glsUndefined.length;
  const hasBlocking = pkgConflicts.some((c) => c.is_blocking);

  if (!projectPath) return null;

  const dotColor = hasBlocking
    ? "var(--build-err)"
    : total > 0
    ? "var(--build-warn)"
    : "var(--build-ok)";

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          fontSize: "var(--fs-xs)", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.07em",
          color: "var(--fg-faint)", padding: 0,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        Diagnósticos del proyecto
        {loading && <span style={{ marginLeft: "auto", fontSize: 10 }}>…</span>}
        {!loading && <span style={{ marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>}
      </button>

      {open && !loading && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {total === 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-ok)", display: "flex", gap: 5, alignItems: "center" }}>
              ✓ Sin issues detectados
            </div>
          )}

          {pkgConflicts.map((c, i) => (
            <div key={i} style={{ fontSize: "var(--fs-xs)", color: c.is_blocking ? "var(--build-err)" : "var(--build-warn)", lineHeight: 1.4 }}>
              {c.is_blocking ? "✗" : "⚠"} {c.description}
            </div>
          ))}

          {pkgMissing.map((m, i) => (
            <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.4 }}>
              + Falta <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-strong)" }}>{m.package_name}</span> en preámbulo
            </div>
          ))}

          {glsUndefined.map((k, i) => (
            <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--build-warn)", lineHeight: 1.4 }}>
              ⚠ <span style={{ fontFamily: "var(--font-mono)" }}>\gls{"{" + k + "}"}</span> sin definir
            </div>
          ))}

          {glsUnused > 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.4 }}>
              {glsUnused} entr{glsUnused === 1 ? "ada" : "adas"} de glosario definida{glsUnused === 1 ? "" : "s"} sin usar
            </div>
          )}
        </div>
      )}
    </div>
  );
}
