import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { IconDownload, IconEdit, IconPlus, IconTrash, IconX } from "../../components/Icons";
import type { ProfileInfo, ProfileSectionInfo } from "../../types";
import { PLACEMENT_COLOR } from "./constants";
import { ProfileStatusBadge } from "../../components/ProfileStatusBadge";
import { ProfileCertificationBadge } from "../../components/ProfileCertificationBadge";
import { useSettingsStore } from "../../stores/settings";

const DEGREE_TAGS = new Set(["licenciatura", "maestria", "doctorado", "especialidad", "posdoctorado"]);
const DEGREE_LABEL_KEY: Record<string, string> = {
  licenciatura: "home.level_licenciatura", maestria: "home.level_maestria", doctorado: "home.level_doctorado",
  especialidad: "home.level_especialidad", posdoctorado: "home.level_posdoctorado",
};

function statusMeaning(status: string, t: TFunction): { icon: string; text: string; color: string } {
  switch (status) {
    case "verified": return { icon: "✓", text: t("library.status_verified_meaning"), color: "var(--build-ok)" };
    case "reviewed": return { icon: "●", text: t("library.status_reviewed_meaning"), color: "var(--accent-deep)" };
    case "experimental": return { icon: "○", text: t("library.status_experimental_meaning"), color: "var(--build-warn)" };
    default: return { icon: "—", text: status, color: "var(--fg-faint)" };
  }
}

// ── ProfileDetailPanel ────────────────────────────────────────────────────────

export function ProfileDetailPanel({ profile, onClose, onEdit, onUse, onExport, onDelete }: {
  profile: ProfileInfo; onClose: () => void; onEdit: () => void;
  onUse: () => void; onExport: () => void; onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { userMode } = useSettingsStore();
  const degreeTags = (profile.tags ?? []).filter((t) => DEGREE_TAGS.has(t));
  const otherTags  = (profile.tags ?? []).filter((t) => !DEGREE_TAGS.has(t) && t !== "tesis" && t !== "tesina");
  const statusInfo = statusMeaning(profile.status, t);

  const sectionsByPlacement = (profile.sections ?? []).reduce<Record<string, ProfileSectionInfo[]>>(
    (acc, s) => { const k = s.placement; if (!acc[k]) acc[k] = []; acc[k].push(s); return acc; }, {}
  );
  const placementOrder = ["front_matter", "body", "back_matter", "appendix"];

  return (
    <div style={{ width: 320, flexShrink: 0, borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{t("library.profile_detail")}</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onEdit} className="btn btn-ghost btn-sm" style={{ padding: "3px 8px" }}>
            <IconEdit size={12} /> {t("common.edit")}
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}>
            <IconX size={14} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", fontWeight: 500, color: "var(--fg-strong)", flex: 1 }}>{profile.name}</div>
            <ProfileStatusBadge status={profile.status} />
            <ProfileCertificationBadge certification={profile.certification} />
          </div>
          {userMode === "advanced" && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginBottom: 6 }}>{profile.id} · v{profile.version ?? "0.1.0"}</div>
          )}
          {profile.description && <p style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6, margin: 0 }}>{profile.description}</p>}

          {/* Cobertura — legible para neófitos */}
          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--fg-faint)", marginBottom: 6 }}>
              {t("library.coverage")}
            </div>
            {degreeTags.length > 0 && (
              <div style={{ marginBottom: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t("library.degree_filter")}:</span>
                {degreeTags.map((tag) => (
                  <span key={tag} className="chip" style={{ fontSize: 9 }}>{DEGREE_LABEL_KEY[tag] ? t(DEGREE_LABEL_KEY[tag]) : tag}</span>
                ))}
              </div>
            )}
            {otherTags.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {otherTags.map((t) => (
                  <span key={t} className="chip" style={{ fontSize: 9 }}>{t}</span>
                ))}
              </div>
            )}
            {degreeTags.length === 0 && otherTags.length === 0 && (
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("library.no_coverage_tags")}</span>
            )}
          </div>

          {/* Estado de confianza */}
          <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: `1px solid ${statusInfo.color}22`, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ color: statusInfo.color, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{statusInfo.icon}</span>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>{statusInfo.text}</span>
          </div>

          {/* Evidencia de verificación */}
          {profile.verification && (
            <div style={{ marginTop: 6, fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.6 }}>
              {profile.verification.verified_at && (
                <div>{t("library.verified_at", { date: profile.verification.verified_at, by: profile.verification.verified_by ? t("library.by_person", { person: profile.verification.verified_by }) : "" })}</div>
              )}
              {profile.verification.reviewed_at && !profile.verification.verified_at && (
                <div>{t("library.reviewed_at", { date: profile.verification.reviewed_at, by: profile.verification.reviewed_by ? t("library.by_person", { person: profile.verification.reviewed_by }) : "" })}</div>
              )}
              {profile.verification.source_urls?.length > 0 && (
                <div style={{ marginTop: 3 }}>
                  {t("library.source")}: {profile.verification.source_urls.slice(0, 1).map((url, i) => (
                    <span key={i} style={{ wordBreak: "break-all" }}>{url.replace(/^https?:\/\//, "")}</span>
                  ))}
                  {profile.verification.source_urls.length > 1 && ` +${profile.verification.source_urls.length - 1}`}
                </div>
              )}
              {profile.verification.ci_evidence && (
                <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "var(--build-ok)", fontWeight: 700, fontSize: 10 }}>✓</span>
                  <span>{t("library.ci_evidence_available")}</span>
                </div>
              )}
            </div>
          )}
          {profile.certification && (
            <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <strong style={{ color: "var(--fg-strong)" }}>{t("profile_certification.panel_title")}</strong>
                <span style={{ fontFamily: "var(--font-mono)" }}>{profile.certification.score}/100</span>
              </div>
              <div>
                {t("profile_certification.sources", { count: profile.certification.source_count })}
                {" · "}
                {profile.certification.has_review_date ? t("profile_certification.review_date_ok") : t("profile_certification.review_date_missing")}
                {" · "}
                {profile.certification.has_ci_evidence ? t("profile_certification.ci_ok") : t("profile_certification.ci_missing")}
              </div>
              {profile.certification.missing.length > 0 && (
                <div style={{ color: "var(--build-warn)", marginTop: 4 }}>
                  {t("profile_certification.missing")}: {profile.certification.missing.map((m) => t(`profile_certification.missing_${m}`, { defaultValue: m })).join(", ")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detalles técnicos — solo en modo avanzado */}
        {userMode === "advanced" && (
        <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {[[t("library.latex_engine"), profile.latex_engine ?? "xelatex"], [t("library.bibliography"), profile.bibliography_style?.toUpperCase() ?? "APA"], [t("library.document_class"), profile.document_class ?? "book"], [t("library.author"), profile.author ?? "—"], [t("library.license"), profile.license ?? "—"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{k}</span>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)", fontFamily: "var(--font-mono)" }}>{v}</span>
            </div>
          ))}
        </div>
        )}
        {userMode === "basic" && (
        <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {[[t("library.citation_style"), profile.bibliography_style?.toUpperCase() ?? "APA"], [t("library.profile_author"), profile.author ?? "—"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{k}</span>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)" }}>{v}</span>
            </div>
          ))}
        </div>
        )}
        <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 10 }}>
          {t("library.sections_count", { count: profile.sections_count ?? profile.sections?.length ?? 0 })}
        </div>
        {placementOrder.map((placement) => {
          const secs = sectionsByPlacement[placement];
          if (!secs?.length) return null;
          return (
            <div key={placement} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: PLACEMENT_COLOR[placement] ?? "var(--fg-faint)", marginBottom: 6 }}>
                {t(`library.placement.${placement}`, { defaultValue: placement })}
              </div>
              {secs.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", marginBottom: 4 }}>
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)" }}>{s.title ?? s.id}</span>
                  {s.required ? <span style={{ fontSize: 9, color: "var(--accent-deep)", fontWeight: 600 }}>{t("library.required")}</span> : <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>{t("wizard.optional")}</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn btn-accent" style={{ width: "100%" }} onClick={onUse}><IconPlus size={13} /> {t("library.new_project_with_profile")}</button>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onExport}><IconDownload size={13} /> {t("common.export", { defaultValue: "Exportar" })}</button>
          <button className="btn btn-ghost" style={{ padding: "6px 10px", color: "var(--build-err)" }} onClick={onDelete} title={t("library.delete_profile")}><IconTrash size={13} /></button>
        </div>
      </div>
    </div>
  );
}
