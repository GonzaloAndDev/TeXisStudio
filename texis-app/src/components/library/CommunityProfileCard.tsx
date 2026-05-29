import { IconBook, IconCheck, IconDownload, IconRefresh } from "../Icons";
import { ProfileStatusBadge } from "../ProfileStatusBadge";
import type { AcademicLevel } from "../../types";
import type { CatalogProfile } from "../../services/profileCatalog";

function audienceLabel(cp: CatalogProfile, disciplineLabel: (value: string) => string) {
  if (cp.program_name) return `Pensado para ${cp.program_name}.`;
  if (cp.department) return `Orientado al departamento de ${cp.department}.`;
  if (cp.faculty) return `Orientado a ${cp.faculty}.`;
  if (cp.discipline) return `Útil sobre todo en ${disciplineLabel(cp.discipline)}.`;
  if (cp.institution) return `Base institucional para ${cp.institution}.`;
  return "Base general para empezar tu proyecto.";
}

function confidenceSummary(cp: CatalogProfile) {
  if (cp.ci_evidence) {
    return "Verificado en CI automatizado — tiene evidencia real de compilación exitosa.";
  }
  if (cp.delivery_verified) {
    return "Tiene evidencia fuerte de compilación y entrega final.";
  }
  if (cp.sample_available) {
    return "Cuenta con muestra o evidencia técnica útil para empezar con menos riesgo.";
  }
  if (cp.novice_safe) {
    return "Es una opción razonablemente segura para comenzar sin ajustar demasiado.";
  }
  return "Conviene revisarlo con más cuidado antes de adoptarlo como base principal.";
}

function limitationSummary(cp: CatalogProfile) {
  if (cp.profile_scope === "program_specific") {
    return "Es específico para un programa; si el tuyo cambia, revisa los detalles antes de usarlo.";
  }
  if (cp.profile_scope === "discipline_specific") {
    return "Está pensado para un área concreta; puede requerir ajustes si tu trabajo sigue otra línea.";
  }
  if (!cp.sample_available) {
    return "Todavía no muestra evidencia técnica fuerte de extremo a extremo.";
  }
  return "Si tu escuela pide variantes muy particulares, revisa portada, comité y bibliografía antes de entregar.";
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
            <strong style={{ color: "var(--fg-strong)" }}>Para quién sirve:</strong> {audienceLabel(profile, disciplineLabel)}
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--fg-strong)" }}>Confianza:</strong> {confidenceSummary(profile)}
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--fg-strong)" }}>Qué revisar:</strong> {limitationSummary(profile)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {profile.style_id && <span className="chip" style={{ fontSize: 9 }}>{profile.style_id}</span>}
          {!profile.style_id && profile.bibliography_style && <span className="chip" style={{ fontSize: 9 }}>{profile.bibliography_style}</span>}
          {profile.novice_safe && <span className="chip" style={{ fontSize: 9 }}>buena base para empezar</span>}
          {profile.sample_available && <span className="chip" style={{ fontSize: 9 }}>con muestra</span>}
          {profile.delivery_verified && <span className="chip" style={{ fontSize: 9 }}>entrega verificada</span>}
          {profile.recommended_for_document_kinds?.map((kind) => (
            <span key={kind} className="chip" style={{ fontSize: 9 }}>para {kind}</span>
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
          {profile.verified_at && <span className="chip" style={{ fontSize: 9 }}>verificado {profile.verified_at}</span>}
          {!profile.verified_at && profile.reviewed_at && <span className="chip" style={{ fontSize: 9 }}>revisado {profile.reviewed_at}</span>}
          {profile.ci_evidence && <span className="chip" style={{ fontSize: 9 }}>CI</span>}
          {profile.tags.slice(0, 4).map((tag) => <span key={tag} className="chip" style={{ fontSize: 9 }}>{tag}</span>)}
        </div>
      </div>
      <div style={{ flexShrink: 0, alignSelf: "center" }}>
        {isInstalled ? (
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--detail)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IconCheck size={12} sw={2.5} /> Instalado</span>
        ) : (
          <button className="btn btn-sm btn-accent" onClick={onInstall} disabled={isDownloading} style={{ minWidth: 90 }}>
            {isDownloading ? <><IconRefresh size={12} /> …</> : <><IconDownload size={12} /> Instalar</>}
          </button>
        )}
      </div>
    </div>
  );
}
