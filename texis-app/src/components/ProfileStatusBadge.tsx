import type { ProfileStatus } from "../types";

const STATUS_CONFIG: Record<ProfileStatus, { label: string; color: string; bg: string; title: string }> = {
  verified:     { label: "verificado",     color: "#166534", bg: "#dcfce7", title: "Trazado contra fuente oficial con fecha de verificación." },
  reviewed:     { label: "revisado",       color: "#1e40af", bg: "#dbeafe", title: "Revisado por maintainers. Compila y valida estructura base." },
  draft:        { label: "borrador",       color: "#78350f", bg: "#fef3c7", title: "En proceso de revisión. Puede tener campos incompletos." },
  experimental: { label: "experimental",  color: "#71717a", bg: "#f4f4f5", title: "Sin revisión formal. Útil como punto de partida." },
  stale:        { label: "desactualizado", color: "#9a3412", bg: "#ffedd5", title: "Fue verificado pero la norma institucional puede haber cambiado." },
  deprecated:   { label: "obsoleto",      color: "#7f1d1d", bg: "#fee2e2", title: "No usar para proyectos nuevos." },
};

export function ProfileStatusBadge({ status }: { status?: ProfileStatus | string }) {
  const s = (status ?? "experimental") as ProfileStatus;
  const c = STATUS_CONFIG[s] ?? STATUS_CONFIG.experimental;
  return (
    <span title={c.title} style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.03em",
      padding: "2px 6px", borderRadius: 4,
      color: c.color, background: c.bg,
      cursor: "default", whiteSpace: "nowrap",
      userSelect: "none",
    }}>
      {c.label}
    </span>
  );
}
