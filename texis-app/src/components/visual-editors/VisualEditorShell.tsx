import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HelpLink } from "../help/HelpLink";
import type { HelpSection } from "../../stores/help";
import type { TechnicalField } from "@texisstudio/plugins";

interface Props {
  children: React.ReactNode;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRestore?: () => void;
  helpTopic?: HelpSection;
  technicalFields?: TechnicalField[];
  technicalValues?: Record<string, string>;
  onTechnicalFieldChange?: (key: string, value: string) => void;
}

export function VisualEditorShell({
  children,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRestore,
  helpTopic = "figures",
  technicalFields = [],
  technicalValues = {},
  onTechnicalFieldChange,
}: Props) {
  const { t } = useTranslation();
  const [advOpen, setAdvOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <button
          className="btn btn-ghost btn-icon"
          onClick={onUndo}
          disabled={!canUndo}
          title={t("visual_editor.undo")}
          style={{ fontSize: 13, padding: "2px 6px" }}
        >
          ↩
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onRedo}
          disabled={!canRedo}
          title={t("visual_editor.redo")}
          style={{ fontSize: 13, padding: "2px 6px" }}
        >
          ↪
        </button>
        {onRestore && (
          <>
            <div style={{ width: 1, height: 14, background: "var(--border-subtle)", margin: "0 2px" }} />
            <button
              className="btn btn-ghost btn-sm"
              onClick={onRestore}
              title={t("visual_editor.restore_title")}
              style={{ fontSize: "var(--fs-xs)", padding: "2px 8px" }}
            >
              {t("visual_editor.restore_btn")}
            </button>
          </>
        )}
        <div style={{ flex: 1 }} />
        <HelpLink topic={helpTopic} />
      </div>

      {/* Editor content */}
      {children}

      {/* Technical fields panel */}
      {technicalFields.length > 0 && onTechnicalFieldChange && (
        <div style={{ marginTop: 12, border: "1px solid var(--border-subtle)", borderRadius: "var(--r-sm)", overflow: "hidden" }}>
          <button
            onClick={() => setAdvOpen((v) => !v)}
            style={{
              width: "100%", padding: "6px 12px",
              background: advOpen ? "var(--bg-hover)" : "var(--bg-app)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              fontSize: "var(--fs-xs)", color: "var(--fg-muted)", textAlign: "left",
              fontWeight: advOpen ? 600 : 400,
            }}
          >
            <span style={{ transform: advOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", display: "inline-block", fontSize: 9 }}>▶</span>
            {t("visual_editor.advanced_section")}
          </button>
          {advOpen && (
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
              {technicalFields.map((field) => (
                <div key={field.key}>
                  <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", display: "block", marginBottom: 3 }}>
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{field.label}</code>
                    {field.description && (
                      <span style={{ marginLeft: 6, color: "var(--fg-faint)", fontFamily: "var(--font-sans, inherit)" }}>
                        — {field.description}
                      </span>
                    )}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={technicalValues[field.key] ?? ""}
                      onChange={(e) => onTechnicalFieldChange(field.key, e.target.value)}
                      rows={3}
                      style={{
                        width: "100%", padding: "5px 8px",
                        fontFamily: "var(--font-mono)", fontSize: 11,
                        borderRadius: "var(--r-xs)", border: "1px solid var(--border-firm)",
                        background: "var(--bg-app)", color: "var(--fg-default)",
                        resize: "vertical", boxSizing: "border-box",
                      }}
                    />
                  ) : field.type === "boolean" ? (
                    <input
                      type="checkbox"
                      checked={technicalValues[field.key] === "true"}
                      onChange={(e) => onTechnicalFieldChange(field.key, String(e.target.checked))}
                    />
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      value={technicalValues[field.key] ?? ""}
                      onChange={(e) => onTechnicalFieldChange(field.key, e.target.value)}
                      style={{
                        width: "100%", padding: "5px 8px",
                        fontFamily: "var(--font-mono)", fontSize: 11,
                        borderRadius: "var(--r-xs)", border: "1px solid var(--border-firm)",
                        background: "var(--bg-app)", color: "var(--fg-default)",
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
