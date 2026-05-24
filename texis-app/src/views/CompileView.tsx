import { useEffect, useState } from "react";
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
type Backend = "auto" | "latexmk" | "tectonic";

const LOG_COLORS: Record<string, string> = {
  err:     "#E89090",
  warn:    "#E5C97A",
  ok:      "#A8D49C",
  cmd:     "#9DBEDC",
  default: "#9C9685",
};

function logColor(line: string): string {
  if (line.startsWith("!") || line.toLowerCase().includes("error"))   return LOG_COLORS.err;
  if (line.toLowerCase().includes("warning"))                          return LOG_COLORS.warn;
  if (line.startsWith("Output written") || line.includes("pdf"))      return LOG_COLORS.ok;
  if (line.startsWith(">") || line.startsWith("latexmk") || line.startsWith("Running") || line.startsWith("tectonic")) return LOG_COLORS.cmd;
  return LOG_COLORS.default;
}

function ErrorCard({ error, sev }: { error: UserError; sev: "err" | "warn" }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--border-subtle)",
      borderLeft: `3px solid ${sev === "err" ? "var(--build-err)" : "var(--build-warn)"}`,
      background: "var(--bg-panel)",
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

// ── Chip de estado para un backend ────────────────────────────────
function BackendChip({
  label, available, version, selected, onClick,
}: {
  id?: Backend; label: string; available: boolean | null;
  version?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={available === false}
      title={available === false ? `${label} no está instalado` : version ?? label}
      style={{
        padding: "5px 12px",
        borderRadius: "var(--r-md)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border-firm)"}`,
        background: selected ? "var(--accent-tint)" : "var(--bg-panel)",
        color: available === false ? "var(--fg-faint)" : selected ? "var(--accent-deep)" : "var(--fg-default)",
        cursor: available === false ? "not-allowed" : "pointer",
        fontSize: "var(--fs-xs)", fontWeight: selected ? 600 : 400,
        display: "flex", gap: 5, alignItems: "center",
        opacity: available === false ? 0.5 : 1,
      }}
    >
      {selected && <IconCheck size={9} sw={2.5} />}
      {label}
      {available === true && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--build-ok)", flexShrink: 0 }} />
      )}
    </button>
  );
}

export default function CompileView() {
  const { id: encodedPath } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, activeProjectPath, latexInfo } = useProjectStore();

  const [state, setState] = useState<CompileState>("idle");
  const [result, setResult] = useState<CompilationResult | null>(null);
  const [draft, setDraft] = useState(false);
  const [backend, setBackend] = useState<Backend>("auto");

  const projectName = activeProject?.metadata.title ?? "Proyecto";

  // Detectar el backend preferido al montar
  useEffect(() => {
    if (latexInfo?.preferred_backend) {
      setBackend(latexInfo.preferred_backend as Backend);
    }
  }, [latexInfo]);

  const latexmkOk  = latexInfo?.latexmk_usable ?? null;
  const tectonicOk = latexInfo?.has_tectonic ?? null;
  const nothingInstalled = latexInfo && !latexInfo.is_usable;

  async function handleCompile() {
    if (!activeProjectPath) return;
    setState("compiling");
    setResult(null);
    try {
      const res = await api.compileProject(activeProjectPath, backend, draft);
      setResult(res);
      setState(res.success ? "success" : "error");
    } catch (e) {
      setResult({
        success: false,
        user_errors: [{ message: String(e), suggestion: "Verifica que el compilador LaTeX esté instalado y en el PATH." }],
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
        center={
          /* Selector de backend */
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginRight: 4 }}>Motor:</span>
            <BackendChip id="auto"     label="Auto"     available={latexInfo ? latexInfo.is_usable : null}    selected={backend === "auto"}     onClick={() => setBackend("auto")} />
            <BackendChip id="latexmk"  label="latexmk"  available={latexmkOk}  version={latexInfo?.latexmk_version}  selected={backend === "latexmk"}  onClick={() => setBackend("latexmk")} />
            <BackendChip id="tectonic" label="Tectonic" available={tectonicOk} version={latexInfo?.tectonic_version} selected={backend === "tectonic"} onClick={() => setBackend("tectonic")} />
          </div>
        }
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
              disabled={state === "compiling" || !!nothingInstalled}
              title={nothingInstalled ? "Instala LaTeX primero" : undefined}
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

        {/* ── Panel izquierdo: estado + errores ──────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1px solid var(--border-subtle)" }}>
          <div style={{
            height: 38, padding: "0 16px", borderBottom: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", gap: 8,
            background: "var(--bg-panel)", fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)",
          }}>
            {state === "success"   && <IconCheckCircle size={14} style={{ color: "var(--build-ok)" }} />}
            {state === "error"     && <IconErr size={14} style={{ color: "var(--build-err)" }} />}
            {state === "idle"      && <IconBuild size={14} />}
            {state === "compiling" && <IconRefresh size={14} />}
            {state === "idle"      && "Listo para compilar"}
            {state === "compiling" && "Compilando…"}
            {state === "success"   && "Compilación exitosa"}
            {state === "error"     && `${result?.user_errors.length ?? 0} error(es)`}
            {result?.backend_used && (
              <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-faint)", fontWeight: 400 }}>
                via {result.backend_used}
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflow: "auto" }} className="scroll">
            {/* LaTeX no instalado */}
            {state === "idle" && nothingInstalled && (
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

            {/* Estado idle normal */}
            {state === "idle" && !nothingInstalled && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--fg-faint)" }}>
                <IconBuild size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ margin: 0 }}>Presiona <strong>Compilar</strong> para generar el PDF.</p>
                <p style={{ fontSize: "var(--fs-xs)", marginTop: 8 }}>
                  Se regenerarán los archivos LaTeX y se ejecutará{" "}
                  {backend === "auto" ? (latexInfo?.preferred_backend ?? "el motor disponible") : backend}.
                </p>
              </div>
            )}

            {state === "compiling" && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--fg-muted)" }}>
                <IconRefresh size={24} style={{ opacity: 0.4, marginBottom: 12 }} />
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
                    {line || " "}
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
