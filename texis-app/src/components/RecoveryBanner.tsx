// Banner que auto-ofrece el Centro de recuperación (Plan Integral §5).
// Al abrir un proyecto escanea su estado; si detecta operaciones interrumpidas,
// temporales sobrantes o problemas de integridad, ofrece abrir RecoveryView en
// vez de dejar al usuario descubrirlo por su cuenta. Se puede descartar.

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { isHealthy, recoveryScan, type RecoveryReport } from "../services/recoveryCenter";

interface Props {
  projectPath: string | null;
}

export function RecoveryBanner({ projectPath }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [report, setReport] = useState<RecoveryReport | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!projectPath) {
      setReport(null);
      return;
    }
    setDismissed(false);
    let cancelled = false;
    recoveryScan(projectPath)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  const openRecovery = useCallback(() => {
    if (!projectPath) return;
    navigate(`/project/${encodeURIComponent(projectPath)}/recovery`);
  }, [navigate, projectPath]);

  if (!projectPath || dismissed || !report || isHealthy(report)) return null;

  // Resumen de qué se detectó, para que el aviso sea específico.
  const parts: string[] = [];
  if (report.incomplete_operations.length > 0) {
    parts.push(t("recovery.banner_incomplete", { count: report.incomplete_operations.length }));
  }
  if (report.leftover_temporaries.length > 0) {
    parts.push(t("recovery.banner_temps", { count: report.leftover_temporaries.length }));
  }
  if (report.integrity_issues.length > 0) {
    parts.push(t("recovery.banner_integrity", { count: report.integrity_issues.length }));
  }

  return (
    <div
      role="alert"
      style={{
        background: "var(--color-warn-subtle, #fef9c3)",
        borderBottom: "1px solid var(--color-warn, #ca8a04)",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", flex: 1, minWidth: 200 }}>
        ⚠ {t("recovery.banner_body")} {parts.join(" · ")}
      </span>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button className="btn btn-ghost btn-xs" onClick={() => setDismissed(true)}>
          {t("recovery.banner_dismiss")}
        </button>
        <button
          className="btn btn-xs"
          onClick={openRecovery}
          style={{ background: "var(--color-warn)", color: "#000" }}
        >
          {t("recovery.banner_open")}
        </button>
      </div>
    </div>
  );
}
