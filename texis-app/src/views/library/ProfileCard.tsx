import { useTranslation } from "react-i18next";
import { IconBook, IconCheck } from "../../components/Icons";
import type { ProfileInfo } from "../../types";
import { ProfileStatusBadge } from "../../components/ProfileStatusBadge";

// ── ProfileCard ───────────────────────────────────────────────────────────────

export function ProfileCard({ profile, selected, onClick }: {
  profile: ProfileInfo; selected: boolean; onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div onClick={onClick} style={{
      background: selected ? "var(--accent-tint)" : "var(--bg-panel)",
      border: `1px solid ${selected ? "var(--accent)" : "var(--border-soft)"}`,
      boxShadow: selected ? "0 0 0 3px var(--accent-soft)" : "none",
      borderRadius: "var(--r-lg)", padding: 18,
      display: "flex", flexDirection: "column", gap: 10,
      cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "var(--r-md)", flexShrink: 0,
            background: selected ? "var(--accent)" : "var(--ink-100)",
            color: selected ? "white" : "var(--fg-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconBook size={15} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>
              {profile.name}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginTop: 1 }}>
              {profile.id}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
          <ProfileStatusBadge status={profile.status} />
          <span className={`chip ${selected ? "chip-accent" : "chip-ok"}`} style={{ fontSize: 10 }}>
            {selected ? <><IconCheck size={8} sw={2.5} /> {t("library.selected_chip")}</> : t("library.installed_chip")}
          </span>
        </div>
      </div>
      {profile.description && (
        <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
          {profile.description}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {profile.tags.map((t) => <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>{profile.meta}</span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{profile.sections_count ?? "?"} {t("library.sections_count_suffix")}</span>
      </div>
    </div>
  );
}

