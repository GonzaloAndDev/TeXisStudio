import { useTranslation } from "react-i18next";
import type { ProjectReadiness } from "../lib/projectReadiness";

export function ReadinessOverview({
  readiness,
  showPending = false,
}: {
  readiness: ProjectReadiness;
  showPending?: boolean;
}) {
  const { t } = useTranslation();

  const rows = [
    {
      label: t("readiness.row_overall"),
      value: readiness.overallCompletion,
      pending: readiness.deliveryBlocked ? t("readiness.delivery_blocked") : undefined,
    },
    {
      label: t("readiness.row_setup"),
      value: readiness.setupCompletion,
      pending: readiness.setupPending[0] ? t(readiness.setupPending[0]) : undefined,
    },
    {
      label: t("readiness.row_writing"),
      value: readiness.writingCompletion,
      pending: readiness.writingPending[0] ? t(readiness.writingPending[0]) : undefined,
    },
    {
      label: t("readiness.row_delivery"),
      value: readiness.deliveryReadiness,
      pending: readiness.deliveryPending[0] ? t(readiness.deliveryPending[0]) : undefined,
    },
    {
      label: t("readiness.row_quality"),
      value: readiness.qualityCompletion,
      pending: readiness.qualityPending[0] ? t(readiness.qualityPending[0]) : undefined,
    },
  ];

  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: "var(--r-md)",
      background: "var(--bg-panel)",
      border: "1px solid var(--border-soft)",
    }}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        {t("readiness.panel_title")}
      </div>
      {rows.map(({ label, value, pending }) => (
        <div key={label} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)" }}>{label}</span>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>{value}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 999, background: "var(--border-subtle)", overflow: "hidden", marginBottom: showPending ? 4 : 0 }}>
            <div
              style={{
                height: "100%",
                width: `${value}%`,
                background: value >= 90 ? "var(--build-ok)" : value >= 60 ? "var(--build-warn)" : "var(--accent)",
              }}
            />
          </div>
          {showPending && typeof pending === "string" && pending.length > 0 && (
            <div style={{ fontSize: "10px", color: "var(--fg-faint)", lineHeight: 1.5 }}>
              {t("readiness.pending_prefix")} {pending}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
