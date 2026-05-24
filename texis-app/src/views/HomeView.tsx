import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { documentDir } from "@tauri-apps/api/path";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBook, IconFile,
  IconFolder, IconPlus, IconSearch, IconSettings, IconStar, IconClock, IconTrash, IconUpload,
} from "../components/Icons";
import { api } from "../lib/tauri";
import { useProjectStore } from "../stores/project";
import type { RecentProject } from "../types";

function formatUpdatedAt(raw: string): string {
  const ts = /^\d+$/.test(raw) ? parseInt(raw, 10) * 1000 : Date.parse(raw);
  if (isNaN(ts)) return raw;
  const diff = (Date.now() - ts) / 1000;
  if (diff < 120) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "ayer";
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
  if (diff < 2592000) return `hace ${Math.floor(diff / 604800)} sem`;
  return `hace ${Math.floor(diff / 2592000)} meses`;
}

// Mock data visible en dev-browser (sin Tauri)
const MOCK_PROJECTS: RecentProject[] = [
  { path: "/proyectos/redes-neuronales", title: "Análisis de redes neuronales en clasificación de imágenes médicas", profile_id: "generic.thesis", academic_level: "maestria", updated_at: "hace 2 h" },
  { path: "/proyectos/rezago-educativo", title: "Determinantes socioeconómicos del rezago educativo en Oaxaca", profile_id: "generic.thesis", academic_level: "licenciatura", updated_at: "hace 1 día" },
  { path: "/proyectos/catalizadores", title: "Optimización de catalizadores Fischer-Tropsch con Pt/Al₂O₃", profile_id: "generic.thesis", academic_level: "doctorado", updated_at: "hace 4 días" },
  { path: "/proyectos/epidemiologia", title: "Modelos predictivos en epidemiología hospitalaria", profile_id: "generic.thesis", academic_level: "maestria", updated_at: "la semana pasada" },
  { path: "/proyectos/ia-derechos", title: "Tesina — Inteligencia artificial y derechos de autor", profile_id: "generic.tesina", academic_level: "licenciatura", updated_at: "hace 2 sem" },
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

function LatexSetupBanner({ info }: { info: import("../types").LatexInfo }) {
  const navigate = useNavigate();
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
            ? "No hay compilador LaTeX instalado — los PDFs no se podrán generar."
            : `LaTeX parcialmente instalado (${available.join(", ")} disponible).`}
        </span>
        <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginLeft: 8 }}>
          Instala Tectonic, MiKTeX o TeX Live para compilar.
        </span>
      </div>
      <button
        className="btn btn-sm btn-accent"
        onClick={() => navigate("/setup-latex")}
        style={{ flexShrink: 0 }}
      >
        Ver guía →
      </button>
    </div>
  );
}

function levelLabel(level: string): string {
  const map: Record<string, string> = {
    licenciatura: "Licenciatura",
    maestria: "Maestría",
    doctorado: "Doctorado",
    bachillerato: "Bachillerato",
    tecnico: "Técnico",
  };
  return map[level.toLowerCase()] ?? level;
}

export default function HomeView() {
  const navigate = useNavigate();
  const { setRecentProjects, latexInfo, setLatexInfo } = useProjectStore();
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [tab, setTab] = useState<"projects" | "favorites" | "recent" | "archived">("projects");

  useEffect(() => {
    api.detectLatex().then(setLatexInfo).catch(() => {});

    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      documentDir().then((dir) =>
        api.listRecentProjects(dir).then((p) => {
          setProjects(p);
          setRecentProjects(p);
        }).catch(() => setProjects([]))
      ).catch(() => setProjects([]));
    } else {
      setProjects(MOCK_PROJECTS);
      setRecentProjects(MOCK_PROJECTS);
    }
  }, [setLatexInfo, setRecentProjects]);

  async function handleOpen(projectPath: string) {
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (!isTauriEnv) {
      navigate("/demo");
      return;
    }
    try {
      const model = await api.getProject(projectPath);
      useProjectStore.getState().openProject(model, projectPath);
      navigate(`/project/${encodeURIComponent(projectPath)}`);
    } catch (e) {
      console.error("Error abriendo proyecto:", e);
    }
  }

  const latexStatus = latexInfo?.is_usable
    ? { text: `TeX Live ${latexInfo.texlive_year ?? ""} · biber`.trim(), dot: "var(--build-ok)" }
    : { text: "LaTeX no detectado", dot: "var(--build-err)" };

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span className="chip" style={{ marginLeft: 6 }}>v1.0.0</span></>}
        center={null}
        right={
          <>
            <button className="btn btn-ghost btn-sm">
              <IconSearch size={13} /> Buscar <span className="kbd">⌘K</span>
            </button>
            <button className="btn btn-ghost btn-icon"><IconSettings size={14} /></button>
          </>
        }
      />

      <div style={S.root}>
        <aside style={S.side}>
          {(["projects", "favorites", "recent", "archived"] as const).map((t) => {
            const icons = {
              projects: <IconBook size={13} />,
              favorites: <IconStar size={13} />,
              recent: <IconClock size={13} />,
              archived: <IconTrash size={13} />,
            };
            const labels = {
              projects: "Proyectos",
              favorites: "Favoritos",
              recent: "Recientes",
              archived: "Archivados",
            };
            return (
              <div key={t} style={S.sideItem(tab === t)} onClick={() => setTab(t)}>
                {icons[t]} {labels[t]}
              </div>
            );
          })}

          <div style={{ height: 1, background: "var(--border-subtle)", margin: "12px 4px" }} />
          <div style={{ ...S.sectionTitle, margin: "4px 4px 8px" }}>Biblioteca</div>
          <div style={S.sideItem(false)} onClick={() => navigate("/library")}>
            <IconFolder size={13} /> Perfiles
          </div>
          <div style={S.sideItem(false)}>
            <IconFile size={13} /> Elementos
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
              Continúa <span style={S.greetItalic}>donde lo dejaste</span>.
            </h1>
            <p style={S.sub}>
              {projects.length} proyecto{projects.length !== 1 ? "s" : ""}
            </p>
            <div style={S.actions}>
              <button className="btn btn-accent" onClick={() => navigate("/new")}>
                <IconPlus size={13} /> Nuevo proyecto
              </button>
              <button className="btn">
                <IconUpload size={13} /> Importar .tex
              </button>
              <button className="btn btn-ghost">Abrir desde carpeta…</button>
            </div>
          </div>

          {latexInfo && !latexInfo.is_usable && <LatexSetupBanner info={latexInfo} />}

          <div style={S.sectionTitle}>
            <span>Proyectos recientes</span>
            <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
            <span style={{ color: "var(--fg-muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              Ordenar por: <span style={{ color: "var(--fg-default)" }}>actualizado ↓</span>
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
                  <span className="tx-mono" style={{ fontSize: 11, color: "var(--fg-faint)" }}>
                    {p.profile_id}
                  </span>
                </div>
                <div style={S.cardFooter}>
                  <span>{p.path.split(/[/\\]/).pop()}</span>
                  <span>{formatUpdatedAt(p.updated_at)}</span>
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
                  <span style={{ fontWeight: 500 }}>Crear primer proyecto</span>
                </div>
                <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  Tesis, tesina, paper o reporte técnico. Empieza desde un perfil.
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
