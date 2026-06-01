import React from "react";
import { ReadinessOverview } from "./ReadinessOverview";
import { IconBuild } from "./Icons";
import { deriveProjectReadiness } from "../lib/projectReadiness";
import type {
  CommitteeMember,
  ProjectModel,
  ProjectSection,
} from "../types";

function MetaField({
  label,
  value,
  onChange,
  mono = false,
  multiline = false,
  large = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  multiline?: boolean;
  large?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)" }}>{label}</div>}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            minHeight: large ? 56 : 40,
            resize: "vertical",
            padding: "7px 10px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--border-firm)",
            background: "var(--bg-panel)",
            fontSize: large ? "var(--fs-md)" : "var(--fs-sm)",
            color: "var(--fg-strong)",
            outline: "none",
            fontFamily: mono ? "var(--font-mono)" : undefined,
            lineHeight: 1.5,
          }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            padding: "7px 10px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--border-firm)",
            background: "var(--bg-panel)",
            fontSize: large ? "var(--fs-md)" : "var(--fs-sm)",
            color: "var(--fg-strong)",
            outline: "none",
            fontFamily: mono ? "var(--font-mono)" : undefined,
          }}
        />
      )}
    </div>
  );
}

export function EditorMetaPanel({
  project,
  wordCount,
  blockCount,
  maxWords,
  activeSection,
  userMode,
  onSave,
  onCompile,
  diagnosticsPanel,
  onCollapse,
}: {
  project: ProjectModel;
  wordCount: number;
  blockCount: number;
  maxWords?: number;
  activeSection?: ProjectSection;
  userMode: "basic" | "advanced";
  onSave: (updates: Record<string, unknown>) => void;
  onCompile: () => void;
  diagnosticsPanel?: React.ReactNode;
  onCollapse?: () => void;
}) {
  const readiness = deriveProjectReadiness(project);

  return (
    <div style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", minHeight: 0, padding: 16, overflow: "auto" }} className="scroll editor-meta-panel">
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{userMode === "basic" ? "Guía del proyecto" : "Proyecto"}</span>
        {onCollapse && (
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onCollapse}
            title="Minimizar panel"
            style={{ padding: 3, width: 22, height: 22, color: "var(--fg-faint)" }}
          >
            ›
          </button>
        )}
      </div>

      {userMode === "basic" && (
        <div style={{
          marginBottom: 14, padding: "12px 14px",
          borderRadius: "var(--r-md)", background: "var(--accent-tint)",
          border: "1px solid var(--accent-soft)",
        }}>
          <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--accent-deep)", marginBottom: 6 }}>
            Qué hacer aquí
          </div>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
            {activeSection?.title
              ? `Estás trabajando en “${activeSection.title}”. Escribe el contenido principal, agrega citas cuando uses fuentes y compila cuando quieras revisar cómo se verá el documento.`
              : "Escribe el contenido principal de tu trabajo. Luego podrás revisar, compilar y exportar la entrega final."}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <ReadinessOverview readiness={readiness} showPending />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "var(--fs-sm)" }}>
        <MetaField
          label="Título"
          value={project.metadata.title}
          onChange={(v) => onSave({ metadata: { ...project.metadata, title: v } })}
          multiline
          large
        />
        <MetaField
          label="Subtítulo"
          value={project.metadata.subtitle ?? ""}
          onChange={(v) => onSave({ metadata: { ...project.metadata, subtitle: v || undefined } })}
        />
        <MetaField
          label="Autor principal"
          value={project.student.full_name}
          onChange={(v) => onSave({ student: { ...project.student, full_name: v } })}
        />

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Asesores</span>
            <button
              type="button"
              onClick={() => {
                const next = [...(project.student.advisors ?? []), ""];
                onSave({ student: { ...project.student, advisors: next } });
              }}
              style={{ fontSize: 11, padding: "1px 7px", border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", background: "var(--bg-app)", color: "var(--fg-muted)", cursor: "pointer" }}
            >
              + Agregar
            </button>
          </div>
          {(project.student.advisors ?? []).length === 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic", padding: "4px 0" }}>
              Sin asesores — haz clic en + Agregar
            </div>
          )}
          {(project.student.advisors ?? []).map((adv, i) => (
            <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
              <input
                value={adv}
                onChange={(e) => {
                  const next = [...(project.student.advisors ?? [])];
                  next[i] = e.target.value;
                  onSave({ student: { ...project.student, advisors: next } });
                }}
                style={{ flex: 1, padding: "5px 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-xs)", color: "var(--fg-strong)", outline: "none" }}
                placeholder="Dra. Ana Torres"
              />
              <button
                type="button"
                onClick={() => {
                  const next = (project.student.advisors ?? []).filter((_, idx) => idx !== i);
                  onSave({ student: { ...project.student, advisors: next } });
                }}
                style={{ width: 22, height: 22, flexShrink: 0, border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", color: "var(--fg-faint)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Co-autores</span>
            <button
              type="button"
              onClick={() => {
                const next = [...(project.student.co_authors ?? []), { full_name: "" }];
                onSave({ student: { ...project.student, co_authors: next } });
              }}
              style={{ fontSize: 11, padding: "1px 7px", border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", background: "var(--bg-app)", color: "var(--fg-muted)", cursor: "pointer" }}
            >
              + Agregar
            </button>
          </div>
          {(project.student.co_authors ?? []).map((ca, i) => (
            <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
              <input
                value={ca.full_name}
                onChange={(e) => {
                  const next = [...(project.student.co_authors ?? [])];
                  next[i] = { ...next[i], full_name: e.target.value };
                  onSave({ student: { ...project.student, co_authors: next } });
                }}
                style={{ flex: 1, padding: "5px 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-xs)", color: "var(--fg-strong)", outline: "none" }}
                placeholder="Luis Hernández"
              />
              <button
                type="button"
                onClick={() => {
                  const next = (project.student.co_authors ?? []).filter((_, idx) => idx !== i);
                  onSave({ student: { ...project.student, co_authors: next } });
                }}
                style={{ width: 22, height: 22, flexShrink: 0, border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", color: "var(--fg-faint)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>Comité sinodal</span>
            <button
              type="button"
              onClick={() => {
                const next: CommitteeMember[] = [...(project.student.committee ?? []), { full_name: "" }];
                onSave({ student: { ...project.student, committee: next } });
              }}
              style={{ fontSize: 11, padding: "1px 7px", border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", background: "var(--bg-app)", color: "var(--fg-muted)", cursor: "pointer" }}
            >
              + Agregar
            </button>
          </div>
          {(project.student.committee ?? []).length === 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic", padding: "4px 0" }}>
              Sin comité — opcional para especialidad y maestría, recomendado para doctorado y posdoctorado
            </div>
          )}
          {(project.student.committee ?? []).map((m, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 4, marginBottom: 4, alignItems: "center" }}>
              <input
                value={m.full_name}
                onChange={(e) => {
                  const next = [...(project.student.committee ?? [])];
                  next[i] = { ...next[i], full_name: e.target.value };
                  onSave({ student: { ...project.student, committee: next } });
                }}
                placeholder="Dra. María García"
                style={{ padding: "5px 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-xs)", color: "var(--fg-strong)", outline: "none" }}
              />
              <input
                value={m.role ?? ""}
                onChange={(e) => {
                  const next = [...(project.student.committee ?? [])];
                  next[i] = { ...next[i], role: e.target.value || undefined };
                  onSave({ student: { ...project.student, committee: next } });
                }}
                placeholder="Presidenta"
                style={{ padding: "5px 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", outline: "none" }}
              />
              <button
                type="button"
                onClick={() => {
                  const next = (project.student.committee ?? []).filter((_, idx) => idx !== i);
                  onSave({ student: { ...project.student, committee: next } });
                }}
                style={{ width: 22, height: 22, flexShrink: 0, border: "1px solid var(--border-firm)", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", color: "var(--fg-faint)", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <MetaField
          label="ORCID iD"
          value={project.student.orcid ?? ""}
          onChange={(v) => onSave({ student: { ...project.student, orcid: v || undefined } })}
          mono
        />

        <MetaField
          label="Institución"
          value={project.institution.name}
          onChange={(v) => onSave({ institution: { ...project.institution, name: v } })}
        />
        <MetaField
          label="Facultad"
          value={project.institution.faculty ?? ""}
          onChange={(v) => onSave({ institution: { ...project.institution, faculty: v || undefined } })}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Ciudad</div>
            <MetaField label="" value={project.metadata.city} onChange={(v) => onSave({ metadata: { ...project.metadata, city: v } })} />
          </div>
          <div>
            <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Año</div>
            <MetaField label="" value={String(project.metadata.year)} onChange={(v) => onSave({ metadata: { ...project.metadata, year: parseInt(v) || project.metadata.year } })} mono />
          </div>
        </div>

        <div>
          <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Perfil</div>
          <span className="chip tx-mono" style={{ fontSize: 11 }}>{project.profile_id}</span>
        </div>

        <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div>
            <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Palabras</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "var(--fs-md)" }}>{wordCount.toLocaleString("es")}</div>
            {maxWords && maxWords > 0 && (() => {
              const pct = Math.min(100, (wordCount / maxWords) * 100);
              const over = wordCount > maxWords;
              const near = pct >= 90;
              const barColor = over ? "var(--build-err)" : near ? "var(--build-warn)" : "var(--build-ok)";
              return (
                <div style={{ marginTop: 4 }}>
                  <div style={{ height: 4, borderRadius: 2, background: "var(--border-subtle)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: barColor, transition: "width 0.3s, background 0.3s" }} />
                  </div>
                  <div style={{ fontSize: 10, color: over ? "var(--build-err)" : "var(--fg-faint)", marginTop: 2 }}>
                    {over
                      ? `+${(wordCount - maxWords).toLocaleString("es")} sobre límite`
                      : `${(maxWords - wordCount).toLocaleString("es")} restantes`}
                  </div>
                </div>
              );
            })()}
          </div>
          <div>
            <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Bloques</div>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "var(--fs-md)" }}>{blockCount}</div>
          </div>
        </div>

        <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />

        {userMode === "basic" && (
          <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg-panel)", border: "1px solid var(--border-soft)", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600, color: "var(--fg-default)", marginBottom: 4 }}>Ruta sugerida</div>
            <div>1. Escribe el contenido de la sección.</div>
            <div>2. Agrega citas, figuras o tablas si las necesitas.</div>
            <div>3. Compila para revisar el PDF antes de entregar.</div>
          </div>
        )}

        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.9 }}>
          <div style={{ fontWeight: 600, color: "var(--fg-muted)", marginBottom: 2 }}>Atajos</div>
          {([
            ["Ctrl+K", "Paleta de comandos"],
            ["Ctrl+[", "Insertar cita"],
            ["Ctrl+S", "Guardar"],
            ["Esc", "Salir edición"],
            ["Enter", "Lista: nuevo ítem"],
          ] as [string, string][]).map(([key, desc]) => (
            <div key={key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 9, background: "var(--bg-app)", border: "1px solid var(--border-firm)", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>{key}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {diagnosticsPanel}

      <div style={{ marginTop: "auto", paddingTop: 12 }}>
        <button className="btn btn-accent" style={{ width: "100%" }} onClick={onCompile}>
          <IconBuild size={13} /> {userMode === "basic" ? "Revisar y compilar" : "Compilar PDF"}
        </button>
      </div>
    </div>
  );
}
