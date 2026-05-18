import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBuild, IconCheck, IconChevronL, IconCheckCircle, IconErr,
  IconFile, IconPlay, IconRefresh, IconWarn,
} from "../components/Icons";
import { api } from "../lib/tauri";
import { useProjectStore } from "../stores/project";
import type { CompilationResult, UserError } from "../types";

type CompileState = "idle" | "compiling" | "success" | "error";

const LOG_COLORS: Record<string, string> = {
  err: "#E89090",
  warn: "#E5C97A",
  ok: "#A8D49C",
  cmd: "#9DBEDC",
  default: "#9C9685",
};

function logColor(line: string): string {
  if (line.startsWith("!") || line.toLowerCase().includes("error")) return LOG_COLORS.err;
  if (line.toLowerCase().includes("warning")) return LOG_COLORS.warn;
  if (line.startsWith("Output written") || line.includes("pdf")) return LOG_COLORS.ok;
  if (line.startsWith(">") || line.startsWith("latexmk") || line.startsWith("Running")) return LOG_COLORS.cmd;
  return LOG_COLORS.default;
}

function ErrorCard({ error, sev }: { error: UserError; sev: "err" | "warn" }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      borderLeft: `3px solid ${sev === "err" ? "var(--build-err)" : "var(--build-warn)"}`,
      background: "var(--bg-panel)", cursor: "pointer",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {sev === "err"
          ? <IconErr size={13} style={{ color: "var(--build-err)" }} />
          : <IconWarn size={13} style={{ color: "var(--build-warn)" }} />
        }
        <span style={{ fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>
          {error.message}
        </span>
      </div>
      {error.suggestion && (
        <div style={{
          background: "var(--accent-tint)", color: "var(--accent-deep)",
          padding: "8px 10px", borderRadius: "var(--r-sm)", fontSize: "var(--fs-sm)",
          display: "flex", gap: 8, alignItems: "flex-start", marginTop: 6,
        }}>
          <IconCheck size={12} sw={2} />
          {error.suggestion}
        </div>
      )}
      {error.raw_log_line && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-muted)", marginTop: 6 }}>
          {error.raw_log_line}
        </div>
      )}
    </div>
  );
}

export default function CompileView() {
  const { id: encodedPath } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, activeProjectPath } = useProjectStore();

  const { latexInfo } = useProjectStore();
  const [state, setState] = useState<CompileState>("idle");
  const [result, setResult] = useState<CompilationResult | null>(null);
  const [draft, setDraft] = useState(false);

  const projectName = activeProject?.metadata.title ?? "Proyecto";

  async function handleCompile() {
    if (!activeProjectPath) return;
    setState("compiling");
    setResult(null);
    try {
      const res = await api.compileProject(activeProjectPath, "latexmk", draft);
      setResult(res);
      setState(res.success ? "success" : "error");
    } catch (e) {
      setResult({
        success: false,
        user_errors: [{ message: String(e), suggestion: "Verifica que latexmk y xelatex estén instalados." }],
        warnings: [],
        log_preview: String(e),
      });
      setState("error");
    }
  }

  return (
    <>
      <TxAppbar
        left={
          <>
            <TxLogo />
            <TxBreadcrumb parts={[projectName, "Compilar"]} />
          </>
        }
        center={null}
        right={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/project/${encodedPath}`)}>
              <IconChevronL size={13} /> Editor
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={draft}
                onChange={(e) => setDraft(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              Borrador
            </label>
            <button
              className={`btn ${state === "compiling" ? "" : "btn-accent"}`}
              onClick={handleCompile}
              disabled={state === "compiling"}
            >
              {state === "compiling"
                ? <><IconRefresh size={13} /> Compilando…</>
                : <><IconPlay size={13} /> Compilar</>
              }
            </button>
          </>
        }
      />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 0, background: "var(--bg-app)" }}>

        {/* ── Panel izquierdo: errores ──────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1px solid var(--border-subtle)" }}>
          <div style={{
            height: 38, padding: "0 16px", borderBottom: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg-panel)", fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)",
          }}>
            {state === "success" && <IconCheckCircle size={14} style={{ color: "var(--build-ok)" }} />}
            {state === "error"   && <IconErr size={14} style={{ color: "var(--build-err)" }} />}
            {state === "idle"    && <IconBuild size={14} />}
            {state === "compiling" && <IconRefresh size={14} />}
            {state === "idle" && "Listo para compilar"}
            {state === "compiling" && "Compilando…"}
            {state === "success" && "Compilación exitosa"}
            {state === "error" && `${result?.user_errors.length ?? 0} error(es)`}
          </div>

          <div style={{ flex: 1, overflow: "auto" }} className="scroll">
            {state === "idle" && latexInfo && !latexInfo.is_usable && (
              <div style={{ padding: "20px 16px" }}>
                <div style={{
                  padding: "14px 16px", borderRadius: "var(--r-md)",
                  background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
                  display: "flex", gap: 12, alignItems: "flex-start",
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>⚠</span>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--accent-deep)", fontSize: "var(--fs-sm)", marginBottom: 4 }}>
                      LaTeX no detectado
                    </div>
                    <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
                      Instala <strong>MiKTeX</strong> o <strong>TeX Live 2024</strong> junto con{" "}
                      <strong>Strawberry Perl</strong> para poder compilar PDFs.
                      Después reinicia TeXisStudio.
                    </div>
                  </div>
                </div>
              </div>
            )}
            {state === "idle" && (!latexInfo || latexInfo.is_usable) && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--fg-faint)" }}>
                <IconBuild size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ margin: 0 }}>Presiona <strong>Compilar</strong> para generar el PDF.</p>
                <p style={{ fontSize: "var(--fs-xs)", marginTop: 8 }}>
                  Se regenerarán los archivos LaTeX y se ejecutará latexmk.
                </p>
              </div>
            )}

            {state === "compiling" && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--fg-muted)" }}>
                <p>Generando LaTeX y compilando…</p>
              </div>
            )}

            {state === "success" && result && (
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
                </div>
                {result.warnings.map((w, i) => (
                  <ErrorCard key={i} error={{ message: w }} sev="warn" />
                ))}
              </div>
            )}

            {state === "error" && result && result.user_errors.map((e, i) => (
              <ErrorCard key={i} error={e} sev="err" />
            ))}
          </div>
        </div>

        {/* ── Panel derecho: log crudo ──────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{
            height: 38, padding: "0 16px", borderBottom: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg-panel)", fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)",
          }}>
            <IconFile size={14} /> Log de compilación
          </div>
          <div
            style={{
              flex: 1, overflow: "auto",
              fontFamily: "var(--font-mono)", fontSize: 11,
              background: "var(--ink-900)", color: "#C8C2B5",
              padding: "14px 18px", lineHeight: 1.65,
            }}
            className="scroll"
          >
            {result?.log_preview
              ? result.log_preview.split("\n").map((line, i) => (
                  <div key={i} style={{ color: logColor(line), whiteSpace: "pre" }}>
                    {line || " "}
                  </div>
                ))
              : (
                <div style={{ color: "#9C9685" }}>
                  {state === "idle" ? "— esperando compilación —" : state === "compiling" ? "compilando…" : "sin log"}
                </div>
              )
            }
          </div>
        </div>
      </div>

      <TxStatusbar items={[
        state === "success"
          ? { text: "PDF listo", dot: "var(--build-ok)" }
          : state === "error"
          ? { text: "Error de compilación", dot: "var(--build-err)" }
          : state === "compiling"
          ? { text: "Compilando…", dot: "var(--build-warn)" }
          : { text: "Listo", dot: "var(--fg-faint)" },
        { icon: <IconFile size={11} />, text: projectName },
        { right: true, text: draft ? "Modo borrador activado" : "Compilación completa" },
      ]} />
    </>
  );
}
