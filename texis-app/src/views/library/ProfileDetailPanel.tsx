import { IconDownload, IconEdit, IconPlus, IconTrash, IconX } from "../../components/Icons";
import type { ProfileInfo, ProfileSectionInfo } from "../../types";
import { PLACEMENT_COLOR, PLACEMENT_LABEL } from "./constants";
import { ProfileStatusBadge } from "../../components/ProfileStatusBadge";
import { useSettingsStore } from "../../stores/settings";

const DEGREE_TAGS = new Set(["licenciatura", "maestria", "doctorado", "especialidad", "posdoctorado"]);
const DEGREE_LABEL: Record<string, string> = {
  licenciatura: "Licenciatura", maestria: "Maestría", doctorado: "Doctorado",
  especialidad: "Especialidad", posdoctorado: "Posdoctorado",
};

function statusMeaning(status: string): { icon: string; text: string; color: string } {
  switch (status) {
    case "verified": return { icon: "✓", text: "Verificado con evidencia técnica real (CI + compilación comprobada)", color: "var(--build-ok)" };
    case "reviewed": return { icon: "●", text: "Revisado por un editor humano con trazabilidad de fuentes", color: "var(--accent-deep)" };
    case "experimental": return { icon: "○", text: "En desarrollo — puede contener errores o estar incompleto", color: "var(--build-warn)" };
    default: return { icon: "—", text: status, color: "var(--fg-faint)" };
  }
}

// ── ProfileDetailPanel ────────────────────────────────────────────────────────

export function ProfileDetailPanel({ profile, onClose, onEdit, onUse, onExport, onDelete }: {
  profile: ProfileInfo; onClose: () => void; onEdit: () => void;
  onUse: () => void; onExport: () => void; onDelete: () => void;
}) {
  const { userMode } = useSettingsStore();
  const degreeTags = (profile.tags ?? []).filter((t) => DEGREE_TAGS.has(t));
  const otherTags  = (profile.tags ?? []).filter((t) => !DEGREE_TAGS.has(t) && t !== "tesis" && t !== "tesina");
  const statusInfo = statusMeaning(profile.status);

  const sectionsByPlacement = (profile.sections ?? []).reduce<Record<string, ProfileSectionInfo[]>>(
    (acc, s) => { const k = s.placement; if (!acc[k]) acc[k] = []; acc[k].push(s); return acc; }, {}
  );
  const placementOrder = ["front_matter", "body", "back_matter", "appendix"];

  return (
    <div style={{ width: 320, flexShrink: 0, borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>Detalle del perfil</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onEdit} className="btn btn-ghost btn-sm" style={{ padding: "3px 8px" }}>
            <IconEdit size={12} /> Editar
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
          </div>
          {userMode === "advanced" && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginBottom: 6 }}>{profile.id} · v{profile.version ?? "0.1.0"}</div>
          )}
          {profile.description && <p style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6, margin: 0 }}>{profile.description}</p>}

          {/* Cobertura — legible para neófitos */}
          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--fg-faint)", marginBottom: 6 }}>
              Cobertura
            </div>
            {degreeTags.length > 0 && (
              <div style={{ marginBottom: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>Grado:</span>
                {degreeTags.map((t) => (
                  <span key={t} className="chip" style={{ fontSize: 9 }}>{DEGREE_LABEL[t] ?? t}</span>
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
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Sin etiquetas de cobertura</span>
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
                <div>Verificado el {profile.verification.verified_at}{profile.verification.verified_by ? ` por ${profile.verification.verified_by}` : ""}</div>
              )}
              {profile.verification.reviewed_at && !profile.verification.verified_at && (
                <div>Revisado el {profile.verification.reviewed_at}{profile.verification.reviewed_by ? ` por ${profile.verification.reviewed_by}` : ""}</div>
              )}
              {profile.verification.source_urls?.length > 0 && (
                <div style={{ marginTop: 3 }}>
                  Fuente: {profile.verification.source_urls.slice(0, 1).map((url, i) => (
                    <span key={i} style={{ wordBreak: "break-all" }}>{url.replace(/^https?:\/\//, "")}</span>
                  ))}
                  {profile.verification.source_urls.length > 1 && ` +${profile.verification.source_urls.length - 1}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detalles técnicos — solo en modo avanzado */}
        {userMode === "advanced" && (
        <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {[["Motor LaTeX", profile.latex_engine ?? "xelatex"], ["Bibliografía", profile.bibliography_style?.toUpperCase() ?? "APA"], ["Clase", profile.document_class ?? "book"], ["Autor", profile.author ?? "—"], ["Licencia", profile.license ?? "—"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{k}</span>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)", fontFamily: "var(--font-mono)" }}>{v}</span>
            </div>
          ))}
        </div>
        )}
        {userMode === "basic" && (
        <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {[["Estilo de citas", profile.bibliography_style?.toUpperCase() ?? "APA"], ["Autor del perfil", profile.author ?? "—"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{k}</span>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)" }}>{v}</span>
            </div>
          ))}
        </div>
        )}
        <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 10 }}>
          Secciones ({profile.sections_count ?? profile.sections?.length ?? 0})
        </div>
        {placementOrder.map((placement) => {
          const secs = sectionsByPlacement[placement];
          if (!secs?.length) return null;
          return (
            <div key={placement} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: PLACEMENT_COLOR[placement] ?? "var(--fg-faint)", marginBottom: 6 }}>
                {PLACEMENT_LABEL[placement] ?? placement}
              </div>
              {secs.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", marginBottom: 4 }}>
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)" }}>{s.title ?? s.id}</span>
                  {s.required ? <span style={{ fontSize: 9, color: "var(--accent-deep)", fontWeight: 600 }}>requerida</span> : <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>opcional</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn btn-accent" style={{ width: "100%" }} onClick={onUse}><IconPlus size={13} /> Nuevo proyecto con este perfil</button>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onExport}><IconDownload size={13} /> Exportar</button>
          <button className="btn btn-ghost" style={{ padding: "6px 10px", color: "var(--build-err)" }} onClick={onDelete} title="Eliminar perfil"><IconTrash size={13} /></button>
        </div>
      </div>
    </div>
  );
}

