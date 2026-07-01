// Estado de tesis — vista central del producto (Plan Integral, Fase 1).
// Convierte toda la ingeniería (validación, compilación, postflight, perfil) en
// una sola narrativa: "¿cómo va mi tesis y qué es lo siguiente?". Consume el
// DeliveryQualityReport, la misma fuente de verdad que el gate de exportación.

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import { IconCheckCircle, IconWarn, IconEdit, IconBuild, IconDownload } from "../components/Icons";
import { useProjectStore } from "../stores/project";
import {
  deliveryQualityReport,
  type DeliveryQualityReport,
  type DeliveryState,
} from "../services/deliveryQuality";

// Color y tono por estado — semántica estable en todo el producto.
const STATE_STYLE: Record<DeliveryState, { color: string; bg: string }> = {
  writing: { color: "var(--build-warn)", bg: "var(--build-warn-tint)" },
  ready_for_review: { color: "var(--accent)", bg: "var(--accent-tint)" },
  ready_for_delivery: { color: "var(--build-ok)", bg: "var(--build-ok-tint)" },
};

// Pasos del recorrido y en cuál está el usuario según el estado.
const JOURNEY: Array<{ key: string; icon: typeof IconEdit }> = [
  { key: "create", icon: IconEdit },
  { key: "write", icon: IconEdit },
  { key: "review", icon: IconCheckCircle },
  { key: "compile", icon: IconBuild },
  { key: "deliver", icon: IconDownload },
];

function journeyIndex(state: DeliveryState): number {
  switch (state) {
    case "writing":
      return 1; // escribiendo/corrigiendo
    case "ready_for_review":
      return 2; // lista para revisión
    case "ready_for_delivery":
      return 4; // lista para entregar
  }
}

export default function ThesisStatusView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeProject = useProjectStore((s) => s.activeProject);
  const activeProjectPath = useProjectStore((s) => s.activeProjectPath);

  const [report, setReport] = useState<DeliveryQualityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await deliveryQualityReport(path));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeProjectPath) void refresh(activeProjectPath);
  }, [activeProjectPath, refresh]);

  const routeId = encodeURIComponent(activeProjectPath ?? "proyecto");
  const projectTitle = activeProject?.metadata.title ?? t("status.project_fallback");
  const state = report?.state ?? "writing";
  const style = STATE_STYLE[state];
  const nextAction = report?.repair_actions?.[0] ?? null;
  const step = journeyIndex(state);

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ {projectTitle.length > 42 ? projectTitle.slice(0, 42) + "…" : projectTitle}</span></>}
        right={
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-sm" onClick={() => activeProjectPath && refresh(activeProjectPath)} disabled={loading || !activeProjectPath}>
              {loading ? t("status.checking") : t("status.recheck")}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/project/${routeId}`)}>
              {t("status.back_to_editor")}
            </button>
          </div>
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "32px 48px", background: "var(--bg-app)" }} className="scroll">
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          {!activeProjectPath && (
            <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>{t("status.no_project")}</p>
          )}
          {error && <p style={{ color: "var(--build-err)", fontSize: "var(--fs-sm)" }}>{error}</p>}

          {report && (
            <>
              {/* Hero: estado + score */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20,
                padding: "22px 24px", borderRadius: "var(--r-lg)",
                background: style.bg, border: `1px solid ${style.color}`, marginBottom: 20,
              }}>
                <div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {t("status.state_label")}
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 500, color: style.color, marginTop: 2 }}>
                    {t(`status.state_${state}`)}
                  </div>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginTop: 4, maxWidth: 480 }}>
                    {t(`status.state_${state}_hint`)}
                  </div>
                </div>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 600, color: style.color, lineHeight: 1 }}>
                    {report.score}
                  </div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>{t("status.score_label")}</div>
                </div>
              </div>

              {/* Recorrido */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 22 }}>
                {JOURNEY.map((s, i) => {
                  const done = i < step;
                  const current = i === step;
                  const c = current ? style.color : done ? "var(--build-ok)" : "var(--border-firm)";
                  return (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center",
                          background: current ? style.bg : done ? "var(--build-ok-tint)" : "var(--bg-panel)",
                          border: `2px solid ${c}`, color: c,
                        }}>
                          <s.icon size={13} />
                        </div>
                        <span style={{ fontSize: 10, color: current ? style.color : "var(--fg-muted)", fontWeight: current ? 700 : 400 }}>
                          {t(`status.step_${s.key}`)}
                        </span>
                      </div>
                      {i < JOURNEY.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: i < step ? "var(--build-ok)" : "var(--border-subtle)", margin: "0 4px", marginBottom: 16 }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Siguiente acción recomendada */}
              <div style={{
                background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
                borderRadius: "var(--r-lg)", padding: 18, marginBottom: 16,
              }}>
                <div style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  {t("status.next_action")}
                </div>
                {state === "ready_for_delivery" ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div>
                      <div style={{ fontWeight: 650, color: "var(--fg-strong)" }}>{t("status.deliver_title")}</div>
                      <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginTop: 2 }}>{t("status.deliver_body")}</div>
                    </div>
                    <button className="btn btn-accent btn-sm" style={{ flexShrink: 0 }} onClick={() => navigate(`/project/${routeId}/compile`)}>
                      <IconDownload size={13} /> {t("status.go_export")}
                    </button>
                  </div>
                ) : nextAction ? (
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 650, color: "var(--fg-strong)" }}>{nextAction.title}</div>
                      <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginTop: 2 }}>{nextAction.action}</div>
                      {nextAction.target && (
                        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{nextAction.target}</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/project/${routeId}`)}><IconEdit size={12} /> {t("status.go_editor")}</button>
                      <button className="btn btn-accent btn-sm" onClick={() => navigate(`/project/${routeId}/compile?auto=1`)}><IconBuild size={12} /> {t("status.go_compile")}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>{t("status.review_ready_body")}</span>
                    <button className="btn btn-accent btn-sm" style={{ flexShrink: 0 }} onClick={() => navigate(`/project/${routeId}/compile?auto=1`)}><IconBuild size={12} /> {t("status.go_compile")}</button>
                  </div>
                )}
              </div>

              {/* Qué falta */}
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12, fontSize: "var(--fs-xs)" }}>
                  <strong style={{ color: "var(--fg-strong)", fontSize: "var(--fs-sm)" }}>{t("status.whats_left")}</strong>
                  <span style={{ color: "var(--build-err)" }}>● {t("status.errors", { count: report.error_count })}</span>
                  <span style={{ color: "var(--build-warn)" }}>● {t("status.warnings", { count: report.warning_count })}</span>
                </div>
                {report.repair_actions.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-sm)", color: "var(--build-ok)" }}>
                    <IconCheckCircle size={16} /> {t("status.nothing_left")}
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {report.repair_actions.slice(0, 8).map((a, i) => (
                      <li key={`${a.code}-${i}`} style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <IconWarn size={13} style={{ color: "var(--build-warn)", flexShrink: 0, marginTop: 2 }} />
                        <div>
                          <span style={{ fontWeight: 600 }}>{a.title}.</span> <span style={{ color: "var(--fg-muted)" }}>{a.action}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <TxStatusbar items={[
        { text: report ? t(`status.state_${report.state}`) : t("status.checking") },
        { text: report ? t("status.score_bar", { score: report.score }) : "", right: true },
      ]} />
    </>
  );
}
