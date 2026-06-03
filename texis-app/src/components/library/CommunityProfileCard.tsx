import { IconBook, IconCheck, IconDownload, IconRefresh } from "../Icons";
import { useTranslation } from "react-i18next";
import { ProfileStatusBadge } from "../ProfileStatusBadge";
import type { AcademicLevel } from "../../types";
import type { CatalogProfile } from "../../services/profileCatalog";

function audienceLabel(cp: CatalogProfile, disciplineLabel: (value: string) => string, t: ReturnType<typeof useTranslation>["t"]) {
  if (cp.program_name) return t("community_profile.audience_program", { program: cp.program_name });
  if (cp.department) return t("community_profile.audience_department", { department: cp.department });
  if (cp.faculty) return t("community_profile.audience_faculty", { faculty: cp.faculty });
  if (cp.discipline) return t("community_profile.audience_discipline", { discipline: disciplineLabel(cp.discipline) });
  if (cp.institution) return t("community_profile.audience_institution", { institution: cp.institution });
  return t("community_profile.audience_general");
}

function confidenceSummary(cp: CatalogProfile, t: ReturnType<typeof useTranslation>["t"]) {
  if (cp.ci_evidence) {
    return t("community_profile.confidence_ci");
  }
  if (cp.delivery_verified) {
    return t("community_profile.confidence_delivery");
  }
  if (cp.sample_available) {
    return t("community_profile.confidence_sample");
  }
  if (cp.novice_safe) {
    return t("community_profile.confidence_novice");
  }
  return t("community_profile.confidence_review");
}

function limitationSummary(cp: CatalogProfile, t: ReturnType<typeof useTranslation>["t"]) {
  if (cp.profile_scope === "program_specific") {
    return t("community_profile.limitation_program");
  }
  if (cp.profile_scope === "discipline_specific") {
    return t("community_profile.limitation_discipline");
  }
  if (!cp.sample_available) {
    return t("community_profile.limitation_no_sample");
  }
  return t("community_profile.limitation_general");
}

export function CommunityProfileCard({
  profile,
  isInstalled,
  isDownloading,
  onInstall,
  academicLevelLabel,
  disciplineLabel,
  profileScopeLabel,
}: {
  profile: CatalogProfile;
  isInstalled: boolean;
  isDownloading: boolean;
  onInstall: () => void;
  academicLevelLabel: (level: AcademicLevel) => string;
  disciplineLabel: (value: string) => string;
  profileScopeLabel: (value: NonNullable<CatalogProfile["profile_scope"]>) => string;
}) {
  const { t } = useTranslation();
  return (
    <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", flexShrink: 0, background: isInstalled ? "var(--detail-tint)" : "var(--ink-100)", color: isInstalled ? "var(--detail)" : "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {isInstalled ? <IconCheck size={16} sw={2.5} /> : <IconBook size={16} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>{profile.name}</span>
          {profile.status ? <ProfileStatusBadge status={profile.status} /> : null}
        </div>
        {profile.institution && <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: 4 }}>{profile.institution}{profile.city ? ` · ${profile.city}` : ""}</div>}
        {profile.description && <p style={{ margin: "0 0 6px", fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>{profile.description}</p>}
        <div style={{ marginBottom: 8, display: "grid", gap: 6 }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--fg-strong)" }}>{t("community_profile.audience_label")}:</strong> {audienceLabel(profile, disciplineLabel, t)}
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--fg-strong)" }}>{t("community_profile.confidence_label")}:</strong> {confidenceSummary(profile, t)}
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--fg-strong)" }}>{t("community_profile.review_label")}:</strong> {limitationSummary(profile, t)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {profile.style_id && <span className="chip" style={{ fontSize: 9 }}>{profile.style_id}</span>}
          {!profile.style_id && profile.bibliography_style && <span className="chip" style={{ fontSize: 9 }}>{profile.bibliography_style}</span>}
          {profile.novice_safe && <span className="chip" style={{ fontSize: 9 }}>{t("community_profile.chip_novice")}</span>}
          {profile.sample_available && <span className="chip" style={{ fontSize: 9 }}>{t("community_profile.chip_sample")}</span>}
          {profile.delivery_verified && <span className="chip" style={{ fontSize: 9 }}>{t("community_profile.chip_delivery")}</span>}
          {profile.recommended_for_document_kinds?.map((kind) => (
            <span key={kind} className="chip" style={{ fontSize: 9 }}>{t("community_profile.for_kind", { kind })}</span>
          ))}
          {profile.academic_level && <span className="chip" style={{ fontSize: 9 }}>{academicLevelLabel(profile.academic_level)}</span>}
          {!profile.academic_level && profile.target_levels && profile.target_levels.length > 0 && (
            <span className="chip" style={{ fontSize: 9 }}>
              {profile.target_levels.map((level) => academicLevelLabel(level)).join(" · ")}
            </span>
          )}
          {profile.discipline && <span className="chip" style={{ fontSize: 9 }}>{disciplineLabel(profile.discipline)}</span>}
          {profile.program_name && <span className="chip" style={{ fontSize: 9 }}>{profile.program_name}</span>}
          {profile.faculty && <span className="chip" style={{ fontSize: 9 }}>{profile.faculty}</span>}
          {profile.department && <span className="chip" style={{ fontSize: 9 }}>{profile.department}</span>}
          {profile.profile_scope && <span className="chip" style={{ fontSize: 9 }}>{profileScopeLabel(profile.profile_scope)}</span>}
          {profile.verified_at && <span className="chip" style={{ fontSize: 9 }}>{t("community_profile.verified_at", { date: profile.verified_at })}</span>}
          {!profile.verified_at && profile.reviewed_at && <span className="chip" style={{ fontSize: 9 }}>{t("community_profile.reviewed_at", { date: profile.reviewed_at })}</span>}
          {profile.ci_evidence && <span className="chip" style={{ fontSize: 9 }}>CI</span>}
          {profile.tags.slice(0, 4).map((tag) => <span key={tag} className="chip" style={{ fontSize: 9 }}>{tag}</span>)}
        </div>
      </div>
      <div style={{ flexShrink: 0, alignSelf: "center" }}>
        {isInstalled ? (
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--detail)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IconCheck size={12} sw={2.5} /> {t("settings.community_installed")}</span>
        ) : (
          <button className="btn btn-sm btn-accent" onClick={onInstall} disabled={isDownloading} style={{ minWidth: 90 }}>
            {isDownloading ? <><IconRefresh size={12} /> …</> : <><IconDownload size={12} /> {t("settings.community_download")}</>}
          </button>
        )}
      </div>
    </div>
  );
}
