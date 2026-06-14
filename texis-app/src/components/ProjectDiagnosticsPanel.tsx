/**
 * ProjectDiagnosticsPanel — estado de salud del proyecto.
 * Muestra issues de paquetes, glosario y estructura sin necesidad de compilar.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/tauri";
import { useToast } from "./ui/ToastProvider";

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
  const { t } = useTranslation();
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

  const toast = useToast();
  const total = pkgMissing.length + pkgConflicts.length + glsUndefined.length;
  const hasBlocking = pkgConflicts.some((c) => c.is_blocking);

  const handleExportLogs = useCallback(async () => {
    try {
      const dir = await api.getLogDir();
      await api.openInSystem(dir);
    } catch {
      toast.error(t("editor.diag_log_error"));
    }
  }, [toast, t]);

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
        {t("editor.diag_title")}
        {loading && <span style={{ marginLeft: "auto", fontSize: 10 }}>…</span>}
        {!loading && <span style={{ marginLeft: "auto" }}>{open ? "▲" : "▼"}</span>}
      </button>

      {open && !loading && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {total === 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-ok)", display: "flex", gap: 5, alignItems: "center" }}>
              ✓ {t("editor.diag_ok")}
            </div>
          )}

          {pkgConflicts.map((c, i) => (
            <div key={i} style={{ fontSize: "var(--fs-xs)", color: c.is_blocking ? "var(--build-err)" : "var(--build-warn)", lineHeight: 1.4 }}>
              {c.is_blocking ? "✗" : "⚠"} {c.description}
            </div>
          ))}

          {pkgMissing.map((m, i) => (
            <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.4 }}>
              + {t("editor.diag_pkg_missing", { pkg: m.package_name })}
            </div>
          ))}

          {glsUndefined.map((k, i) => (
            <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--build-warn)", lineHeight: 1.4 }}>
              ⚠ <span style={{ fontFamily: "var(--font-mono)" }}>\gls{"{" + k + "}"}</span> {t("editor.diag_gls_undefined")}
            </div>
          ))}

          {glsUnused > 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.4 }}>
              {t(glsUnused === 1 ? "editor.diag_gls_unused_one" : "editor.diag_gls_unused_other", { count: glsUnused })}
            </div>
          )}

          <div style={{ marginTop: 6, borderTop: "1px solid var(--border-subtle)", paddingTop: 6 }}>
            <button
              className="btn btn-ghost btn-xs"
              style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}
              onClick={() => void handleExportLogs()}
            >
              {t("editor.diag_export_logs")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
