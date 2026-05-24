import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBook, IconCheck, IconCode, IconDoc, IconDownload, IconFile,
  IconHeading, IconImage, IconList, IconPlus, IconSearch, IconSigma,
  IconTable, IconText, IconUpload, IconX,
} from "../components/Icons";
import { api } from "../lib/tauri";
import type { ProfileInfo, ProfileSectionInfo } from "../types";

// ── Catálogo de elementos (bloques de contenido) ────────────────

const BLOCK_CATALOG = [
  {
    type: "paragraph",
    name: "Párrafo",
    icon: <IconText size={16} />,
    description: "Bloque de texto libre. Soporte para énfasis, citas en línea y LaTeX inline.",
    latex_output: "Texto escapado directamente en el documento.",
    tags: ["texto", "contenido"],
  },
  {
    type: "heading",
    name: "Título / Encabezado",
    icon: <IconHeading size={16} />,
    description: "Encabezado de sección: section (H1), subsection (H2) o subsubsection (H3).",
    latex_output: "\\section{}, \\subsection{}, \\subsubsection{}",
    tags: ["estructura", "navegación"],
  },
  {
    type: "figure",
    name: "Figura",
    icon: <IconImage size={16} />,
    description: "Imagen con leyenda, fuente y etiqueta para referencia cruzada. Anchos: 50%, 75%, 100%.",
    latex_output: "Entorno figure + \\includegraphics + \\caption + \\label",
    tags: ["imagen", "gráfico"],
  },
  {
    type: "table",
    name: "Tabla",
    icon: <IconTable size={16} />,
    description: "Tabla con encabezados, filas, leyenda y fuente. Estilos: simple, booktabs, wide, longtable.",
    latex_output: "Entorno table + tabular/longtable + \\caption",
    tags: ["datos", "estadísticas"],
  },
  {
    type: "equation",
    name: "Ecuación",
    icon: <IconSigma size={16} />,
    description: "Fórmula matemática numerada o no. Se escribe en LaTeX math puro.",
    latex_output: "Entorno equation o equation* + \\label opcional",
    tags: ["matemáticas", "fórmula"],
  },
  {
    type: "list",
    name: "Lista",
    icon: <IconList size={16} />,
    description: "Lista con viñetas (itemize), numerada (enumerate) o descriptiva (description).",
    latex_output: "\\begin{itemize/enumerate/description}",
    tags: ["lista", "enumeración"],
  },
  {
    type: "citation",
    name: "Cita bibliográfica",
    icon: <IconDoc size={16} />,
    description: "Cita parentética, narrativa o múltiple. Vinculada a la clave BibTeX del .bib.",
    latex_output: "\\parencite{}, \\textcite{}, \\cite{}",
    tags: ["bibliografía", "referencia"],
  },
  {
    type: "raw_latex",
    name: "LaTeX directo",
    icon: <IconCode size={16} />,
    description: "Fragmento LaTeX arbitrario para casos avanzados. Requiere confirmación del usuario.",
    latex_output: "Verbatim — sin escapar. Úsalo con cuidado.",
    tags: ["avanzado", "personalizado"],
  },
];

const PLACEMENT_LABEL: Record<string, string> = {
  front_matter: "Preliminares",
  body:         "Cuerpo",
  back_matter:  "Material final",
  appendix:     "Anexos",
};

const PLACEMENT_COLOR: Record<string, string> = {
  front_matter: "var(--accent)",
  body:         "#3AA396",
  back_matter:  "#7C6EAF",
  appendix:     "var(--fg-muted)",
};

// ── ProfileCard ──────────────────────────────────────────────────

function ProfileCard({
  profile, selected, onClick,
}: {
  profile: ProfileInfo;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "var(--accent-tint)" : "var(--bg-panel)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border-soft)"}`,
        boxShadow: selected ? "0 0 0 3px var(--accent-soft)" : "none",
        borderRadius: "var(--r-lg)", padding: 18,
        display: "flex", flexDirection: "column", gap: 10,
        cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "var(--r-md)", flexShrink: 0,
            background: selected ? "var(--accent)" : "var(--ink-100)",
            color: selected ? "white" : "var(--fg-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconBook size={15} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>
              {profile.name}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginTop: 1 }}>
              {profile.id}
            </div>
          </div>
        </div>
        <span className={`chip ${selected ? "chip-accent" : "chip-ok"}`} style={{ flexShrink: 0, fontSize: 10 }}>
          {selected ? <><IconCheck size={8} sw={2.5} /> seleccionado</> : "instalado"}
        </span>
      </div>

      {profile.description && (
        <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
          {profile.description}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {profile.tags.map((t) => (
          <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>
        ))}
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: 8, borderTop: "1px solid var(--border-subtle)",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>
          {profile.meta}
        </span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
          {profile.sections_count ?? "?"} secciones
        </span>
      </div>
    </div>
  );
}

// ── ProfileDetailPanel ───────────────────────────────────────────

function ProfileDetailPanel({
  profile, onClose, onUse, onExport,
}: {
  profile: ProfileInfo;
  onClose: () => void;
  onUse: () => void;
  onExport: () => void;
}) {
  const sectionsByPlacement = (profile.sections ?? []).reduce<Record<string, ProfileSectionInfo[]>>(
    (acc, s) => {
      const key = s.placement;
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    },
    {}
  );
  const placementOrder = ["front_matter", "body", "back_matter", "appendix"];

  return (
    <div style={{
      width: 320, flexShrink: 0,
      borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>
          Detalle del perfil
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--fg-faint)", padding: 2,
          }}
        >
          <IconX size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">
        {/* Cabecera */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", fontWeight: 500, color: "var(--fg-strong)" }}>
            {profile.name}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginBottom: 6 }}>
            {profile.id} · v{profile.version ?? "0.1.0"}
          </div>
          {profile.description && (
            <p style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6, margin: 0 }}>
              {profile.description}
            </p>
          )}
        </div>

        {/* Especificaciones técnicas */}
        <div style={{
          padding: "10px 12px", borderRadius: "var(--r-md)",
          background: "var(--bg-app)", border: "1px solid var(--border-subtle)",
          marginBottom: 16, display: "flex", flexDirection: "column", gap: 6,
        }}>
          {[
            ["Motor LaTeX", profile.latex_engine ?? "xelatex"],
            ["Bibliografía", profile.bibliography_style?.toUpperCase() ?? "APA"],
            ["Clase", profile.document_class ?? "book"],
            ["Autor", profile.author ?? "—"],
            ["Licencia", profile.license ?? "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{k}</span>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)", fontFamily: "var(--font-mono)" }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Secciones */}
        <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 10 }}>
          Secciones ({profile.sections_count ?? profile.sections?.length ?? 0})
        </div>

        {placementOrder.map((placement) => {
          const secs = sectionsByPlacement[placement];
          if (!secs?.length) return null;
          return (
            <div key={placement} style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                color: PLACEMENT_COLOR[placement] ?? "var(--fg-faint)",
                marginBottom: 6,
              }}>
                {PLACEMENT_LABEL[placement] ?? placement}
              </div>
              {secs.map((s) => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "5px 8px", borderRadius: "var(--r-sm)",
                  background: "var(--bg-panel)", border: "1px solid var(--border-subtle)",
                  marginBottom: 4,
                }}>
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)" }}>
                    {s.title ?? s.id}
                  </span>
                  {s.required ? (
                    <span style={{ fontSize: 9, color: "var(--accent-deep)", fontWeight: 600 }}>requerida</span>
                  ) : (
                    <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>opcional</span>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {profile.sections?.length === 0 && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic" }}>
            Carga el detalle para ver las secciones.
          </div>
        )}
      </div>

      {/* Acciones */}
      <div style={{
        padding: 14, borderTop: "1px solid var(--border-subtle)",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <button className="btn btn-accent" style={{ width: "100%" }} onClick={onUse}>
          <IconPlus size={13} /> Nuevo proyecto con este perfil
        </button>
        <button className="btn" style={{ width: "100%" }} onClick={onExport}>
          <IconDownload size={13} /> Exportar .texisprofile
        </button>
      </div>
    </div>
  );
}

// ── Catálogo de elementos ─────────────────────────────────────────

function ElementsTab() {
  const [selected, setSelected] = useState<string | null>(null);
  const sel = BLOCK_CATALOG.find((b) => b.type === selected);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Lista */}
      <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }} className="scroll">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>
            Elementos
          </h1>
          <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>
            Bloques de contenido disponibles en el editor. Haz clic para ver el detalle.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {BLOCK_CATALOG.map((b) => (
            <div
              key={b.type}
              onClick={() => setSelected(b.type === selected ? null : b.type)}
              style={{
                background: selected === b.type ? "var(--accent-tint)" : "var(--bg-panel)",
                border: `1px solid ${selected === b.type ? "var(--accent)" : "var(--border-soft)"}`,
                boxShadow: selected === b.type ? "0 0 0 3px var(--accent-soft)" : "none",
                borderRadius: "var(--r-lg)", padding: 16,
                cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start",
              }}
            >
              <div style={{
                width: 32, height: 32, flexShrink: 0, borderRadius: "var(--r-md)",
                background: selected === b.type ? "var(--accent)" : "var(--ink-100)",
                color: selected === b.type ? "white" : "var(--fg-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {b.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", marginBottom: 3 }}>
                  {b.name}
                </div>
                <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  {b.description}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {b.tags.map((t) => (
                    <span key={t} className="chip" style={{ fontSize: 9 }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel detalle */}
      {sel && (
        <div style={{
          width: 280, flexShrink: 0,
          borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)",
          padding: 20, overflow: "auto",
        }} className="scroll">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "var(--r-md)",
                background: "var(--accent)", color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {sel.icon}
              </div>
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{sel.name}</span>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)" }}
            >
              <IconX size={13} />
            </button>
          </div>

          <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 14 }}>
            {sel.description}
          </p>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 6 }}>
              Salida LaTeX
            </div>
            <div style={{
              padding: "8px 10px", borderRadius: "var(--r-sm)",
              background: "var(--bg-app)", border: "1px solid var(--border-firm)",
              fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-default)", lineHeight: 1.6,
            }}>
              {sel.latex_output}
            </div>
          </div>

          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 6 }}>
            Tipo interno
          </div>
          <span className="chip tx-mono" style={{ fontSize: 11 }}>{sel.type}</span>
        </div>
      )}
    </div>
  );
}

// ── LibraryView principal ─────────────────────────────────────────

export default function LibraryView() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"profiles" | "elements">("profiles");
  const [selected, setSelected] = useState<ProfileInfo | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.getProfiles()
      .then((p) => { setProfiles(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = profiles.filter(
    (p) => !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some((t) => t.includes(search.toLowerCase()))
  );

  async function handleImport() {
    setImporting(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({
        directory: true,
        multiple: false,
        title: "Selecciona el directorio del perfil (.texisprofile)",
      });
      const src = Array.isArray(result) ? result[0] : result;
      if (!src) { setImporting(false); return; }
      const imported = await api.importProfile(src);
      setProfiles((prev) => [...prev, imported]);
      setSelected(imported);
      alert(`✓ Perfil '${imported.name}' importado correctamente.`);
    } catch (e) {
      alert(`Error al importar: ${e}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleExport(profile: ProfileInfo) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dest = await open({ directory: true, multiple: false, title: "Selecciona la carpeta de destino" });
      const destPath = Array.isArray(dest) ? dest[0] : dest;
      if (!destPath) return;
      const result = await api.exportProfile(profile.id, destPath);
      alert(`✓ Perfil exportado en:\n${result.exported_to}`);
    } catch (e) {
      alert(`Error al exportar: ${e}`);
    }
  }

  function handleUseProfile(profile: ProfileInfo) {
    navigate(`/new?profile=${encodeURIComponent(profile.id)}`);
  }

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ Biblioteca</span></>}
        center={null}
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>
            ← Inicio
          </button>
        }
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)" }}>
        {/* Sidebar */}
        <div style={{
          width: 200, flexShrink: 0,
          borderRight: "1px solid var(--border-subtle)", background: "var(--bg-chrome)",
          padding: "20px 12px", display: "flex", flexDirection: "column", gap: 4,
        }}>
          {[
            { id: "profiles", label: "Perfiles", icon: <IconBook size={13} /> },
            { id: "elements", label: "Elementos", icon: <IconFile size={13} /> },
          ].map(({ id, label, icon }) => (
            <div
              key={id}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 10px",
                borderRadius: "var(--r-md)", cursor: "pointer", fontSize: "var(--fs-base)",
                background: tab === id ? "var(--bg-selected)" : "transparent",
                color: tab === id ? "var(--accent-deep)" : "var(--fg-default)",
                fontWeight: tab === id ? 500 : 400,
              }}
              onClick={() => setTab(id as "profiles" | "elements")}
            >
              {icon} {label}
            </div>
          ))}

          <div style={{ flex: 1 }} />

          <div style={{ padding: "10px", borderRadius: "var(--r-md)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: "var(--fg-muted)", marginBottom: 3 }}>Release 0.3</div>
            {profiles.length} perfiles instalados · {BLOCK_CATALOG.length} tipos de bloque
          </div>
        </div>

        {/* Main content */}
        {tab === "profiles" && (
          <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
            {/* Listado */}
            <div style={{ flex: 1, overflow: "auto", padding: "32px 40px" }} className="scroll">
              {/* Toolbar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>
                    Perfiles instalados
                  </h1>
                  <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>
                    {loading ? "Cargando…" : `${profiles.length} perfiles · haz clic para ver detalle`}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    onClick={handleImport}
                    disabled={importing}
                    title="Importar perfil desde directorio .texisprofile"
                  >
                    <IconUpload size={13} /> {importing ? "Importando…" : "Importar perfil"}
                  </button>
                  <button className="btn btn-accent btn-sm" onClick={() => navigate("/new")}>
                    <IconPlus size={13} /> Nuevo proyecto
                  </button>
                </div>
              </div>

              {/* Buscador */}
              <div style={{ position: "relative", maxWidth: 380, marginBottom: 24 }}>
                <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o etiqueta…"
                  style={{
                    width: "100%", padding: "7px 12px 7px 32px", borderRadius: "var(--r-md)",
                    border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
                    fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none",
                  }}
                />
              </div>

              {/* Grid de perfiles */}
              {loading ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0" }}>
                  Cargando perfiles…
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0", textAlign: "center" }}>
                  No se encontraron perfiles para «{search}»
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                  {filtered.map((p) => (
                    <ProfileCard
                      key={p.id}
                      profile={p}
                      selected={selected?.id === p.id}
                      onClick={() => setSelected(selected?.id === p.id ? null : p)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Panel de detalle */}
            {selected && (
              <ProfileDetailPanel
                profile={selected}
                onClose={() => setSelected(null)}
                onUse={() => handleUseProfile(selected)}
                onExport={() => handleExport(selected)}
              />
            )}
          </div>
        )}

        {tab === "elements" && <ElementsTab />}
      </div>

      <TxStatusbar items={[
        { text: `${profiles.length} perfiles instalados` },
        { icon: <IconUpload size={11} />, text: "Importar · Ctrl+I" },
        { right: true, text: "TeXisStudio 0.3.0" },
      ]} />
    </>
  );
}
