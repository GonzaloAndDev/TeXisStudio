import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import { ReadinessOverview } from "../components/ReadinessOverview";
import { IconBuild, IconChevronL, IconCheckCircle, IconErr, IconFile, IconMore, IconPlay, IconRefresh, IconX } from "../components/Icons";
import { api } from "../lib/tauri";
import { deriveProjectReadiness } from "../lib/projectReadiness";
import { useProjectStore } from "../stores/project";
import { useSettingsStore } from "../stores/settings";
import { getLatexConfig } from "../services/languagePacks";
import { useAiStore } from "../stores/ai";
import type { CompilationResult, ExportDeliveryResult, PdfPostflightResult, ValidationReport } from "../types";

type CompileState = "idle" | "compiling" | "success" | "error";
import { ErrorCard, BackendChip, AiErrorHelper, DeliveryCheckModal, PdfViewer, PostflightPanel, logColor, type Backend, type PendingAction } from "./compile/CompileWidgets";

// ── Vista principal ───────────────────────────────────────────────

export default function CompileView() {
  const { id: encodedPath } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, activeProjectPath, latexInfo } = useProjectStore();
  const { lang, userMode } = useSettingsStore();

  const [compileState, setCompileState] = useState<CompileState>("idle");
  const [result, setResult] = useState<CompilationResult | null>(null);
  const [draft, setDraft] = useState(false);
  const [backend, setBackend] = useState<Backend>("auto");
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [showPdf, setShowPdf] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportedZip, setExportedZip] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<"draft" | "review" | "final">("review");
  const [exportResult, setExportResult] = useState<ExportDeliveryResult | null>(null);
  const [postflightResult, setPostflightResult] = useState<PdfPostflightResult | null>(null);
  const [postflightBusy, setPostflightBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [postflightError, setPostflightError] = useState<string | null>(null);
  const [showTechnicalLog, setShowTechnicalLog] = useState(userMode === "advanced");

  const [checkReport, setCheckReport]       = useState<ValidationReport | null>(null);
  const [checkAction, setCheckAction]       = useState<PendingAction | null>(null);
  const [pkgConflicts, setPkgConflicts]     = useState<Array<{ package_a: string; package_b: string; description: string; is_blocking: boolean }>>([]);
  const [pkgMissing, setPkgMissing]         = useState<Array<{ package_name: string; priority: string }>>([]);
  const [glossaryIssues, setGlossaryIssues] = useState<{ undefined_references: string[]; unused_count: number } | null>(null);
  const [glossarySummary, setGlossarySummary] = useState<{ entries: number; acronyms: number } | null>(null);

  const logRef = useRef<HTMLDivElement>(null);

  const projectName = activeProject?.metadata.title ?? "Proyecto";
  const readiness = activeProject ? deriveProjectReadiness(activeProject) : null;

  // Detectar backend preferido al montar
  useEffect(() => {
    if (latexInfo?.preferred_backend) {
      setBackend(latexInfo.preferred_backend as Backend);
    }
  }, [latexInfo]);

  // Analizar paquetes y glosario del proyecto al cargar
  useEffect(() => {
    if (!activeProjectPath) return;
    api.analyzePackages(activeProjectPath).then((analysis) => {
      setPkgConflicts(analysis.conflicts);
      setPkgMissing(analysis.missing.filter((m) => m.priority === "required" && !m.already_declared));
    }).catch(() => {});
    api.analyzeGlossary(activeProjectPath).then((g) => {
      if (g.has_issues) {
        const unusedCount = [...g.entries, ...g.acronyms].filter((e: { status: string }) => e.status === "defined_unused").length;
        setGlossaryIssues({ undefined_references: g.undefined_references, unused_count: unusedCount });
      } else {
        setGlossaryIssues(null);
      }
      if (!g.is_empty) {
        setGlossarySummary({ entries: g.entries.length, acronyms: g.acronyms.length });
      } else {
        setGlossarySummary(null);
      }
    }).catch(() => {});
  }, [activeProjectPath]);

  useEffect(() => {
    setShowTechnicalLog(userMode === "advanced");
  }, [userMode]);

  // Auto-scroll del log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [liveLog]);

  const latexmkOk  = latexInfo?.latexmk_usable ?? null;
  const tectonicOk = latexInfo?.has_tectonic ?? null;
  const nothingInstalled = latexInfo && !latexInfo.is_usable;

  async function doCompile() {
    if (!activeProjectPath) return;
    setCompileState("compiling");
    setResult(null);
    setLiveLog([]);
    setShowPdf(false);

    // Escuchar eventos de log en tiempo real
    const unlistenLog = await listen<string>("compile://log", (event) => {
      setLiveLog((prev) => [...prev, event.payload]);
    });

    try {
      const langConfig = getLatexConfig(lang);
      const res = await api.compileProject(activeProjectPath, backend, draft, langConfig);
      setResult(res);
      setCompileState(res.success ? "success" : "error");
      // Actualizar contexto de UI para el asistente de IA
      useAiStore.getState().setUiContext({
        activePanel: "compile",
        hasErrors: !res.success,
        lastErrorMessage: res.user_errors?.[0]?.message,
      });
      // Abrir automáticamente el PDF si la compilación fue exitosa
      if (res.success && res.pdf_path) {
        setShowPdf(true);
      }
    } catch (e) {
      const errMsg = String(e);
      if (errMsg.includes("cancelad")) {
        setCompileState("idle");
      } else {
        setResult({
          success: false,
          user_errors: [{ message: errMsg, suggestion: "Verifica que el compilador LaTeX esté instalado y en el PATH." }],
          warnings: [],
          log_preview: errMsg,
        });
        setCompileState("error");
      }
    } finally {
      unlistenLog();
    }
  }

  async function runDeliveryCheck(action: PendingAction): Promise<boolean> {
    if (!activeProjectPath) return false;
    try {
      const report = await api.validateProject(activeProjectPath);
      const hasIssues = report.issues.some(i => i.severity === "Error" || i.severity === "Warning");
      if (hasIssues) {
        setCheckReport(report);
        setCheckAction(action);
        return false;
      }
    } catch {
      // Si falla la validación, no bloqueamos — el compilador reportará sus propios errores
    }
    return true;
  }

  async function handleCompile() {
    if (!activeProjectPath) return;
    // Solo el borrador se salta el checklist; la compilación final lo requiere
    if (!draft) {
      const ok = await runDeliveryCheck("compile");
      if (!ok) return;
    }
    doCompile();
  }

  async function doExportDelivery() {
    if (!activeProjectPath) return;
    const folder = await api.pickFolder();
    if (!folder) return;
    setExportBusy(true);
    setExportError(null);
    setExportResult(null);
    setExportedZip(null);
    try {
      const res = await api.exportDelivery(activeProjectPath, folder, exportMode);
      setExportResult(res);
      setExportedZip(res.zip_path);
    } catch (e) {
      setExportError(`Error al exportar: ${e}`);
    } finally {
      setExportBusy(false);
    }
  }

  async function doPostflightCheck() {
    if (!activeProjectPath) return;
    setPostflightBusy(true);
    setPostflightError(null);
    setPostflightResult(null);
    try {
      const res = await api.checkPdfPostflight(activeProjectPath);
      setPostflightResult(res);
    } catch (e) {
      setPostflightError(`Error en verificación PDF: ${e}`);
    } finally {
      setPostflightBusy(false);
    }
  }

  async function handleExportDelivery() {
    if (!activeProjectPath) return;
    if (exportMode !== "draft") {
      const ok = await runDeliveryCheck("export");
      if (!ok) return;
    }
    doExportDelivery();
  }

  function handleGoToSection(sectionId: string) {
    if (!encodedPath) return;
    navigate(`/project/${encodedPath}?section=${sectionId}`);
  }

  async function handleCancel() {
    try {
      await api.cancelCompile();
    } catch {
      // ignorar
    }
  }

  // El log que se muestra: mientras compila = liveLog; terminado = log_preview del result
  const displayLog =
    compileState === "compiling"
      ? liveLog
      : result?.log_preview
        ? result.log_preview.split("\n")
        : liveLog;
  const blockingIssues = result?.user_errors.length ?? 0;
  const warningCount = result?.warnings.length ?? 0;
  const readinessLabel =
    compileState === "success"
      ? "Listo para revisar y entregar"
      : compileState === "error"
      ? "Hay problemas que debes corregir antes de entregar"
      : compileState === "compiling"
      ? "Estamos preparando tu PDF"
      : nothingInstalled
      ? "Tu entorno todavía no está listo"
      : "Tu proyecto está listo para intentar una compilación";
  const nextActionLabel =
    compileState === "success"
      ? "Revisa el PDF y genera tu paquete de entrega."
      : compileState === "error"
      ? "Corrige primero los problemas bloqueantes. Puedes abrir el detalle técnico solo si lo necesitas."
      : compileState === "compiling"
      ? "Espera a que termine la compilación. Te mostraremos primero el resultado útil."
      : nothingInstalled
      ? "Instala un compilador LaTeX para poder generar y verificar tu documento."
      : "Cuando quieras, compila para validar portada, bibliografía y estructura.";

  return (
    <>
      {checkReport && checkAction && (
        <DeliveryCheckModal
          report={checkReport}
          pendingAction={checkAction}
          onProceed={() => {
            const action = checkAction;
            setCheckReport(null);
            setCheckAction(null);
            if (action === "compile") doCompile();
            else doExportDelivery();
          }}
          onClose={() => { setCheckReport(null); setCheckAction(null); }}
          onGoToSection={handleGoToSection}
        />
      )}
      <TxAppbar
        left={
          <>
            <TxLogo />
            <TxBreadcrumb parts={[projectName, "Compilar"]} />
          </>
        }
        center={
          (userMode === "advanced" || (tectonicOk && latexmkOk)) ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginRight: 4 }}>
                {tectonicOk && latexmkOk ? "Motor:" : "Motor:"}
              </span>
              <BackendChip id="auto"     label="Auto"     available={latexInfo ? latexInfo.is_usable : null}    selected={backend === "auto"}     onClick={() => setBackend("auto")} />
              <BackendChip id="tectonic" label="Tectonic" available={tectonicOk} version={latexInfo?.tectonic_version} selected={backend === "tectonic"} onClick={() => setBackend("tectonic")} />
              <BackendChip id="latexmk"  label="TeX Live" available={latexmkOk}  version={latexInfo?.latexmk_version}  selected={backend === "latexmk"}  onClick={() => setBackend("latexmk")} />
            </div>
          ) : (
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
              Centro de entrega · modo guiado
            </span>
          )
        }
        right={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/project/${encodedPath}`)}>
              <IconChevronL size={13} /> Editor
            </button>
            {userMode === "advanced" && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowTechnicalLog((value) => !value)}
              >
                {showTechnicalLog ? "Ocultar detalles" : "Ver detalles técnicos"}
              </button>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={draft}
                onChange={(e) => setDraft(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              Borrador
            </label>
            {compileState === "compiling" ? (
              <button className="btn btn-ghost btn-sm" onClick={handleCancel} style={{ color: "var(--build-err)" }}>
                <IconX size={13} /> Cancelar
              </button>
            ) : (
              <button
                className="btn btn-accent"
                onClick={handleCompile}
                disabled={!!nothingInstalled}
                title={nothingInstalled ? "Instala LaTeX primero" : undefined}
              >
                <IconPlay size={13} /> Compilar
              </button>
            )}
          </>
        }
      />

      {/* ── Layout principal: 3 columnas cuando hay PDF ─────────── */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: showPdf ? "320px 1fr 1fr" : "360px 1fr",
        minHeight: 0,
        background: "var(--bg-app)",
      }}>

        {/* ── Panel izquierdo: estado + errores ──────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1px solid var(--border-subtle)" }}>
          <div style={{
            height: 38, padding: "0 16px", borderBottom: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg-panel)", fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)",
          }}>
            {compileState === "success"   && <IconCheckCircle size={14} style={{ color: "var(--build-ok)" }} />}
            {compileState === "error"     && <IconErr size={14} style={{ color: "var(--build-err)" }} />}
            {compileState === "idle"      && <IconBuild size={14} />}
            {compileState === "compiling" && <IconRefresh size={14} />}
            {compileState === "idle"      && "Listo para compilar"}
            {compileState === "compiling" && "Compilando…"}
            {compileState === "success"   && "Compilación exitosa"}
            {compileState === "error"     && `${result?.user_errors.length ?? 0} error(es)`}
            {result?.backend_used && (
              <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", fontWeight: 400 }}>
                via {result.backend_used}
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflow: "auto" }} className="scroll">
            <div style={{ padding: "16px 16px 0" }}>
              <div style={{
                padding: "14px 16px", borderRadius: "var(--r-md)",
                background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
                marginBottom: 12,
              }}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Salud del proyecto
                </div>
                <div style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 6 }}>
                  {readinessLabel}
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
                  {nextActionLabel}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <span className="chip">{blockingIssues} bloqueantes</span>
                  <span className="chip">{warningCount} advertencias</span>
                  <span className="chip">{showPdf && result?.pdf_path ? "PDF visible" : "PDF no visible"}</span>
                </div>
                {readiness && (
                  <div style={{ marginTop: 10 }}>
                    <ReadinessOverview readiness={readiness} showPending={userMode === "basic"} />
                  </div>
                )}
              </div>
            </div>

            {/* LaTeX no instalado */}
            {compileState === "idle" && nothingInstalled && (
              <div style={{ padding: "20px 16px" }}>
                <div style={{
                  padding: "14px 16px", borderRadius: "var(--r-md)",
                  background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
                  display: "flex", gap: 12, alignItems: "flex-start",
                }}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>⚠</span>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--accent-deep)", fontSize: "var(--fs-sm)", marginBottom: 6 }}>
                      No hay compilador LaTeX instalado
                    </div>
                    <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7, marginBottom: 10 }}>
                      Necesitas al menos uno de estos:
                    </div>
                    <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 2 }}>
                      <li><strong>Tectonic</strong> — recomendado, minimal, no necesita Perl</li>
                      <li><strong>MiKTeX</strong> — fácil en Windows, descarga paquetes bajo demanda</li>
                      <li><strong>TeX Live 2024</strong> — instalación completa</li>
                    </ul>
                    <button
                      className="btn btn-accent btn-sm"
                      onClick={() => navigate("/setup-latex")}
                    >
                      Ver guía de instalación →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Advertencias de paquetes */}
            {compileState === "idle" && !nothingInstalled && (pkgConflicts.length > 0 || pkgMissing.length > 0) && (
              <div style={{ margin: "12px 16px 0", padding: "12px 14px", borderRadius: "var(--r-md)", background: "color-mix(in srgb, var(--build-warn) 10%, var(--bg-panel))", border: "1px solid var(--build-warn)" }}>
                <div style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--build-warn)", marginBottom: 6 }}>
                  Advertencias de paquetes LaTeX
                </div>
                {pkgConflicts.filter(c => c.is_blocking).map((c, i) => (
                  <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--build-err)", marginBottom: 4 }}>
                    ✗ Conflicto bloqueante: {c.description}
                  </div>
                ))}
                {pkgConflicts.filter(c => !c.is_blocking).map((c, i) => (
                  <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--build-warn)", marginBottom: 4 }}>
                    ⚠ {c.description}
                  </div>
                ))}
                {pkgMissing.map((m, i) => (
                  <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: 2 }}>
                    + Falta <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-strong)" }}>{m.package_name}</span> en el preámbulo
                  </div>
                ))}
              </div>
            )}

            {/* Advertencias de glosario */}
            {compileState === "idle" && !nothingInstalled && glossaryIssues && (
              <div style={{ margin: "12px 16px 0", padding: "12px 14px", borderRadius: "var(--r-md)", background: "color-mix(in srgb, var(--accent) 8%, var(--bg-panel))", border: "1px solid var(--accent-soft)" }}>
                <div style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--accent-deep)", marginBottom: 6 }}>
                  Advertencias de glosario
                </div>
                {glossaryIssues.undefined_references.map((k, i) => (
                  <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--build-warn)", marginBottom: 2 }}>
                    ⚠ <span style={{ fontFamily: "var(--font-mono)" }}>{k}</span> referenciado con \gls pero no definido
                  </div>
                ))}
                {glossaryIssues.unused_count > 0 && (
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 4 }}>
                    {glossaryIssues.unused_count} entrada{glossaryIssues.unused_count > 1 ? "s" : ""} definida{glossaryIssues.unused_count > 1 ? "s" : ""} sin usar en el documento
                  </div>
                )}
              </div>
            )}

            {/* Resumen de glosario (sin issues) */}
            {compileState === "idle" && !nothingInstalled && !glossaryIssues && glossarySummary && (
              <div style={{ margin: "12px 16px 0", padding: "9px 14px", borderRadius: "var(--r-md)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "var(--build-ok)", fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                  Glosario listo — {glossarySummary.acronyms > 0 && `${glossarySummary.acronyms} acrónimo${glossarySummary.acronyms > 1 ? "s" : ""}`}
                  {glossarySummary.acronyms > 0 && glossarySummary.entries > 0 && " · "}
                  {glossarySummary.entries > 0 && `${glossarySummary.entries} término${glossarySummary.entries > 1 ? "s" : ""}`}
                </span>
              </div>
            )}

            {/* Estado idle normal — solo cuando no hay otro panel informativo visible */}
            {compileState === "idle" && !nothingInstalled && !glossarySummary && !glossaryIssues && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--fg-faint)" }}>
                <IconBuild size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ margin: 0 }}>Presiona <strong>Compilar</strong> para generar el PDF.</p>
                <p style={{ fontSize: "var(--fs-xs)", marginTop: 8 }}>
                  Se regenerarán los archivos LaTeX y se ejecutará{" "}
                  {backend === "auto" ? (latexInfo?.preferred_backend ?? "el motor disponible") : backend}.
                </p>
              </div>
            )}

            {compileState === "compiling" && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--fg-muted)" }}>
                <IconRefresh size={24} style={{ opacity: 0.4, marginBottom: 12 }} />
                <p>Compilando — {liveLog.length} líneas recibidas…</p>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleCancel}
                  style={{ marginTop: 12, color: "var(--build-err)" }}
                >
                  <IconX size={11} /> Cancelar compilación
                </button>
              </div>
            )}

            {compileState === "success" && result && (
              <div style={{ padding: "20px 16px" }}>
                <div style={{
                  background: "var(--build-ok-tint)", color: "var(--build-ok)",
                  padding: "12px 16px", borderRadius: "var(--r-md)",
                  display: "flex", gap: 10, alignItems: "center", marginBottom: 12,
                }}>
                  <IconCheckCircle size={16} />
                  <div>
                    <div style={{ fontWeight: 500 }}>PDF generado correctamente</div>
                    {result.pdf_path && (
                      <div style={{ fontSize: "var(--fs-xs)", marginTop: 2, fontFamily: "var(--font-mono)", opacity: 0.8 }}>
                        {result.pdf_path}
                      </div>
                    )}
                  </div>
                  {result.pdf_path && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ marginLeft: "auto" }}
                      onClick={() => setShowPdf((v) => !v)}
                    >
                      {showPdf ? "Ocultar PDF" : "Ver PDF"}
                    </button>
                  )}
                </div>

                <div style={{
                  padding: "12px 14px", borderRadius: "var(--r-md)",
                  background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
                  fontSize: "var(--fs-sm)", color: "var(--accent-deep)", lineHeight: 1.6, marginBottom: 12,
                }}>
                  <strong>Qué sigue:</strong> revisa el PDF, ejecuta la verificación final si tu institución la pide y luego exporta el paquete de entrega.
                </div>

                {/* Paquete de entrega */}
                <div style={{
                  padding: "14px 16px", borderRadius: "var(--r-md)",
                  background: "var(--bg-panel)", border: "1px solid var(--border-firm)",
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", marginBottom: 8 }}>
                    Paquete de entrega
                  </div>

                  {/* Selector de modo */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                    {(["draft", "review", "final"] as const).map((m) => {
                      const labels = { draft: "Borrador", review: "Revisión", final: "Final" };
                      const col = m === "draft" ? "var(--fg-muted)" : m === "review" ? "var(--accent)" : "var(--build-ok)";
                      const active = exportMode === m;
                      return (
                        <button
                          key={m}
                          className="btn btn-xs"
                          onClick={() => setExportMode(m)}
                          style={{
                            border: `1px solid ${active ? col : "var(--border-firm)"}`,
                            background: active ? `color-mix(in srgb, ${col} 15%, transparent)` : "transparent",
                            color: active ? col : "var(--fg-muted)",
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          {labels[m]}
                        </button>
                      );
                    })}
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginLeft: 2 }}>
                      {exportMode === "draft"  && "Sin verificación"}
                      {exportMode === "review" && "Bloquea errores de validación"}
                      {exportMode === "final"  && "Bloquea errores + fuentes no incrustadas"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: "var(--accent)", color: "#fff", border: "none" }}
                      disabled={exportBusy}
                      onClick={handleExportDelivery}
                    >
                      <IconMore size={12} />
                      {exportBusy ? "Generando…" : "Exportar entrega (.zip)"}
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      disabled={postflightBusy || !result?.pdf_path}
                      onClick={doPostflightCheck}
                      title={!result?.pdf_path ? "Compila primero para obtener un PDF" : undefined}
                    >
                      {postflightBusy ? "Verificando…" : "Verificar PDF"}
                    </button>
                  </div>
                  {exportError && (
                    <div style={{ marginTop: 8, fontSize: "var(--fs-xs)", color: "var(--build-err)", background: "var(--build-err-tint)", padding: "7px 10px", borderRadius: "var(--r-sm)" }}>
                      {exportError}
                    </div>
                  )}
                  {postflightError && (
                    <div style={{ marginTop: 8, fontSize: "var(--fs-xs)", color: "var(--build-err)", background: "var(--build-err-tint)", padding: "7px 10px", borderRadius: "var(--r-sm)" }}>
                      {postflightError}
                    </div>
                  )}

                  {exportedZip && (
                    <div style={{
                      marginTop: 10, padding: "8px 12px",
                      background: "var(--build-ok-tint)", borderRadius: "var(--r-sm)",
                      fontSize: "var(--fs-xs)", color: "var(--build-ok)",
                      fontFamily: "var(--font-mono)", wordBreak: "break-all",
                      display: "flex", alignItems: "flex-start", gap: 6,
                    }}>
                      <IconCheckCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        {exportedZip}
                        {exportResult && !exportResult.all_fonts_embedded && (
                          <div style={{ color: "var(--build-warn)", marginTop: 4, fontFamily: "inherit" }}>
                            ⚠ Hay fuentes no incrustadas en el PDF
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Panel postflight */}
                {postflightResult && <PostflightPanel result={postflightResult} />}

                {result.warnings.map((w, i) => (
                  <ErrorCard key={i} error={{ message: w }} sev="warn" />
                ))}
              </div>
            )}

            {compileState === "error" && result && result.user_errors.map((e, i) => (
              <ErrorCard key={i} error={e} sev="err" />
            ))}

            {/* Trigger de asistente IA tras build fallido */}
            {compileState === "error" && result && result.user_errors.length > 0 && (
              <div style={{ padding: "0 16px 16px" }}>
                <AiErrorHelper
                  errors={result.user_errors}
                  log={result.log_preview ?? displayLog.join("\n")}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Panel central: resumen / detalle técnico ──────────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRight: showPdf ? "1px solid var(--border-subtle)" : undefined }}>
          <div style={{
            height: 38, padding: "0 16px", borderBottom: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg-panel)", fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)",
          }}>
            <IconFile size={14} />
            {showTechnicalLog ? "Detalles técnicos" : "Resumen guiado"}
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: "auto", fontSize: 10 }}
              onClick={() => setShowTechnicalLog((value) => !value)}
            >
              {showTechnicalLog ? "Ocultar detalle" : "Ver detalles técnicos"}
            </button>
          </div>
          {showTechnicalLog ? (
            <div
              ref={logRef}
              style={{
                flex: 1, overflow: "auto",
                fontFamily: "var(--font-mono)", fontSize: 11,
                background: "var(--ink-900)", color: "#C8C2B5",
                padding: "14px 18px", lineHeight: 1.65,
              }}
              className="scroll"
            >
              {displayLog.length > 0
                ? displayLog.map((line, i) => (
                    <div key={i} style={{ color: logColor(line), whiteSpace: "pre" }}>
                      {line || " "}
                    </div>
                  ))
                : (
                  <div style={{ color: "#9C9685" }}>
                    {compileState === "idle" ? "— esperando compilación —" : compileState === "compiling" ? "iniciando…" : "sin log"}
                  </div>
                )
              }
            </div>
          ) : (
            <div style={{ flex: 1, overflow: "auto", padding: "20px 22px" }} className="scroll">
              <div style={{
                background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
                borderRadius: "var(--r-lg)", padding: 18, marginBottom: 12,
              }}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Qué hace TeXisStudio por ti
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.9 }}>
                  <li>Genera los archivos necesarios para tu tesis.</li>
                  <li>Intenta compilar el PDF y detectar errores importantes.</li>
                  <li>Te ayuda a verificar antes de exportar la entrega final.</li>
                </ul>
              </div>
              <div style={{
                background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
                borderRadius: "var(--r-lg)", padding: 18,
              }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--accent-deep)", marginBottom: 8 }}>
                  ¿Cuándo abrir los detalles técnicos?
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
                  Solo cuando un error no se entienda con el resumen principal, cuando soporte te lo pida o cuando quieras revisar el backend exacto usado.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Panel derecho: visor PDF (solo cuando showPdf) ────── */}
        {showPdf && result?.pdf_path && (
          <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{
              height: 38, padding: "0 16px", borderBottom: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--bg-panel)", fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)",
            }}>
              <IconFile size={14} />
              Vista previa PDF
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: "auto", fontSize: 10 }}
                onClick={() => setShowPdf(false)}
              >
                <IconX size={11} /> Cerrar
              </button>
            </div>
            <PdfViewer pdfPath={result.pdf_path} />
          </div>
        )}
      </div>

      <TxStatusbar items={[
        compileState === "success"
          ? { text: "PDF listo", dot: "var(--build-ok)" }
          : compileState === "error"
          ? { text: "Error de compilación", dot: "var(--build-err)" }
          : compileState === "compiling"
          ? { text: `Compilando… (${liveLog.length} líneas)`, dot: "var(--build-warn)" }
          : { text: "Listo", dot: "var(--fg-faint)" },
        { icon: <IconFile size={11} />, text: projectName },
        {
          right: true,
          text: latexInfo?.is_usable
            ? `${latexInfo.available_backends.join(" · ")} disponibles`
            : "⚠ LaTeX no instalado",
        },
      ]} />
    </>
  );
}
