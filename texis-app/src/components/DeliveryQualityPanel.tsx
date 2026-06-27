// Panel de la Compuerta Única de Calidad (Plan Integral §1).
// Muestra el DeliveryQualityReport unificado: conteos, estado de las compuertas
// por modo (borrador/revisión/final) y los hallazgos con su acción sugerida.
// Consume exactamente la misma fuente de verdad que usa export_delivery.

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deliveryQualityReport,
  gateForMode,
  type DeliveryMode,
  type DeliveryQualityReport,
  type QualityFinding,
  type QualitySeverity,
} from "../services/deliveryQuality";

const SEV_COLOR: Record<QualitySeverity, string> = {
  error: "var(--build-err)",
  warning: "var(--build-warn)",
  info: "var(--accent)",
};

function Dot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: 99,
      background: ok ? "var(--build-ok)" : "var(--build-err)",
    }} />
  );
}

export function DeliveryQualityPanel({
  projectPath,
  mode,
}: {
  projectPath: string | null;
  mode: DeliveryMode;
}) {
  const { t } = useTranslation();
  const [report, setReport] = useState<DeliveryQualityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await deliveryQualityReport(path));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectPath) void refresh(projectPath);
  }, [projectPath, refresh]);

  if (!projectPath) return null;

  const gate = report ? gateForMode(report, mode) : null;

  return (
    <div style={{
      background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
      borderRadius: "var(--r-lg)", padding: 16, marginTop: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <strong style={{ fontSize: "var(--fs-sm)", color: "var(--fg-strong)" }}>
          {t("quality.title")}
        </strong>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => refresh(projectPath)}
          disabled={loading}
        >
          {loading ? t("quality.checking") : t("quality.recheck")}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-err)" }}>{error}</div>
      )}

      {report && (
        <>
          {/* Compuerta del modo activo */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
            padding: "8px 12px", borderRadius: "var(--r-md)",
            background: gate?.passed ? "var(--build-ok-tint)" : "var(--build-err-tint)",
            border: `1px solid ${gate?.passed ? "var(--build-ok)" : "var(--build-err)"}`,
          }}>
            <Dot ok={!!gate?.passed} />
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-strong)" }}>
              {gate?.passed
                ? t("quality.gate_pass", { mode: t(`quality.mode_${mode}`) })
                : t("quality.gate_block", { mode: t(`quality.mode_${mode}`), count: gate?.blocking_codes.length ?? 0 })}
            </span>
          </div>

          {/* Conteos */}
          <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: "var(--fs-xs)" }}>
            <span style={{ color: SEV_COLOR.error }}>● {t("quality.errors", { count: report.error_count })}</span>
            <span style={{ color: SEV_COLOR.warning }}>● {t("quality.warnings", { count: report.warning_count })}</span>
            <span style={{ color: SEV_COLOR.info }}>● {t("quality.infos", { count: report.info_count })}</span>
          </div>

          {/* Hallazgos */}
          {report.findings.length === 0 ? (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
              {t("quality.no_findings")}
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {report.findings
                .slice()
                .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
                .map((f: QualityFinding, i) => (
                  <li key={`${f.code}-${i}`} style={{
                    fontSize: "var(--fs-xs)", color: "var(--fg-default)",
                    borderLeft: `3px solid ${SEV_COLOR[f.severity]}`, paddingLeft: 8,
                  }}>
                    <span style={{ color: SEV_COLOR[f.severity], fontWeight: 600 }}>
                      [{t(`quality.dim_${f.dimension}`)}]
                    </span>{" "}
                    {f.message}
                    {f.suggestion && (
                      <div style={{ color: "var(--fg-muted)", marginTop: 1 }}>→ {f.suggestion}</div>
                    )}
                  </li>
                ))}
            </ul>
          )}

          {/* Confianza del perfil */}
          <div style={{ marginTop: 10, fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
            {t("quality.profile_trust", { status: report.profile_trust.status })}
            {report.profile_trust.recommended_for_final
              ? ` — ${t("quality.profile_ok")}`
              : ` — ${t("quality.profile_warn")}`}
          </div>
        </>
      )}
    </div>
  );
}

function severityRank(s: QualitySeverity): number {
  return s === "error" ? 0 : s === "warning" ? 1 : 2;
}
