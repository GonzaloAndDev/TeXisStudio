import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBook, IconCheck, IconChevronL, IconChevronR, IconFile, IconInfo,
} from "../components/Icons";
import { api } from "../lib/tauri";
import { useProjectStore } from "../stores/project";
import { useSettingsStore } from "../stores/settings";
import { useLangPacksStore } from "../stores/languagePacks";
import { useVocabPacksStore } from "../stores/vocabularyPacks";
import { ensureProfileLocale, localizeProfiles } from "../services/profile-i18n";
import type { AcademicLevel, CloudFolder, LangPackEntry, ProfileInfo, ProfileStatus, VocabPackEntry } from "../types";
import { ProfileStatusBadge } from "../components/ProfileStatusBadge";

import { documentDir } from "@tauri-apps/api/path";

async function resolveDocumentsPath(): Promise<string> {
  try {
    return await documentDir();
  } catch {
    return "/tmp";
  }
}

type StepState = "done" | "active" | "todo";

function getBuiltinProfiles(t: TFunction): ProfileInfo[] {
  return [
    {
      id: "generic.thesis",
      name: t("wizard.builtin_thesis_name"),
      description: t("wizard.builtin_thesis_desc"),
      meta: t("wizard.builtin_thesis_meta"),
      tags: ["tesis", "licenciatura", "especialidad", "maestria", "doctorado", "posdoctorado"],
      sections_count: 13,
      sections: [],
      author: "Gonzalo Andrade Estrella",
      version: "0.1.0",
      status: "draft" as ProfileStatus,
    },
    {
      id: "generic.tesina",
      name: t("wizard.builtin_tesina_name"),
      description: t("wizard.builtin_tesina_desc"),
      meta: t("wizard.builtin_tesina_meta"),
      tags: ["tesina", "licenciatura"],
      sections_count: 6,
      sections: [],
      author: "Gonzalo Andrade Estrella",
      version: "0.1.0",
      status: "draft" as ProfileStatus,
    },
  ];
}

const ACADEMIC_LEVEL_OPTIONS: Array<{ id: AcademicLevel; label: string }> = [
  { id: "licenciatura", label: "Licenciatura" },
  { id: "especialidad", label: "Especialidad" },
  { id: "maestria", label: "Maestría" },
  { id: "doctorado", label: "Doctorado" },
  { id: "posdoctorado", label: "Posdoctorado" },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

// ── Matriz disciplinaria ──────────────────────────────────────────────────────

type DisciplineSupport = {
  native: string[];    // qué produce TeXisStudio directamente
  external: string[];  // qué conviene integrar como asset externo
  tip?: string;
};

const DISCIPLINE_MATRIX: Record<string, DisciplineSupport> = {
  // Matemáticas / Lógica
  matematicas: {
    native: ["Ecuaciones numeradas \\eqref{}", "Teoremas y demostraciones", "Matrices y vectores", "Diagramas conmutativos (tikz-cd)", "Árboles de prueba (bussproofs)"],
    external: [],
    tip: "LaTeX es la herramienta canónica para matemáticas formales.",
  },
  logica: {
    native: ["Árboles de deducción (bussproofs)", "Tablas de verdad", "Semántica formal", "Diagramas de Hasse"],
    external: [],
  },
  // Física
  fisica: {
    native: ["Unidades físicas \\SI{} (siunitx)", "Derivadas parciales \\pdv{}", "Diagramas de Feynman (tikz-feynman)", "Gráficas (pgfplots)"],
    external: ["Simulaciones numéricas (exportar como PDF/PNG)"],
    tip: "Usa siunitx para todas las unidades — nunca escribir 'km/h' directo.",
  },
  // Química
  quimica: {
    native: ["Reacciones químicas \\ce{} (mhchem)", "Estructuras moleculares (chemfig)", "Unidades \\SI{} (siunitx)"],
    external: ["Estructuras 3D complejas (exportar desde ChemDraw como PDF)"],
    tip: "Para estructuras sencillas usa chemfig. Para cristalografía o proteínas, importa como PDF.",
  },
  // Ingeniería
  ingenieria: {
    native: ["Unidades \\SI{} (siunitx)", "Circuitos (circuitikz)", "Gráficas de datos (pgfplots)", "Algoritmos (algpseudocode)"],
    external: ["Planos técnicos (AutoCAD → PDF)", "Esquemas PCB (KiCad → PDF)"],
    tip: "circuitikz cubre la mayoría de los circuitos de señal y potencia.",
  },
  computacion: {
    native: ["Código fuente (lstlisting)", "Algoritmos con pseudocódigo", "Gráficas de rendimiento (pgfplots)", "Árboles de decisión (tikz)"],
    external: ["Diagramas de arquitectura complejos (draw.io → PDF/PNG)"],
  },
  // Humanidades / Ciencias Sociales
  humanidades: {
    native: ["Notas al pie extensas", "Aparato crítico y citas textuales", "Índices analíticos (makeindex)", "Ejemplos lingüísticos (gb4e)"],
    external: ["Imágenes de obras de arte (alta resolución como PNG/PDF)"],
  },
  "ciencias sociales": {
    native: ["Tablas estadísticas (booktabs)", "Gráficas (pgfplots)", "Citas bibliográficas estilo APA/Chicago"],
    external: ["Visualizaciones de datos complejas (R/Python → PDF/PNG)"],
    tip: "Para gráficas simples usa pgfplots. Para visualizaciones elaboradas, exporta desde R o Python.",
  },
  // Medicina / Salud
  medicina: {
    native: ["Tablas clínicas (booktabs)", "Unidades médicas \\SI{}", "Figuras con caption y label"],
    external: ["Imágenes DICOM / histología (exportar como PNG/TIFF de alta resolución)", "Organigramas clínicos (draw.io → PDF)"],
    tip: "Las imágenes médicas de diagnóstico deben importarse como archivo externo, no reproducidas en LaTeX.",
  },
  // Artes / Música / Diseño
  musica: {
    native: [],
    external: ["Partituras completas (MuseScore/Sibelius → PDF)", "Fragmentos de audio (enlace externo)"],
    tip: "La notación musical compleja conviene producirla en un editor de partituras y adjuntarla como PDF.",
  },
  arte: {
    native: ["Fichas técnicas tabuladas (booktabs)"],
    external: ["Láminas y obras (alta resolución como PNG/TIFF)", "Portfolio visual (PDF externo)", "Planos (DWG → PDF)"],
    tip: "Para portfolios, incluye el PDF o PNG de alta calidad. LaTeX gestiona layout y texto descriptivo.",
  },
  arquitectura: {
    native: ["Tablas de presupuesto y materiales", "Cronogramas", "Textos descriptivos"],
    external: ["Planos (AutoCAD/ArchiCAD → PDF)", "Renders (exportar como PNG/PDF)", "Maquetas (fotografía como PNG)"],
  },
  biologia: {
    native: ["Tablas de datos (booktabs)", "Unidades \\SI{}", "Árboles filogenéticos (tikz)"],
    external: ["Esquemas anatómicos complejos (Inkscape → PDF/SVG)", "Microscopia (PNG de alta resolución)"],
  },
  economia: {
    native: ["Tablas estadísticas (booktabs)", "Gráficas (pgfplots)", "Ecuaciones econométricas"],
    external: ["Dashboards y visualizaciones interactivas (exportar como PNG/PDF)"],
  },
};

// Pre-normalized keys — se computan una sola vez al cargar el módulo.
const DISCIPLINE_MATRIX_NORMALIZED: Array<[string, DisciplineSupport]> =
  Object.entries(DISCIPLINE_MATRIX).map(([k, v]) => [normalize(k), v]);

function getDisciplineSupport(discipline: string): DisciplineSupport | null {
  const norm = normalize(discipline);
  // Requiere al menos 3 caracteres para evitar falsos positivos con "a", "co", etc.
  if (norm.length < 3) return null;
  for (const [normKey, value] of DISCIPLINE_MATRIX_NORMALIZED) {
    // Solo la dirección: la clave contiene el input del usuario (coincidencia por prefijo/substring).
    // La dirección inversa (norm.includes(key)) daría false-positive con keys cortas.
    if (normKey.includes(norm) || norm.includes(normKey)) {
      return value;
    }
  }
  return null;
}

function DisciplineHintPanel({ discipline }: { discipline: string }) {
  const { t } = useTranslation();
  const support = getDisciplineSupport(discipline);
  if (!discipline.trim() || !support) return null;

  return (
    <div style={{
      gridColumn: "1 / -1",
      padding: "12px 14px",
      borderRadius: "var(--r-md)",
      background: "var(--bg-panel)",
      border: "1px solid var(--border-soft)",
      marginTop: 4,
    }}>
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        {t("wizard.discipline_hint_title")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: support.external.length > 0 ? "1fr 1fr" : "1fr", gap: 12 }}>
        {support.native.length > 0 && (
          <div>
            <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--build-ok)", marginBottom: 4 }}>
              {t("wizard.discipline_produces")}
            </div>
            {support.native.map((item) => (
              <div key={item} style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.7 }}>· {item}</div>
            ))}
          </div>
        )}
        {support.external.length > 0 && (
          <div>
            <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--accent-deep)", marginBottom: 4 }}>
              {t("wizard.discipline_integrates")}
            </div>
            {support.external.map((item) => (
              <div key={item} style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.7 }}>· {item}</div>
            ))}
          </div>
        )}
      </div>
      {support.tip && (
        <div style={{ marginTop: 8, fontSize: "var(--fs-xs)", color: "var(--accent-deep)", fontStyle: "italic" }}>
          {support.tip}
        </div>
      )}
    </div>
  );
}

export function defaultAcademicLevelForDocType(docType: string): AcademicLevel {
  switch (docType) {
    case "tesina":
      return "licenciatura";
    case "especialidad":
      return "especialidad";
    case "posdoctorado":
      return "posdoctorado";
    default:
      return "licenciatura";
  }
}

function recommendProfile(
  profiles: ProfileInfo[],
  docType: string,
  institution: string,
  academicLevel: string,
  discipline: string,
  programName: string,
  t: TFunction,
) {
  const institutionNorm = normalize(institution);
  const disciplineNorm = normalize(discipline);
  const programNorm = normalize(programName);
  const levelNorm = normalize(academicLevel);

  const ranked = profiles
    .map((profile) => {
      const haystack = normalize([
        profile.name,
        profile.description ?? "",
        profile.meta,
        ...(profile.tags ?? []),
      ].join(" "));

      let score = 0;
      const reasons: string[] = [];

      if (institutionNorm && haystack.includes(institutionNorm)) {
        score += 4;
        reasons.push(t("wizard.recommend_reason_institution", { name: institution.trim() }));
      }
      if (levelNorm && haystack.includes(levelNorm)) {
        score += 3;
        reasons.push(t("wizard.recommend_reason_level", { level: academicLevel }));
      }
      if (disciplineNorm && haystack.includes(disciplineNorm)) {
        score += 2;
        reasons.push(t("wizard.recommend_reason_discipline", { discipline: discipline.trim() }));
      }
      if (programNorm && haystack.includes(programNorm)) {
        score += 2;
        reasons.push(t("wizard.recommend_reason_program", { program: programName.trim() }));
      }
      if (docType === "tesina" && profile.id.includes("tesina")) {
        score += 2;
        reasons.push(t("wizard.recommend_reason_tesina"));
      }
      if (docType !== "tesina" && profile.id.includes("thesis")) {
        score += 1;
        reasons.push(t("wizard.recommend_reason_tesis"));
      }
      if (profile.status === "verified") {
        score += 2;
        reasons.push(t("wizard.recommend_reason_verified"));
      } else if (profile.status === "reviewed") {
        score += 1;
        reasons.push(t("wizard.recommend_reason_reviewed"));
      }

      return { profile, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0] ?? null;
}

function describePackKind(kind: VocabPackEntry["pack_kind"] | undefined, t: TFunction): string {
  switch (kind) {
    case "general":    return t("wizard.vocab_kind_general");
    case "academic":   return t("wizard.vocab_kind_academic");
    case "subject":    return t("wizard.vocab_kind_subject");
    case "program":    return t("wizard.vocab_kind_program");
    case "discipline":
    default:           return t("wizard.vocab_kind_discipline");
  }
}

function getVocabAreaOptions(t: TFunction) {
  return [
    { id: "", label: t("wizard.vocab_area_project") },
    { id: "medicine", label: t("wizard.vocab_area_medicine") },
    { id: "chemistry", label: t("wizard.vocab_area_chemistry") },
    { id: "biology", label: t("wizard.vocab_area_biology") },
    { id: "engineering", label: t("wizard.vocab_area_engineering") },
    { id: "mathematics", label: t("wizard.vocab_area_mathematics") },
    { id: "physics", label: t("wizard.vocab_area_physics") },
    { id: "economics", label: t("wizard.vocab_area_economics") },
    { id: "social_sciences", label: t("wizard.vocab_area_social_sciences") },
    { id: "humanities", label: t("wizard.vocab_area_humanities") },
    { id: "arts", label: t("wizard.vocab_area_arts") },
  ];
}

const VOCAB_AREA_ALIASES: Record<string, string[]> = {
  medicine: ["medicina", "medico", "médico", "salud", "clinica", "clínica", "enfermeria", "enfermería", "odontologia", "odontología", "farmacia", "biomedicina", "biomedical"],
  chemistry: ["quimica", "química", "bioquimica", "bioquímica", "farmaceutica", "farmacéutica", "chemistry"],
  biology: ["biologia", "biología", "biotech", "biotecnologia", "biotecnología", "genetica", "genética", "ecologia", "ecología"],
  engineering: ["ingenieria", "ingeniería", "engineering", "civil", "mecanica", "mecánica", "electrica", "eléctrica", "electronica", "electrónica", "computacion", "computación", "software", "robotica", "robótica"],
  mathematics: ["matematica", "matemática", "matematicas", "matemáticas", "math", "estadistica", "estadística", "calculo", "cálculo", "algebra", "álgebra"],
  physics: ["fisica", "física", "physics", "mecanica", "mecánica", "optica", "óptica", "termodinamica", "termodinámica"],
  economics: ["economia", "economía", "finanzas", "contaduria", "contaduría", "negocios", "administracion", "administración"],
  social_sciences: ["sociologia", "sociología", "psicologia", "psicología", "educacion", "educación", "derecho", "politica", "política", "antropologia", "antropología"],
  humanities: ["historia", "literatura", "filosofia", "filosofía", "linguistica", "lingüística", "humanidades"],
  arts: ["arte", "artes", "diseño", "diseno", "arquitectura", "musica", "música"],
};

const VOCAB_RELATED_AREAS: Record<string, string[]> = {
  medicine: ["chemistry", "biology"],
  chemistry: ["biology", "medicine"],
  biology: ["chemistry", "medicine"],
  engineering: ["mathematics", "physics"],
  mathematics: ["engineering", "physics"],
  physics: ["mathematics", "engineering"],
  economics: ["mathematics", "social_sciences"],
  social_sciences: ["humanities", "economics"],
  humanities: ["social_sciences", "arts"],
  arts: ["humanities"],
};

function detectVocabularyArea(value: string): string | null {
  const norm = normalize(value);
  if (!norm) return null;
  for (const [area, aliases] of Object.entries(VOCAB_AREA_ALIASES)) {
    if (aliases.some((alias) => {
      const aliasNorm = normalize(alias);
      return norm.includes(aliasNorm) || aliasNorm.includes(norm);
    })) {
      return area;
    }
  }
  return null;
}

function packVocabularyArea(pack: VocabPackEntry): string | null {
  return detectVocabularyArea([
    pack.discipline ?? "",
    pack.subject ?? "",
    pack.program_name ?? "",
    pack.name,
    pack.description,
  ].join(" "));
}

function vocabularyAreaLabel(area: string, t: TFunction): string {
  return getVocabAreaOptions(t).find((option) => option.id === area)?.label ?? area;
}

function recommendVocabularyPacks(
  packs: VocabPackEntry[],
  language: string,
  academicLevel: string,
  discipline: string,
  programName: string,
) {
  const langNorm = normalize(language);
  const levelNorm = normalize(academicLevel);
  const targetArea = detectVocabularyArea([discipline, programName].join(" "));
  const programNorm = normalize(programName);

  return packs
    .map((pack) => {
      let score = 0;
      const packKind = pack.pack_kind ?? "discipline";
      const packLang = normalize(pack.base_language_hint ?? "");
      const packArea = packVocabularyArea(pack);

      if (packLang && packLang !== langNorm) return { pack, score: -1 };
      score += packLang === langNorm ? 4 : 1;

      if (packKind === "general") score += 2;
      if (packKind === "academic") score += 3;

      if (["discipline", "subject", "program"].includes(packKind)) {
        if (!targetArea) return { pack, score: -1 };
        if (packArea === targetArea) {
          score += packKind === "program" ? 8 : 7;
        } else if (packArea && (VOCAB_RELATED_AREAS[targetArea] ?? []).includes(packArea)) {
          score += 2;
        } else {
          return { pack, score: -1 };
        }
      }

      if (programNorm && normalize(pack.program_name ?? "").includes(programNorm)) score += 5;
      if (levelNorm && (pack.target_levels ?? []).some((level) => normalize(level) === levelNorm)) score += 2;
      return { pack, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

const S = {
  shell: { flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)" } as const,
  rail: {
    width: 280, flexShrink: 0,
    background: "var(--bg-chrome)", borderRight: "1px solid var(--border-subtle)",
    padding: "32px 24px", display: "flex", flexDirection: "column" as const, gap: 4,
  },
  main: {
    flex: 1, overflow: "auto", padding: "40px 56px 32px",
    display: "flex", flexDirection: "column" as const,
  },
  footer: {
    marginTop: "auto", paddingTop: 32,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    maxWidth: 820,
  } as const,
};

function WizStep({
  n, name, hint, state, last = false,
}: {
  n: number; name: string; hint: string; state: StepState; last?: boolean;
}) {
  return (
    <>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 8px",
        color: state === "done" ? "var(--fg-muted)" : state === "active" ? "var(--fg-strong)" : "var(--fg-faint)",
      }}>
        <div style={{
          width: 22, height: 22, flexShrink: 0, borderRadius: "50%",
          border: `1.5px solid ${state === "active" ? "var(--accent)" : "var(--border-firm)"}`,
          background: state === "done" ? "var(--accent)" : state === "active" ? "var(--accent-tint)" : "transparent",
          color: state === "done" ? "white" : state === "active" ? "var(--accent-deep)" : "var(--fg-faint)",
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {state === "done" ? <IconCheck size={11} sw={3} /> : n}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingTop: 1 }}>
          <span style={{ fontSize: "var(--fs-base)", fontWeight: 500, lineHeight: 1.3 }}>{name}</span>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{hint}</span>
        </div>
      </div>
      {!last && (
        <div style={{
          width: 1, flex: 1, marginLeft: 22, marginTop: 4, marginBottom: 4,
          background: state === "done" ? "var(--accent)" : "var(--border-soft)", minHeight: 8,
        }} />
      )}
    </>
  );
}

// Paso 1: tipo de documento
function StepTipo({
  selected, onSelect,
}: {
  selected: string; onSelect: (v: string) => void;
}) {
  const { t } = useTranslation();
  const options = [
    { id: "tesina", title: t("wizard.doc_tesina"), desc: t("wizard.doc_tesina_desc"), meta: t("home.level_licenciatura") },
    { id: "tesis", title: t("wizard.doc_tesis"), desc: t("wizard.doc_tesis_desc"), meta: t("wizard.doc_tesis_meta") },
    { id: "especialidad", title: t("home.level_especialidad"), desc: t("wizard.doc_especialidad_desc"), meta: t("home.level_especialidad") },
    { id: "posdoctorado", title: t("home.level_posdoctorado"), desc: t("wizard.doc_posdoctorado_desc"), meta: t("home.level_posdoctorado") },
  ];
  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        {t("wizard.doc_type_title_prefix")} <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>{t("wizard.doc_type_title_em")}</em> {t("wizard.doc_type_title_suffix")}
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 28, maxWidth: 540 }}>
        {t("wizard.doc_type_subtitle")}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, maxWidth: 820 }}>
        {options.map((o) => (
          <div
            key={o.id}
            onClick={() => onSelect(o.id)}
            style={{
              background: selected === o.id ? "var(--accent-tint)" : "var(--bg-panel)",
              border: `1px solid ${selected === o.id ? "var(--accent)" : "var(--border-soft)"}`,
              borderRadius: "var(--r-lg)", padding: 18, cursor: "pointer",
              boxShadow: selected === o.id ? "0 0 0 3px var(--accent-soft)" : "none",
              display: "flex", flexDirection: "column", gap: 8, minHeight: 130,
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: "var(--r-md)",
              background: selected === o.id ? "var(--accent)" : "var(--ink-100)",
              color: selected === o.id ? "white" : "var(--fg-default)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              <IconBook size={16} />
            </div>
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>{o.title}</div>
            <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>{o.desc}</p>
            <div style={{ marginTop: "auto", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
              {o.meta}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function InputField({
  label, value, onChange, placeholder, mono = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-default)" }}>{label}</label>
      <input
        style={{
          padding: "8px 12px", borderRadius: "var(--r-md)",
          border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
          fontSize: "var(--fs-base)", color: "var(--fg-strong)",
          outline: "none", fontFamily: mono ? "var(--font-mono)" : undefined,
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/** Lista dinámica de strings con botón + para agregar y × para eliminar */
function DynamicList({
  label, sublabel, items, onChange, placeholder,
}: {
  label: string; sublabel?: string;
  items: string[]; onChange: (items: string[]) => void; placeholder?: string;
}) {
  const { t } = useTranslation();
  const addItem = () => onChange([...items, ""]);
  const setItem = (i: number, v: string) => {
    const next = [...items]; next[i] = v; onChange(next);
  };
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-default)" }}>
          {label}
          {sublabel && (
            <span style={{ fontWeight: 400, color: "var(--fg-faint)", marginLeft: 6 }}>{sublabel}</span>
          )}
        </label>
        <button
          type="button"
          className="btn btn-sm"
          style={{ padding: "2px 10px", fontSize: "var(--fs-xs)" }}
          onClick={addItem}
        >
          + {t("common.add")}
        </button>
      </div>
      {items.length === 0 && (
        <div style={{
          padding: "8px 12px", borderRadius: "var(--r-md)",
          border: "1px dashed var(--border-soft)", background: "var(--bg-app)",
          fontSize: "var(--fs-sm)", color: "var(--fg-faint)", textAlign: "center",
        }}>
          {t("wizard.dynamic_none")}
        </div>
      )}
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            style={{
              flex: 1, padding: "7px 12px", borderRadius: "var(--r-md)",
              border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
              fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none",
            }}
            value={item}
            onChange={(e) => setItem(i, e.target.value)}
            placeholder={placeholder ?? ""}
          />
          <button
            type="button"
            onClick={() => removeItem(i)}
            title={t("common.delete")}
            style={{
              width: 28, height: 28, flexShrink: 0,
              border: "1px solid var(--border-firm)", borderRadius: "var(--r-md)",
              background: "var(--bg-panel)", color: "var(--fg-muted)",
              cursor: "pointer", fontSize: 14, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// Paso 2: datos de la institución y alumno
function StepDatos({
  form,
  onChange,
  advisors,
  onAdvisors,
  coAuthors,
  onCoAuthors,
}: {
  form: Record<string, string>;
  onChange: (key: string, val: string) => void;
  advisors: string[];
  onAdvisors: (v: string[]) => void;
  coAuthors: string[];
  onCoAuthors: (v: string[]) => void;
}) {
  const { t } = useTranslation();
  const { userMode } = useSettingsStore();
  const [showOptional, setShowOptional] = useState(userMode === "advanced");

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        {t("wizard.context_title_prefix")} <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>{t("wizard.context_title_em")}</em> {t("wizard.context_title_suffix")}
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 20, maxWidth: 560 }}>
        {t("wizard.context_subtitle")}
      </p>

      {/* ── Campos esenciales ── */}
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-faint)", marginBottom: 10 }}>
        {t("wizard.essentials")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 820, marginBottom: 20 }}>
        <InputField label={t("wizard.project_title")} value={form.title ?? ""} onChange={(v) => onChange("title", v)} placeholder={t("wizard.project_title_short_placeholder")} />
        <InputField label={t("wizard.full_name")} value={form.full_name ?? ""} onChange={(v) => onChange("full_name", v)} placeholder={t("wizard.full_name_placeholder")} />
        <InputField label={t("wizard.university_institution")} value={form.institution ?? ""} onChange={(v) => onChange("institution", v)} placeholder={t("wizard.institution_examples")} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-default)" }}>{t("wizard.academic_level")}</label>
          <select
            value={form.academic_level ?? "licenciatura"}
            onChange={(e) => onChange("academic_level", e.target.value)}
            style={{
              padding: "8px 12px", borderRadius: "var(--r-md)",
              border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
              fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none",
            }}
          >
            {ACADEMIC_LEVEL_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{t(`home.level_${option.id}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Asesor */}
      <div style={{ maxWidth: 820, marginBottom: 20 }}>
        <DynamicList
          label={t("wizard.advisor_director")}
          sublabel={t("wizard.required_for_cover")}
          items={advisors}
          onChange={onAdvisors}
          placeholder={t("editor_meta.advisor_placeholder")}
        />
      </div>

      {/* ── Detalles adicionales (colapsable en básico) ── */}
      <button
        type="button"
        onClick={() => setShowOptional((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 12,
          fontSize: "var(--fs-sm)", color: "var(--accent-deep)", fontFamily: "var(--font-sans)",
        }}
      >
        <span>{showOptional ? "▾" : "▸"}</span>
        {showOptional ? t("wizard.hide_optional") : t("wizard.show_optional")}
      </button>

      {showOptional && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 820, marginBottom: 20 }}>
            <InputField label={t("wizard.faculty_department")} value={form.faculty ?? ""} onChange={(v) => onChange("faculty", v)} placeholder={t("wizard.faculty_placeholder")} />
            <InputField label={t("editor.meta_city")} value={form.city ?? t("wizard.default_city")} onChange={(v) => onChange("city", v)} placeholder={t("wizard.default_city")} />
            <InputField label={t("wizard.discipline_area")} value={form.discipline ?? ""} onChange={(v) => onChange("discipline", v)} placeholder={t("wizard.discipline_placeholder")} />
            <InputField label={t("wizard.program")} value={form.program_name ?? ""} onChange={(v) => onChange("program_name", v)} placeholder={t("wizard.program_placeholder")} />
            <DisciplineHintPanel discipline={form.discipline ?? ""} />
          </div>
          <div style={{ maxWidth: 820, marginBottom: 16 }}>
            <DynamicList
              label={t("editor_meta.coauthors")}
              sublabel={t("wizard.for_group_work")}
              items={coAuthors}
              onChange={onCoAuthors}
              placeholder={t("editor_meta.coauthor_placeholder")}
            />
          </div>
        </>
      )}

      {!showOptional && form.discipline && (
        <DisciplineHintPanel discipline={form.discipline} />
      )}
    </>
  );
}

// Paso 3: selección de perfil con preview de secciones
function StepPerfil({
  profiles, selected, onSelect, docType, institution, academicLevel, discipline, programName,
}: {
  profiles: ProfileInfo[];
  selected: string;
  onSelect: (id: string) => void;
  docType: string;
  institution: string;
  academicLevel: string;
  discipline: string;
  programName: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userMode } = useSettingsStore();
  const placementShort = useMemo(() => ({
    front_matter: t("wizard.placement_front_short"),
    body:         t("wizard.placement_body_short"),
    back_matter:  t("wizard.placement_back_short"),
    appendix:     t("wizard.placement_appendix_short"),
  }), [t]);
  const selProfile = profiles.find((p) => p.id === selected);
  const recommended = recommendProfile(
    profiles,
    docType,
    institution,
    academicLevel,
    discipline,
    programName,
    t,
  );
  const recommendedProfile = recommended?.profile;

  return (
    <div style={{ display: "flex", gap: 24, maxWidth: 900, alignItems: "flex-start" }}>
      {/* Listado */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
          {t("wizard.choose_profile_prefix")} <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>{t("wizard.choose_profile_em")}</em>
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 22, maxWidth: 500 }}>
          {t("wizard.choose_profile_subtitle")}
        </p>
        {recommendedProfile && (
          <div style={{
            marginBottom: 14, padding: "12px 14px", borderRadius: "var(--r-md)",
            background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
            fontSize: "var(--fs-sm)", color: "var(--accent-deep)", lineHeight: 1.6,
          }}>
            <strong>{t("wizard.initial_recommendation")}:</strong> {recommendedProfile.name}
            <div style={{ color: "var(--fg-muted)", marginTop: 4 }}>
              {recommended?.reasons.length
                ? t("wizard.recommendation_reasons", { reasons: recommended.reasons.join(", ") })
                : t("wizard.recommendation_default_reason")}
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {profiles.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                background: selected === p.id ? "var(--accent-tint)" : "var(--bg-panel)",
                border: `1px solid ${selected === p.id ? "var(--accent)" : "var(--border-soft)"}`,
                borderRadius: "var(--r-lg)", padding: "14px 16px", cursor: "pointer",
                boxShadow: selected === p.id ? "0 0 0 3px var(--accent-soft)" : "none",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: "var(--r-md)", flexShrink: 0,
                background: selected === p.id ? "var(--accent)" : "var(--ink-100)",
                color: selected === p.id ? "white" : "var(--fg-default)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <IconBook size={15} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>{p.name}</span>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <ProfileStatusBadge status={p.status} />
                    {recommendedProfile?.id === p.id && (
                      <span className="chip" style={{ fontSize: 10 }}>
                        {t("wizard.recommended")}
                      </span>
                    )}
                    {selected === p.id && (
                      <span className="chip chip-accent" style={{ fontSize: 10 }}>
                        <IconCheck size={8} sw={2.5} /> {t("wizard.selected")}
                      </span>
                    )}
                  </div>
                </div>
                {p.description && (
                  <p style={{ margin: "3px 0 6px", fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.4 }}>{p.description}</p>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {userMode === "advanced" && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>{p.meta}</span>
                  )}
                  {userMode === "basic" && p.meta && (
                    <span style={{ fontSize: 10, color: "var(--fg-muted)" }}>{p.meta}</span>
                  )}
                  {p.sections_count > 0 && (
                    <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>· {t("wizard.profile_sections", { n: p.sections_count })}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 16, padding: "12px 14px", borderRadius: "var(--r-md)",
          background: "var(--accent-tint)", border: "1px dashed var(--accent-soft)",
          fontSize: "var(--fs-sm)", color: "var(--accent-deep)",
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <IconInfo size={14} />
          <div>
            <strong>{t("wizard.no_institution")}</strong> {t("wizard.import_profile_from")}{" "}
            <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => navigate("/library")}>{t("library.title")}</span>.
          </div>
        </div>
      </div>

      {/* Preview de secciones del perfil seleccionado */}
      {selProfile && selProfile.sections.length > 0 && (
        <div style={{
          width: 220, flexShrink: 0,
          background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
          borderRadius: "var(--r-lg)", padding: 16,
        }}>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 10 }}>
            {t("wizard.profile_sections_title")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {selProfile.sections.map((s) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "4px 8px", borderRadius: "var(--r-sm)",
                background: "var(--bg-app)", border: "1px solid var(--border-subtle)",
              }}>
                <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)" }}>
                  {s.title ?? s.id}
                </span>
                <span style={{ fontSize: 9, color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                  {placementShort[s.placement as keyof typeof placementShort] ?? s.placement}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StepReview({
  docType,
  form,
  profile,
  advisors,
  coAuthors,
  outputPath,
  documentLanguage,
  suggestedVocab,
}: {
  docType: string;
  form: Record<string, string>;
  profile?: ProfileInfo;
  advisors: string[];
  coAuthors: string[];
  outputPath: string;
  documentLanguage: string;
  suggestedVocab: VocabPackEntry[];
}) {
  const { t } = useTranslation();
  const summaryRows = [
    [t("wizard.review_doc_type"), docType],
    [t("wizard.review_level"), form.academic_level || t("wizard.pending")],
    [t("editor.meta_title"), form.title || t("wizard.pending")],
    [t("wizard.review_authorship"), form.full_name || t("wizard.pending")],
    [t("editor.meta_institution"), form.institution || t("wizard.pending")],
    [t("wizard.faculty_department"), form.faculty || t("wizard.optional")],
    [t("wizard.review_area"), form.discipline || t("wizard.optional")],
    [t("wizard.program"), form.program_name || t("wizard.optional")],
    [t("editor_meta.profile"), profile?.name ?? t("wizard.pending")],
    [t("wizard.review_document_language"), documentLanguage.toUpperCase()],
    [t("wizard.output_folder_review"), outputPath || t("wizard.pending")],
  ];

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        {t("wizard.review_title_prefix")} <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>{t("wizard.review_title_em")}</em>
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 28, maxWidth: 620 }}>
        {t("wizard.review_subtitle")}
      </p>
      <div style={{
        maxWidth: 820, background: "var(--bg-panel)", border: "1px solid var(--border-soft)",
        borderRadius: "var(--r-lg)", padding: 20, display: "flex", flexDirection: "column", gap: 10,
      }}>
        {summaryRows.map(([label, value]) => (
          <div
            key={label}
            style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}
          >
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>{label}</span>
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-strong)", textAlign: "right" }}>{value}</span>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              {t("wizard.advisors_committee")}
            </div>
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.6 }}>
              {advisors.filter((item) => item.trim()).length > 0 ? advisors.filter((item) => item.trim()).join(", ") : t("wizard.can_add_later")}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              {t("editor_meta.coauthors")}
            </div>
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.6 }}>
              {coAuthors.filter((item) => item.trim()).length > 0 ? coAuthors.filter((item) => item.trim()).join(", ") : t("wizard.not_defined")}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {t("wizard.suggested_language_support")}
          </div>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.6 }}>
            {suggestedVocab.length > 0
              ? suggestedVocab.map((pack) => pack.name).join(", ")
              : t("wizard.language_support_later")}
          </div>
        </div>
      </div>
    </>
  );
}

function StepLanguageSupport({
  documentLanguage,
  onDocumentLanguage,
  vocabularyArea,
  onVocabularyArea,
  availableLanguages,
  recommendedPacks,
  selectedVocabIds,
  onToggleVocab,
}: {
  documentLanguage: string;
  onDocumentLanguage: (lang: string) => void;
  vocabularyArea: string;
  onVocabularyArea: (area: string) => void;
  availableLanguages: LangPackEntry[];
  recommendedPacks: VocabPackEntry[];
  selectedVocabIds: string[];
  onToggleVocab: (id: string) => void;
}) {
  const { t } = useTranslation();
  const quickChoices = [
    { id: "es", name: "Español", note: t("wizard.bundled_default") },
    { id: "en", name: "English", note: t("wizard.bundled_default") },
    ...availableLanguages
      .filter((entry) => !["es", "en"].includes(entry.id))
      .slice(0, 6)
      .map((entry) => ({
        id: entry.id,
        name: entry.native_name || entry.name,
        note: entry.capabilities.spelling ? t("wizard.installable_spellcheck") : t("wizard.available_catalog"),
      })),
  ];

  const uniqueChoices = quickChoices.filter(
    (entry, index, list) => list.findIndex((item) => item.id === entry.id) === index,
  );

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        {t("wizard.language_title_prefix")} <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>{t("wizard.language_title_em")}</em> {t("wizard.language_title_suffix")}
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 28, maxWidth: 620 }}>
        {t("wizard.language_subtitle")}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, maxWidth: 820 }}>
        {uniqueChoices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => onDocumentLanguage(choice.id)}
            style={{
              textAlign: "left",
              padding: "14px 16px",
              borderRadius: "var(--r-lg)",
              border: `1px solid ${documentLanguage === choice.id ? "var(--accent)" : "var(--border-soft)"}`,
              background: documentLanguage === choice.id ? "var(--accent-tint)" : "var(--bg-panel)",
              boxShadow: documentLanguage === choice.id ? "0 0 0 3px var(--accent-soft)" : "none",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 500, color: "var(--fg-strong)" }}>{choice.name}</div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 4 }}>{choice.note}</div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 24, maxWidth: 820, padding: "16px 18px", borderRadius: "var(--r-lg)", background: "var(--bg-panel)", border: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 4 }}>
              {t("wizard.suggested_stack", { language: documentLanguage.toUpperCase() })}
            </div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
              {t("wizard.vocab_area_used")}: {vocabularyArea ? vocabularyAreaLabel(vocabularyArea, t) : t("wizard.vocab_area_from_project")}
            </div>
          </div>
          <select
            value={vocabularyArea}
            onChange={(e) => onVocabularyArea(e.target.value)}
            style={{
              minWidth: 220,
              padding: "7px 10px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border-firm)",
              background: "var(--bg-app)",
              color: "var(--fg-strong)",
              fontSize: "var(--fs-sm)",
            }}
          >
            {getVocabAreaOptions(t).map((option) => (
              <option key={option.id || "project"} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 12 }}>
          {t("wizard.suggested_stack_body")}
        </div>
        {recommendedPacks.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {recommendedPacks.map((pack) => {
              const selected = selectedVocabIds.includes(pack.id);
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => onToggleVocab(pack.id)}
                  aria-pressed={selected}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: "var(--r-md)",
                    background: selected ? "var(--accent-tint)" : "var(--bg-app)",
                    border: `1px solid ${selected ? "var(--accent)" : "var(--border-subtle)"}`,
                    boxShadow: selected ? "0 0 0 3px var(--accent-soft)" : "none",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                    <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>{pack.name}</span>
                    <span style={{
                      width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                      border: `1px solid ${selected ? "var(--accent)" : "var(--border-firm)"}`,
                      background: selected ? "var(--accent)" : "var(--bg-panel)",
                      color: selected ? "white" : "transparent",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, lineHeight: 1,
                    }}>✓</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7 }}>
                    <span className="chip" style={{ fontSize: 10 }}>{describePackKind(pack.pack_kind, t)}</span>
                    <span style={{ fontSize: "var(--fs-xs)", color: selected ? "var(--accent-deep)" : "var(--fg-faint)" }}>
                      {selected ? t("wizard.vocab_will_activate") : t("wizard.vocab_click_to_activate")}
                    </span>
                  </div>
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    {pack.description}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
            {t("wizard.no_vocab_match")}
          </div>
        )}
      </div>
    </>
  );
}

export default function WizardView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lang: savedUiLang, spellLang: savedSpellLang, setSpellLang } = useSettingsStore();
  const { catalog, loadCatalog } = useLangPacksStore();
  const { officialPacks, loadOfficialCatalog, install: installVocabPack, isInstalled: isVocabInstalled } = useVocabPacksStore();
  const [step, setStep] = useState(0);
  const [docType, setDocType] = useState("tesis");
  const [profileId, setProfileId] = useState(
    searchParams.get("profile") ?? "generic.thesis"
  );
  const [form, setForm] = useState<Record<string, string>>({
    title: "",
    full_name: "",
    institution: "",
    faculty: "",
    city: t("wizard.default_city"),
    academic_level: defaultAcademicLevelForDocType("tesis"),
    discipline: "",
    program_name: "",
  });
  const [documentLanguage, setDocumentLanguage] = useState(savedSpellLang ?? savedUiLang ?? "es");
  const [vocabularyArea, setVocabularyArea] = useState("");
  const [selectedVocabIds, setSelectedVocabIds] = useState<string[]>([]);
  const [advisors, setAdvisors] = useState<string[]>([""]);
  const [coAuthors, setCoAuthors] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [apiProfiles, setApiProfiles] = useState<ProfileInfo[] | null>(null);
  const [profileLocaleTick, setProfileLocaleTick] = useState(0);
  const builtinProfiles = useMemo(() => getBuiltinProfiles(t), [t]);
  const profiles = useMemo(
    () => localizeProfiles(apiProfiles ?? builtinProfiles, i18n.language),
    [apiProfiles, builtinProfiles, i18n.language, profileLocaleTick],
  );
  const [outputPath, setOutputPath] = useState("");
  const [cloudFolders, setCloudFolders] = useState<CloudFolder[]>([]);

  useEffect(() => {
    let cancelled = false;
    ensureProfileLocale(i18n.language).then(() => {
      if (!cancelled) setProfileLocaleTick((tick) => tick + 1);
    });
    return () => { cancelled = true; };
  }, [i18n.language]);

  // Resolver path por defecto + cargar perfiles reales al montar
  useEffect(() => {
    resolveDocumentsPath().then(setOutputPath).catch(() => setOutputPath("/tmp"));
    api.getCloudFolders().then(setCloudFolders).catch(() => {});
    api.getProfiles()
      .then((loaded) => { if (loaded.length > 0) setApiProfiles(loaded); })
      .catch(() => {}); // silencioso, usa builtinProfiles como fallback
    loadCatalog().catch(() => {});
    loadOfficialCatalog().catch(() => {});
  }, []);

  useEffect(() => {
    if (docType === "tesina") {
      setProfileId("generic.tesina");
    } else if (["tesis", "especialidad", "posdoctorado"].includes(docType)) {
      setProfileId("generic.thesis");
    }
    setForm((prev) => ({
      ...prev,
      academic_level:
        docType === "tesis" && prev.academic_level && prev.academic_level !== "especialidad" && prev.academic_level !== "posdoctorado"
          ? prev.academic_level
          : defaultAcademicLevelForDocType(docType),
    }));
  }, [docType]);

  const availableLanguages = useMemo(
    () => (catalog?.packages ?? []).filter((entry) => entry.capabilities.spelling || entry.capabilities.ui),
    [catalog],
  );

  const suggestedVocab = useMemo(
    () =>
      recommendVocabularyPacks(
        officialPacks,
        documentLanguage,
        form.academic_level ?? "licenciatura",
        vocabularyArea ? vocabularyAreaLabel(vocabularyArea, t) : form.discipline ?? "",
        form.program_name ?? "",
      ),
    [documentLanguage, form.academic_level, form.discipline, form.program_name, officialPacks, vocabularyArea, t],
  );

  const recommendedVocabPacks = useMemo(
    () => suggestedVocab.map((entry) => entry.pack),
    [suggestedVocab],
  );

  const selectedVocabPacks = useMemo(
    () => recommendedVocabPacks.filter((pack) => selectedVocabIds.includes(pack.id)),
    [recommendedVocabPacks, selectedVocabIds],
  );

  function toggleVocabPack(id: string) {
    setSelectedVocabIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handlePickFolder() {
    const picked = await api.pickFolder();
    if (picked) setOutputPath(picked);
  }

  const steps = [
    { name: t("wizard.step_doc_type"), hint: docType ? t(`wizard.doc_${docType}`, { defaultValue: docType }) : t("wizard.doc_type_hint") },
    { name: t("wizard.step_context"), hint: form.institution || t("wizard.context_hint") },
    { name: t("wizard.step_profile"), hint: profiles.find((p) => p.id === profileId)?.name ?? t("wizard.profile_hint") },
    { name: t("wizard.step_language"), hint: documentLanguage.toUpperCase() },
    { name: t("wizard.step_review"), hint: t("wizard.review_hint") },
  ];

  async function handleCreate() {
    setCreateError(null);
    if (!form.title.trim()) {
      setCreateError(t("wizard.error_title_required"));
      return;
    }
    if (!outputPath.trim()) {
      setCreateError(t("wizard.error_folder_required"));
      return;
    }
    setCreating(true);
    try {
      // Instalar vocabularios seleccionados antes de crear el proyecto
      for (const pack of selectedVocabPacks) {
        if (!isVocabInstalled(pack.id)) {
          try {
            await installVocabPack(pack);
          } catch (e) {
            throw new Error(t("wizard.error_vocab_install", { name: pack.name, error: String(e) }));
          }
        }
      }

      const result = await api.createProject(form.title, profileId, outputPath);
      // Cargar modelo y enriquecer con datos del wizard
      const model = await api.getProject(result.project_path);
      const filledAdvisors = advisors.filter((a) => a.trim());
      const filledCoAuthors = coAuthors
        .filter((c) => c.trim())
        .map((c) => ({ full_name: c.trim() }));
      const seededKeywords = [form.discipline.trim(), form.program_name.trim()].filter(Boolean);

      const enriched = {
        ...model,
        metadata: {
          ...model.metadata,
          title: form.title.trim(),
          academic_level: (form.academic_level as AcademicLevel) || model.metadata.academic_level,
          language: documentLanguage,
          city: form.city.trim() || t("wizard.default_city"),
          keywords: seededKeywords.length > 0 ? seededKeywords : model.metadata.keywords,
        },
        institution: {
          ...model.institution,
          name: form.institution.trim() || t("wizard.default_institution"),
          faculty: form.faculty.trim() || undefined,
        },
        student: {
          ...model.student,
          full_name: form.full_name.trim() || t("wizard.default_author"),
          advisors: filledAdvisors,
          co_authors: filledCoAuthors,
        },
      };
      if (["es", "en"].includes(documentLanguage) || availableLanguages.some((entry) => entry.id === documentLanguage)) {
        setSpellLang(documentLanguage);
      }
      await api.saveProject(result.project_path, enriched);
      const saved = await api.getProject(result.project_path);
      useProjectStore.getState().openProject(saved, result.project_path);
      navigate(`/project/${encodeURIComponent(result.project_path)}`);
    } catch (e) {
      console.error("Error creando proyecto:", e);
      setCreateError(t("wizard.error_create_project", { error: String(e) }));
      setCreating(false);
    }
  }

  const stepStates = steps.map((_, i): StepState =>
    i < step ? "done" : i === step ? "active" : "todo"
  );

  return (
    <>
      <TxAppbar
        left={<TxLogo />}
        center={<span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
          {t("wizard.appbar_title", { current: step + 1, total: steps.length })}
        </span>}
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>
            {t("common.cancel")} <span className="kbd">Esc</span>
          </button>
        }
      />

      <div style={S.shell}>
        <aside style={S.rail}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-xl)", fontWeight: 500, color: "var(--fg-strong)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            {t("wizard.assistant_title")}
          </h2>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginBottom: 28 }}>
            {t("wizard.assistant_subtitle")}
          </p>
          {steps.map((s, i) => (
            <WizStep
              key={i}
              n={i + 1}
              name={s.name}
              hint={s.hint}
              state={stepStates[i]}
              last={i === steps.length - 1}
            />
          ))}
          <div style={{
            marginTop: 24, padding: 12, borderRadius: "var(--r-md)",
            background: "var(--bg-panel)", border: "1px solid var(--border-subtle)",
            fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5,
          }}>
            <strong style={{ color: "var(--fg-default)", fontSize: "var(--fs-sm)" }}>{t("wizard.why_profile_title")}</strong>
            <br />
            {t("wizard.why_profile_body")}
          </div>
        </aside>

        <main style={S.main} className="scroll">
          {step === 0 && (
            <StepTipo selected={docType} onSelect={setDocType} />
          )}
          {step === 1 && (
            <StepDatos
              form={form}
              onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
              advisors={advisors}
              onAdvisors={setAdvisors}
              coAuthors={coAuthors}
              onCoAuthors={setCoAuthors}
            />
          )}
          {step === 2 && (
            <StepPerfil
              profiles={profiles}
              selected={profileId}
              onSelect={setProfileId}
              docType={docType}
              institution={form.institution ?? ""}
              academicLevel={form.academic_level ?? "licenciatura"}
              discipline={form.discipline ?? ""}
              programName={form.program_name ?? ""}
            />
          )}
          {step === 3 && (
            <StepLanguageSupport
              documentLanguage={documentLanguage}
              onDocumentLanguage={setDocumentLanguage}
              vocabularyArea={vocabularyArea}
              onVocabularyArea={setVocabularyArea}
              availableLanguages={availableLanguages}
              recommendedPacks={recommendedVocabPacks}
              selectedVocabIds={selectedVocabIds}
              onToggleVocab={toggleVocabPack}
            />
          )}
          {step === 4 && (
            <StepReview
              docType={docType}
              form={form}
              profile={profiles.find((p) => p.id === profileId)}
              advisors={advisors}
              coAuthors={coAuthors}
              outputPath={outputPath}
              documentLanguage={documentLanguage}
              suggestedVocab={suggestedVocab.map((entry) => entry.pack)}
            />
          )}

          {/* Campo de carpeta de destino — visible solo en el último paso */}
          {step === steps.length - 1 && (
            <div style={{ maxWidth: 820, marginTop: 20 }}>
              {/* Selector de carpeta */}
              <div style={{ padding: "12px 16px", borderRadius: "var(--r-md)", background: "var(--bg-panel)", border: "1px solid var(--border-soft)" }}>
                <label style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", display: "block", marginBottom: 6 }}>
                  {t("wizard.output_folder_label")}
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder={t("wizard.output_folder_placeholder")}
                    style={{
                      flex: 1, padding: "7px 10px", borderRadius: "var(--r-md)",
                      border: "1px solid var(--border-firm)", background: "var(--bg-app)",
                      fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handlePickFolder}
                    title={t("wizard.browse_folders")}
                    style={{ flexShrink: 0, padding: "6px 14px" }}
                  >
                    📁 {t("wizard.browse")}
                  </button>
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 5 }}>
                  {t("wizard.folder_creation_prefix")}{" "}
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{form.title || t("wizard.default_project_slug")}/</code>{" "}
                  {t("wizard.folder_creation_suffix")}
                </div>
              </div>

              {/* Sugerencia de nube — si hay carpetas detectadas */}
              {cloudFolders.length > 0 && (
                <div style={{
                  marginTop: 12, padding: "12px 16px", borderRadius: "var(--r-md)",
                  background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
                }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>☁</span>
                    <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--accent-deep)" }}>
                      {t("wizard.cloud_backup_title")}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    {t("wizard.cloud_backup_body")}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {cloudFolders.map((cf) => (
                      <button
                        key={cf.path}
                        type="button"
                        onClick={() => setOutputPath(cf.path)}
                        style={{
                          textAlign: "left", padding: "8px 12px",
                          borderRadius: "var(--r-md)",
                          border: `1px solid ${outputPath === cf.path ? "var(--accent)" : "var(--border-firm)"}`,
                          background: outputPath === cf.path ? "var(--accent-tint)" : "var(--bg-panel)",
                          cursor: "pointer",
                          display: "flex", flexDirection: "column", gap: 2,
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontWeight: 500, fontSize: "var(--fs-sm)", color: "var(--fg-strong)" }}>
                            {cf.icon} {cf.service}
                          </span>
                          {outputPath === cf.path && (
                            <span className="chip chip-accent" style={{ fontSize: 10, padding: "1px 6px" }}>
                              <IconCheck size={8} sw={2.5} /> {t("wizard.selected")}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>
                          {cf.path}
                        </span>
                        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>{cf.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructivo si NO hay nube detectada */}
              {cloudFolders.length === 0 && (
                <div style={{
                  marginTop: 12, padding: "10px 14px", borderRadius: "var(--r-md)",
                  background: "var(--bg-panel)", border: "1px dashed var(--border-soft)",
                  fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5,
                }}>
                  <strong style={{ color: "var(--fg-default)" }}>💡 {t("wizard.cloud_tip_title")}</strong>
                  <br />
                  {t("wizard.cloud_tip_prefix")}{" "}
                  <em>OneDrive</em> {t("wizard.cloud_tip_or")}{" "}
                  <em>{t("wizard.google_drive_desktop")}</em>{" "}
                  {t("wizard.cloud_tip_suffix")}
                </div>
              )}
            </div>
          )}

          <div style={S.footer}>
            {step > 0 ? (
              <button className="btn" onClick={() => { setStepError(null); setStep((s) => s - 1); }}>
                <IconChevronL size={13} /> {t("common.back")}
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              {stepError && (
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--build-err)", background: "var(--build-err-tint)", padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--build-err)" }}>
                  {stepError}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
                {profileId} · v0.1
              </span>
              {step < steps.length - 1 ? (
                <button className="btn btn-accent" onClick={() => {
                  if (step === 1) {
                    if (!form.title.trim()) {
                      setStepError(t("wizard.error_title_required"));
                      return;
                    }
                    if (!form.full_name.trim()) {
                      setStepError(t("wizard.error_author_required"));
                      return;
                    }
                  }
                  setStepError(null);
                  setStep((s) => s + 1);
                }}>
                  {t("wizard.continue")} <IconChevronR size={13} />
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                  {createError && (
                    <div style={{ fontSize: "var(--fs-sm)", color: "var(--build-err)", background: "var(--build-err-tint)", padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--build-err)" }}>
                      {createError}
                    </div>
                  )}
                  <button
                    className="btn btn-accent"
                    onClick={handleCreate}
                    disabled={creating || !form.title.trim()}
                  >
                    {creating ? t("wizard.creating") : <><IconFile size={13} /> {t("wizard.btn_create")}</>}
                  </button>
                </div>
              )}
              </div>
            </div>
          </div>
        </main>
      </div>

      <TxStatusbar items={[
        { text: t("wizard.statusbar_active"), dot: "var(--accent)" },
        { icon: <IconFile size={11} />, text: t("wizard.statusbar_unsaved") },
        { right: true, text: t("wizard.esc_to_cancel") },
      ]} />
    </>
  );
}
