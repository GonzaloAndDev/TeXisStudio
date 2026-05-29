import type { ProjectReadiness } from "../lib/projectReadiness";

export function ReadinessOverview({
  readiness,
  showPending = false,
}: {
  readiness: ProjectReadiness;
  showPending?: boolean;
}) {
  const rows: Array<{
    label: string;
    value: number;
    pending?: string;
  }> = [
    { label: "Configuración", value: readiness.setupCompletion, pending: readiness.setupPending[0] },
    { label: "Escritura", value: readiness.writingCompletion, pending: readiness.writingPending[0] },
    { label: "Entrega", value: readiness.deliveryReadiness, pending: readiness.deliveryPending[0] },
  ];

  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: "var(--r-md)",
      background: "var(--bg-panel)",
      border: "1px solid var(--border-soft)",
    }}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
        Avance del proyecto
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
                background: value >= 80 ? "var(--build-ok)" : value >= 50 ? "var(--build-warn)" : "var(--accent)",
              }}
            />
          </div>
          {showPending && typeof pending === "string" && pending.length > 0 && (
            <div style={{ fontSize: "10px", color: "var(--fg-faint)", lineHeight: 1.5 }}>
              Pendiente: {pending}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
