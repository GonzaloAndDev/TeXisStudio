import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBook, IconCheck, IconCode, IconDoc, IconDownload, IconEdit, IconFile,
  IconHeading, IconImage, IconList, IconPlus, IconRefresh, IconSearch, IconSigma,
  IconTable, IconText, IconTrash, IconUpload, IconX,
} from "../components/Icons";
import { api } from "../lib/tauri";
import type { ProfileInfo, ProfileSectionInfo, ProfileUpdatePayload } from "../types";

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

// IDs de secciones disponibles para añadir a un perfil
const KNOWN_SECTION_ELEMENTS = [
  { id: "title_page",       label: "Portada",              placement: "front_matter" },
  { id: "abstract",         label: "Resumen",              placement: "front_matter" },
  { id: "acknowledgements", label: "Agradecimientos",      placement: "front_matter" },
  { id: "table_of_contents",label: "Tabla de contenidos",  placement: "front_matter" },
  { id: "list_of_figures",  label: "Lista de figuras",     placement: "front_matter" },
  { id: "list_of_tables",   label: "Lista de tablas",      placement: "front_matter" },
  { id: "introduction",     label: "Introducción",         placement: "body" },
  { id: "theoretical_framework", label: "Marco teórico",  placement: "body" },
  { id: "methodology",      label: "Metodología",          placement: "body" },
  { id: "results",          label: "Resultados",           placement: "body" },
  { id: "discussion",       label: "Discusión",            placement: "body" },
  { id: "conclusions",      label: "Conclusiones",         placement: "body" },
  { id: "references",       label: "Referencias",          placement: "back_matter" },
  { id: "appendix",         label: "Anexo",                placement: "appendix" },
];

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
  profile, onClose, onEdit, onUse, onExport, onDelete,
}: {
  profile: ProfileInfo;
  onClose: () => void;
  onEdit: () => void;
  onUse: () => void;
  onExport: () => void;
  onDelete: () => void;
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
        padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>
          Detalle del perfil
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={onEdit}
            className="btn btn-ghost btn-sm"
            title="Editar perfil"
            style={{ padding: "3px 8px" }}
          >
            <IconEdit size={12} /> Editar
          </button>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}
          >
            <IconX size={14} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">
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
                color: PLACEMENT_COLOR[placement] ?? "var(--fg-faint)", marginBottom: 6,
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
                  {s.required
                    ? <span style={{ fontSize: 9, color: "var(--accent-deep)", fontWeight: 600 }}>requerida</span>
                    : <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>opcional</span>
                  }
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
      <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn btn-accent" style={{ width: "100%" }} onClick={onUse}>
          <IconPlus size={13} /> Nuevo proyecto con este perfil
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onExport}>
            <IconDownload size={13} /> Exportar
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: "6px 10px", color: "var(--build-err)" }}
            onClick={onDelete}
            title="Eliminar perfil"
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProfileEditorPanel ────────────────────────────────────────────

function ProfileEditorPanel({
  profile,
  onSave,
  onCancel,
}: {
  profile: ProfileInfo;
  onSave: (updated: ProfileInfo) => void;
  onCancel: () => void;
}) {
  // Metadatos editables
  const [name, setName]               = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? "");
  const [author, setAuthor]           = useState(profile.author ?? "");
  const [version, setVersion]         = useState(profile.version ?? "0.1.0");
  const [license, setLicense]         = useState(profile.license ?? "");
  const [latexEngine, setLatexEngine] = useState(profile.latex_engine ?? "xelatex");
  const [docClass, setDocClass]       = useState(profile.document_class ?? "book");
  const [bibStyle, setBibStyle]       = useState(profile.bibliography_style ?? "apa");
  const [tagsRaw, setTagsRaw]         = useState((profile.tags ?? []).join(", "));

  // Secciones
  const [sections, setSections]       = useState<ProfileSectionInfo[]>(profile.sections ?? []);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Añadir sección desde lista preset
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionEl, setNewSectionEl]   = useState(KNOWN_SECTION_ELEMENTS[0].id);

  function moveSection(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= sections.length) return;
    const arr = [...sections];
    [arr[index], arr[next]] = [arr[next], arr[index]];
    setSections(arr);
  }

  function toggleRequired(index: number) {
    setSections(sections.map((s, i) => i === index ? { ...s, required: !s.required } : s));
  }

  function changePlacement(index: number, placement: string) {
    setSections(sections.map((s, i) => i === index ? { ...s, placement } : s));
  }

  function removeSection(index: number) {
    setSections(sections.filter((_, i) => i !== index));
  }

  function addSection() {
    const el = KNOWN_SECTION_ELEMENTS.find((e) => e.id === newSectionEl);
    if (!el) return;
    const newSec: ProfileSectionInfo = {
      id: el.id,
      element_id: el.id,
      placement: el.placement,
      required: false,
    };
    setSections([...sections, newSec]);
    setAddingSection(false);
  }

  async function handleSave() {
    if (!name.trim()) { setError("El nombre del perfil es requerido."); return; }
    setSaving(true);
    setError(null);
    const payload: ProfileUpdatePayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      author: author.trim() || undefined,
      version: version.trim() || undefined,
      license: license.trim() || undefined,
      latex_engine: latexEngine,
      document_class: docClass,
      bibliography_style: bibStyle,
      bibliography_backend: bibStyle === "vancouver" ? "bibtex" : "biber",
      tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean),
      sections,
    };
    try {
      const updated = await api.updateProfile(profile.id, payload);
      onSave(updated);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "6px 10px", borderRadius: "var(--r-sm)",
    border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
    fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontWeight: 500,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block",
  };

  return (
    <div style={{
      width: 380, flexShrink: 0,
      borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>
            Editar perfil
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginLeft: 8 }}>
            {profile.id}
          </span>
        </div>
        <button
          onClick={onCancel}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}
        >
          <IconX size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">

        {/* ── Metadatos ── */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-deep)", marginBottom: 12 }}>
            Metadatos
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Nombre *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ ...fieldStyle, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Autor</label>
              <input value={author} onChange={(e) => setAuthor(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Versión</label>
              <input value={version} onChange={(e) => setVersion(e.target.value)} style={fieldStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Licencia</label>
            <input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="p.ej. CC BY 4.0" style={fieldStyle} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Etiquetas (separadas por coma)</label>
            <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="tesis, licenciatura, apa" style={fieldStyle} />
          </div>
        </div>

        {/* ── Técnico ── */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-deep)", marginBottom: 12 }}>
            Configuración técnica
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Motor LaTeX</label>
              <select value={latexEngine} onChange={(e) => setLatexEngine(e.target.value)} style={fieldStyle}>
                <option value="xelatex">XeLaTeX</option>
                <option value="pdflatex">pdfLaTeX</option>
                <option value="lualatex">LuaLaTeX</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Clase de documento</label>
              <select value={docClass} onChange={(e) => setDocClass(e.target.value)} style={fieldStyle}>
                <option value="book">book</option>
                <option value="article">article</option>
                <option value="report">report</option>
                <option value="memoir">memoir</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Estilo bibliográfico</label>
            <select value={bibStyle} onChange={(e) => setBibStyle(e.target.value)} style={fieldStyle}>
              <option value="apa">APA 7</option>
              <option value="vancouver">Vancouver</option>
              <option value="ieee">IEEE</option>
              <option value="chicago">Chicago</option>
              <option value="mla">MLA</option>
            </select>
          </div>
        </div>

        {/* ── Secciones ── */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <div style={{ fontSize: "var(--fs-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-deep)" }}>
              Secciones ({sections.length})
            </div>
            <button
              className="btn btn-sm"
              onClick={() => setAddingSection(!addingSection)}
              style={{ fontSize: 11, padding: "3px 8px" }}
            >
              <IconPlus size={11} /> Añadir
            </button>
          </div>

          {/* Formulario para añadir sección */}
          {addingSection && (
            <div style={{
              padding: "10px 12px", borderRadius: "var(--r-md)",
              background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
              marginBottom: 10, display: "flex", flexDirection: "column", gap: 8,
            }}>
              <label style={labelStyle}>Tipo de sección</label>
              <select
                value={newSectionEl}
                onChange={(e) => setNewSectionEl(e.target.value)}
                style={fieldStyle}
              >
                {KNOWN_SECTION_ELEMENTS.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.label} ({PLACEMENT_LABEL[el.placement] ?? el.placement})
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-accent btn-sm" style={{ flex: 1 }} onClick={addSection}>
                  <IconCheck size={11} sw={2.5} /> Añadir sección
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingSection(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista de secciones */}
          {sections.map((sec, i) => (
            <div
              key={`${sec.id}-${i}`}
              style={{
                padding: "8px 10px", borderRadius: "var(--r-sm)",
                background: "var(--bg-panel)", border: "1px solid var(--border-subtle)",
                marginBottom: 5, display: "flex", flexDirection: "column", gap: 6,
              }}
            >
              {/* Fila superior: id + controles de orden */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: PLACEMENT_COLOR[sec.placement] ?? "var(--fg-faint)",
                }} />
                <span style={{ flex: 1, fontSize: "var(--fs-xs)", color: "var(--fg-strong)", fontFamily: "var(--font-mono)" }}>
                  {sec.id}
                </span>
                <button
                  onClick={() => moveSection(i, -1)}
                  disabled={i === 0}
                  style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "var(--fg-faint)" : "var(--fg-muted)", padding: "0 2px", fontSize: 12 }}
                  title="Subir"
                >▲</button>
                <button
                  onClick={() => moveSection(i, 1)}
                  disabled={i === sections.length - 1}
                  style={{ background: "none", border: "none", cursor: i === sections.length - 1 ? "default" : "pointer", color: i === sections.length - 1 ? "var(--fg-faint)" : "var(--fg-muted)", padding: "0 2px", fontSize: 12 }}
                  title="Bajar"
                >▼</button>
                <button
                  onClick={() => removeSection(i)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--build-err)", padding: "0 2px" }}
                  title="Eliminar sección"
                >
                  <IconX size={11} />
                </button>
              </div>

              {/* Fila inferior: placement + required */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select
                  value={sec.placement}
                  onChange={(e) => changePlacement(i, e.target.value)}
                  style={{ ...fieldStyle, padding: "3px 6px", fontSize: 11, flex: 1 }}
                >
                  {["front_matter", "body", "back_matter", "appendix"].map((p) => (
                    <option key={p} value={p}>{PLACEMENT_LABEL[p]}</option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--fg-muted)", cursor: "pointer", flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={sec.required}
                    onChange={() => toggleRequired(i)}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  requerida
                </label>
              </div>
            </div>
          ))}

          {sections.length === 0 && (
            <div style={{ padding: "16px 0", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-xs)" }}>
              Sin secciones. Añade al menos una.
            </div>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: 12, padding: "8px 12px", borderRadius: "var(--r-sm)",
            background: "var(--build-err-tint, #ffeded)", color: "var(--build-err)",
            fontSize: "var(--fs-xs)", border: "1px solid var(--build-err)",
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Footer acciones */}
      <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
        <button
          className="btn btn-accent"
          style={{ flex: 1 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Guardando…" : <><IconCheck size={13} sw={2} /> Guardar cambios</>}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancelar
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

// ── Catálogo curado de perfiles de comunidad ──────────────────────

interface CommunityProfile {
  id: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  meta: string;
  downloadUrl: string;
  stars?: number;
  verified?: boolean;
}

const PROFILES_REPO = "https://github.com/GonzaloAndDev/TeXisStudio-Profiles/releases/latest/download";

const COMMUNITY_PROFILES: CommunityProfile[] = [
  {
    id: "generic.thesis",
    name: "Tesis genérica",
    description: "Estructura completa para tesis de cualquier disciplina. Portada, resumen, capítulos, conclusiones y bibliografía.",
    author: "Gonzalo Andrade Estrella",
    tags: ["tesis", "genérico", "licenciatura", "maestría", "doctorado"],
    meta: "XeLaTeX · biber · APA",
    downloadUrl: `${PROFILES_REPO}/generic.thesis.zip`,
    verified: true,
  },
  {
    id: "apa.basic",
    name: "Tesis APA 7",
    description: "Estructura IMRyD estándar con estilo APA 7. Portada, resumen, introducción, metodología, resultados y referencias.",
    author: "Gonzalo Andrade Estrella",
    tags: ["tesis", "APA", "licenciatura", "maestría"],
    meta: "XeLaTeX · biber · APA 7",
    downloadUrl: `${PROFILES_REPO}/apa.basic.zip`,
    verified: true,
  },
  {
    id: "vancouver.health",
    name: "Tesis Ciencias de la Salud (Vancouver)",
    description: "Perfil IMRyD completo con estilo Vancouver para ciencias médicas y de la salud.",
    author: "Gonzalo Andrade Estrella",
    tags: ["tesis", "salud", "Vancouver", "doctorado"],
    meta: "XeLaTeX · biber · Vancouver",
    downloadUrl: `${PROFILES_REPO}/vancouver.health.zip`,
    verified: true,
  },
  {
    id: "engineering.basic",
    name: "Reporte de Ingeniería (IEEE)",
    description: "Para proyectos de ingeniería, memorias técnicas y reportes de laboratorio con estilo IEEE.",
    author: "Gonzalo Andrade Estrella",
    tags: ["reporte", "ingeniería", "IEEE"],
    meta: "XeLaTeX · biber · IEEE",
    downloadUrl: `${PROFILES_REPO}/engineering.basic.zip`,
    verified: true,
  },
  {
    id: "company.internship",
    name: "Reporte de Prácticas Profesionales",
    description: "Formato para memoria de estadía o prácticas profesionales en empresa.",
    author: "Gonzalo Andrade Estrella",
    tags: ["prácticas", "empresa", "APA"],
    meta: "XeLaTeX · biber · APA 7",
    downloadUrl: `${PROFILES_REPO}/company.internship.zip`,
    verified: true,
  },
  {
    id: "generic.tesina",
    name: "Tesina genérica",
    description: "Versión compacta para trabajos monográficos, tesinas y documentos académicos breves.",
    author: "Gonzalo Andrade Estrella",
    tags: ["tesina", "monografía", "licenciatura"],
    meta: "XeLaTeX · biber · APA",
    downloadUrl: `${PROFILES_REPO}/generic.tesina.zip`,
    verified: true,
  },
];

// ── CommunityTab ──────────────────────────────────────────────────

function CommunityTab({
  installedIds,
  onInstalled,
}: {
  installedIds: Set<string>;
  onInstalled: (profile: ProfileInfo) => void;
}) {
  const [downloading, setDownloading]   = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState<string | null>(null);
  const [customUrl, setCustomUrl]       = useState("");
  const [fetchingCustom, setFetchingCustom] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  async function handleInstall(profile: CommunityProfile) {
    setDownloading(profile.id);
    setError(null);
    setSuccess(null);
    try {
      const installed = await api.fetchRemoteProfile(profile.downloadUrl);
      onInstalled(installed);
      setSuccess(`✓ "${installed.name}" instalado correctamente.`);
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(null);
    }
  }

  async function handleCustomUrl() {
    const url = customUrl.trim();
    if (!url) return;
    setFetchingCustom(true);
    setError(null);
    setSuccess(null);
    try {
      const installed = await api.fetchRemoteProfile(url);
      onInstalled(installed);
      setSuccess(`✓ "${installed.name}" instalado correctamente.`);
      setCustomUrl("");
    } catch (e) {
      setError(String(e));
    } finally {
      setFetchingCustom(false);
    }
  }

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 48px" }} className="scroll">
      <div style={{ maxWidth: 720 }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>
            Biblioteca de comunidad
          </h1>
          <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>
            Perfiles verificados listos para descargar e instalar. Requiere conexión a internet.
          </p>
        </div>

        {!isTauri && (
          <div style={{ padding: "12px 16px", borderRadius: "var(--r-md)", background: "var(--accent-tint)", border: "1px solid var(--accent-soft)", fontSize: "var(--fs-sm)", color: "var(--accent-deep)", marginBottom: 20 }}>
            ℹ La descarga real solo funciona en la app de escritorio (Tauri). En el navegador se simula.
          </div>
        )}

        {/* Feedback */}
        {error && (
          <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--build-err-tint, #ffeded)", border: "1px solid var(--build-err)", color: "var(--build-err)", fontSize: "var(--fs-sm)", marginBottom: 16 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--build-ok-tint, #edfff3)", border: "1px solid var(--build-ok)", color: "var(--build-ok)", fontSize: "var(--fs-sm)", marginBottom: 16 }}>
            {success}
          </div>
        )}

        {/* Lista curada */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {COMMUNITY_PROFILES.map((cp) => {
            const isInstalled = installedIds.has(cp.id);
            const isDownloading = downloading === cp.id;
            return (
              <div
                key={cp.id}
                style={{
                  background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
                  borderRadius: "var(--r-lg)", padding: "16px 18px",
                  display: "flex", gap: 14, alignItems: "flex-start",
                }}
              >
                {/* Ícono */}
                <div style={{
                  width: 40, height: 40, borderRadius: "var(--r-md)", flexShrink: 0,
                  background: isInstalled ? "var(--build-ok-tint, #edfff3)" : "var(--ink-100)",
                  color: isInstalled ? "var(--build-ok)" : "var(--fg-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isInstalled ? <IconCheck size={18} sw={2.5} /> : <IconBook size={18} />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>
                      {cp.name}
                    </span>
                    {cp.verified && (
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: "var(--r-xs)", background: "var(--accent-tint)", color: "var(--accent-deep)", fontWeight: 600 }}>
                        VERIFICADO
                      </span>
                    )}
                    {cp.stars !== undefined && (
                      <span style={{ fontSize: 11, color: "var(--fg-faint)", marginLeft: 2 }}>
                        ★ {cp.stars}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    {cp.description}
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>{cp.meta}</span>
                    {cp.tags.map((t) => (
                      <span key={t} className="chip" style={{ fontSize: 9 }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 6 }}>
                    por {cp.author}
                  </div>
                </div>

                {/* Acción */}
                <div style={{ flexShrink: 0, alignSelf: "center" }}>
                  {isInstalled ? (
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--build-ok)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      <IconCheck size={12} sw={2.5} /> Instalado
                    </span>
                  ) : (
                    <button
                      className="btn btn-sm btn-accent"
                      onClick={() => handleInstall(cp)}
                      disabled={isDownloading}
                      style={{ minWidth: 100 }}
                    >
                      {isDownloading
                        ? <><IconRefresh size={12} /> Instalando…</>
                        : <><IconDownload size={12} /> Instalar</>
                      }
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* URL personalizada */}
        <div style={{
          padding: "20px 22px", borderRadius: "var(--r-lg)",
          border: "1px dashed var(--border-firm)", background: "var(--bg-panel)",
        }}>
          <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", marginBottom: 6 }}>
            Instalar desde URL
          </div>
          <p style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
            Pega la URL de un archivo <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--bg-app)", padding: "1px 4px", borderRadius: 3 }}>.zip</code> que contenga un <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--bg-app)", padding: "1px 4px", borderRadius: 3 }}>profile.yaml</code> válido.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={urlRef}
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://github.com/.../archive/main.zip"
              style={{
                flex: 1, padding: "7px 12px", borderRadius: "var(--r-md)",
                border: "1px solid var(--border-firm)", background: "var(--bg-app)",
                fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none",
                fontFamily: "var(--font-mono)",
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCustomUrl(); }}
            />
            <button
              className="btn btn-accent btn-sm"
              onClick={handleCustomUrl}
              disabled={!customUrl.trim() || fetchingCustom}
            >
              {fetchingCustom ? <><IconRefresh size={12} /> …</> : <><IconDownload size={12} /> Instalar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LibraryView principal ─────────────────────────────────────────

export default function LibraryView() {
  const navigate = useNavigate();
  const [profiles, setProfiles]       = useState<ProfileInfo[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [tab, setTab]                 = useState<"profiles" | "community" | "elements">("profiles");
  const [selected, setSelected]       = useState<ProfileInfo | null>(null);
  const [editing, setEditing]         = useState(false);
  const [importing, setImporting]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProfileInfo | null>(null);

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
        directory: true, multiple: false,
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

  async function handleDelete(profile: ProfileInfo) {
    setConfirmDelete(null);
    try {
      await api.deleteProfile(profile.id);
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      if (selected?.id === profile.id) setSelected(null);
    } catch (e) {
      alert(`Error al eliminar: ${e}`);
    }
  }

  function handleSaveEdit(updated: ProfileInfo) {
    setProfiles((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setSelected(updated);
    setEditing(false);
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

      {/* Confirmación de eliminación */}
      {confirmDelete && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{
            background: "var(--bg-chrome)", borderRadius: "var(--r-lg)",
            padding: 24, maxWidth: 380, width: "90%",
            border: "1px solid var(--border-firm)",
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            <div style={{ fontWeight: 600, color: "var(--fg-strong)" }}>
              ¿Eliminar perfil?
            </div>
            <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
              Se eliminará <strong>{confirmDelete.name}</strong> ({confirmDelete.id}) del directorio de perfiles. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn"
                style={{ background: "var(--build-err)", color: "white", border: "none" }}
                onClick={() => handleDelete(confirmDelete)}
              >
                <IconTrash size={13} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)" }}>
        {/* Sidebar */}
        <div style={{
          width: 200, flexShrink: 0,
          borderRight: "1px solid var(--border-subtle)", background: "var(--bg-chrome)",
          padding: "20px 12px", display: "flex", flexDirection: "column", gap: 4,
        }}>
          {[
            { id: "profiles",  label: "Perfiles",   icon: <IconBook size={13} /> },
            { id: "community", label: "Comunidad",  icon: <IconDownload size={13} /> },
            { id: "elements",  label: "Elementos",  icon: <IconFile size={13} /> },
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
              onClick={() => setTab(id as "profiles" | "community" | "elements")}
            >
              {icon} {label}
            </div>
          ))}

          <div style={{ flex: 1 }} />

          <div style={{ padding: "10px", borderRadius: "var(--r-md)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: "var(--fg-muted)", marginBottom: 3 }}>Release 0.5</div>
            {profiles.length} perfiles · {BLOCK_CATALOG.length} elementos
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
                    <IconUpload size={13} /> {importing ? "Importando…" : "Importar"}
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
                      onClick={() => {
                        if (editing && selected?.id === p.id) return;
                        setEditing(false);
                        setSelected(selected?.id === p.id ? null : p);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Panel lateral: detalle o editor */}
            {selected && !editing && (
              <ProfileDetailPanel
                profile={selected}
                onClose={() => setSelected(null)}
                onEdit={() => setEditing(true)}
                onUse={() => handleUseProfile(selected)}
                onExport={() => handleExport(selected)}
                onDelete={() => setConfirmDelete(selected)}
              />
            )}
            {selected && editing && (
              <ProfileEditorPanel
                profile={selected}
                onSave={handleSaveEdit}
                onCancel={() => setEditing(false)}
              />
            )}
          </div>
        )}

        {tab === "community" && (
          <CommunityTab
            installedIds={new Set(profiles.map((p) => p.id))}
            onInstalled={(p) => {
              setProfiles((prev) => {
                const exists = prev.some((x) => x.id === p.id);
                return exists ? prev : [...prev, p];
              });
            }}
          />
        )}

        {tab === "elements" && <ElementsTab />}
      </div>

      <TxStatusbar items={[
        { text: `${profiles.length} perfiles instalados` },
        { icon: <IconUpload size={11} />, text: "Importar" },
        { right: true, text: "TeXisStudio 0.5.0" },
      ]} />
    </>
  );
}
