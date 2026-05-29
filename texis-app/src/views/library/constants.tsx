import { IconCode, IconDoc, IconHeading, IconImage, IconList, IconSigma, IconTable, IconText } from "../../components/Icons";

// Constantes y helpers compartidos entre los sub-componentes de LibraryView

// Constantes y helpers compartidos entre los sub-componentes de LibraryView

// ── Catálogo de elementos ──────────────────────────────────────────────────────

export const BLOCK_CATALOG = [
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

export const PLACEMENT_LABEL: Record<string, string> = {
  front_matter: "Preliminares", body: "Cuerpo", back_matter: "Material final", appendix: "Anexos",
};
export const PLACEMENT_COLOR: Record<string, string> = {
  front_matter: "var(--accent)", body: "#3AA396", back_matter: "#7C6EAF", appendix: "var(--fg-muted)",
};

export const KNOWN_SECTION_ELEMENTS = [
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

export const BUILTIN_STYLES: CitationStyle[] = [
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

export const STYLES_LS_KEY = "texis_citation_styles_v1";

export function loadStyles(): CitationStyle[] {
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

export function saveStyles(styles: CitationStyle[]) {
  localStorage.setItem(STYLES_LS_KEY, JSON.stringify(styles));
}

// ── Helpers de localización ───────────────────────────────────────────────────

export const CONTINENT_LABEL: Record<string, string> = {
  america: "América", europe: "Europa", asia: "Asia", generic: "Genérico",
};
export const CONTINENT_ABBR: Record<string, string> = {
  america: "AM", europe: "EU", asia: "AS", generic: "GN",
};
export const CONTINENT_COLOR: Record<string, string> = {
  america: "#4338CA", europe: "#0369A1", asia: "#B45309", generic: "#4F7A68",
};
export const COUNTRY_LABEL: Record<string, string> = {
  mexico: "México", usa: "Estados Unidos", canada: "Canadá",
  brazil: "Brasil", argentina: "Argentina", chile: "Chile",
  uk: "Reino Unido", germany: "Alemania", spain: "España",
  netherlands: "Países Bajos", italy: "Italia", sweden: "Suecia",
  france: "Francia",
  china: "China", japan: "Japón", south_korea: "Corea del Sur",
  singapore: "Singapur", india: "India",
  generic: "Genérico",
};

export const TYPE_LABEL: Record<string, string> = {
  author_date: "Autor-Fecha", numeric: "Numérico",
  notes_bibliography: "Notas-Bibliog.", author_page: "Autor-Página",
};

export const ACADEMIC_LEVEL_LABEL: Record<string, string> = {
  bachillerato: "Bachillerato",
  tecnico: "Técnico",
  licenciatura: "Licenciatura",
  especialidad: "Especialidad",
  maestria: "Maestría",
  doctorado: "Doctorado",
  posdoctorado: "Posdoctorado",
};

export const PROFILE_SCOPE_LABEL: Record<string, string> = {
  institutional: "Institucional",
  degree_specific: "Por grado",
  program_specific: "Por programa",
  discipline_specific: "Por área",
};

export const DISCIPLINE_LABEL: Record<string, string> = {
  all_disciplines: "Todas las disciplinas",
  engineering: "Ingeniería",
  social_sciences: "Ciencias sociales",
  humanities: "Humanidades",
  health_sciences: "Ciencias de la salud",
  computing: "Computación",
  natural_sciences: "Ciencias naturales",
};

