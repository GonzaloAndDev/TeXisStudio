import { useEffect, useState } from "react";
import { IconCheck, IconCheckCircle, IconErr, IconPlay, IconWarn, IconX } from "../../components/Icons";
import { useAiStore } from "../../stores/ai";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { PdfaCheck, PdfPostflightResult, UserError, ValidationReport, ValidationIssue } from "../../types";

export type Backend = "auto" | "latexmk" | "tectonic";
export type PendingAction = "compile" | "export";


export const LOG_COLORS: Record<string, string> = {
  err:     "#E89090",
  warn:    "#E5C97A",
  ok:      "#A8D49C",
  cmd:     "#9DBEDC",
  default: "#9C9685",
};

export function logColor(line: string): string {
  if (line.startsWith("!") || line.toLowerCase().includes("error"))   return LOG_COLORS.err;
  if (line.toLowerCase().includes("warning"))                          return LOG_COLORS.warn;
  if (line.startsWith("Output written") || line.includes("pdf"))      return LOG_COLORS.ok;
  if (line.startsWith(">") || line.startsWith("latexmk") || line.startsWith("Running") || line.startsWith("→") || line.startsWith("tectonic")) return LOG_COLORS.cmd;
  return LOG_COLORS.default;
}

export function ErrorCard({ error, sev }: { error: UserError; sev: "err" | "warn" }) {
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

export function BackendChip({
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

// ── Modal de checklist de entrega ────────────────────────────────


export function AiErrorHelper({
  errors,
  log,
}: {
  errors: Array<{ message: string; suggestion?: string }>;
  log: string;
}) {
  const aiPanel = useAiStore();

  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: "var(--r-md)",
        background: "var(--accent-tint)",
        border: "1px solid var(--accent-soft)",
      }}
    >
      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--accent-deep)", marginBottom: 6 }}>
        ¿Quieres ayuda para entender este fallo?
      </div>
      <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 10 }}>
        TeXisStudio puede abrir el asistente en el editor para explicar el error principal y sugerir qué revisar, sin tocar tu documento.
      </div>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => {
          aiPanel.openPanel();
          aiPanel.setActionMode("explain_latex_error");
          aiPanel.setContextScope(log ? "build_log" : "diagnostics");
        }}
      >
        Explicar este error en el editor
      </button>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 8 }}>
        {errors[0]?.message}
      </div>
    </div>
  );
}

export const SEV_COLOR: Record<string, string> = {
  Error:      "var(--build-err)",
  Warning:    "var(--build-warn)",
  Suggestion: "var(--accent)",
};

export const SEV_LABEL: Record<string, string> = {
  Error:      "Error",
  Warning:    "Advertencia",
  Suggestion: "Sugerencia",
};

export function IssueRow({ issue, onGoTo }: {
  issue: ValidationIssue;
  onGoTo?: () => void;
}) {
  const color = SEV_COLOR[issue.severity] ?? "var(--fg-muted)";
  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: "1px solid var(--border-subtle)",
      borderLeft: `3px solid ${color}`,
      background: "var(--bg-surface)",
    }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color,
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          padding: "1px 6px", borderRadius: "var(--r-sm)",
          flexShrink: 0, marginTop: 1, letterSpacing: "0.04em",
        }}>
          {SEV_LABEL[issue.severity]}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-strong)", lineHeight: 1.5 }}>
            {issue.message}
          </div>
          {issue.suggestion && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 4, lineHeight: 1.4 }}>
              → {issue.suggestion}
            </div>
          )}
        </div>
        {onGoTo && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 11, flexShrink: 0 }}
            onClick={onGoTo}
          >
            Ir a sección
          </button>
        )}
      </div>
    </div>
  );
}

export function DeliveryCheckModal({ report, pendingAction, onProceed, onClose, onGoToSection }: {
  report: ValidationReport;
  pendingAction: PendingAction;
  onProceed: () => void;
  onClose: () => void;
  onGoToSection: (sectionId: string) => void;
}) {
  const errors      = report.issues.filter(i => i.severity === "Error");
  const warnings    = report.issues.filter(i => i.severity === "Warning");
  const suggestions = report.issues.filter(i => i.severity === "Suggestion");
  const hasErrors   = errors.length > 0;
  const actionLabel = pendingAction === "compile" ? "Compilar" : "Exportar entrega";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9000,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: 520, maxHeight: "80vh", display: "flex", flexDirection: "column",
        background: "var(--bg-base)", borderRadius: "var(--r-lg)",
        border: "1px solid var(--border-firm)", boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          {hasErrors
            ? <IconErr size={16} style={{ color: "var(--build-err)", flexShrink: 0 }} />
            : <IconWarn size={16} style={{ color: "var(--build-warn)", flexShrink: 0 }} />
          }
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "var(--fs-md)", color: "var(--fg-strong)" }}>
              Verificación antes de {actionLabel.toLowerCase()}
            </div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
              {hasErrors
                ? `Corrige ${errors.length} error${errors.length > 1 ? "es" : ""} antes de continuar.`
                : `${warnings.length} advertencia${warnings.length !== 1 ? "s" : ""} encontrada${warnings.length !== 1 ? "s" : ""}. Puedes continuar de todos modos.`
              }
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flexShrink: 0 }}>
            <IconX size={12} />
          </button>
        </div>

        {/* Issues list */}
        <div style={{ flex: 1, overflow: "auto" }} className="scroll">
          {errors.length > 0 && (
            <>
              <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--build-err)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Errores ({errors.length})
              </div>
              {errors.map((issue, i) => (
                <IssueRow
                  key={i} issue={issue}
                  onGoTo={issue.section_id ? () => { onGoToSection(issue.section_id!); onClose(); } : undefined}
                />
              ))}
            </>
          )}
          {warnings.length > 0 && (
            <>
              <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--build-warn)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Advertencias ({warnings.length})
              </div>
              {warnings.map((issue, i) => (
                <IssueRow
                  key={i} issue={issue}
                  onGoTo={issue.section_id ? () => { onGoToSection(issue.section_id!); onClose(); } : undefined}
                />
              ))}
            </>
          )}
          {suggestions.length > 0 && (
            <>
              <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Sugerencias ({suggestions.length})
              </div>
              {suggestions.map((issue, i) => (
                <IssueRow key={i} issue={issue} />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: "1px solid var(--border-subtle)",
          display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center",
          background: "var(--bg-panel)",
        }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Cerrar
          </button>
          {!hasErrors && (
            <button
              className="btn btn-sm"
              style={{ background: "var(--build-warn)", color: "#fff", border: "none" }}
              onClick={() => { onClose(); onProceed(); }}
            >
              <IconPlay size={11} /> {actionLabel} de todos modos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Visor de PDF embebido ─────────────────────────────────────────

export function PdfViewer({ pdfPath }: { pdfPath: string }) {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);

  useEffect(() => {
    // convertFileSrc convierte una ruta nativa a una URL asset:// que el webview
    // puede cargar aunque el archivo esté fuera del recurso bundle.
    try {
      setAssetUrl(convertFileSrc(pdfPath));
    } catch {
      setAssetUrl(null);
    }
  }, [pdfPath]);

  if (!assetUrl) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)" }}>
        No se pudo cargar el visor de PDF.
      </div>
    );
  }

  return (
    <iframe
      src={assetUrl}
      title="Vista previa del PDF"
      style={{ flex: 1, border: "none", width: "100%", height: "100%", background: "#404040" }}
    />
  );
}

// ── Panel de verificación PDF ─────────────────────────────────────

export function PdfaBadge({ pdfa }: { pdfa: PdfaCheck }) {
  if (pdfa.flavour === null) {
    return (
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 6, padding: "4px 8px", borderRadius: "var(--r-xs)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)" }}>
        PDF/A: no declarado — el PDF no incluye metadatos XMP de conformidad.
        {pdfa.verapdf_version && <span style={{ marginLeft: 8, opacity: 0.6 }}>veraPDF {pdfa.verapdf_version}</span>}
      </div>
    );
  }
  const ok = pdfa.compliant;
  return (
    <div style={{
      fontSize: "var(--fs-xs)", marginTop: 6, padding: "4px 10px", borderRadius: "var(--r-xs)",
      background: ok ? "var(--build-ok-tint)" : "color-mix(in srgb, var(--build-warn) 12%, transparent)",
      border: `1px solid ${ok ? "var(--build-ok)" : "var(--build-warn)"}`,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ color: ok ? "var(--build-ok)" : "var(--build-warn)", fontWeight: 600 }}>
        {ok ? "✓" : "⚠"} PDF/A — {pdfa.flavour}
      </span>
      <span style={{ color: "var(--fg-muted)" }}>{ok ? "conforme" : "no conforme"}</span>
      {pdfa.verapdf_version && <span style={{ marginLeft: "auto", opacity: 0.5 }}>veraPDF {pdfa.verapdf_version}</span>}
    </div>
  );
}

export function PostflightPanel({ result }: { result: PdfPostflightResult }) {
  const errors   = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");

  return (
    <div style={{
      padding: "14px 16px", borderRadius: "var(--r-md)",
      background: "var(--bg-panel)",
      border: `1px solid ${result.passed ? "var(--build-ok)" : "var(--build-err)"}`,
      marginBottom: 12,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        fontSize: "var(--fs-sm)", fontWeight: 600,
        color: result.passed ? "var(--build-ok)" : "var(--build-err)",
        marginBottom: 8,
      }}>
        {result.passed ? <IconCheckCircle size={14} /> : <IconErr size={14} />}
        Verificación PDF — {result.passed ? "apta para entrega" : "no apta para entrega"}
      </div>

      {!result.pdf_exists && (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-err)" }}>
          El PDF no existe. Compila primero.
        </div>
      )}

      {result.pdf_exists && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginBottom: 4, fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
            {result.metadata.pages !== undefined && <span>Páginas: <strong>{result.metadata.pages}</strong></span>}
            {result.metadata.pdf_version && <span>PDF {result.metadata.pdf_version}</span>}
            {result.metadata.file_size_bytes != null && (
              <span>{(result.metadata.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
            )}
            {result.metadata.page_size && <span>{result.metadata.page_size}</span>}
            <span style={{ color: result.all_fonts_embedded ? "var(--build-ok)" : "var(--build-warn)" }}>
              Fuentes: {result.all_fonts_embedded
                ? "todas incrustadas ✓"
                : `${result.non_embedded_fonts.length} sin incrustar`}
            </span>
          </div>

          {/* PDF/A — solo si veraPDF está disponible */}
          {result.pdfa && <PdfaBadge pdfa={result.pdfa} />}

          {errors.map((issue, i) => (
            <div key={i} style={{
              padding: "8px 10px", marginBottom: 4, borderRadius: "var(--r-sm)",
              background: "color-mix(in srgb, var(--build-err) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--build-err) 25%, transparent)",
              fontSize: "var(--fs-xs)",
            }}>
              <div style={{ color: "var(--build-err)", fontWeight: 600, marginBottom: 2 }}>
                {issue.code}: {issue.message}
              </div>
              {issue.suggestion && (
                <div style={{ color: "var(--fg-muted)" }}>{issue.suggestion}</div>
              )}
            </div>
          ))}

          {warnings.map((issue, i) => (
            <div key={i} style={{
              padding: "8px 10px", marginBottom: 4, borderRadius: "var(--r-sm)",
              background: "color-mix(in srgb, var(--build-warn) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--build-warn) 25%, transparent)",
              fontSize: "var(--fs-xs)",
            }}>
              <div style={{ color: "var(--build-warn)", fontWeight: 600, marginBottom: 2 }}>
                {issue.code}: {issue.message}
              </div>
              {issue.suggestion && (
                <div style={{ color: "var(--fg-muted)" }}>{issue.suggestion}</div>
              )}
            </div>
          ))}

          {result.tools_missing.length > 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 4 }}>
              Sin herramientas: {result.tools_missing.join(", ")} — instala poppler-utils para análisis completo.
            </div>
          )}
        </>
      )}
    </div>
  );
}

