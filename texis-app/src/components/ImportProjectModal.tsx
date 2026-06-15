import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppDialog } from "./AppDialog";
import { api } from "../lib/tauri";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type SourcePlatform =
  | "overleaf"
  | "texstudio"
  | "miktex"
  | "texlive"
  | "vscode"
  | "other";

interface PlatformMeta {
  id: SourcePlatform;
  icon: string;
  i18nName: string;
  i18nDesc: string;
}

const PLATFORMS: PlatformMeta[] = [
  { id: "overleaf",   icon: "🌿", i18nName: "import_project.platform_overleaf",   i18nDesc: "import_project.platform_overleaf_desc"   },
  { id: "texstudio",  icon: "📝", i18nName: "import_project.platform_texstudio",  i18nDesc: "import_project.platform_texstudio_desc"  },
  { id: "miktex",     icon: "🪟", i18nName: "import_project.platform_miktex",     i18nDesc: "import_project.platform_miktex_desc"     },
  { id: "texlive",    icon: "🐧", i18nName: "import_project.platform_texlive",    i18nDesc: "import_project.platform_texlive_desc"    },
  { id: "vscode",     icon: "💻", i18nName: "import_project.platform_vscode",     i18nDesc: "import_project.platform_vscode_desc"     },
  { id: "other",      icon: "📁", i18nName: "import_project.platform_other",      i18nDesc: "import_project.platform_other_desc"      },
];

interface ImportResult {
  projectFile: string;
  warnings: string[];
  figuresCopied: number;
  bibsCopied: number;
}

interface Props {
  onClose: () => void;
  /** Callback invocado con la ruta al project YAML recién creado */
  onProjectImported?: (projectFile: string) => void;
}

// ── Estilos reutilizables ─────────────────────────────────────────────────────

const fieldLabel: React.CSSProperties = {
  fontSize: "var(--fs-xs)",
  fontWeight: 600,
  color: "var(--fg-muted)",
  marginBottom: 4,
};

const pathDisplay = (hasValue: boolean): React.CSSProperties => ({
  flex: 1,
  fontSize: "var(--fs-xs)",
  color: hasValue ? "var(--fg-base)" : "var(--fg-faint)",
  background: "var(--bg-subtle)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--r-sm)",
  padding: "6px 10px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

const errorBox: React.CSSProperties = {
  fontSize: "var(--fs-xs)",
  color: "var(--build-err)",
  padding: "8px 10px",
  background: "var(--build-err-bg, rgba(220,50,50,0.08))",
  border: "1px solid var(--build-err)",
  borderRadius: "var(--r-sm)",
};

// ── Componente ────────────────────────────────────────────────────────────────

export function ImportProjectModal({ onClose, onProjectImported }: Props) {
  const { t } = useTranslation();

  const [platform, setPlatform] = useState<SourcePlatform>("overleaf");
  const [sourceDir, setSourceDir] = useState("");
  const [workDir, setWorkDir] = useState("");
  const [mainFileHint, setMainFileHint] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handlePickSource() {
    const folder = await api.pickFolder();
    if (folder) setSourceDir(folder);
  }

  async function handlePickDest() {
    const folder = await api.pickFolder();
    if (folder) setWorkDir(folder);
  }

  async function handleImport() {
    if (!sourceDir) { setError(t("import_project.error_no_source")); return; }
    if (!workDir) { setError(t("import_project.error_no_dest")); return; }
    if (sourceDir === workDir) { setError(t("import_project.error_same_folder")); return; }
    setError(null);
    setBusy(true);
    try {
      const res = await api.importFromSource({
        sourceDir,
        workDir,
        sourcePlatform: platform,
        mainFileHint: mainFileHint.trim() || undefined,
        overwrite,
      });
      setResult(res);
      onProjectImported?.(res.projectFile);
    } catch (e) {
      setError(t("import_project.error_generic", { error: String(e) }));
    } finally {
      setBusy(false);
    }
  }

  function handleOpenProject() {
    if (result) api.openInSystem(result.projectFile);
  }

  function handleImportAgain() {
    setResult(null);
    setError(null);
  }

  // ── Estado de éxito ──────────────────────────────────────────────────────
  if (result) {
    return (
      <AppDialog
        title={t("import_project.success_title")}
        width={500}
        onClose={onClose}
        footer={
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button className="btn-secondary" onClick={handleImportAgain}>
              {t("import_project.import_again")}
            </button>
            <button className="btn-primary" onClick={handleOpenProject}>
              {t("import_project.success_open_btn")}
            </button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0" }}>
          {/* Ruta del proyecto */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
              {t("import_project.success_project_file")}
            </span>
            <code style={{
              fontSize: "var(--fs-xs)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-sm)",
              padding: "6px 10px",
              wordBreak: "break-all",
            }}>
              {result.projectFile}
            </code>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{
              fontSize: "var(--fs-xs)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-sm)",
              padding: "4px 10px",
            }}>
              {t("import_project.success_figures", { count: result.figuresCopied })}
            </span>
            <span style={{
              fontSize: "var(--fs-xs)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-sm)",
              padding: "4px 10px",
            }}>
              {t("import_project.success_bibs", { count: result.bibsCopied })}
            </span>
          </div>

          {/* Avisos */}
          {result.warnings.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-muted)" }}>
                {t("import_project.success_warnings_title")}
              </span>
              <div style={{
                maxHeight: 160,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}>
                {result.warnings.map((w, i) => (
                  <div key={i} style={{
                    fontSize: "var(--fs-xs)",
                    color: "var(--fg-muted)",
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--r-sm)",
                    padding: "4px 8px",
                  }}>
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppDialog>
    );
  }

  // ── Formulario principal ─────────────────────────────────────────────────
  return (
    <AppDialog
      title={t("import_project.title")}
      subtitle={t("import_project.subtitle")}
      width={560}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            {t("import_project.cancel")}
          </button>
          <button
            className="btn-primary"
            onClick={handleImport}
            disabled={busy || !sourceDir || !workDir}
          >
            {busy ? t("import_project.importing") : t("import_project.import_btn")}
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "4px 0" }}>

        {/* Plataforma de origen */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={fieldLabel}>{t("import_project.label_platform")}</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {PLATFORMS.map((pm) => (
              <button
                key={pm.id}
                onClick={() => setPlatform(pm.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 3,
                  padding: "8px 10px",
                  background: platform === pm.id
                    ? "var(--accent-subtle, rgba(99,102,241,0.12))"
                    : "var(--bg-subtle)",
                  border: `1.5px solid ${platform === pm.id ? "var(--accent)" : "var(--border-subtle)"}`,
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.1s, background 0.1s",
                }}
              >
                <span style={{ fontSize: "var(--fs-xs)", fontWeight: 600 }}>
                  {pm.icon} {t(pm.i18nName)}
                </span>
                <span style={{ fontSize: "10px", color: "var(--fg-faint)", lineHeight: 1.3 }}>
                  {t(pm.i18nDesc)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Carpeta de origen */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={fieldLabel}>{t("import_project.label_source_folder")}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={pathDisplay(!!sourceDir)}>
              {sourceDir || t("import_project.no_folder_selected")}
            </div>
            <button className="btn-secondary" onClick={handlePickSource} disabled={busy}>
              {t("import_project.choose_folder_btn")}
            </button>
          </div>
        </div>

        {/* Carpeta de destino */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={fieldLabel}>{t("import_project.label_work_folder")}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={pathDisplay(!!workDir)}>
              {workDir || t("import_project.no_folder_selected")}
            </div>
            <button className="btn-secondary" onClick={handlePickDest} disabled={busy}>
              {t("import_project.choose_folder_btn")}
            </button>
          </div>
        </div>

        {/* Archivo raíz (opcional) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={fieldLabel}>{t("import_project.label_main_file")}</span>
          <input
            type="text"
            value={mainFileHint}
            onChange={(e) => setMainFileHint(e.target.value)}
            placeholder={t("import_project.label_main_file_hint")}
            disabled={busy}
            style={{
              fontSize: "var(--fs-xs)",
              padding: "6px 10px",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--r-sm)",
              color: "var(--fg-base)",
              outline: "none",
            }}
          />
        </div>

        {/* Sobreescribir */}
        <label style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          fontSize: "var(--fs-xs)",
          color: "var(--fg-muted)",
        }}>
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            disabled={busy}
          />
          {t("import_project.label_overwrite")}
        </label>

        {/* Error */}
        {error && <div style={errorBox}>{error}</div>}
      </div>
    </AppDialog>
  );
}
