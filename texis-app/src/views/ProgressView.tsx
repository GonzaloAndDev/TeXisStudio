// Vista de Progreso — P5A
// Muestra el estado editorial de cada sección, word count, notas del autor,
// y permite generar/descargar el reporte de revisión para el asesor.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import { ReadinessOverview } from "../components/ReadinessOverview";
import {
  IconDoc, IconDownload, IconRefresh,
} from "../components/Icons";
import { deriveProjectReadiness } from "../lib/projectReadiness";
import { api } from "../lib/tauri";
import { useProjectStore } from "../stores/project";
import type { SectionProgress } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  draft:     "Borrador",
  in_review: "En revisión",
  revised:   "Corrigiendo",
  approved:  "Aprobado",
};
const STATUS_COLOR: Record<string, string> = {
  draft:     "#B45309",
  in_review: "#1D4ED8",
  revised:   "#9333EA",
  approved:  "#15803D",
};
const STATUS_BG: Record<string, string> = {
  draft:     "#FEF9C3",
  in_review: "#DBEAFE",
  revised:   "#F3E8FF",
  approved:  "#DCFCE7",
};
const PLACEMENT_LABEL: Record<string, string> = {
  front_matter: "Preliminares",
  body:         "Cuerpo",
  back_matter:  "Material final",
  appendix:     "Anexos",
};
const PLACEMENT_COLOR: Record<string, string> = {
  front_matter: "var(--accent)",
  body:         "#3AA396",
  back_matter:  "#7C6EAF",
  appendix:     "var(--fg-muted)",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 600,
      color: STATUS_COLOR[status] ?? "var(--fg-muted)",
      background: STATUS_BG[status] ?? "var(--bg-panel)",
      padding: "2px 8px", borderRadius: 99,
      border: `1px solid ${STATUS_COLOR[status] ?? "var(--border-soft)"}22`,
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ── Estadísticas globales ─────────────────────────────────────────────────────

function ProgressStats({ sections }: { sections: SectionProgress[] }) {
  const enabled = sections.filter(s => s.enabled);
  const total   = enabled.length;
  const approved = enabled.filter(s => s.status === "approved").length;
  const inReview = enabled.filter(s => s.status === "in_review").length;
  const revised  = enabled.filter(s => s.status === "revised").length;
  const totalWords = enabled.reduce((acc, s) => acc + s.word_count, 0);

  const pct = total > 0 ? Math.round((approved / total) * 100) : 0;

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
      {[
        { label: "Total secciones", value: total, color: "var(--fg-strong)" },
        { label: "Aprobadas", value: approved, color: "#15803D" },
        { label: "En revisión", value: inReview, color: "#1D4ED8" },
        { label: "Corrigiendo", value: revised, color: "#9333EA" },
        { label: "Palabras (cuerpo)", value: totalWords.toLocaleString("es-MX"), color: "var(--fg-strong)" },
      ].map(({ label, value, color }) => (
        <div key={label} style={{
          flex: "1 1 130px",
          padding: "14px 18px", borderRadius: "var(--r-lg)",
          background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <span style={{ fontSize: 10, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
          <span style={{ fontSize: "var(--fs-2xl)", fontWeight: 600, fontFamily: "var(--font-display)", color }}>{value}</span>
        </div>
      ))}
      {/* Barra de progreso */}
      <div style={{ flexBasis: "100%", padding: "12px 18px", borderRadius: "var(--r-lg)", background: "var(--bg-panel)", border: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Progreso de aprobación</span>
          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "#15803D" }}>{pct}%</span>
        </div>
        <div style={{ height: 8, background: "var(--ink-100)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#15803D", borderRadius: 99, transition: "width 0.4s ease" }} />
        </div>
      </div>
    </div>
  );
}

// ── Tabla de secciones ────────────────────────────────────────────────────────

function SectionTable({ sections }: { sections: SectionProgress[] }) {
  const grouped: Record<string, SectionProgress[]> = {};
  for (const s of sections) {
    if (!grouped[s.placement]) grouped[s.placement] = [];
    grouped[s.placement].push(s);
  }
  const order = ["front_matter", "body", "back_matter", "appendix"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {order.map((placement) => {
        const secs = grouped[placement];
        if (!secs?.length) return null;
        return (
          <div key={placement}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.1em", color: PLACEMENT_COLOR[placement] ?? "var(--fg-faint)",
              marginBottom: 10, paddingBottom: 6,
              borderBottom: `2px solid ${PLACEMENT_COLOR[placement] ?? "var(--border-subtle)"}`,
            }}>
              {PLACEMENT_LABEL[placement] ?? placement}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {secs.map((s) => (
                <div key={s.id} style={{
                  padding: "12px 16px", borderRadius: "var(--r-md)",
                  background: s.enabled ? "var(--bg-panel)" : "var(--bg-chrome)",
                  border: "1px solid var(--border-subtle)",
                  opacity: s.enabled ? 1 : 0.55,
                  display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                }}>
                  {/* Estado */}
                  <StatusBadge status={s.status} />

                  {/* Título */}
                  <span style={{ flex: 1, fontSize: "var(--fs-sm)", color: "var(--fg-strong)", fontWeight: 500, minWidth: 120 }}>
                    {s.title}
                    {!s.enabled && <span style={{ fontWeight: 400, color: "var(--fg-faint)", marginLeft: 6 }}>(desactivada)</span>}
                  </span>

                  {/* Estadísticas */}
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
                    {s.word_count > 0 && (
                      <span style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
                        {s.word_count.toLocaleString("es-MX")} pal.
                      </span>
                    )}
                    {s.block_count > 0 && (
                      <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                        {s.block_count} {s.block_count === 1 ? "bloque" : "bloques"}
                      </span>
                    )}
                    {s.has_notes && (
                      <span title={s.notes ?? ""} style={{
                        fontSize: 10, color: "#7C6EAF", background: "#F3E8FF",
                        padding: "1px 7px", borderRadius: 99, fontWeight: 600,
                      }}>
                        nota
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Panel de notas del asesor ────────────────────────────────────────────────

function NotesPanel({ sections }: { sections: SectionProgress[] }) {
  const withNotes = sections.filter(s => s.has_notes && s.enabled);
  if (withNotes.length === 0) {
    return (
      <div style={{ padding: "24px 0", color: "var(--fg-faint)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
        Ninguna sección tiene notas internas aún.<br />
        <span style={{ fontSize: "var(--fs-xs)" }}>Añade notas desde el editor de cada sección.</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {withNotes.map(s => (
        <div key={s.id} style={{
          padding: "12px 16px", borderRadius: "var(--r-md)",
          background: "var(--bg-panel)", border: "1px solid var(--border-subtle)",
        }}>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {s.title}
          </div>
          <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {s.notes}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── ProgressView ─────────────────────────────────────────────────────────────

type Tab = "progress" | "notes" | "report";

export default function ProgressView() {
  const navigate = useNavigate();
  const { activeProjectPath, activeProject } = useProjectStore();

  const [tab, setTab]       = useState<Tab>("progress");
  const [sections, setSections] = useState<SectionProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport]   = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    if (!activeProjectPath) { setLoading(false); return; }
    api.getSectionProgress(activeProjectPath)
      .then(setSections)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeProjectPath]);

  async function handleGenerateReport() {
    if (!activeProjectPath) return;
    setReportLoading(true);
    try {
      const md = await api.generateReviewReport(activeProjectPath);
      setReport(md);
      setTab("report");
    } catch (e) {
      alert(`Error al generar reporte: ${e}`);
    } finally {
      setReportLoading(false);
    }
  }

  function handleDownloadReport() {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = "revision_report.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "progress", label: "Progreso" },
    { id: "notes",    label: "Notas del autor" },
    { id: "report",   label: "Reporte de revisión" },
  ];

  const projectTitle = activeProject?.metadata.title ?? "Proyecto";
  const projectId    = activeProjectPath?.split("/").pop() ?? "proyecto";
  const readiness = activeProject ? deriveProjectReadiness(activeProject) : null;

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ {projectTitle.length > 40 ? projectTitle.slice(0, 40) + "…" : projectTitle}</span></>}
        center={
          <div style={{ display: "flex", gap: 2 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`btn btn-sm ${tab === t.id ? "btn-accent" : "btn-ghost"}`}
                style={{ fontSize: "var(--fs-xs)" }}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
        right={
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/project/${projectId}`)}>
              ← Editor
            </button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "32px 48px", background: "var(--bg-app)" }} className="scroll">
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* ── Progreso ── */}
          {tab === "progress" && (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>
                    Avance de tu tesis
                  </h1>
                  <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>
                    Aquí ves qué tan listo está tu proyecto para seguir escribiendo, revisar con tu asesor o preparar la entrega final.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    className="btn btn-sm"
                    onClick={() => { setLoading(true); api.getSectionProgress(activeProjectPath!).then(setSections).finally(() => setLoading(false)); }}
                    disabled={loading || !activeProjectPath}
                  >
                    <IconRefresh size={12} /> Actualizar
                  </button>
                  <button
                    className="btn btn-accent btn-sm"
                    onClick={handleGenerateReport}
                    disabled={reportLoading || !activeProjectPath}
                  >
                    {reportLoading ? <><IconRefresh size={12} /> Generando…</> : <><IconDoc size={12} /> Generar reporte</>}
                  </button>
                </div>
              </div>

              {loading ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0", textAlign: "center" }}>Cargando progreso…</div>
              ) : sections.length === 0 ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0", textAlign: "center" }}>
                  No hay secciones para mostrar.
                </div>
              ) : (
                <>
                  {readiness && (
                    <div style={{ marginBottom: 20 }}>
                      <ReadinessOverview readiness={readiness} showPending />
                    </div>
                  )}
                  <ProgressStats sections={sections} />
                  <SectionTable sections={sections} />
                </>
              )}
            </>
          )}

          {/* ── Notas ── */}
          {tab === "notes" && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>
                  Notas internas
                </h1>
                <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>
                  Notas del autor por sección. Visibles solo en el editor, no se incluyen en el PDF.
                </p>
              </div>
              {loading ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", textAlign: "center", padding: "40px 0" }}>Cargando…</div>
              ) : (
                <NotesPanel sections={sections} />
              )}
            </>
          )}

          {/* ── Reporte ── */}
          {tab === "report" && (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>
                    Reporte de revisión
                  </h1>
                  <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>
                    Documento Markdown para compartir con el asesor. Incluye estado de secciones e issues de validación.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button className="btn btn-sm" onClick={handleGenerateReport} disabled={reportLoading || !activeProjectPath}>
                    <IconRefresh size={12} /> {reportLoading ? "Generando…" : "Regenerar"}
                  </button>
                  {report && (
                    <button className="btn btn-accent btn-sm" onClick={handleDownloadReport}>
                      <IconDownload size={12} /> Descargar .md
                    </button>
                  )}
                </div>
              </div>

              {!report && !reportLoading && (
                <div style={{ padding: "48px 0", textAlign: "center", color: "var(--fg-faint)" }}>
                  <div style={{ marginBottom: 12 }}><IconDoc size={32} /></div>
                  <div style={{ fontSize: "var(--fs-sm)" }}>Haz clic en "Generar reporte" para crear el documento de revisión.</div>
                </div>
              )}
              {reportLoading && (
                <div style={{ padding: "48px 0", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)" }}>Generando reporte…</div>
              )}
              {report && (
                <div style={{
                  padding: "24px 28px", borderRadius: "var(--r-lg)",
                  background: "var(--bg-panel)", border: "1px solid var(--border-subtle)",
                  fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)",
                  color: "var(--fg-default)", lineHeight: 1.8,
                  whiteSpace: "pre-wrap", overflowX: "auto",
                }}>
                  {report}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <TxStatusbar items={[
        { text: `${sections.filter(s => s.enabled).length} secciones` },
        { text: `${sections.filter(s => s.status === "approved").length} aprobadas` },
        { right: true, text: "TeXisStudio 1.0.0" },
      ]} />
    </>
  );
}
