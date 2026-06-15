import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppDialog } from "./AppDialog";
import { api } from "../lib/tauri";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ExportTarget = "overleaf" | "texstudio" | "vscode" | "local";

interface TargetMeta {
  id: ExportTarget;
  icon: string;
  i18nName: string;
  i18nDesc: string;
}

const TARGETS: TargetMeta[] = [
  { id: "overleaf",   icon: "📄", i18nName: "export_platform.target_overleaf",   i18nDesc: "export_platform.target_overleaf_desc"   },
  { id: "texstudio",  icon: "📝", i18nName: "export_platform.target_texstudio",  i18nDesc: "export_platform.target_texstudio_desc"  },
  { id: "vscode",     icon: "💻", i18nName: "export_platform.target_vscode",     i18nDesc: "export_platform.target_vscode_desc"     },
  { id: "local",      icon: "📁", i18nName: "export_platform.target_local",      i18nDesc: "export_platform.target_local_desc"      },
];

interface ExportResult {
  artifact_path: string;
  info_url: string | null;
  note_key: string;
}

interface Props {
  projectPath: string;
  onClose: () => void;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ExportPlatformModal({ projectPath, onClose }: Props) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<ExportTarget>("overleaf");
  const [outputDir, setOutputDir] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  async function handlePickFolder() {
    const folder = await api.pickFolder();
    if (folder) setOutputDir(folder);
  }

  async function handleExport() {
    if (!outputDir) {
      setError(t("export_platform.error_no_folder"));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await api.exportForTarget(projectPath, outputDir, target);
      setResult(res);
    } catch (e) {
      setError(t("export_platform.error_generic", { error: String(e) }));
    } finally {
      setBusy(false);
    }
  }

  function handleOpenFolder() {
    if (result) api.openInSystem(result.artifact_path);
  }

  function handleOpenLink() {
    if (result?.info_url) api.openInSystem(result.info_url);
  }

  function handleExportAgain() {
    setResult(null);
    setError(null);
  }

  // ── Success state ────────────────────────────────────────────────────────
  if (result) {
    return (
      <AppDialog
        title={t("export_platform.success_title")}
        width={480}
        onClose={onClose}
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button className="btn-secondary" onClick={handleExportAgain}>
              {t("export_platform.export_again")}
            </button>
            {result.info_url && (
              <button className="btn-secondary" onClick={handleOpenLink}>
                {t("export_platform.open_link")}
              </button>
            )}
            <button className="btn-primary" onClick={handleOpenFolder}>
              {t("export_platform.open_folder")}
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
              {t("export_platform.success_path")}
            </span>
            <code style={{
              fontSize: "var(--fs-xs)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-sm)",
              padding: "6px 10px",
              wordBreak: "break-all",
            }}>
              {result.artifact_path}
            </code>
          </div>

          <div style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--r-sm)",
            padding: "10px 12px",
            fontSize: "var(--fs-xs)",
            color: "var(--fg-base)",
          }}>
            {t(result.note_key)}
          </div>
        </div>
      </AppDialog>
    );
  }

  // ── Main export form ─────────────────────────────────────────────────────
  return (
    <AppDialog
      title={t("export_platform.title")}
      subtitle={t("export_platform.subtitle")}
      width={520}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            {t("export_platform.cancel")}
          </button>
          <button
            className="btn-primary"
            onClick={handleExport}
            disabled={busy || !outputDir}
          >
            {busy ? t("export_platform.exporting") : t("export_platform.export_btn")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "4px 0" }}>

        {/* Target selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-muted)" }}>
            {t("export_platform.choose_target")}
          </span>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}>
            {TARGETS.map((tm) => (
              <button
                key={tm.id}
                onClick={() => setTarget(tm.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                  padding: "10px 12px",
                  background: target === tm.id ? "var(--accent-subtle, rgba(99,102,241,0.12))" : "var(--bg-subtle)",
                  border: `1.5px solid ${target === tm.id ? "var(--accent)" : "var(--border-subtle)"}`,
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.1s, background 0.1s",
                }}
              >
                <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>
                  {tm.icon} {t(tm.i18nName)}
                </span>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                  {t(tm.i18nDesc)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Destination folder */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-muted)" }}>
            {t("export_platform.choose_folder")}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              flex: 1,
              fontSize: "var(--fs-xs)",
              color: outputDir ? "var(--fg-base)" : "var(--fg-faint)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-sm)",
              padding: "6px 10px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {outputDir || t("export_platform.no_folder_selected")}
            </div>
            <button className="btn-secondary" onClick={handlePickFolder} disabled={busy}>
              {t("export_platform.choose_folder_btn")}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            fontSize: "var(--fs-xs)",
            color: "var(--build-err)",
            padding: "8px 10px",
            background: "var(--build-err-bg, rgba(220,50,50,0.08))",
            border: "1px solid var(--build-err)",
            borderRadius: "var(--r-sm)",
          }}>
            {error}
          </div>
        )}
      </div>
    </AppDialog>
  );
}
