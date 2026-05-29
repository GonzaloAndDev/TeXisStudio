import { useEffect, useMemo, useState } from "react";
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

const BUILTIN_PROFILES: ProfileInfo[] = [
  {
    id: "generic.thesis",
    name: "Tesis genérica",
    description: "Estructura clásica para licenciatura, especialidad, maestría, doctorado o posdoctorado.",
    meta: "XeLaTeX · biber · APA 7",
    tags: ["tesis", "licenciatura", "especialidad", "maestria", "doctorado", "posdoctorado"],
    sections_count: 13,
    sections: [],
    author: "Gonzalo Andrade Estrella",
    version: "0.1.0",
    status: "draft" as ProfileStatus,
  },
  {
    id: "generic.tesina",
    name: "Tesina genérica",
    description: "Versión simplificada para licenciatura: introducción, desarrollo y cierre.",
    meta: "XeLaTeX · biber · APA 7",
    tags: ["tesina", "licenciatura"],
    sections_count: 6,
    sections: [],
    author: "Gonzalo Andrade Estrella",
    version: "0.1.0",
    status: "draft" as ProfileStatus,
  },
];

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

function defaultAcademicLevelForDocType(docType: string): AcademicLevel {
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
        reasons.push(`coincide con ${institution.trim()}`);
      }
      if (levelNorm && haystack.includes(levelNorm)) {
        score += 3;
        reasons.push(`cubre ${academicLevel}`);
      }
      if (disciplineNorm && haystack.includes(disciplineNorm)) {
        score += 2;
        reasons.push(`se alinea con el área ${discipline.trim()}`);
      }
      if (programNorm && haystack.includes(programNorm)) {
        score += 2;
        reasons.push(`menciona el programa ${programName.trim()}`);
      }
      if (docType === "tesina" && profile.id.includes("tesina")) {
        score += 2;
        reasons.push("está pensado para tesinas");
      }
      if (docType !== "tesina" && profile.id.includes("thesis")) {
        score += 1;
        reasons.push("sirve como base sólida para tesis");
      }
      if (profile.status === "verified") {
        score += 2;
        reasons.push("tiene verificación institucional");
      } else if (profile.status === "reviewed") {
        score += 1;
        reasons.push("ya fue revisado por el equipo");
      }

      return { profile, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0] ?? null;
}

function describePackKind(kind?: VocabPackEntry["pack_kind"]): string {
  switch (kind) {
    case "general":
      return "general";
    case "academic":
      return "académico";
    case "subject":
      return "por materia";
    case "program":
      return "por programa";
    case "discipline":
    default:
      return "por área";
  }
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
  const disciplineNorm = normalize(discipline);
  const programNorm = normalize(programName);

  return packs
    .map((pack) => {
      let score = 0;
      if (normalize(pack.base_language_hint ?? "") === langNorm) score += 4;
      if ((pack.pack_kind ?? "discipline") === "general") score += 1;
      if ((pack.pack_kind ?? "discipline") === "academic") score += 2;
      if (disciplineNorm && normalize(pack.discipline ?? "").includes(disciplineNorm)) score += 4;
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
  const options = [
    { id: "tesina", title: "Tesina", desc: "Trabajo corto o monográfico con estructura sencilla.", meta: "Licenciatura" },
    { id: "tesis", title: "Tesis", desc: "Investigación formal para licenciatura o posgrado.", meta: "Licenciatura · Maestría · Doctorado" },
    { id: "especialidad", title: "Especialidad", desc: "Trabajo profesional o clínico con requisitos más acotados.", meta: "Especialidad" },
    { id: "posdoctorado", title: "Posdoctorado", desc: "Reporte avanzado con énfasis en resultados y publicaciones.", meta: "Posdoctorado" },
  ];
  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        ¿Qué tipo de <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>trabajo académico</em> vas a crear?
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 28, maxWidth: 540 }}>
        TeXisStudio te propondrá una estructura inicial. Después podrás ajustar secciones, portada y requisitos institucionales.
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
          + Agregar
        </button>
      </div>
      {items.length === 0 && (
        <div style={{
          padding: "8px 12px", borderRadius: "var(--r-md)",
          border: "1px dashed var(--border-soft)", background: "var(--bg-app)",
          fontSize: "var(--fs-sm)", color: "var(--fg-faint)", textAlign: "center",
        }}>
          Ninguno — haz clic en «+ Agregar»
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
            title="Eliminar"
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
  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        Contexto <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>académico</em> y datos personales
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 20, maxWidth: 560 }}>
        Estos datos se usan para la portada, para recomendar el perfil correcto y para los metadatos del PDF.
      </p>

      {/* ── Contexto académico (institución primero) ── */}
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-faint)", marginBottom: 10 }}>
        Dónde estudias
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 820, marginBottom: 24 }}>
        <InputField label="Universidad / Institución" value={form.institution ?? ""} onChange={(v) => onChange("institution", v)} placeholder="UNAM, MIT, UNAM-IPN…" />
        <InputField label="Facultad / Departamento" value={form.faculty ?? ""} onChange={(v) => onChange("faculty", v)} placeholder="Facultad de Ingeniería" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-default)" }}>Nivel académico</label>
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
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </div>
        <InputField label="Área o disciplina" value={form.discipline ?? ""} onChange={(v) => onChange("discipline", v)} placeholder="Ingeniería eléctrica" />
        <InputField label="Programa" value={form.program_name ?? ""} onChange={(v) => onChange("program_name", v)} placeholder="Doctorado en Ciencias" />
        <InputField label="Ciudad" value={form.city ?? "Ciudad de México"} onChange={(v) => onChange("city", v)} placeholder="Ciudad de México" />
      </div>

      {/* ── Datos personales del trabajo ── */}
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-faint)", marginBottom: 10 }}>
        Tu trabajo
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 820 }}>
        <InputField label="Título del trabajo" value={form.title ?? ""} onChange={(v) => onChange("title", v)} placeholder="Análisis de…" />
        <InputField label="Tu nombre completo" value={form.full_name ?? ""} onChange={(v) => onChange("full_name", v)} placeholder="María García López" />
        <div /> {/* grid spacer */}
      </div>

      {/* Asesores */}
      <div style={{ maxWidth: 820, marginTop: 20 }}>
        <DynamicList
          label="Asesores"
          sublabel="(Director, Codirector, Sinodales…)"
          items={advisors}
          onChange={onAdvisors}
          placeholder="Dra. Ana Torres"
        />
      </div>

      {/* Co-autores */}
      <div style={{ maxWidth: 820, marginTop: 16 }}>
        <DynamicList
          label="Co-autores"
          sublabel="(para trabajos grupales)"
          items={coAuthors}
          onChange={onCoAuthors}
          placeholder="Luis Hernández"
        />
      </div>
    </>
  );
}

const PLACEMENT_SHORT: Record<string, string> = {
  front_matter: "Preliminares",
  body:         "Cuerpo",
  back_matter:  "Final",
  appendix:     "Anexos",
};

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
  const selProfile = profiles.find((p) => p.id === selected);
  const recommended = recommendProfile(
    profiles,
    docType,
    institution,
    academicLevel,
    discipline,
    programName,
  );
  const recommendedProfile = recommended?.profile;

  return (
    <div style={{ display: "flex", gap: 24, maxWidth: 900, alignItems: "flex-start" }}>
      {/* Listado */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
          Elige tu <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>perfil académico</em>
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 22, maxWidth: 500 }}>
          Nosotros te sugerimos uno. Si tu institución no aparece exacta, puedes empezar con la mejor coincidencia y cambiarlo después.
        </p>
        {recommendedProfile && (
          <div style={{
            marginBottom: 14, padding: "12px 14px", borderRadius: "var(--r-md)",
            background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
            fontSize: "var(--fs-sm)", color: "var(--accent-deep)", lineHeight: 1.6,
          }}>
            <strong>Recomendación inicial:</strong> {recommendedProfile.name}
            <div style={{ color: "var(--fg-muted)", marginTop: 4 }}>
              {recommended?.reasons.length
                ? `La elegimos porque ${recommended.reasons.join(", ")}.`
                : "La elegimos como punto de partida seguro para este tipo de trabajo."}
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
                        recomendado
                      </span>
                    )}
                    {selected === p.id && (
                      <span className="chip chip-accent" style={{ fontSize: 10 }}>
                        <IconCheck size={8} sw={2.5} /> seleccionado
                      </span>
                    )}
                  </div>
                </div>
                {p.description && (
                  <p style={{ margin: "3px 0 6px", fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.4 }}>{p.description}</p>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>{p.meta}</span>
                  {p.sections_count > 0 && (
                    <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>· {p.sections_count} secciones</span>
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
            <strong>¿No ves tu institución?</strong> Importa un perfil desde la{" "}
            <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => window.open("/library")}>Biblioteca</span>.
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
            Secciones del perfil
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
                  {PLACEMENT_SHORT[s.placement] ?? s.placement}
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
  const summaryRows = [
    ["Trabajo", docType],
    ["Nivel", form.academic_level || "Pendiente"],
    ["Título", form.title || "Pendiente"],
    ["Autoría", form.full_name || "Pendiente"],
    ["Institución", form.institution || "Pendiente"],
    ["Facultad / departamento", form.faculty || "Opcional"],
    ["Área", form.discipline || "Opcional"],
    ["Programa", form.program_name || "Opcional"],
    ["Perfil", profile?.name ?? "Pendiente"],
    ["Idioma del documento", documentLanguage.toUpperCase()],
    ["Carpeta de destino", outputPath || "Pendiente"],
  ];

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        Revisa tu <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>configuración inicial</em>
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 28, maxWidth: 620 }}>
        Estás a un paso de crear tu proyecto. Luego podrás escribir, revisar y entregar sin tocar LaTeX directamente.
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
              Asesores y comité
            </div>
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.6 }}>
              {advisors.filter((item) => item.trim()).length > 0 ? advisors.filter((item) => item.trim()).join(", ") : "Podrás agregarlos después."}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Coautores
            </div>
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.6 }}>
              {coAuthors.filter((item) => item.trim()).length > 0 ? coAuthors.filter((item) => item.trim()).join(", ") : "No definidos."}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Apoyos lingüísticos sugeridos
          </div>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.6 }}>
            {suggestedVocab.length > 0
              ? suggestedVocab.map((pack) => pack.name).join(", ")
              : "Podrás activar vocabularios académicos o disciplinares después desde Configuración."}
          </div>
        </div>
      </div>
    </>
  );
}

function StepLanguageSupport({
  documentLanguage,
  onDocumentLanguage,
  availableLanguages,
  recommendedPacks,
}: {
  documentLanguage: string;
  onDocumentLanguage: (lang: string) => void;
  availableLanguages: LangPackEntry[];
  recommendedPacks: VocabPackEntry[];
}) {
  const quickChoices = [
    { id: "es", name: "Español", note: "Bundled por defecto" },
    { id: "en", name: "English", note: "Bundled por defecto" },
    ...availableLanguages
      .filter((entry) => !["es", "en"].includes(entry.id))
      .slice(0, 6)
      .map((entry) => ({
        id: entry.id,
        name: entry.native_name || entry.name,
        note: entry.capabilities.spelling ? "Instalable para corrección" : "Disponible en catálogo",
      })),
  ];

  const uniqueChoices = quickChoices.filter(
    (entry, index, list) => list.findIndex((item) => item.id === entry.id) === index,
  );

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 6px", letterSpacing: "-0.015em" }}>
        Elige el <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>idioma principal</em> y tus apoyos
      </h1>
      <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-md)", marginBottom: 28, maxWidth: 620 }}>
        Esto no cambia la estructura del documento; solo nos ayuda a recomendar corrección ortográfica, gramática y vocabularios útiles para tu área.
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
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 8 }}>
          Pila sugerida para {documentLanguage.toUpperCase()}
        </div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 12 }}>
          Lo recomendable es combinar un diccionario general del idioma con vocabularios académicos y, si aplica, uno específico de tu área o programa.
        </div>
        {recommendedPacks.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {recommendedPacks.map((pack) => (
              <div
                key={pack.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  background: "var(--bg-app)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{pack.name}</span>
                  <span className="chip" style={{ fontSize: 10 }}>{describePackKind(pack.pack_kind)}</span>
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                  {pack.description}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
            No hay un vocabulario específico que coincida todavía con tu selección. Podrás activar uno general y añadir tu propio vocabulario después desde Configuración.
          </div>
        )}
      </div>
    </>
  );
}

export default function WizardView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lang: savedUiLang, spellLang: savedSpellLang, setLang, setSpellLang } = useSettingsStore();
  const { catalog, loadCatalog } = useLangPacksStore();
  const { officialPacks, loadOfficialCatalog } = useVocabPacksStore();
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
    city: "Ciudad de México",
    academic_level: defaultAcademicLevelForDocType("tesis"),
    discipline: "",
    program_name: "",
  });
  const [documentLanguage, setDocumentLanguage] = useState(savedSpellLang ?? savedUiLang ?? "es");
  const [advisors, setAdvisors] = useState<string[]>([""]);
  const [coAuthors, setCoAuthors] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileInfo[]>(BUILTIN_PROFILES);
  const [outputPath, setOutputPath] = useState("");
  const [cloudFolders, setCloudFolders] = useState<CloudFolder[]>([]);

  // Resolver path por defecto + cargar perfiles reales al montar
  useEffect(() => {
    resolveDocumentsPath().then(setOutputPath).catch(() => setOutputPath("/tmp"));
    api.getCloudFolders().then(setCloudFolders).catch(() => {});
    api.getProfiles()
      .then((loaded) => { if (loaded.length > 0) setProfiles(loaded); })
      .catch(() => {}); // silencioso, usa BUILTIN_PROFILES como fallback
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
        form.discipline ?? "",
        form.program_name ?? "",
      ),
    [documentLanguage, form.academic_level, form.discipline, form.program_name, officialPacks],
  );

  async function handlePickFolder() {
    const picked = await api.pickFolder();
    if (picked) setOutputPath(picked);
  }

  const steps = [
    { name: "Tipo de trabajo", hint: docType ? docType : "Tesina · Tesis · Posgrado" },
    { name: "Contexto académico", hint: form.institution || "Institución, grado y comité" },
    { name: "Perfil recomendado", hint: profiles.find((p) => p.id === profileId)?.name ?? "Estructura y normas" },
    { name: "Idioma y apoyo", hint: documentLanguage.toUpperCase() },
    { name: "Revisión final", hint: "Resumen antes de crear el proyecto" },
  ];

  async function handleCreate() {
    setCreateError(null);
    if (!form.title.trim()) {
      setCreateError("Escribe un título para el proyecto antes de continuar.");
      return;
    }
    if (!outputPath.trim()) {
      setCreateError("Selecciona una carpeta donde guardar el proyecto.");
      return;
    }
    setCreating(true);
    try {
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
          city: form.city.trim() || "Ciudad de México",
          keywords: seededKeywords.length > 0 ? seededKeywords : model.metadata.keywords,
        },
        institution: {
          ...model.institution,
          name: form.institution.trim() || "Universidad",
          faculty: form.faculty.trim() || undefined,
        },
        student: {
          ...model.student,
          full_name: form.full_name.trim() || "Autor",
          advisors: filledAdvisors,
          co_authors: filledCoAuthors,
        },
      };
      if (["es", "en"].includes(documentLanguage) || availableLanguages.some((entry) => entry.id === documentLanguage)) {
        setSpellLang(documentLanguage);
      }
      if (["es", "en"].includes(documentLanguage)) {
        setLang(documentLanguage);
      }
      await api.saveProject(result.project_path, enriched);
      const saved = await api.getProject(result.project_path);
      useProjectStore.getState().openProject(saved, result.project_path);
      navigate(`/project/${encodeURIComponent(result.project_path)}`);
    } catch (e) {
      console.error("Error creando proyecto:", e);
      setCreateError(`No se pudo crear el proyecto: ${e}`);
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
          Asistente de tesis · paso {step + 1} de {steps.length}
        </span>}
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>
            Cancelar <span className="kbd">Esc</span>
          </button>
        }
      />

      <div style={S.shell}>
        <aside style={S.rail}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-xl)", fontWeight: 500, color: "var(--fg-strong)", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            Asistente de tesis
          </h2>
          <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginBottom: 28 }}>
            Te guiamos para dejar listo el proyecto sin pedirte que conozcas LaTeX. Todo se puede ajustar después.
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
            <strong style={{ color: "var(--fg-default)", fontSize: "var(--fs-sm)" }}>¿Por qué un perfil?</strong>
            <br />
            Define clase LaTeX, paquetes, estilo de bibliografía y secciones. Se puede cambiar después.
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
              availableLanguages={availableLanguages}
              recommendedPacks={suggestedVocab.map((entry) => entry.pack)}
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
                  Carpeta donde se creará el proyecto
                </label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder="/ruta/a/documentos"
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
                    title="Explorar carpetas"
                    style={{ flexShrink: 0, padding: "6px 14px" }}
                  >
                    📁 Explorar…
                  </button>
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 5 }}>
                  Se creará una carpeta{" "}
                  <code style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{form.title || "mi-tesis"}/</code>{" "}
                  dentro de esta ruta.
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
                      Guarda en la nube para tener respaldo automático
                    </span>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                    Detectamos las siguientes carpetas de sincronización en tu equipo.
                    Haz clic para usarla como destino.
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
                              <IconCheck size={8} sw={2.5} /> seleccionado
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
                  <strong style={{ color: "var(--fg-default)" }}>💡 Tip: guarda en la nube</strong>
                  <br />
                  No detectamos OneDrive ni Google Drive en tu equipo. Para tener respaldo automático
                  puedes instalar{" "}
                  <em>OneDrive</em> (incluido en Windows) o{" "}
                  <em>Google Drive para escritorio</em>{" "}
                  y luego usar esa carpeta como destino. Tu tesis se sincronizará sola.
                </div>
              )}
            </div>
          )}

          <div style={S.footer}>
            {step > 0 ? (
              <button className="btn" onClick={() => setStep((s) => s - 1)}>
                <IconChevronL size={13} /> Atrás
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
                {profileId} · v0.1
              </span>
              {step < steps.length - 1 ? (
                <button className="btn btn-accent" onClick={() => setStep((s) => s + 1)}>
                  Continuar <IconChevronR size={13} />
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
                    {creating ? "Creando…" : <><IconFile size={13} /> Crear proyecto</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <TxStatusbar items={[
        { text: "Wizard activo", dot: "var(--accent)" },
        { icon: <IconFile size={11} />, text: "tesis.project.yaml (sin guardar)" },
        { right: true, text: "Esc para cancelar · ↵ para continuar" },
      ]} />
    </>
  );
}
