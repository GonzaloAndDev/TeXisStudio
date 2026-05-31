import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { documentDir } from "@tauri-apps/api/path";
import { AppDialog } from "../components/AppDialog";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBook, IconFile,
  IconFolder, IconPlus, IconSearch, IconSettings, IconUpload,
} from "../components/Icons";
import { LanguagePicker } from "../components/LanguagePicker";
import { api } from "../lib/tauri";
import { useProjectStore } from "../stores/project";
import { useSettingsStore } from "../stores/settings";
import type { RecentProject } from "../types";

function formatUpdatedAt(raw: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const ts = /^\d+$/.test(raw) ? parseInt(raw, 10) * 1000 : Date.parse(raw);
  if (isNaN(ts)) return raw;
  const diff = (Date.now() - ts) / 1000;
  if (diff < 120) return t("home.time_just_now");
  if (diff < 3600) return t("home.time_minutes", { n: Math.floor(diff / 60) });
  if (diff < 86400) return t("home.time_hours", { n: Math.floor(diff / 3600) });
  if (diff < 172800) return t("home.time_yesterday");
  if (diff < 604800) return t("home.time_days", { n: Math.floor(diff / 86400) });
  if (diff < 2592000) return t("home.time_weeks", { n: Math.floor(diff / 604800) });
  return t("home.time_months", { n: Math.floor(diff / 2592000) });
}

const MOCK_PROJECTS: RecentProject[] = [
  { path: "/demo/tesis-ejemplo", title: "Proyecto de ejemplo (modo demo)", profile_id: "generic.thesis", academic_level: "licenciatura", updated_at: String(Math.floor(Date.now() / 1000 - 3600)) },
];

const S = {
  root: { flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)" } as const,
  side: {
    width: 220, flexShrink: 0,
    borderRight: "1px solid var(--border-subtle)",
    padding: "20px 14px", display: "flex", flexDirection: "column", gap: 4,
    background: "var(--bg-chrome)",
  } as const,
  sideItem: (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 10px", borderRadius: "var(--r-md)",
    fontSize: "var(--fs-base)", cursor: "pointer",
    background: active ? "var(--bg-selected)" : "transparent",
    color: active ? "var(--accent-deep)" : "var(--fg-default)",
    fontWeight: active ? 500 : 400,
  }),
  main: { flex: 1, overflow: "auto", padding: "32px 48px 48px" } as const,
  hero: { marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--border-subtle)" } as const,
  greet: {
    fontFamily: "var(--font-display)", fontSize: "var(--fs-3xl)", fontWeight: 400,
    color: "var(--fg-strong)", margin: 0, letterSpacing: "-0.02em",
  } as const,
  greetItalic: { fontStyle: "italic", color: "var(--accent-deep)" } as const,
  sub: { color: "var(--fg-muted)", marginTop: 6, fontSize: "var(--fs-md)" } as const,
  actions: { display: "flex", gap: 8, marginTop: 18 } as const,
  sectionTitle: {
    fontSize: "var(--fs-xs)", fontWeight: 600, letterSpacing: "0.08em",
    textTransform: "uppercase" as const, color: "var(--fg-faint)",
    margin: "24px 0 12px", display: "flex", alignItems: "center", gap: 8,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 } as const,
  journeyGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginTop: 18 } as const,
  card: {
    background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
    borderRadius: "var(--r-lg)", padding: 16, cursor: "pointer",
    transition: "border-color .15s, transform .15s",
    display: "flex", flexDirection: "column" as const, gap: 10, minHeight: 132,
    position: "relative" as const,
  },
  cardSpine: { width: 4, height: 28, borderRadius: 2, background: "var(--detail)", flexShrink: 0 } as const,
  cardTitle: {
    fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", fontWeight: 500,
    color: "var(--fg-strong)", lineHeight: 1.3, letterSpacing: "-0.005em", margin: 0,
  } as const,
  cardMeta: { fontSize: "var(--fs-sm)", color: "var(--fg-muted)", display: "flex", gap: 10, alignItems: "center" } as const,
  cardFooter: {
    marginTop: "auto", paddingTop: 10, borderTop: "1px dashed var(--border-soft)",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    fontSize: "var(--fs-xs)", color: "var(--fg-muted)", fontFamily: "var(--font-mono)",
  } as const,
};

import React from "react";

// Todos los prefijos de país usados en el catálogo de perfiles.
const PROFILE_COUNTRY_PREFIX_RE = /^(mx|us|uk|ca|es|de|fr|jp|br|ar|co|cl|cn|in|kr|sg|nl|se|it)_/;

function humanizeProfileId(id: string): string {
  // Perfiles genéricos no tienen institución que mostrar
  if (!id || id.startsWith("generic.")) return "";
  // mx_unam_apa7 → "UNAM · APA 7"  |  br_usp_abnt → "USP · ABNT"
  const parts = id.replace(PROFILE_COUNTRY_PREFIX_RE, "").split("_");
  const styled = parts
    .map((p) => p.toUpperCase()
      .replace("APA7", "APA 7").replace("APA6", "APA 6")
      .replace("CHICAGO", "Chicago").replace("VANCOUVER", "Vancouver")
      .replace("HARVARD", "Harvard").replace("ABNT", "ABNT"))
    .join(" · ");
  return styled;
}

function NextStepBanner({ project, onClick }: { project: RecentProject; onClick: () => void }) {
  const ts = /^\d+$/.test(project.updated_at)
    ? parseInt(project.updated_at, 10) * 1000
    : Date.parse(project.updated_at);
  const diffH = isNaN(ts) ? 999 : (Date.now() - ts) / 3600000;
  const isRecent = diffH < 24;
  const label = isRecent ? "Continúa donde lo dejaste" : "Retoma tu proyecto";
  const hint = isRecent
    ? "Tu última sesión fue hace menos de un día."
    : "Listo para que retomes el hilo.";

  return (
    <div
      style={{
        margin: "0 0 20px", padding: "14px 18px",
        borderRadius: "var(--r-lg)",
        background: "var(--bg-panel)",
        border: "1px solid var(--accent-soft)",
        display: "flex", gap: 16, alignItems: "center",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "var(--fg-strong)", fontSize: "var(--fs-sm)", marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--accent-deep)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.title}
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>{hint}</div>
      </div>
      <button className="btn btn-sm btn-accent" style={{ flexShrink: 0 }}>
        Abrir
      </button>
    </div>
  );
}

function LatexSetupBanner({ info }: { info: import("../types").LatexInfo }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const available = info.available_backends ?? [];

  return (
    <div style={{
      margin: "0 0 20px", padding: "14px 18px",
      borderRadius: "var(--r-lg)",
      background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
      display: "flex", gap: 14, alignItems: "center",
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>⚠</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 600, color: "var(--accent-deep)", fontSize: "var(--fs-sm)" }}>
          {available.length === 0
            ? t("home.latex_missing")
            : t("home.latex_partial", { backends: available.join(", ") })}
        </span>
        <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginLeft: 8 }}>
          {t("home.latex_install_hint")}
        </span>
      </div>
      <button
        className="btn btn-sm btn-accent"
        onClick={() => navigate("/setup-latex")}
        style={{ flexShrink: 0 }}
      >
        {t("home.latex_guide")}
      </button>
    </div>
  );
}

export default function HomeView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setRecentProjects, latexInfo, setLatexInfo } = useProjectStore();
  const { userMode } = useSettingsStore();
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [latexLoading, setLatexLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTexPath, setImportTexPath] = useState("");
  const [importOutputPath, setImportOutputPath] = useState("");
  const [importProjectName, setImportProjectName] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  useEffect(() => {
    api.detectLatex()
      .then(setLatexInfo)
      .catch(() => {})
      .finally(() => setLatexLoading(false));

    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      documentDir().then((dir) =>
        api.listRecentProjects(dir).then((p) => {
          setProjects(p);
          setRecentProjects(p);
        }).catch(() => setProjects([]))
          .finally(() => setProjectsLoading(false))
      ).catch(() => {
        setProjects([]);
        setProjectsLoading(false);
      });
    } else {
      setProjects(MOCK_PROJECTS);
      setRecentProjects(MOCK_PROJECTS);
      setProjectsLoading(false);
    }
  }, [setLatexInfo, setRecentProjects]);

  async function handleOpen(projectPath: string, destination: "editor" | "compile" = "editor") {
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (!isTauriEnv) { navigate("/demo"); return; }
    try {
      const model = await api.getProject(projectPath);
      useProjectStore.getState().openProject(model, projectPath);
      const encodedPath = encodeURIComponent(projectPath);
      navigate(destination === "compile" ? `/project/${encodedPath}/compile` : `/project/${encodedPath}`);
    } catch (e) {
      console.error("Error abriendo proyecto:", e);
      setHomeError("No pude abrir esa carpeta como proyecto TeXisStudio. Verifica que contenga tesis.project.yaml.");
    }
  }

  async function handleOpenFolder() {
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (!isTauriEnv) { navigate("/demo"); return; }
    const projectPath = await api.pickFolder();
    if (!projectPath) return;
    await handleOpen(projectPath);
  }

  async function pickImportTexFile() {
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (!isTauriEnv) { navigate("/demo"); return; }
    const texPath = await api.pickFile([{ name: "LaTeX", extensions: ["tex"] }]);
    if (!texPath) return;
    setImportTexPath(texPath);
    const fileName = texPath.split(/[\\/]/).pop() ?? "tesis-importada.tex";
    const defaultName = fileName.replace(/\.tex$/i, "") || "tesis-importada";
    if (!importProjectName.trim()) setImportProjectName(defaultName);
  }

  async function pickImportOutputFolder() {
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (!isTauriEnv) { navigate("/demo"); return; }
    const outputPath = await api.pickFolder();
    if (outputPath) setImportOutputPath(outputPath);
  }

  async function handleImportTex() {
    if (!importTexPath || !importOutputPath || !importProjectName.trim()) return;
    setImportBusy(true);
    setHomeError(null);
    try {
      const imported = await api.importTexProject(
        importTexPath,
        importOutputPath,
        importProjectName.trim(),
        "generic.thesis",
      );
      const model = await api.getProject(imported.project_path);
      useProjectStore.getState().openProject(model, imported.project_path);
      setImportDialogOpen(false);
      navigate(`/project/${encodeURIComponent(imported.project_path)}`);
    } catch (e) {
      console.error("Error importando .tex:", e);
      const message = e instanceof Error ? e.message : String(e);
      setHomeError(`No pude importar el archivo .tex: ${message}`);
    } finally {
      setImportBusy(false);
    }
  }

  function levelLabel(level: string): string {
    const key = `home.level_${level.toLowerCase()}` as const;
    return t(key as Parameters<typeof t>[0]) ?? level;
  }

  const latexStatus = (() => {
    if (!latexInfo?.is_usable) return { text: t("home.latex_not_detected"), dot: "var(--build-err)" };
    const backends = latexInfo.available_backends ?? [];
    const hasTectonic = latexInfo.has_tectonic;
    const hasTexLive  = latexInfo.latexmk_usable;
    if (hasTectonic && hasTexLive) {
      return { text: `Tectonic + TeX Live ${latexInfo.texlive_year ?? ""}`.trim(), dot: "var(--build-ok)" };
    }
    if (hasTectonic) {
      return { text: `Tectonic ${latexInfo.tectonic_version ?? ""}`.trim(), dot: "var(--build-ok)" };
    }
    if (hasTexLive) {
      return { text: `TeX Live ${latexInfo.texlive_year ?? ""} · biber`.trim(), dot: "var(--build-ok)" };
    }
    return { text: backends.join(" · ") || "LaTeX listo", dot: "var(--build-ok)" };
  })();

  const latestProject = projectsLoading ? undefined : projects[0];

  const workMoments = [
    {
      label: "Empezar",
      hint: "Crea una tesis nueva o importa una existente.",
      icon: <IconPlus size={13} />,
      onClick: () => navigate("/new"),
    },
    {
      label: "Configurar",
      hint: "Elige perfil, universidad, grado e idioma.",
      icon: <IconFolder size={13} />,
      onClick: () => navigate("/library"),
    },
    {
      label: "Escribir",
      hint: latestProject ? "Vuelve a tu proyecto más reciente." : "Abre un proyecto para empezar a redactar.",
      icon: <IconBook size={13} />,
      onClick: () => latestProject ? handleOpen(latestProject.path) : navigate("/new"),
    },
    {
      label: "Revisar",
      hint: "Ajusta idioma, ortografía y apoyos de escritura.",
      icon: <IconSearch size={13} />,
      onClick: () => navigate("/settings/text"),
    },
    {
      label: "Entregar",
      hint: latestProject ? "Compila, verifica el PDF y exporta tu entrega." : "Compila tu proyecto cuando ya tengas contenido.",
      icon: <IconUpload size={13} />,
      onClick: () => latestProject ? handleOpen(latestProject.path, "compile") : navigate("/new"),
    },
  ];

  return (
    <>
      {homeError && (
        <AppDialog
          title="No se pudo completar la accion"
          subtitle="TeXisStudio no modifico tu proyecto. Revisa el detalle y vuelve a intentarlo."
          onClose={() => setHomeError(null)}
          footer={<button className="btn btn-accent btn-sm" onClick={() => setHomeError(null)}>Entendido</button>}
        >
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.6 }}>
            {homeError}
          </div>
        </AppDialog>
      )}
      {importDialogOpen && (
        <AppDialog
          title="Importar archivo TeX"
          subtitle="Crea un proyecto TeXisStudio conservando el contenido LaTeX original para que puedas migrarlo gradualmente al editor visual."
          width={560}
          onClose={() => !importBusy && setImportDialogOpen(false)}
          footer={
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setImportDialogOpen(false)} disabled={importBusy}>
                Cancelar
              </button>
              <button
                className="btn btn-accent btn-sm"
                onClick={handleImportTex}
                disabled={importBusy || !importTexPath || !importOutputPath || !importProjectName.trim()}
              >
                {importBusy ? "Importando..." : "Crear proyecto importado"}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 5 }}>
                Archivo .tex
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={importTexPath}
                  readOnly
                  placeholder="Selecciona el archivo principal .tex"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", color: "var(--fg-strong)", fontSize: "var(--fs-sm)" }}
                />
                <button className="btn btn-sm" onClick={pickImportTexFile} disabled={importBusy}>
                  Elegir
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 5 }}>
                Carpeta destino
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={importOutputPath}
                  readOnly
                  placeholder="Selecciona donde crear la carpeta del proyecto"
                  style={{ flex: 1, padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", color: "var(--fg-strong)", fontSize: "var(--fs-sm)" }}
                />
                <button className="btn btn-sm" onClick={pickImportOutputFolder} disabled={importBusy}>
                  Elegir
                </button>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 5 }}>
                Nombre del proyecto
              </label>
              <input
                value={importProjectName}
                onChange={(e) => setImportProjectName(e.target.value)}
                placeholder="tesis-importada"
                disabled={importBusy}
                style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", color: "var(--fg-strong)", fontSize: "var(--fs-sm)" }}
              />
              <div style={{ marginTop: 6, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                El original se guardara en <span style={{ fontFamily: "var(--font-mono)" }}>imports/source.tex</span> y el contenido entrara como LaTeX confirmado para no perder fidelidad.
              </div>
            </div>
          </div>
        </AppDialog>
      )}
      <TxAppbar
        left={<><TxLogo /><span className="chip" style={{ marginLeft: 6 }}>v1.0.0</span></>}
        center={null}
        right={
          <>
            <LanguagePicker />
            <button className="btn btn-ghost btn-sm">
              <IconSearch size={13} /> {t("common.search")} <span className="kbd">⌘K</span>
            </button>
            <button className="btn btn-ghost btn-icon" onClick={() => navigate("/settings")} title={t("common.settings")}><IconSettings size={14} /></button>
          </>
        }
      />

      <div style={S.root}>
        <aside style={S.side}>
          <div style={{ ...S.sectionTitle, margin: "4px 4px 8px" }}>Ruta sugerida</div>
          {workMoments.map(({ label, icon, onClick }) => (
            <div key={label} style={S.sideItem(false)} onClick={onClick}>
              {icon} {label}
            </div>
          ))}

          <div style={{ height: 1, background: "var(--border-subtle)", margin: "12px 4px" }} />
          <div style={{ ...S.sectionTitle, margin: "4px 4px 8px" }}>{t("home.nav_library")}</div>
          <div style={S.sideItem(false)} onClick={() => navigate("/library")}>
            <IconFolder size={13} /> {t("home.nav_profiles")}
          </div>
          <div style={S.sideItem(false)}>
            <IconFile size={13} /> {t("home.nav_elements")}
          </div>

          <div style={{
            marginTop: "auto", padding: 8, borderTop: "1px solid var(--border-subtle)",
            fontSize: "var(--fs-xs)", color: "var(--fg-faint)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: latexStatus.dot }} />
            {latexStatus.text}
          </div>
        </aside>

        <main style={S.main} className="scroll">
          <div style={S.hero}>
            <h1 style={S.greet}>
              {t("home.greeting").split(t("home.greeting_italic")).map((part, i, arr) =>
                i < arr.length - 1
                  ? [part, <span key={i} style={S.greetItalic}>{t("home.greeting_italic")}</span>]
                  : part
              )}
            </h1>
            <p style={S.sub}>
              {userMode === "basic"
                ? "TeXisStudio está en modo guiado: tú enfócate en tu trabajo y la app te acompaña con formato, bibliografía y entrega."
                : t(projects.length === 1 ? "home.projects_count_one" : "home.projects_count_other", { count: projects.length })}
            </p>
            <div style={S.actions}>
              <button className="btn btn-accent" onClick={() => navigate("/new")}>
                <IconPlus size={13} /> {t("home.new_project")}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setHomeError(null);
                  setImportDialogOpen(true);
                }}
              >
                <IconUpload size={13} /> {t("home.import_tex")}
              </button>
              <button className="btn btn-ghost" onClick={handleOpenFolder}>{t("home.open_folder")}</button>
            </div>
            <div style={S.journeyGrid}>
              {workMoments.map(({ label, hint, icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  style={{
                    textAlign: "left",
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border-soft)",
                    borderRadius: "var(--r-lg)",
                    padding: "14px 16px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fg-strong)", fontWeight: 600 }}>
                    {icon}
                    {label}
                  </div>
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    {hint}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {latexInfo && !latexInfo.is_usable && <LatexSetupBanner info={latexInfo} />}
          {latestProject && latexInfo?.is_usable && (
            <NextStepBanner project={latestProject} onClick={() => handleOpen(latestProject.path)} />
          )}

          <div style={S.sectionTitle}>
            <span>{t("home.recent_projects")}</span>
            <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
            <span style={{ color: "var(--fg-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              {t("home.sort_by")} <span style={{ color: "var(--fg-default)" }}>{t("home.sort_updated")}</span>
            </span>
          </div>

          <div style={S.grid}>
            {projects.map((p, i) => (
              <div
                key={i}
                style={S.card}
                onClick={() => handleOpen(p.path)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--accent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-soft)"; }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={S.cardSpine} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={S.cardTitle}>{p.title}</h3>
                  </div>
                </div>
                <div style={S.cardMeta}>
                  <span className="chip">{levelLabel(p.academic_level)}</span>
                  {humanizeProfileId(p.profile_id) && (
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
                      {humanizeProfileId(p.profile_id)}
                    </span>
                  )}
                </div>
                <div style={S.cardFooter}>
                  <span>{p.path.split(/[/\\]/).pop()}</span>
                  <span>{formatUpdatedAt(p.updated_at, t)}</span>
                </div>
              </div>
            ))}

            {projects.length === 0 && (
              <div
                style={{
                  background: "var(--bg-panel)", border: "1px dashed var(--border-firm)",
                  borderRadius: "var(--r-lg)", padding: 16, cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 8, minHeight: 132,
                }}
                onClick={() => navigate("/new")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fg-muted)" }}>
                  <IconPlus size={14} />
                  <span style={{ fontWeight: 500 }}>{t("home.create_first")}</span>
                </div>
                <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  {t("home.create_first_desc")}
                </p>
                <div style={{ marginTop: "auto", display: "flex", gap: 6 }}>
                  <span className="chip">Tesis</span>
                  <span className="chip">Tesina</span>
                  <span className="chip">+ más</span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <TxStatusbar items={[
        latexStatus,
        { icon: <IconFolder size={11} />, text: "~/Documentos" },
        { right: true, text: "TeXisStudio 1.0.0 · AGPL+CC", icon: <span style={{ cursor: "pointer" }} onClick={() => navigate("/about")} /> },
      ]} />
    </>
  );
}
