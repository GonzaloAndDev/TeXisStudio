import { useTranslation } from "react-i18next";
import {
  IconCheck,
  IconErr,
  IconWarn,
  IconX,
} from "../Icons";
import type {
  UserError,
  ValidationIssue,
  ValidationReport,
} from "../../types";

export type CompileBackend = "auto" | "latexmk" | "tectonic";

const LOG_COLORS: Record<string, string> = {
  err: "#E89090",
  warn: "#E5C97A",
  ok: "#A8D49C",
  cmd: "#9DBEDC",
  default: "#9C9685",
};

export function logColor(line: string): string {
  if (line.startsWith("!") || line.toLowerCase().includes("error")) return LOG_COLORS.err;
  if (line.toLowerCase().includes("warning")) return LOG_COLORS.warn;
  if (line.startsWith("Output written") || line.includes("pdf")) return LOG_COLORS.ok;
  if (
    line.startsWith(">")
    || line.startsWith("latexmk")
    || line.startsWith("Running")
    || line.startsWith("→")
    || line.startsWith("tectonic")
  ) {
    return LOG_COLORS.cmd;
  }
  return LOG_COLORS.default;
}

export function CompileErrorCard({
  error,
  sev,
}: {
  error: UserError;
  sev: "err" | "warn";
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        borderLeft: `3px solid ${sev === "err" ? "var(--build-err)" : "var(--build-warn)"}`,
        background: "var(--bg-panel)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {sev === "err" ? (
          <IconErr size={13} style={{ color: "var(--build-err)" }} />
        ) : (
          <IconWarn size={13} style={{ color: "var(--build-warn)" }} />
        )}
        <span style={{ fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>
          {error.message}
        </span>
      </div>
      {error.suggestion && (
        <div
          style={{
            background: "var(--accent-tint)",
            color: "var(--accent-deep)",
            padding: "8px 10px",
            borderRadius: "var(--r-sm)",
            fontSize: "var(--fs-sm)",
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            marginTop: 6,
          }}
        >
          <IconCheck size={12} sw={2} />
          {error.suggestion}
        </div>
      )}
      {error.raw_log_line && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--fg-muted)",
            marginTop: 6,
          }}
        >
          {error.raw_log_line}
        </div>
      )}
    </div>
  );
}

export function BackendChip({
  label,
  available,
  version,
  selected,
  onClick,
}: {
  label: string;
  available: boolean | null;
  version?: string;
  selected: boolean;
  onClick: () => void;
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
        color:
          available === false
            ? "var(--fg-faint)"
            : selected
              ? "var(--accent-deep)"
              : "var(--fg-default)",
        cursor: available === false ? "not-allowed" : "pointer",
        fontSize: "var(--fs-xs)",
        fontWeight: selected ? 600 : 400,
        display: "flex",
        gap: 5,
        alignItems: "center",
        opacity: available === false ? 0.5 : 1,
      }}
    >
      {selected && <IconCheck size={9} sw={2.5} />}
      {label}
      {available === true && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--build-ok)",
            flexShrink: 0,
          }}
        />
      )}
    </button>
  );
}

type PendingAction = "compile" | "export";

const SEV_COLOR: Record<string, string> = {
  Error: "var(--build-err)",
  Warning: "var(--build-warn)",
  Suggestion: "var(--accent)",
};

const SEV_LABEL_KEY: Record<string, string> = {
  Error: "compile.severity_error",
  Warning: "compile.severity_warning",
  Suggestion: "compile.severity_suggestion",
};

function IssueRow({
  issue,
  onGoTo,
}: {
  issue: ValidationIssue;
  onGoTo?: () => void;
}) {
  const { t } = useTranslation();
  const color = SEV_COLOR[issue.severity] ?? "var(--fg-muted)";
  return (
    <div
      style={{
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        borderLeft: `3px solid ${color}`,
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            padding: "1px 6px",
            borderRadius: "var(--r-sm)",
            flexShrink: 0,
            marginTop: 1,
            letterSpacing: "0.04em",
          }}
        >
          {t(SEV_LABEL_KEY[issue.severity] ?? "compile.severity_suggestion")}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-strong)", lineHeight: 1.5 }}>
            {issue.message}
          </div>
          {issue.suggestion && (
            <div
              style={{
                fontSize: "var(--fs-xs)",
                color: "var(--fg-muted)",
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
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
            {t("compile.go_to_section")}
          </button>
        )}
      </div>
    </div>
  );
}

export function DeliveryCheckModal({
  report,
  pendingAction,
  onProceed,
  onClose,
  onGoToSection,
}: {
  report: ValidationReport;
  pendingAction: PendingAction;
  onProceed: () => void;
  onClose: () => void;
  onGoToSection: (sectionId: string) => void;
}) {
  const { t } = useTranslation();
  const errors = report.issues.filter((i) => i.severity === "Error");
  const warnings = report.issues.filter((i) => i.severity === "Warning");
  const suggestions = report.issues.filter((i) => i.severity === "Suggestion");
  const hasErrors = errors.length > 0;
  const actionLabel = pendingAction === "compile" ? t("compile.preflight_action_compile") : t("compile.preflight_action_export");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 520,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-base)",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border-firm)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {hasErrors ? (
            <IconErr size={16} style={{ color: "var(--build-err)", flexShrink: 0 }} />
          ) : (
            <IconWarn size={16} style={{ color: "var(--build-warn)", flexShrink: 0 }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "var(--fs-md)", color: "var(--fg-strong)" }}>
              {t("compile.preflight_title", { action: actionLabel })}
            </div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
              {hasErrors
                ? t("compile.preflight_has_errors", { count: errors.length })
                : t("compile.preflight_has_warnings", { count: warnings.length })}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flexShrink: 0 }}>
            <IconX size={12} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto" }} className="scroll">
          {errors.length > 0 && (
            <>
              <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--build-err)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {t("compile.preflight_errors_section", { count: errors.length })}
              </div>
              {errors.map((issue, i) => (
                <IssueRow
                  key={i}
                  issue={issue}
                  onGoTo={issue.section_id ? () => { onGoToSection(issue.section_id!); onClose(); } : undefined}
                />
              ))}
            </>
          )}
          {warnings.length > 0 && (
            <>
              <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--build-warn)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {t("compile.preflight_warnings_section", { count: warnings.length })}
              </div>
              {warnings.map((issue, i) => (
                <IssueRow
                  key={i}
                  issue={issue}
                  onGoTo={issue.section_id ? () => { onGoToSection(issue.section_id!); onClose(); } : undefined}
                />
              ))}
            </>
          )}
          {suggestions.length > 0 && (
            <>
              <div style={{ padding: "8px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {t("compile.preflight_suggestions_section", { count: suggestions.length })}
              </div>
              {suggestions.map((issue, i) => (
                <IssueRow
                  key={i}
                  issue={issue}
                  onGoTo={issue.section_id ? () => { onGoToSection(issue.section_id!); onClose(); } : undefined}
                />
              ))}
            </>
          )}
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <button className="btn btn-ghost" onClick={onClose}>
            {t("compile.preflight_review_first")}
          </button>
          <button className="btn btn-accent" onClick={onProceed} disabled={hasErrors}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
