import { useTranslation } from "react-i18next";
import type { ProfileCertificationSummary } from "../types";

const LEVEL_STYLE: Record<ProfileCertificationSummary["level"], { fg: string; bg: string }> = {
  certified: { fg: "#166534", bg: "#dcfce7" },
  evidence: { fg: "#1e40af", bg: "#dbeafe" },
  partial: { fg: "#78350f", bg: "#fef3c7" },
  uncertified: { fg: "#7f1d1d", bg: "#fee2e2" },
};

export function ProfileCertificationBadge({
  certification,
}: {
  certification?: ProfileCertificationSummary;
}) {
  const { t } = useTranslation();
  const summary = certification ?? {
    level: "uncertified" as const,
    score: 0,
    source_count: 0,
    has_review_date: false,
    has_ci_evidence: false,
    missing: ["official_sources", "review_date"],
  };
  const style = LEVEL_STYLE[summary.level];
  return (
    <span
      title={t(`profile_certification.${summary.level}_title`, { score: summary.score })}
      style={{
        fontSize: 10,
        fontWeight: 650,
        padding: "2px 6px",
        borderRadius: 4,
        color: style.fg,
        background: style.bg,
        whiteSpace: "nowrap",
      }}
    >
      {t(`profile_certification.${summary.level}`, { score: summary.score })}
    </span>
  );
}
