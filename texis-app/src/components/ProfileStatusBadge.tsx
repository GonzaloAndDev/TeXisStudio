import { useTranslation } from "react-i18next";
import type { ProfileStatus } from "../types";

const STATUS_CONFIG: Record<ProfileStatus, { labelKey: string; color: string; bg: string; titleKey: string }> = {
  verified:     { labelKey: "profile_status.verified",     color: "#166534", bg: "#dcfce7", titleKey: "profile_status.verified_title" },
  reviewed:     { labelKey: "profile_status.reviewed",     color: "#1e40af", bg: "#dbeafe", titleKey: "profile_status.reviewed_title" },
  draft:        { labelKey: "profile_status.draft",        color: "#78350f", bg: "#fef3c7", titleKey: "profile_status.draft_title" },
  experimental: { labelKey: "profile_status.experimental", color: "#71717a", bg: "#f4f4f5", titleKey: "profile_status.experimental_title" },
  stale:        { labelKey: "profile_status.stale",        color: "#9a3412", bg: "#ffedd5", titleKey: "profile_status.stale_title" },
  deprecated:   { labelKey: "profile_status.deprecated",   color: "#7f1d1d", bg: "#fee2e2", titleKey: "profile_status.deprecated_title" },
};

export function ProfileStatusBadge({ status }: { status?: ProfileStatus | string }) {
  const { t } = useTranslation();
  const s = (status ?? "experimental") as ProfileStatus;
  const c = STATUS_CONFIG[s] ?? STATUS_CONFIG.experimental;
  return (
    <span title={t(c.titleKey)} style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.03em",
      padding: "2px 6px", borderRadius: 4,
      color: c.color, background: c.bg,
      cursor: "default", whiteSpace: "nowrap",
      userSelect: "none",
    }}>
      {t(c.labelKey)}
    </span>
  );
}
