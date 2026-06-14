import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { AppDialog } from "../components/AppDialog";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import { ReadinessOverview } from "../components/ReadinessOverview";
import { IconBuild, IconChevronL, IconCheckCircle, IconErr, IconFile, IconMore, IconPlay, IconRefresh, IconX } from "../components/Icons";
import { api } from "../lib/tauri";
import { deriveProjectReadiness } from "../lib/projectReadiness";
import { useProjectStore } from "../stores/project";
import { useSettingsStore } from "../stores/settings";
import { getLatexConfig } from "../services/languagePacks";
import { useAiStore } from "../stores/ai";
import type { CompilationResult, DependencyIssue, ExportDeliveryResult, PdfPostflightResult, ValidationReport } from "../types";
import { useToast } from "../components/ui/ToastProvider";
import { resolvePreferredLatexBackend } from "../lib/latexBackendPreference";
import { useWorkspaceStore } from "../stores/workspace";

type CompileState = "idle" | "compiling" | "success" | "error";
import { ErrorCard, BackendChip, AiErrorHelper, DeliveryCheckModal, PdfViewer, PostflightPanel, DependencyIssuesPanel, logColor, type Backend, type PendingAction } from "./compile/CompileWidgets";
import { isCancellationError } from "../lib/compileErrors";

// ── Constantes ────────────────────────────────────────────────────

/** Cap the live log buffer so a runaway LaTeX run can't OOM the UI. */
const MAX_LOG_LINES = 2000;

// ── Vista principal ───────────────────────────────────────────────

export default function CompileView() {
  const { t } = useTranslation();
  const { id: encodedPath } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const autostart = searchParams.get("auto") === "1";
  const { activeProject, activeProjectPath, latexInfo } = useProjectStore();
  const { lang, userMode, latexPrimaryBackend, latexAllowFallback } = useSettingsStore();

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
  const [readinessAction, setReadinessAction] = useState<PendingAction | null>(null);

  const [checkReport, setCheckReport]       = useState<ValidationReport | null>(null);
  const [checkAction, setCheckAction]       = useState<PendingAction | null>(null);
  const [pkgConflicts, setPkgConflicts]     = useState<Array<{ package_a: string; package_b: string; description: string; is_blocking: boolean }>>([]);
  const [pkgMissing, setPkgMissing]         = useState<Array<{ package_name: string; priority: string }>>([]);
  const [glossaryIssues, setGlossaryIssues] = useState<{ undefined_references: string[]; unused_count: number } | null>(null);
  const [glossarySummary, setGlossarySummary] = useState<{ entries: number; acronyms: number } | null>(null);
  const [dependencyIssues, setDependencyIssues] = useState<DependencyIssue[]>([]);
  const [platform, setPlatform] = useState<string>("linux");

  const logRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const autostartFiredRef = useRef(false);
  // Tracks whether the component is still mounted — used to avoid setState
  // after unmount when the user navigates away mid-compile.
  const mountedRef = useRef(true);
  // Tracks whether a compile is already in flight (debounce double-click).
  const compilingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const projectName = activeProject?.metadata.title ?? t("progress.project_fallback");
  const readiness = activeProject ? deriveProjectReadiness(activeProject) : null;
  const projectRouteId = encodeURIComponent(activeProjectPath ?? encodedPath ?? "");

  // Apply the user's default; the compile screen can still override it locally.
  useEffect(() => {
    setBackend(resolvePreferredLatexBackend(latexPrimaryBackend, latexAllowFallback, latexInfo));
  }, [latexAllowFallback, latexInfo, latexPrimaryBackend]);

  // Detectar plataforma al montar
  useEffect(() => {
    api.getPlatform().then(p => setPlatform(p)).catch(() => {});
  }, []);

  // Verificar dependencias del entorno al cargar o cambiar backend.
  // The `cancelled` flag prevents stale responses from overwriting state when
  // the user switches project or backend before the previous fetch resolves.
  useEffect(() => {
    if (!activeProjectPath) return;
    let cancelled = false;
    api.checkToolchain(activeProjectPath, backend).then(report => {
      if (cancelled) return;
      setDependencyIssues(report.issues);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeProjectPath, backend]);

  // Analizar paquetes y glosario del proyecto al cargar
  useEffect(() => {
    if (!activeProjectPath) return;
    let cancelled = false;
    api.analyzePackages(activeProjectPath).then((analysis) => {
      if (cancelled) return;
      setPkgConflicts(analysis.conflicts);
      setPkgMissing(analysis.missing.filter((m) => m.priority === "required" && !m.already_declared));
    }).catch(() => {});
    api.analyzeGlossary(activeProjectPath).then((g) => {
      if (cancelled) return;
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
    return () => { cancelled = true; };
  }, [activeProjectPath]);

  useEffect(() => {
    setShowTechnicalLog(userMode === "advanced");
  }, [userMode]);

  // Auto-scroll del log — respect user-initiated scroll. If the user scrolled
  // up to inspect older lines we don't yank them back to the bottom on every
  // new line; we resume auto-scroll once they're within a few pixels of the
  // bottom again.
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const STICK_THRESHOLD = 24;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= STICK_THRESHOLD) {
      el.scrollTop = el.scrollHeight;
    }
  }, [liveLog]);

  const latexmkOk  = latexInfo?.latexmk_usable ?? null;
  const tectonicOk = latexInfo?.has_tectonic ?? null;
  const nothingInstalled = latexInfo && !latexInfo.is_usable;

  // Trigger automatic compilation when arriving with ?auto=1.
  // We deliberately wait until `latexInfo` is loaded (non-null) before
  // deciding whether to fire — otherwise we risked starting a compile against
  // an unknown environment because `nothingInstalled` was `false` (not yet
  // determined) instead of being a real "yes".
  useEffect(() => {
    if (!autostart || autostartFiredRef.current) return;
    if (!activeProjectPath) return;
    if (latexInfo === null) return; // detection still in flight
    if (!latexInfo.is_usable) return; // user must install LaTeX first
    autostartFiredRef.current = true;
    // Strip ?auto=1 from the URL so a manual F5 doesn't re-trigger a build.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("auto");
      return next;
    }, { replace: true });
    doCompile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart, activeProjectPath, latexInfo]);

  async function doCompile() {
    if (!activeProjectPath) return;
    // Debounce double invocation (autostart + user click, or two rapid clicks).
    if (compilingRef.current) return;
    compilingRef.current = true;

    const startedAt = performance.now();
    setCompileState("compiling");
    setResult(null);
    setLiveLog([]);
    setShowPdf(false);

    // Subscribe to live log events. Wrapped in try/catch because `listen`
    // can fail when running outside Tauri (e.g., dev browser, tests).
    let unlistenLog: (() => void) | null = null;
    try {
      unlistenLog = await listen<string>("compile://log", (event) => {
        if (!mountedRef.current) return;
        setLiveLog((prev) => {
          // Bound the buffer so a runaway build can't OOM the renderer.
          // Drop the oldest line when we'd exceed the cap.
          if (prev.length >= MAX_LOG_LINES) {
            return [...prev.slice(prev.length - MAX_LOG_LINES + 1), event.payload];
          }
          return [...prev, event.payload];
        });
      });
    } catch {
      // Live log unavailable; the final log_preview from the result still works.
    }

    try {
      const langConfig = getLatexConfig(lang);
      const res = await api.compileProject(activeProjectPath, backend, draft, langConfig);
      if (!mountedRef.current) return;
      setResult(res);
      useWorkspaceStore.getState().setLastBuildSummary({
        success: res.success,
        pdf_path: res.pdf_path,
        duration_ms: res.duration_ms ?? Math.round(performance.now() - startedAt),
      });
      if (res.dependency_issues && res.dependency_issues.length > 0) {
        setDependencyIssues(res.dependency_issues);
      }
      setCompileState(res.success ? "success" : "error");
      useAiStore.getState().setUiContext({
        activePanel: "compile",
        hasErrors: !res.success,
        lastErrorMessage: res.user_errors?.[0]?.message,
      });
      if (res.success && res.pdf_path) {
        setShowPdf(true);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      if (isCancellationError(e)) {
        setCompileState("idle");
      } else {
        const errMsg = String(e);
        useWorkspaceStore.getState().setLastBuildSummary({
          success: false,
          duration_ms: Math.round(performance.now() - startedAt),
        });
        setResult({
          success: false,
          user_errors: [{ message: errMsg, suggestion: t("compile.ensure_latex_installed_path") }],
          warnings: [],
          log_preview: errMsg,
        });
        setCompileState("error");
      }
    } finally {
      compilingRef.current = false;
      if (unlistenLog) {
        try { unlistenLog(); } catch { /* listener already gone */ }
      }
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
    if (!draft && readiness?.deliveryBlocked) {
      setReadinessAction("compile");
      return;
    }
    if (!draft) {
      const ok = await runDeliveryCheck("compile");
      if (!ok) return;
    }
    doCompile();
  }

  async function doExportDelivery() {
    if (!activeProjectPath) return;
    if (exportBusy) return; // guard double-click
    const folder = await api.pickFolder();
    if (!folder) return;
    if (!mountedRef.current) return;
    setExportBusy(true);
    setExportError(null);
    setExportResult(null);
    setExportedZip(null);
    try {
      const res = await api.exportDelivery(activeProjectPath, folder, exportMode);
      if (!mountedRef.current) return;
      setExportResult(res);
      setExportedZip(res.zip_path);
      toast.success(t("compile.export_success"));
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = t("compile.export_error", { error: String(e) });
      setExportError(msg);
      toast.error(msg);
    } finally {
      if (mountedRef.current) setExportBusy(false);
    }
  }

  async function doPostflightCheck() {
    if (!activeProjectPath) return;
    if (postflightBusy) return; // guard double-click
    setPostflightBusy(true);
    setPostflightError(null);
    setPostflightResult(null);
    try {
      const res = await api.checkPdfPostflight(activeProjectPath);
      if (!mountedRef.current) return;
      setPostflightResult(res);
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = t("compile.postflight_error", { error: String(e) });
      setPostflightError(msg);
      toast.error(msg);
    } finally {
      if (mountedRef.current) setPostflightBusy(false);
    }
  }

  async function handleExportDelivery() {
    if (!activeProjectPath) return;
    if (exportMode === "final" && readiness?.deliveryBlocked) {
      setReadinessAction("export");
      return;
    }
    if (exportMode !== "draft") {
      const ok = await runDeliveryCheck("export");
      if (!ok) return;
    }
    doExportDelivery();
  }

  function handleGoToSection(sectionId: string) {
    if (!projectRouteId) return;
    navigate(`/project/${projectRouteId}?section=${sectionId}`);
  }

  // Guard against multiple cancel taps while the backend is still processing.
  const cancelInFlightRef = useRef(false);
  async function handleCancel() {
    if (cancelInFlightRef.current) return;
    if (compileState !== "compiling") return;
    cancelInFlightRef.current = true;
    try {
      await api.cancelCompile();
    } catch (e) {
      console.warn("cancel_compile failed:", e);
    } finally {
      cancelInFlightRef.current = false;
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
      ? t("compile.ready_deliver")
      : compileState === "error"
      ? t("compile.must_fix_before_delivery")
      : compileState === "compiling"
      ? t("compile.preparing_pdf")
      : nothingInstalled
      ? t("compile.environment_not_ready")
      : t("compile.ready_to_compile");
  const nextActionLabel =
    compileState === "success"
      ? t("compile.next_review_pdf")
      : compileState === "error"
      ? t("compile.next_fix_blockers")
      : compileState === "compiling"
      ? t("compile.next_wait")
      : nothingInstalled
      ? t("compile.next_install_latex")
      : t("compile.next_compile_when_ready");

  // Guard: if we landed here without a loaded project (e.g., deep-link, store
  // reset, or external launch), show a friendly empty state instead of an
  // inert "Compile" button that silently does nothing.
  if (!activeProject || !activeProjectPath) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--fg-muted)", background: "var(--bg-app)" }}>
        <p>{t("editor.project_not_loaded")}</p>
        <button className="btn" onClick={() => navigate("/")}>← {t("library.back_home").replace("← ", "")}</button>
      </div>
    );
  }

  return (
    <>
      {readinessAction && readiness && (
        <AppDialog
          title={readinessAction === "compile" ? t("compile.readiness_compile_title") : t("compile.readiness_export_title")}
          subtitle={readinessAction === "compile"
            ? t("compile.readiness_compile_subtitle")
            : t("compile.readiness_export_subtitle")}
          width={580}
          onClose={() => setReadinessAction(null)}
          footer={
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setReadinessAction(null)}>
                {t("compile.readiness_back")}
              </button>
              {readinessAction === "compile" && (
                <button
                  className="btn btn-accent btn-sm"
                  onClick={() => {
                    setReadinessAction(null);
                    setDraft(true);
                    doCompile();
                  }}
                >
                  {t("compile.compile_as_draft")}
                </button>
              )}
            </>
          }
        >
          <div style={{ display: "grid", gap: 12 }}>
            {([
              [t("compile.readiness_delivery"), readiness.deliveryPending],
              [t("compile.readiness_quality"), readiness.qualityPending],
            ] as [string, string[]][]).map(([label, items]) => (
              <div key={label} style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                <div style={{ padding: "8px 10px", background: "var(--bg-panel)", fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}
                </div>
                {items.length === 0 ? (
                  <div style={{ padding: "9px 10px", fontSize: "var(--fs-sm)", color: "var(--build-ok)" }}>
                    {t("compile.readiness_complete")}
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={item} style={{ padding: "9px 10px", borderTop: "1px solid var(--border-subtle)", fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.5 }}>
                      {item}
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </AppDialog>
      )}
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
            <TxBreadcrumb parts={[projectName, t("editor.compile")]} />
          </>
        }
        center={
          (userMode === "advanced" || (tectonicOk && latexmkOk)) ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginRight: 4 }}>
                {t("compile.engine")}:
              </span>
              <BackendChip id="auto"     label="Auto"     available={latexInfo ? latexInfo.is_usable : null}    selected={backend === "auto"}     onClick={() => setBackend("auto")} />
              <BackendChip id="tectonic" label="Tectonic" available={tectonicOk} version={latexInfo?.tectonic_version} selected={backend === "tectonic"} onClick={() => setBackend("tectonic")} />
              <BackendChip id="latexmk"  label="TeX Live" available={latexmkOk}  version={latexInfo?.latexmk_version}  selected={backend === "latexmk"}  onClick={() => setBackend("latexmk")} />
            </div>
          ) : (
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
              {t("compile.guided_delivery_center")}
            </span>
          )
        }
        right={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/project/${projectRouteId}`)}>
              <IconChevronL size={13} /> {t("progress.back_to_editor").replace("← ", "")}
            </button>
            {userMode === "advanced" && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowTechnicalLog((value) => !value)}
              >
                {showTechnicalLog ? t("compile.hide_details") : t("compile.show_technical_details")}
              </button>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={draft}
                onChange={(e) => setDraft(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              {t("compile.draft")}
            </label>
            {compileState === "compiling" ? (
              <button className="btn btn-ghost btn-sm" onClick={handleCancel} style={{ color: "var(--build-err)" }}>
                <IconX size={13} /> {t("common.cancel")}
              </button>
            ) : (
              <button
                className="btn btn-accent"
                onClick={handleCompile}
                disabled={!!nothingInstalled}
                title={nothingInstalled ? t("compile.install_latex_first") : undefined}
              >
                <IconPlay size={13} /> {t("editor.compile")}
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
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{
              height: 38, padding: "0 16px", borderBottom: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--bg-panel)", fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)",
            }}
          >
            {compileState === "success"   && <IconCheckCircle size={14} style={{ color: "var(--build-ok)" }} />}
            {compileState === "error"     && <IconErr size={14} style={{ color: "var(--build-err)" }} />}
            {compileState === "idle"      && <IconBuild size={14} />}
            {compileState === "compiling" && <IconRefresh size={14} />}
            {compileState === "idle"      && t("compile.ready_to_compile_short")}
            {compileState === "compiling" && t("compile.compiling")}
            {compileState === "success"   && t("compile.compile_success")}
            {compileState === "error"     && t("compile.error_count", { count: result?.user_errors.length ?? 0 })}
            {result?.backend_used && (
              <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", fontWeight: 400 }}>
                {t("compile.via_backend", { backend: result.backend_used })}
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
                  {t("compile.project_health")}
                </div>
                <div style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 6 }}>
                  {readinessLabel}
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
                  {nextActionLabel}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <span className="chip">{t("compile.blocking_count", { count: blockingIssues })}</span>
                  <span className="chip">{t("compile.warning_count", { count: warningCount })}</span>
                  <span className="chip">{showPdf && result?.pdf_path ? t("compile.pdf_visible") : t("compile.pdf_not_visible")}</span>
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
                      {t("compile.no_latex_installed")}
                    </div>
                    <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7, marginBottom: 10 }}>
                      {t("compile.need_one_of")}
                    </div>
                    <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 2 }}>
                      <li><strong>Tectonic</strong> — {t("compile.tectonic_desc")}</li>
                      <li><strong>MiKTeX</strong> — {t("compile.miktex_desc")}</li>
                      <li><strong>TeX Live 2024</strong> — {t("compile.texlive_desc")}</li>
                    </ul>
                    <button
                      className="btn btn-accent btn-sm"
                      onClick={() => navigate("/setup-latex")}
                    >
                      {t("compile.view_install_guide")} →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Issues de dependencias del entorno */}
            {dependencyIssues.length > 0 && !nothingInstalled && (
              <div style={{ padding: "12px 16px 0" }}>
                <DependencyIssuesPanel issues={dependencyIssues} platform={platform} />
              </div>
            )}

            {/* Advertencias de paquetes */}
            {compileState === "idle" && !nothingInstalled && (pkgConflicts.length > 0 || pkgMissing.length > 0) && (
              <div style={{ margin: "12px 16px 0", padding: "12px 14px", borderRadius: "var(--r-md)", background: "color-mix(in srgb, var(--build-warn) 10%, var(--bg-panel))", border: "1px solid var(--build-warn)" }}>
                <div style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--build-warn)", marginBottom: 6 }}>
                  {t("compile.latex_package_warnings")}
                </div>
                {pkgConflicts.filter(c => c.is_blocking).map((c, i) => (
                  <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--build-err)", marginBottom: 4 }}>
                    ✗ {t("compile.blocking_conflict")}: {c.description}
                  </div>
                ))}
                {pkgConflicts.filter(c => !c.is_blocking).map((c, i) => (
                  <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--build-warn)", marginBottom: 4 }}>
                    ⚠ {c.description}
                  </div>
                ))}
                {pkgMissing.map((m, i) => (
                  <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: 2 }}>
                    + {t("compile.missing_package_prefix")} <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-strong)" }}>{m.package_name}</span> {t("compile.missing_package_suffix")}
                  </div>
                ))}
              </div>
            )}

            {/* Advertencias de glosario */}
            {compileState === "idle" && !nothingInstalled && glossaryIssues && (
              <div style={{ margin: "12px 16px 0", padding: "12px 14px", borderRadius: "var(--r-md)", background: "color-mix(in srgb, var(--accent) 8%, var(--bg-panel))", border: "1px solid var(--accent-soft)" }}>
                <div style={{ fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--accent-deep)", marginBottom: 6 }}>
                  {t("compile.glossary_warnings")}
                </div>
                {glossaryIssues.undefined_references.map((k, i) => (
                  <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--build-warn)", marginBottom: 2 }}>
                    ⚠ <span style={{ fontFamily: "var(--font-mono)" }}>{k}</span> {t("compile.gls_undefined")}
                  </div>
                ))}
                {glossaryIssues.unused_count > 0 && (
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 4 }}>
                    {t("compile.glossary_unused_count", { count: glossaryIssues.unused_count })}
                  </div>
                )}
              </div>
            )}

            {/* Resumen de glosario (sin issues) */}
            {compileState === "idle" && !nothingInstalled && !glossaryIssues && glossarySummary && (
              <div style={{ margin: "12px 16px 0", padding: "9px 14px", borderRadius: "var(--r-md)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "var(--build-ok)", fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                  {t("compile.glossary_ready")} — {glossarySummary.acronyms > 0 && t("compile.acronym_count", { count: glossarySummary.acronyms })}
                  {glossarySummary.acronyms > 0 && glossarySummary.entries > 0 && " · "}
                  {glossarySummary.entries > 0 && t("compile.term_count", { count: glossarySummary.entries })}
                </span>
              </div>
            )}

            {/* Estado idle normal — solo cuando no hay otro panel informativo visible */}
            {compileState === "idle" && !nothingInstalled && !glossarySummary && !glossaryIssues && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--fg-faint)" }}>
                <IconBuild size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                {autostart && !autostartFiredRef.current
                  ? <p style={{ margin: 0 }}>{t("compile.autostart_pending")}</p>
                  : <p style={{ margin: 0 }}>{t("compile.press_compile_prefix")} <strong>{t("editor.compile")}</strong> {t("compile.press_compile_suffix")}</p>
                }
                <p style={{ fontSize: "var(--fs-xs)", marginTop: 8 }}>
                  {t("compile.regenerate_latex_run")}{" "}
                  {backend === "auto" ? (latexInfo?.preferred_backend ?? t("compile.available_engine")) : backend}.
                </p>
              </div>
            )}

            {compileState === "compiling" && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--fg-muted)" }}>
                <IconRefresh size={24} style={{ opacity: 0.4, marginBottom: 12 }} />
                <p>{t("compile.compiling_lines", { count: liveLog.length })}</p>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleCancel}
                  style={{ marginTop: 12, color: "var(--build-err)" }}
                >
                  <IconX size={11} /> {t("compile.cancel_compile")}
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
                    <div style={{ fontWeight: 500 }}>{t("compile.pdf_generated")}</div>
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
                      {showPdf ? t("compile.hide_pdf") : t("compile.view_pdf")}
                    </button>
                  )}
                </div>

                <div style={{
                  padding: "12px 14px", borderRadius: "var(--r-md)",
                  background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
                  fontSize: "var(--fs-sm)", color: "var(--accent-deep)", lineHeight: 1.6, marginBottom: 12,
                }}>
                  <strong>{t("compile.next_steps_title")}:</strong> {t("compile.next_steps_body")}
                </div>

                {/* Paquete de entrega */}
                <div style={{
                  padding: "14px 16px", borderRadius: "var(--r-md)",
                  background: "var(--bg-panel)", border: "1px solid var(--border-firm)",
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", marginBottom: 8 }}>
                    {t("compile.delivery_package")}
                  </div>

                  {/* Selector de modo */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                    {(["draft", "review", "final"] as const).map((m) => {
                      const labels = { draft: t("compile.export_mode_draft"), review: t("compile.export_mode_review"), final: t("compile.export_mode_final") };
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
                      {exportMode === "draft"  && t("compile.export_draft_hint")}
                      {exportMode === "review" && t("compile.export_review_hint")}
                      {exportMode === "final"  && t("compile.export_final_hint")}
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
                      {exportBusy ? t("compile.generating") : t("compile.export_delivery_zip")}
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      disabled={postflightBusy || !result?.pdf_path}
                      onClick={doPostflightCheck}
                      title={!result?.pdf_path ? t("compile.compile_first_pdf") : undefined}
                    >
                      {postflightBusy ? t("compile.verifying") : t("compile.verify_pdf")}
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
                            ⚠ {t("compile.non_embedded_fonts_warning")}
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
            {showTechnicalLog ? t("compile.technical_details") : t("compile.guided_summary")}
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: "auto", fontSize: 10 }}
              onClick={() => setShowTechnicalLog((value) => !value)}
            >
              {showTechnicalLog ? t("compile.hide_detail") : t("compile.show_technical_details")}
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
                    {compileState === "idle" ? t("compile.waiting_compile_log") : compileState === "compiling" ? t("compile.starting") : t("compile.no_log")}
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
                  {t("compile.what_texis_does")}
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.9 }}>
                  <li>{t("compile.what_does_1")}</li>
                  <li>{t("compile.what_does_2")}</li>
                  <li>{t("compile.what_does_3")}</li>
                </ul>
              </div>
              <div style={{
                background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
                borderRadius: "var(--r-lg)", padding: 18,
              }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--accent-deep)", marginBottom: 8 }}>
                  {t("compile.when_open_details")}
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
                  {t("compile.when_open_details_body")}
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
              {t("compile.pdf_preview")}
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: "auto", fontSize: 10 }}
                onClick={() => setShowPdf(false)}
              >
                <IconX size={11} /> {t("common.close")}
              </button>
            </div>
            <PdfViewer pdfPath={result.pdf_path} />
          </div>
        )}
      </div>

      <TxStatusbar items={[
        compileState === "success"
          ? { text: t("compile.pdf_ready"), dot: "var(--build-ok)" }
          : compileState === "error"
          ? { text: t("compile.compile_error"), dot: "var(--build-err)" }
          : compileState === "compiling"
          ? { text: t("compile.compiling_statusbar", { count: liveLog.length }), dot: "var(--build-warn)" }
          : { text: t("editor.status_done"), dot: "var(--fg-faint)" },
        { icon: <IconFile size={11} />, text: projectName },
        {
          right: true,
          text: latexInfo?.is_usable
            ? t("compile.backends_available", { backends: latexInfo.available_backends.join(" · ") })
            : t("compile.latex_not_installed_status"),
        },
      ]} />
    </>
  );
}
