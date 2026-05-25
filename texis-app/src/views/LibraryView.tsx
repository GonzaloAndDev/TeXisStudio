import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBook, IconBuilding, IconCheck, IconCode, IconDoc, IconDownload, IconEdit,
  IconFolder, IconGlobe, IconGrid, IconHeading, IconImage, IconLayers,
  IconList, IconMap, IconPlus, IconRefresh, IconSearch, IconSigma,
  IconTable, IconText, IconTrash, IconUpload, IconX,
} from "../components/Icons";
import { api } from "../lib/tauri";
import type { ProfileInfo, ProfileSectionInfo, ProfileUpdatePayload } from "../types";

// ── Catálogo de elementos ──────────────────────────────────────────────────────

const BLOCK_CATALOG = [
  { type: "paragraph", name: "Párrafo", icon: <IconText size={16} />,
    description: "Bloque de texto libre. Soporte para énfasis, citas en línea y LaTeX inline.",
    latex_output: "Texto escapado directamente en el documento.", tags: ["texto", "contenido"] },
  { type: "heading", name: "Título / Encabezado", icon: <IconHeading size={16} />,
    description: "Encabezado de sección: section (H1), subsection (H2) o subsubsection (H3).",
    latex_output: "\\section{}, \\subsection{}, \\subsubsection{}", tags: ["estructura", "navegación"] },
  { type: "figure", name: "Figura", icon: <IconImage size={16} />,
    description: "Imagen con leyenda, fuente y etiqueta para referencia cruzada. Anchos: 50%, 75%, 100%.",
    latex_output: "Entorno figure + \\includegraphics + \\caption + \\label", tags: ["imagen", "gráfico"] },
  { type: "table", name: "Tabla", icon: <IconTable size={16} />,
    description: "Tabla con encabezados, filas, leyenda y fuente. Estilos: simple, booktabs, wide, longtable.",
    latex_output: "Entorno table + tabular/longtable + \\caption", tags: ["datos", "estadísticas"] },
  { type: "equation", name: "Ecuación", icon: <IconSigma size={16} />,
    description: "Fórmula matemática numerada o no. Se escribe en LaTeX math puro.",
    latex_output: "Entorno equation o equation* + \\label opcional", tags: ["matemáticas", "fórmula"] },
  { type: "list", name: "Lista", icon: <IconList size={16} />,
    description: "Lista con viñetas (itemize), numerada (enumerate) o descriptiva (description).",
    latex_output: "\\begin{itemize/enumerate/description}", tags: ["lista", "enumeración"] },
  { type: "citation", name: "Cita bibliográfica", icon: <IconDoc size={16} />,
    description: "Cita parentética, narrativa o múltiple. Vinculada a la clave BibTeX del .bib.",
    latex_output: "\\parencite{}, \\textcite{}, \\cite{}", tags: ["bibliografía", "referencia"] },
  { type: "raw_latex", name: "LaTeX directo", icon: <IconCode size={16} />,
    description: "Fragmento LaTeX arbitrario para casos avanzados. Requiere confirmación del usuario.",
    latex_output: "Verbatim — sin escapar. Úsalo con cuidado.", tags: ["avanzado", "personalizado"] },
];

const PLACEMENT_LABEL: Record<string, string> = {
  front_matter: "Preliminares", body: "Cuerpo", back_matter: "Material final", appendix: "Anexos",
};
const PLACEMENT_COLOR: Record<string, string> = {
  front_matter: "var(--accent)", body: "#3AA396", back_matter: "#7C6EAF", appendix: "var(--fg-muted)",
};

const KNOWN_SECTION_ELEMENTS = [
  { id: "title_page",          label: "Portada",              placement: "front_matter" },
  { id: "abstract",            label: "Resumen",              placement: "front_matter" },
  { id: "acknowledgements",    label: "Agradecimientos",      placement: "front_matter" },
  { id: "table_of_contents",   label: "Tabla de contenidos",  placement: "front_matter" },
  { id: "list_of_figures",     label: "Lista de figuras",     placement: "front_matter" },
  { id: "list_of_tables",      label: "Lista de tablas",      placement: "front_matter" },
  { id: "introduction",        label: "Introducción",         placement: "body" },
  { id: "theoretical_framework", label: "Marco teórico",     placement: "body" },
  { id: "methodology",         label: "Metodología",          placement: "body" },
  { id: "results",             label: "Resultados",           placement: "body" },
  { id: "discussion",          label: "Discusión",            placement: "body" },
  { id: "conclusions",         label: "Conclusiones",         placement: "body" },
  { id: "references",          label: "Referencias",          placement: "back_matter" },
  { id: "appendix",            label: "Anexo",                placement: "appendix" },
];

// ── Estilos bibliográficos integrados ─────────────────────────────────────────

export interface CitationStyle {
  id: string;
  name: string;
  full_name: string;
  type: "author_date" | "numeric" | "notes_bibliography" | "author_page";
  biblatex_style: string;
  disciplines: string[];
  in_text_format: string;
  bibliography_title: string;
  description: string;
  builtin: boolean;
  regions_primary?: string[];
}

const BUILTIN_STYLES: CitationStyle[] = [
  {
    id: "apa7", name: "APA 7", full_name: "American Psychological Association, 7th Edition",
    type: "author_date", biblatex_style: "apa",
    disciplines: ["Psicología", "Educación", "Ciencias Sociales", "Enfermería", "Comunicación"],
    in_text_format: "(Autor, Año)", bibliography_title: "References",
    description: "El estilo más usado globalmente. Obligatorio en la mayoría de programas de psicología, educación y ciencias sociales. Séptima edición (2020).",
    regions_primary: ["EE.UU.", "Canadá", "América Latina", "Australia"],
    builtin: true,
  },
  {
    id: "vancouver", name: "Vancouver", full_name: "Vancouver / ICMJE Recommendations",
    type: "numeric", biblatex_style: "vancouver",
    disciplines: ["Medicina", "Enfermería", "Farmacia", "Odontología", "Ciencias de la Salud"],
    in_text_format: "[1]", bibliography_title: "References",
    description: "Estilo numérico obligatorio para ciencias de la salud. Referencias en orden de aparición. Estándar de revistas en MEDLINE/PubMed.",
    regions_primary: ["Global — ciencias médicas y de la salud"],
    builtin: true,
  },
  {
    id: "ieee", name: "IEEE", full_name: "IEEE Citation Style",
    type: "numeric", biblatex_style: "ieee",
    disciplines: ["Ingeniería Eléctrica", "Computación", "Telecomunicaciones", "Robótica", "Electrónica"],
    in_text_format: "[1]", bibliography_title: "References",
    description: "Estilo numérico estándar para ingeniería, computación y tecnología. Adoptado en MIT, Stanford, TU Delft, TU Munich, IIT Bombay y prácticamente todas las escuelas de ingeniería.",
    regions_primary: ["Global — ingeniería y tecnología"],
    builtin: true,
  },
  {
    id: "chicago17_notes", name: "Chicago 17 (Notas)", full_name: "Chicago Manual of Style, 17.ª Edición — Notes-Bibliography",
    type: "notes_bibliography", biblatex_style: "verbose-note",
    disciplines: ["Historia", "Literatura", "Artes", "Filosofía", "Estudios Religiosos"],
    in_text_format: "Nota al pie¹", bibliography_title: "Bibliography",
    description: "Sistema de notas y bibliografía para humanidades. Las citas aparecen en notas a pie de página. Preferido en Harvard, UChicago y departamentos de humanidades en EE.UU. y UK.",
    regions_primary: ["EE.UU.", "UK", "Canadá — humanidades"],
    builtin: true,
  },
  {
    id: "chicago17_authordate", name: "Chicago 17 (Autor-Fecha)", full_name: "Chicago Manual of Style, 17.ª Edición — Author-Date",
    type: "author_date", biblatex_style: "chicago-authordate",
    disciplines: ["Economía", "Ciencias Políticas", "Sociología", "Antropología", "Geografía"],
    in_text_format: "(Autor Año)", bibliography_title: "References",
    description: "Variante Author-Date de Chicago, preferida en ciencias sociales y economía. Requerida en programas de ciencias sociales de UChicago y común en economía a nivel global.",
    regions_primary: ["EE.UU.", "Canadá — ciencias sociales"],
    builtin: true,
  },
  {
    id: "mla9", name: "MLA 9", full_name: "MLA Handbook, 9.ª Edición",
    type: "author_page", biblatex_style: "mla",
    disciplines: ["Literatura", "Lengua", "Lingüística", "Estudios Culturales", "Retórica"],
    in_text_format: "(Autor Página)", bibliography_title: "Works Cited",
    description: "Estándar para lengua, literatura y estudios culturales en Norteamérica. Novena edición (2021) simplificó reglas de formato.",
    regions_primary: ["EE.UU.", "Canadá — lengua y literatura"],
    builtin: true,
  },
  {
    id: "harvard", name: "Harvard", full_name: "Harvard Referencing Style",
    type: "author_date", biblatex_style: "apa",
    disciplines: ["Negocios", "Administración", "Economía", "Ciencias Sociales"],
    in_text_format: "(Autor Año)", bibliography_title: "References",
    description: "Estilo autor-fecha similar a APA. Ampliamente usado en universidades del Reino Unido y Australia para negocios, administración y ciencias sociales.",
    regions_primary: ["UK", "Australia", "Irlanda", "Sudáfrica"],
    builtin: true,
  },
  {
    id: "mhra", name: "MHRA", full_name: "Modern Humanities Research Association Style Guide, 3.ª Edición",
    type: "notes_bibliography", biblatex_style: "verbose-note",
    disciplines: ["Humanidades", "Historia", "Literatura", "Filosofía", "Lingüística"],
    in_text_format: "Nota al pie¹", bibliography_title: "Bibliography",
    description: "Estándar UK de humanidades similar a Chicago Notes. Ampliamente requerido en Oxford, Cambridge, UCL y otras universidades Russell Group.",
    regions_primary: ["UK", "Irlanda — humanidades"],
    builtin: true,
  },
  {
    id: "abnt", name: "ABNT", full_name: "ABNT NBR 6023:2018",
    type: "author_date", biblatex_style: "abnt",
    disciplines: ["Todas las disciplinas (Brasil)"],
    in_text_format: "(AUTOR, Año)", bibliography_title: "Referências",
    description: "Norma nacional obligatoria para trabajos académicos en universidades brasileñas. NBR 6023:2018 para referencias; NBR 10520:2002 para citas en texto.",
    regions_primary: ["Brasil — obligatorio"],
    builtin: true,
  },
  {
    id: "gb7714", name: "GB/T 7714", full_name: "GB/T 7714-2015 — Norma Nacional China",
    type: "numeric", biblatex_style: "gb7714-2015",
    disciplines: ["Todas las disciplinas (China)"],
    in_text_format: "[1]", bibliography_title: "参考文献 / References",
    description: "Norma nacional obligatoria para tesis en chino. Requerida en Tsinghua, Peking University, Fudan y todas las universidades chinas para tesis en idioma chino.",
    regions_primary: ["China — obligatorio"],
    builtin: true,
  },
];

const STYLES_LS_KEY = "texis_citation_styles_v1";

function loadStyles(): CitationStyle[] {
  try {
    const raw = localStorage.getItem(STYLES_LS_KEY);
    if (!raw) return BUILTIN_STYLES;
    const saved: CitationStyle[] = JSON.parse(raw);
    // merge: keep builtins that are missing, preserve order for saved ones
    const savedIds = new Set(saved.map((s) => s.id));
    const extra = BUILTIN_STYLES.filter((s) => !savedIds.has(s.id));
    return [...saved, ...extra];
  } catch {
    return BUILTIN_STYLES;
  }
}

function saveStyles(styles: CitationStyle[]) {
  localStorage.setItem(STYLES_LS_KEY, JSON.stringify(styles));
}

// ── Helpers de localización ───────────────────────────────────────────────────

const CONTINENT_LABEL: Record<string, string> = {
  america: "América", europe: "Europa", asia: "Asia", generic: "Genérico",
};
const CONTINENT_ABBR: Record<string, string> = {
  america: "AM", europe: "EU", asia: "AS", generic: "GN",
};
const CONTINENT_COLOR: Record<string, string> = {
  america: "#4338CA", europe: "#0369A1", asia: "#B45309", generic: "#4F7A68",
};
const COUNTRY_LABEL: Record<string, string> = {
  mexico: "México", usa: "Estados Unidos", canada: "Canadá",
  brazil: "Brasil", argentina: "Argentina", chile: "Chile",
  uk: "Reino Unido", germany: "Alemania", spain: "España",
  netherlands: "Países Bajos", italy: "Italia", sweden: "Suecia",
  france: "Francia",
  china: "China", japan: "Japón", south_korea: "Corea del Sur",
  singapore: "Singapur", india: "India",
  generic: "Genérico",
};

const TYPE_LABEL: Record<string, string> = {
  author_date: "Autor-Fecha", numeric: "Numérico",
  notes_bibliography: "Notas-Bibliog.", author_page: "Autor-Página",
};

// ── ProfileCard ───────────────────────────────────────────────────────────────

function ProfileCard({ profile, selected, onClick }: {
  profile: ProfileInfo; selected: boolean; onClick: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      background: selected ? "var(--accent-tint)" : "var(--bg-panel)",
      border: `1px solid ${selected ? "var(--accent)" : "var(--border-soft)"}`,
      boxShadow: selected ? "0 0 0 3px var(--accent-soft)" : "none",
      borderRadius: "var(--r-lg)", padding: 18,
      display: "flex", flexDirection: "column", gap: 10,
      cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
    }}>
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
        {profile.tags.map((t) => <span key={t} className="chip" style={{ fontSize: 10 }}>{t}</span>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)" }}>{profile.meta}</span>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{profile.sections_count ?? "?"} secciones</span>
      </div>
    </div>
  );
}

// ── ProfileDetailPanel ────────────────────────────────────────────────────────

function ProfileDetailPanel({ profile, onClose, onEdit, onUse, onExport, onDelete }: {
  profile: ProfileInfo; onClose: () => void; onEdit: () => void;
  onUse: () => void; onExport: () => void; onDelete: () => void;
}) {
  const sectionsByPlacement = (profile.sections ?? []).reduce<Record<string, ProfileSectionInfo[]>>(
    (acc, s) => { const k = s.placement; if (!acc[k]) acc[k] = []; acc[k].push(s); return acc; }, {}
  );
  const placementOrder = ["front_matter", "body", "back_matter", "appendix"];

  return (
    <div style={{ width: 320, flexShrink: 0, borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>Detalle del perfil</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onEdit} className="btn btn-ghost btn-sm" style={{ padding: "3px 8px" }}>
            <IconEdit size={12} /> Editar
          </button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}>
            <IconX size={14} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", fontWeight: 500, color: "var(--fg-strong)" }}>{profile.name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginBottom: 6 }}>{profile.id} · v{profile.version ?? "0.1.0"}</div>
          {profile.description && <p style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6, margin: 0 }}>{profile.description}</p>}
        </div>
        <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {[["Motor LaTeX", profile.latex_engine ?? "xelatex"], ["Bibliografía", profile.bibliography_style?.toUpperCase() ?? "APA"], ["Clase", profile.document_class ?? "book"], ["Autor", profile.author ?? "—"], ["Licencia", profile.license ?? "—"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{k}</span>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)", fontFamily: "var(--font-mono)" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 10 }}>
          Secciones ({profile.sections_count ?? profile.sections?.length ?? 0})
        </div>
        {placementOrder.map((placement) => {
          const secs = sectionsByPlacement[placement];
          if (!secs?.length) return null;
          return (
            <div key={placement} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: PLACEMENT_COLOR[placement] ?? "var(--fg-faint)", marginBottom: 6 }}>
                {PLACEMENT_LABEL[placement] ?? placement}
              </div>
              {secs.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", marginBottom: 4 }}>
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)" }}>{s.title ?? s.id}</span>
                  {s.required ? <span style={{ fontSize: 9, color: "var(--accent-deep)", fontWeight: 600 }}>requerida</span> : <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>opcional</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn btn-accent" style={{ width: "100%" }} onClick={onUse}><IconPlus size={13} /> Nuevo proyecto con este perfil</button>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn" style={{ flex: 1 }} onClick={onExport}><IconDownload size={13} /> Exportar</button>
          <button className="btn btn-ghost" style={{ padding: "6px 10px", color: "var(--build-err)" }} onClick={onDelete} title="Eliminar perfil"><IconTrash size={13} /></button>
        </div>
      </div>
    </div>
  );
}

// ── ProfileEditorPanel ────────────────────────────────────────────────────────

function ProfileEditorPanel({ profile, onSave, onCancel }: {
  profile: ProfileInfo; onSave: (updated: ProfileInfo) => void; onCancel: () => void;
}) {
  const [name, setName]               = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? "");
  const [author, setAuthor]           = useState(profile.author ?? "");
  const [version, setVersion]         = useState(profile.version ?? "0.1.0");
  const [license, setLicense]         = useState(profile.license ?? "");
  const [latexEngine, setLatexEngine] = useState(profile.latex_engine ?? "xelatex");
  const [docClass, setDocClass]       = useState(profile.document_class ?? "book");
  const [bibStyle, setBibStyle]       = useState(profile.bibliography_style ?? "apa");
  const [tagsRaw, setTagsRaw]         = useState((profile.tags ?? []).join(", "));
  const [sections, setSections]       = useState<ProfileSectionInfo[]>(profile.sections ?? []);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
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
  function removeSection(index: number) { setSections(sections.filter((_, i) => i !== index)); }
  function addSection() {
    const el = KNOWN_SECTION_ELEMENTS.find((e) => e.id === newSectionEl);
    if (!el) return;
    setSections([...sections, { id: el.id, element_id: el.id, placement: el.placement, required: false }]);
    setAddingSection(false);
  }
  async function handleSave() {
    if (!name.trim()) { setError("El nombre del perfil es requerido."); return; }
    setSaving(true); setError(null);
    const payload: ProfileUpdatePayload = {
      name: name.trim(), description: description.trim() || undefined, author: author.trim() || undefined,
      version: version.trim() || undefined, license: license.trim() || undefined,
      latex_engine: latexEngine, document_class: docClass, bibliography_style: bibStyle,
      bibliography_backend: bibStyle === "vancouver" ? "bibtex" : "biber",
      tags: tagsRaw.split(",").map((t) => t.trim()).filter(Boolean), sections,
    };
    try { const updated = await api.updateProfile(profile.id, payload); onSave(updated); }
    catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "6px 10px", borderRadius: "var(--r-sm)",
    border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
    fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontWeight: 500,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block",
  };
  const sectionLabel: React.CSSProperties = {
    fontSize: "var(--fs-xs)", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "var(--accent-deep)", marginBottom: 12,
  };

  return (
    <div style={{ width: 380, flexShrink: 0, borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>Editar perfil</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginLeft: 8 }}>{profile.id}</span>
        </div>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}><IconX size={14} /></button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">
        <div style={{ marginBottom: 18 }}>
          <div style={sectionLabel}>Metadatos</div>
          <div style={{ marginBottom: 10 }}><label style={labelStyle}>Nombre *</label><input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} /></div>
          <div style={{ marginBottom: 10 }}><label style={labelStyle}>Descripción</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div><label style={labelStyle}>Autor</label><input value={author} onChange={(e) => setAuthor(e.target.value)} style={fieldStyle} /></div>
            <div><label style={labelStyle}>Versión</label><input value={version} onChange={(e) => setVersion(e.target.value)} style={fieldStyle} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={labelStyle}>Licencia</label><input value={license} onChange={(e) => setLicense(e.target.value)} placeholder="p.ej. CC BY 4.0" style={fieldStyle} /></div>
          <div><label style={labelStyle}>Etiquetas (separadas por coma)</label><input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="tesis, licenciatura, apa" style={fieldStyle} /></div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={sectionLabel}>Configuración técnica</div>
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
              <option value="chicago-notes">Chicago 17 (Notas)</option>
              <option value="chicago-authordate">Chicago 17 (Autor-Fecha)</option>
              <option value="mla">MLA 9</option>
              <option value="mhra">MHRA</option>
              <option value="abnt">ABNT</option>
              <option value="gb7714">GB/T 7714</option>
            </select>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={sectionLabel}>Secciones ({sections.length})</div>
            <button className="btn btn-sm" onClick={() => setAddingSection(!addingSection)} style={{ fontSize: 11, padding: "3px 8px" }}><IconPlus size={11} /> Añadir</button>
          </div>
          {addingSection && (
            <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--accent-tint)", border: "1px solid var(--accent-soft)", marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={labelStyle}>Tipo de sección</label>
              <select value={newSectionEl} onChange={(e) => setNewSectionEl(e.target.value)} style={fieldStyle}>
                {KNOWN_SECTION_ELEMENTS.map((el) => <option key={el.id} value={el.id}>{el.label} ({PLACEMENT_LABEL[el.placement] ?? el.placement})</option>)}
              </select>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-accent btn-sm" style={{ flex: 1 }} onClick={addSection}><IconCheck size={11} sw={2.5} /> Añadir sección</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingSection(false)}>Cancelar</button>
              </div>
            </div>
          )}
          {sections.map((sec, i) => (
            <div key={`${sec.id}-${i}`} style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", marginBottom: 5, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: PLACEMENT_COLOR[sec.placement] ?? "var(--fg-faint)" }} />
                <span style={{ flex: 1, fontSize: "var(--fs-xs)", color: "var(--fg-strong)", fontFamily: "var(--font-mono)" }}>{sec.id}</span>
                <button onClick={() => moveSection(i, -1)} disabled={i === 0} style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "var(--fg-faint)" : "var(--fg-muted)", padding: "0 2px", fontSize: 12 }} title="Subir">▲</button>
                <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} style={{ background: "none", border: "none", cursor: i === sections.length - 1 ? "default" : "pointer", color: i === sections.length - 1 ? "var(--fg-faint)" : "var(--fg-muted)", padding: "0 2px", fontSize: 12 }} title="Bajar">▼</button>
                <button onClick={() => removeSection(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--build-err)", padding: "0 2px" }} title="Eliminar sección"><IconX size={11} /></button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select value={sec.placement} onChange={(e) => changePlacement(i, e.target.value)} style={{ ...fieldStyle, padding: "3px 6px", fontSize: 11, flex: 1 }}>
                  {["front_matter", "body", "back_matter", "appendix"].map((p) => <option key={p} value={p}>{PLACEMENT_LABEL[p]}</option>)}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--fg-muted)", cursor: "pointer", flexShrink: 0 }}>
                  <input type="checkbox" checked={sec.required} onChange={() => toggleRequired(i)} style={{ accentColor: "var(--accent)" }} />
                  requerida
                </label>
              </div>
            </div>
          ))}
          {sections.length === 0 && <div style={{ padding: "16px 0", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-xs)" }}>Sin secciones. Añade al menos una.</div>}
        </div>

        {error && <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--build-err-tint, #ffeded)", color: "var(--build-err)", fontSize: "var(--fs-xs)", border: "1px solid var(--build-err)" }}>{error}</div>}
      </div>

      <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
        <button className="btn btn-accent" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
          {saving ? "Guardando…" : <><IconCheck size={13} sw={2} /> Guardar cambios</>}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancelar</button>
      </div>
    </div>
  );
}

// ── ElementsTab ───────────────────────────────────────────────────────────────

function ElementsTab() {
  const [selected, setSelected] = useState<string | null>(null);
  const sel = BLOCK_CATALOG.find((b) => b.type === selected);
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }} className="scroll">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>Elementos</h1>
          <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>Bloques de contenido disponibles en el editor. Haz clic para ver el detalle.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {BLOCK_CATALOG.map((b) => (
            <div key={b.type} onClick={() => setSelected(b.type === selected ? null : b.type)} style={{ background: selected === b.type ? "var(--accent-tint)" : "var(--bg-panel)", border: `1px solid ${selected === b.type ? "var(--accent)" : "var(--border-soft)"}`, boxShadow: selected === b.type ? "0 0 0 3px var(--accent-soft)" : "none", borderRadius: "var(--r-lg)", padding: 16, cursor: "pointer", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "var(--r-md)", background: selected === b.type ? "var(--accent)" : "var(--ink-100)", color: selected === b.type ? "white" : "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>{b.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", marginBottom: 3 }}>{b.name}</div>
                <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>{b.description}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {b.tags.map((t) => <span key={t} className="chip" style={{ fontSize: 9 }}>{t}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {sel && (
        <div style={{ width: 280, flexShrink: 0, borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", padding: 20, overflow: "auto" }} className="scroll">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 28, height: 28, borderRadius: "var(--r-md)", background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>{sel.icon}</div>
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{sel.name}</span>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)" }}><IconX size={13} /></button>
          </div>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 14 }}>{sel.description}</p>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 6 }}>Salida LaTeX</div>
            <div style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-app)", border: "1px solid var(--border-firm)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-default)", lineHeight: 1.6 }}>{sel.latex_output}</div>
          </div>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 6 }}>Tipo interno</div>
          <span className="chip tx-mono" style={{ fontSize: 11 }}>{sel.type}</span>
        </div>
      )}
    </div>
  );
}

// ── StylesTab ─────────────────────────────────────────────────────────────────

function StylesTab() {
  const [styles, setStyles]           = useState<CitationStyle[]>(loadStyles);
  const [selected, setSelected]       = useState<CitationStyle | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [editingCustom, setEditingCustom] = useState<CitationStyle | null>(null);
  const [search, setSearch]           = useState("");

  // New/edit form state
  const emptyForm = { id: "", name: "", full_name: "", type: "author_date" as const, biblatex_style: "", in_text_format: "", bibliography_title: "References", description: "", disciplines: "" };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  useEffect(() => { saveStyles(styles); }, [styles]);

  function moveStyle(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= styles.length) return;
    const arr = [...styles];
    [arr[index], arr[next]] = [arr[next], arr[index]];
    setStyles(arr);
  }

  function openAdd() {
    setForm(emptyForm);
    setFormError("");
    setEditingCustom(null);
    setAddingCustom(true);
  }

  function openEdit(style: CitationStyle) {
    setForm({
      id: style.id, name: style.name, full_name: style.full_name,
      type: style.type as typeof emptyForm.type, biblatex_style: style.biblatex_style,
      in_text_format: style.in_text_format, bibliography_title: style.bibliography_title,
      description: style.description, disciplines: style.disciplines.join(", "),
    });
    setFormError("");
    setEditingCustom(style);
    setAddingCustom(true);
  }

  function submitForm() {
    if (!form.id.trim() || !form.name.trim() || !form.biblatex_style.trim()) {
      setFormError("ID, Nombre y Estilo biblatex son obligatorios."); return;
    }
    if (!editingCustom && styles.some((s) => s.id === form.id.trim())) {
      setFormError("Ya existe un estilo con ese ID."); return;
    }
    const newStyle: CitationStyle = {
      id: form.id.trim(), name: form.name.trim(), full_name: form.full_name.trim() || form.name.trim(),
      type: form.type, biblatex_style: form.biblatex_style.trim(),
      in_text_format: form.in_text_format.trim() || "(Autor, Año)",
      bibliography_title: form.bibliography_title.trim() || "References",
      description: form.description.trim(),
      disciplines: form.disciplines.split(",").map((s) => s.trim()).filter(Boolean),
      builtin: false,
    };
    if (editingCustom) {
      setStyles(styles.map((s) => s.id === editingCustom.id ? newStyle : s));
      if (selected?.id === editingCustom.id) setSelected(newStyle);
    } else {
      setStyles([...styles, newStyle]);
    }
    setAddingCustom(false);
    setEditingCustom(null);
  }

  function deleteCustom(style: CitationStyle) {
    setStyles(styles.filter((s) => s.id !== style.id));
    if (selected?.id === style.id) setSelected(null);
  }

  function resetToDefaults() {
    if (!window.confirm("¿Restaurar el orden y estilos predeterminados? Se perderán los estilos personalizados.")) return;
    saveStyles(BUILTIN_STYLES);
    setStyles(BUILTIN_STYLES);
    setSelected(null);
  }

  const filtered = styles.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.disciplines.some((d) => d.toLowerCase().includes(search.toLowerCase()))
  );

  const fieldStyle: React.CSSProperties = { width: "100%", padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Main list */}
      <div style={{ flex: 1, overflow: "auto", padding: "32px 40px" }} className="scroll">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>Estilos bibliográficos</h1>
            <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>
              Biblioteca de estilos de cita. Independiente de cualquier proyecto. Reordena, añade o personaliza.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={resetToDefaults} title="Restaurar predeterminados" style={{ fontSize: 11 }}>
              <IconRefresh size={12} /> Restaurar
            </button>
            <button className="btn btn-accent btn-sm" onClick={openAdd}>
              <IconPlus size={13} /> Añadir estilo
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 380, marginBottom: 20 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o disciplina…" style={{ width: "100%", padding: "7px 12px 7px 32px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none" }} />
        </div>

        {/* Styles list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((style, idx) => {
            const realIdx = styles.indexOf(style);
            const isSelected = selected?.id === style.id;
            return (
              <div
                key={style.id}
                onClick={() => setSelected(isSelected ? null : style)}
                style={{
                  background: isSelected ? "var(--accent-tint)" : "var(--bg-panel)",
                  border: `1px solid ${isSelected ? "var(--accent)" : "var(--border-soft)"}`,
                  borderRadius: "var(--r-lg)", padding: "12px 14px",
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
              >
                {/* Drag order number */}
                <div style={{ width: 22, height: 22, borderRadius: "var(--r-sm)", flexShrink: 0, background: isSelected ? "var(--accent)" : "var(--ink-100)", color: isSelected ? "white" : "var(--fg-faint)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  {idx + 1}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>{style.name}</span>
                    <span className="chip" style={{ fontSize: 9, background: style.builtin ? "var(--accent-tint)" : "var(--detail-tint)", color: style.builtin ? "var(--accent-deep)" : "var(--detail-deep)" }}>
                      {style.builtin ? "integrado" : "personalizado"}
                    </span>
                    <span className="chip" style={{ fontSize: 9 }}>{TYPE_LABEL[style.type] ?? style.type}</span>
                  </div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                    biblatex: {style.biblatex_style} · cita: {style.in_text_format}
                  </div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 2 }}>
                    {style.disciplines.slice(0, 3).join(", ")}{style.disciplines.length > 3 ? ` +${style.disciplines.length - 3}` : ""}
                  </div>
                </div>

                {/* Order controls */}
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); moveStyle(realIdx, -1); }} disabled={realIdx === 0} style={{ background: "none", border: "none", cursor: realIdx === 0 ? "default" : "pointer", color: realIdx === 0 ? "var(--fg-faint)" : "var(--fg-muted)", padding: "2px 4px", fontSize: 13 }} title="Subir">▲</button>
                  <button onClick={(e) => { e.stopPropagation(); moveStyle(realIdx, 1); }} disabled={realIdx === styles.length - 1} style={{ background: "none", border: "none", cursor: realIdx === styles.length - 1 ? "default" : "pointer", color: realIdx === styles.length - 1 ? "var(--fg-faint)" : "var(--fg-muted)", padding: "2px 4px", fontSize: 13 }} title="Bajar">▼</button>
                  {!style.builtin && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(style); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted)", padding: "2px 4px" }} title="Editar"><IconEdit size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteCustom(style); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--build-err)", padding: "2px 4px" }} title="Eliminar"><IconTrash size={12} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "16px 0", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", borderTop: "1px solid var(--border-subtle)", marginTop: 12 }}>
          {styles.length} estilos · {styles.filter((s) => !s.builtin).length} personalizados · el orden se guarda automáticamente
        </div>
      </div>

      {/* Detail / Form panel */}
      <div style={{ width: 340, flexShrink: 0, borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {addingCustom ? (
          <>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>{editingCustom ? "Editar estilo" : "Nuevo estilo"}</span>
              <button onClick={() => setAddingCustom(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}><IconX size={14} /></button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">
              {[
                { key: "id",           label: "ID *",                  placeholder: "mi_estilo_v1" },
                { key: "name",         label: "Nombre *",              placeholder: "Mi Estilo" },
                { key: "full_name",    label: "Nombre completo",       placeholder: "Mi Estilo — Organización, Año" },
                { key: "biblatex_style", label: "Estilo biblatex *",   placeholder: "apa" },
                { key: "in_text_format", label: "Formato en texto",    placeholder: "(Autor, Año)" },
                { key: "bibliography_title", label: "Título de referencias", placeholder: "References" },
                { key: "disciplines",  label: "Disciplinas (comas)",   placeholder: "Historia, Sociología" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>{label}</label>
                  <input
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    style={fieldStyle}
                    disabled={editingCustom !== null && key === "id"}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Tipo</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} style={fieldStyle}>
                  <option value="author_date">Autor-Fecha</option>
                  <option value="numeric">Numérico</option>
                  <option value="notes_bibliography">Notas-Bibliografía</option>
                  <option value="author_page">Autor-Página</option>
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>Descripción</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
              </div>
              {formError && <div style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--build-err-tint, #ffeded)", color: "var(--build-err)", fontSize: "var(--fs-xs)", border: "1px solid var(--build-err)" }}>{formError}</div>}
            </div>
            <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
              <button className="btn btn-accent" style={{ flex: 1 }} onClick={submitForm}><IconCheck size={13} sw={2} /> {editingCustom ? "Guardar" : "Añadir"}</button>
              <button className="btn btn-ghost" onClick={() => setAddingCustom(false)}>Cancelar</button>
            </div>
          </>
        ) : selected ? (
          <>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>Detalle del estilo</span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}><IconX size={14} /></button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", fontWeight: 500, color: "var(--fg-strong)" }}>{selected.name}</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 8 }}>{selected.full_name}</div>
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6, margin: 0 }}>{selected.description || "Sin descripción."}</p>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {[["Tipo", TYPE_LABEL[selected.type] ?? selected.type], ["Biblatex", selected.biblatex_style], ["En texto", selected.in_text_format], ["Título refs", selected.bibliography_title]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{k}</span>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)", fontFamily: "var(--font-mono)" }}>{v}</span>
                  </div>
                ))}
              </div>
              {selected.disciplines.length > 0 && (
                <>
                  <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 8 }}>Disciplinas</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
                    {selected.disciplines.map((d) => <span key={d} className="chip" style={{ fontSize: 10 }}>{d}</span>)}
                  </div>
                </>
              )}
              {selected.regions_primary && (
                <>
                  <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 8 }}>Regiones principales</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {selected.regions_primary.map((r) => <span key={r} className="chip" style={{ fontSize: 10, background: "var(--detail-tint)", color: "var(--detail-deep)" }}>{r}</span>)}
                  </div>
                </>
              )}
            </div>
            {!selected.builtin && (
              <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => openEdit(selected)}><IconEdit size={13} /> Editar</button>
                <button className="btn btn-ghost" style={{ padding: "6px 10px", color: "var(--build-err)" }} onClick={() => deleteCustom(selected)} title="Eliminar estilo"><IconTrash size={13} /></button>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 24, color: "var(--fg-faint)", textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "var(--r-lg)", background: "var(--ink-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-faint)" }}><IconLayers size={20} /></div>
            <div style={{ fontSize: "var(--fs-sm)" }}>Selecciona un estilo para ver el detalle</div>
            <div style={{ fontSize: "var(--fs-xs)", lineHeight: 1.6 }}>
              Usa ▲▼ para cambiar el orden.<br />El orden determina el menú desplegable al crear un proyecto.
            </div>
            <button className="btn btn-accent btn-sm" onClick={openAdd} style={{ marginTop: 8 }}><IconPlus size={13} /> Añadir estilo personalizado</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CommunityTab ──────────────────────────────────────────────────────────────

const CATALOG_URL = "https://github.com/GonzaloAndDev/TeXisStudio-Profiles/releases/latest/download/catalog.json";

interface CatalogProfile {
  id: string; name: string; description?: string; author?: string;
  tags: string[]; continent: string; country: string;
  institution?: string; city?: string;
  bibliography_style?: string; download_url: string; version?: string;
  sha256?: string;
}

function CommunityTab({ installedIds, onInstalled }: {
  installedIds: Set<string>;
  onInstalled: (profile: ProfileInfo) => void;
}) {
  const [catalog, setCatalog]       = useState<CatalogProfile[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError]     = useState<string | null>(null);
  const [catLoaded, setCatLoaded]   = useState(false);

  const [navContinent, setNavContinent] = useState<string | null>(null);
  const [navCountry, setNavCountry]     = useState<string | null>(null);

  const [downloading, setDownloading] = useState<string | null>(null);
  const [opError, setOpError]         = useState<string | null>(null);
  const [opSuccess, setOpSuccess]     = useState<string | null>(null);
  const [customUrl, setCustomUrl]     = useState("");
  const [fetchingCustom, setFetchingCustom] = useState(false);
  const [search, setSearch]           = useState("");

  async function fetchCatalog() {
    setCatLoading(true); setCatError(null);
    try {
      const res = await fetch(CATALOG_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCatalog(data.profiles ?? []);
      setCatLoaded(true);
    } catch (e) {
      setCatError(`No se pudo cargar el catálogo: ${e}. Verifica tu conexión.`);
    } finally {
      setCatLoading(false);
    }
  }

  useEffect(() => { fetchCatalog(); }, []);

  async function handleInstall(cp: CatalogProfile) {
    setDownloading(cp.id); setOpError(null); setOpSuccess(null);
    try {
      const installed = await api.fetchRemoteProfile(cp.download_url, cp.sha256);
      onInstalled(installed);
      setOpSuccess(`✓ "${installed.name}" instalado correctamente.`);
    } catch (e) { setOpError(String(e)); }
    finally { setDownloading(null); }
  }

  async function handleCustomUrl() {
    const url = customUrl.trim();
    if (!url) return;
    setFetchingCustom(true); setOpError(null); setOpSuccess(null);
    try {
      const installed = await api.fetchRemoteProfile(url);
      onInstalled(installed);
      setOpSuccess(`✓ "${installed.name}" instalado correctamente.`);
      setCustomUrl("");
    } catch (e) { setOpError(String(e)); }
    finally { setFetchingCustom(false); }
  }

  // Build hierarchy from catalog
  const continents = [...new Set(catalog.map((p) => p.continent))].sort();
  const countriesInContinent = (continent: string) =>
    [...new Set(catalog.filter((p) => p.continent === continent).map((p) => p.country))].sort();
  const profilesInCountry = (continent: string, country: string) =>
    catalog.filter((p) => p.continent === continent && p.country === country);

  // Search flattens everything
  const searchResults = search.trim()
    ? catalog.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        (p.institution ?? "").toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : [];

  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  // Profile card for community
  const renderProfileCard = (cp: CatalogProfile) => {
    const isInstalled = installedIds.has(cp.id);
    const isDownloading = downloading === cp.id;
    return (
      <div key={cp.id} style={{ background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", flexShrink: 0, background: isInstalled ? "var(--detail-tint)" : "var(--ink-100)", color: isInstalled ? "var(--detail)" : "var(--fg-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isInstalled ? <IconCheck size={16} sw={2.5} /> : <IconBook size={16} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>{cp.name}</span>
          </div>
          {cp.institution && <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginBottom: 4 }}>{cp.institution}{cp.city ? ` · ${cp.city}` : ""}</div>}
          {cp.description && <p style={{ margin: "0 0 6px", fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>{cp.description}</p>}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            {cp.bibliography_style && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>{cp.bibliography_style.toUpperCase()}</span>}
            {cp.tags.slice(0, 4).map((t) => <span key={t} className="chip" style={{ fontSize: 9 }}>{t}</span>)}
          </div>
        </div>
        <div style={{ flexShrink: 0, alignSelf: "center" }}>
          {isInstalled ? (
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--detail)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IconCheck size={12} sw={2.5} /> Instalado</span>
          ) : (
            <button className="btn btn-sm btn-accent" onClick={() => handleInstall(cp)} disabled={isDownloading} style={{ minWidth: 90 }}>
              {isDownloading ? <><IconRefresh size={12} /> …</> : <><IconDownload size={12} /> Instalar</>}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "32px 48px" }} className="scroll">
      <div style={{ maxWidth: 740 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>Comunidad</h1>
            <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>Perfiles verificados por institución. Requiere conexión a internet.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={fetchCatalog} disabled={catLoading} style={{ flexShrink: 0 }}><IconRefresh size={12} /> {catLoading ? "Cargando…" : "Actualizar"}</button>
        </div>

        {!isTauri && (
          <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--accent-tint)", border: "1px solid var(--accent-soft)", fontSize: "var(--fs-sm)", color: "var(--accent-deep)", marginBottom: 16 }}>
            ℹ La descarga real solo funciona en la app de escritorio. En el navegador se simula.
          </div>
        )}

        {opError && <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--build-err-tint, #ffeded)", border: "1px solid var(--build-err)", color: "var(--build-err)", fontSize: "var(--fs-sm)", marginBottom: 14 }}>{opError}</div>}
        {opSuccess && <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--build-ok-tint, #edfff3)", border: "1px solid var(--build-ok)", color: "var(--build-ok)", fontSize: "var(--fs-sm)", marginBottom: 14 }}>{opSuccess}</div>}
        {catError && <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", background: "var(--build-err-tint, #ffeded)", border: "1px solid var(--build-err)", color: "var(--build-err)", fontSize: "var(--fs-sm)", marginBottom: 14 }}>{catError}</div>}

        {/* Search bar */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setNavContinent(null); setNavCountry(null); }} placeholder="Buscar institución, país, estilo…" style={{ width: "100%", padding: "7px 12px 7px 32px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none", boxSizing: "border-box" }} />
          {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}><IconX size={12} /></button>}
        </div>

        {/* Search results */}
        {search.trim() ? (
          <div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 12 }}>{searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""} para «{search}»</div>
            {searchResults.length === 0
              ? <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "20px 0" }}>Sin resultados. Intenta con otro término.</div>
              : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{searchResults.map(renderProfileCard)}</div>
            }
          </div>
        ) : catLoading ? (
          <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0", textAlign: "center" }}>Cargando catálogo…</div>
        ) : catLoaded && catalog.length === 0 ? (
          <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "20px 0" }}>El catálogo está vacío.</div>
        ) : catLoaded ? (
          <>
            {/* Breadcrumb */}
            {(navContinent || navCountry) && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
                <span style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => { setNavContinent(null); setNavCountry(null); }}>Todos</span>
                {navContinent && (
                  <>
                    <span>›</span>
                    <span style={{ cursor: navCountry ? "pointer" : "default", color: navCountry ? "var(--accent)" : "var(--fg-strong)", fontWeight: navCountry ? 400 : 500 }} onClick={() => { if (navCountry) setNavCountry(null); }}>{CONTINENT_LABEL[navContinent] ?? navContinent}</span>
                  </>
                )}
                {navCountry && (
                  <>
                    <span>›</span>
                    <span style={{ color: "var(--fg-strong)", fontWeight: 500 }}>{COUNTRY_LABEL[navCountry] ?? navCountry}</span>
                  </>
                )}
              </div>
            )}

            {/* Continent view */}
            {!navContinent && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
                {continents.map((continent) => {
                  const count = catalog.filter((p) => p.continent === continent).length;
                  const color = CONTINENT_COLOR[continent] ?? "var(--accent)";
                  return (
                    <div key={continent} onClick={() => setNavContinent(continent)}
                      style={{ background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", padding: "18px 16px", cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 0 0 3px ${color}22`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-soft)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: `${color}18`, color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                        <IconMap size={16} />
                      </div>
                      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 2 }}>{CONTINENT_LABEL[continent] ?? continent}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{count} perfiles</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color, fontWeight: 700, background: `${color}14`, padding: "1px 5px", borderRadius: "var(--r-xs)" }}>{CONTINENT_ABBR[continent] ?? continent.slice(0,2).toUpperCase()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Country view */}
            {navContinent && !navCountry && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 32 }}>
                {countriesInContinent(navContinent).map((country) => {
                  const count = profilesInCountry(navContinent, country).length;
                  const color = CONTINENT_COLOR[navContinent] ?? "var(--accent)";
                  return (
                    <div key={country} onClick={() => setNavCountry(country)}
                      style={{ background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-lg)", padding: "14px 14px", cursor: "pointer", transition: "border-color 0.15s", display: "flex", alignItems: "center", gap: 10 }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-soft)"; }}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: "var(--r-sm)", background: `${color}14`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <IconBuilding size={13} />
                      </div>
                      <div>
                        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{COUNTRY_LABEL[country] ?? country}</div>
                        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{count} perfiles</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Profile list view */}
            {navContinent && navCountry && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                {profilesInCountry(navContinent, navCountry).map(renderProfileCard)}
              </div>
            )}
          </>
        ) : null}

        {/* Custom URL */}
        <div style={{ padding: "20px 22px", borderRadius: "var(--r-lg)", border: "1px dashed var(--border-firm)", background: "var(--bg-panel)", marginTop: 16 }}>
          <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", marginBottom: 6 }}>Instalar desde URL</div>
          <p style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
            Pega la URL de un <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--bg-app)", padding: "1px 4px", borderRadius: 3 }}>.zip</code> que contenga un <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--bg-app)", padding: "1px 4px", borderRadius: 3 }}>profile.yaml</code> válido.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://github.com/.../download/mi_perfil.zip" style={{ flex: 1, padding: "7px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-app)", fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none", fontFamily: "var(--font-mono)" }} onKeyDown={(e) => { if (e.key === "Enter") handleCustomUrl(); }} />
            <button className="btn btn-accent btn-sm" onClick={handleCustomUrl} disabled={!customUrl.trim() || fetchingCustom}>
              {fetchingCustom ? <><IconRefresh size={12} /> …</> : <><IconDownload size={12} /> Instalar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── LibraryView ───────────────────────────────────────────────────────────────

type LibTab = "profiles" | "community" | "styles" | "elements";

export default function LibraryView() {
  const navigate = useNavigate();
  const [profiles, setProfiles]     = useState<ProfileInfo[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [tab, setTab]               = useState<LibTab>("profiles");
  const [selected, setSelected]     = useState<ProfileInfo | null>(null);
  const [editing, setEditing]       = useState(false);
  const [importing, setImporting]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProfileInfo | null>(null);

  useEffect(() => {
    api.getProfiles()
      .then((p) => { setProfiles(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = profiles.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.tags.some((t) => t.includes(search.toLowerCase()))
  );

  async function handleImport() {
    setImporting(true);
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const result = await open({ directory: true, multiple: false, title: "Selecciona el directorio del perfil" });
      const src = Array.isArray(result) ? result[0] : result;
      if (!src) { setImporting(false); return; }
      const imported = await api.importProfile(src);
      setProfiles((prev) => [...prev, imported]);
      setSelected(imported);
      alert(`✓ Perfil '${imported.name}' importado correctamente.`);
    } catch (e) { alert(`Error al importar: ${e}`); }
    finally { setImporting(false); }
  }

  async function handleExport(profile: ProfileInfo) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const dest = await open({ directory: true, multiple: false, title: "Selecciona la carpeta de destino" });
      const destPath = Array.isArray(dest) ? dest[0] : dest;
      if (!destPath) return;
      const result = await api.exportProfile(profile.id, destPath);
      alert(`✓ Perfil exportado en:\n${result.exported_to}`);
    } catch (e) { alert(`Error al exportar: ${e}`); }
  }

  async function handleDelete(profile: ProfileInfo) {
    setConfirmDelete(null);
    try {
      await api.deleteProfile(profile.id);
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      if (selected?.id === profile.id) setSelected(null);
    } catch (e) { alert(`Error al eliminar: ${e}`); }
  }

  function handleSaveEdit(updated: ProfileInfo) {
    setProfiles((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setSelected(updated); setEditing(false);
  }

  function handleUseProfile(profile: ProfileInfo) {
    navigate(`/new?profile=${encodeURIComponent(profile.id)}`);
  }

  const TABS: { id: LibTab; label: string; icon: React.ReactNode }[] = [
    { id: "profiles",  label: "Perfiles",  icon: <IconFolder size={13} /> },
    { id: "community", label: "Comunidad", icon: <IconGlobe size={13} /> },
    { id: "styles",    label: "Estilos",   icon: <IconLayers size={13} /> },
    { id: "elements",  label: "Elementos", icon: <IconGrid size={13} /> },
  ];

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ Biblioteca</span></>}
        center={null}
        right={<button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>← Inicio</button>}
      />

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-chrome)", borderRadius: "var(--r-lg)", padding: 24, maxWidth: 380, width: "90%", border: "1px solid var(--border-firm)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontWeight: 600, color: "var(--fg-strong)" }}>¿Eliminar perfil?</div>
            <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
              Se eliminará <strong>{confirmDelete.name}</strong> ({confirmDelete.id}). Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn" style={{ background: "var(--build-err)", color: "white", border: "none" }} onClick={() => handleDelete(confirmDelete)}><IconTrash size={13} /> Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)" }}>
        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", padding: "20px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map(({ id, label, icon }) => (
            <div key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: "var(--r-md)", cursor: "pointer", fontSize: "var(--fs-base)", background: tab === id ? "var(--bg-selected)" : "transparent", color: tab === id ? "var(--accent-deep)" : "var(--fg-default)", fontWeight: tab === id ? 500 : 400 }}>
              {icon} {label}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ padding: "10px", borderRadius: "var(--r-md)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: "var(--fg-muted)", marginBottom: 3 }}>Release 1.0</div>
            {profiles.length} perfiles · {BLOCK_CATALOG.length} elementos
          </div>
        </div>

        {/* Profiles tab */}
        {tab === "profiles" && (
          <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
            <div style={{ flex: 1, overflow: "auto", padding: "32px 40px" }} className="scroll">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>Perfiles instalados</h1>
                  <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>{loading ? "Cargando…" : `${profiles.length} perfiles · haz clic para ver detalle`}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-sm" onClick={handleImport} disabled={importing} title="Importar perfil desde directorio"><IconUpload size={13} /> {importing ? "Importando…" : "Importar"}</button>
                  <button className="btn btn-sm" onClick={() => navigate("/new-profile")} title="Crear un perfil propio"><IconPlus size={13} /> Crear perfil</button>
                  <button className="btn btn-accent btn-sm" onClick={() => navigate("/new")}><IconPlus size={13} /> Nuevo proyecto</button>
                </div>
              </div>
              <div style={{ position: "relative", maxWidth: 380, marginBottom: 24 }}>
                <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o etiqueta…" style={{ width: "100%", padding: "7px 12px 7px 32px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none" }} />
              </div>
              {loading ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0" }}>Cargando perfiles…</div>
              ) : filtered.length === 0 ? (
                <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-sm)", padding: "40px 0", textAlign: "center" }}>No se encontraron perfiles para «{search}»</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                  {filtered.map((p) => (
                    <ProfileCard key={p.id} profile={p} selected={selected?.id === p.id} onClick={() => { if (editing && selected?.id === p.id) return; setEditing(false); setSelected(selected?.id === p.id ? null : p); }} />
                  ))}
                </div>
              )}
            </div>
            {selected && !editing && <ProfileDetailPanel profile={selected} onClose={() => setSelected(null)} onEdit={() => setEditing(true)} onUse={() => handleUseProfile(selected)} onExport={() => handleExport(selected)} onDelete={() => setConfirmDelete(selected)} />}
            {selected && editing && <ProfileEditorPanel profile={selected} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />}
          </div>
        )}

        {tab === "community" && (
          <CommunityTab
            installedIds={new Set(profiles.map((p) => p.id))}
            onInstalled={(p) => { setProfiles((prev) => { const exists = prev.some((x) => x.id === p.id); return exists ? prev : [...prev, p]; }); }}
          />
        )}

        {tab === "styles" && <StylesTab />}

        {tab === "elements" && <ElementsTab />}
      </div>

      <TxStatusbar items={[
        { text: `${profiles.length} perfiles instalados` },
        { icon: <IconUpload size={11} />, text: "Importar" },
        { right: true, text: "TeXisStudio 1.0.0" },
      ]} />
    </>
  );
}
