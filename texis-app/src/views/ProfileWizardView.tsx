/**
 * ProfileWizardView — Asistente para crear un perfil propio de TeXisStudio.
 *
 * Pasos:
 *   1. Información básica  (nombre, ID, descripción, autor)
 *   2. Configuración LaTeX (motor, clase de documento, bibliografía)
 *   3. Secciones           (agregar / reordenar / eliminar)
 *   4. Revisar y crear
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconCheck, IconChevronD, IconChevronL, IconPlus, IconTrash, IconX,
} from "../components/Icons";
import { api } from "../lib/tauri";
import type { ProfileSectionInfo, ProfileUpdatePayload } from "../types";

// ── Catálogo de secciones predefinidas ────────────────────────────

const SECTION_CATALOG: { id: string; placement: string; required: boolean }[] = [
  { id: "title_page",            placement: "front_matter", required: true  },
  { id: "abstract",              placement: "front_matter", required: false },
  { id: "acknowledgements",      placement: "front_matter", required: false },
  { id: "table_of_contents",     placement: "front_matter", required: false },
  { id: "list_of_figures",       placement: "front_matter", required: false },
  { id: "list_of_tables",        placement: "front_matter", required: false },
  { id: "introduction",          placement: "body",         required: true  },
  { id: "theoretical_framework", placement: "body",         required: false },
  { id: "methodology",           placement: "body",         required: false },
  { id: "results",               placement: "body",         required: false },
  { id: "discussion",            placement: "body",         required: false },
  { id: "conclusions",           placement: "body",         required: true  },
  { id: "references",            placement: "back_matter",  required: true  },
  { id: "appendix_a",            placement: "appendix",     required: false },
];

// PLACEMENT_LABEL is built dynamically inside the component using i18n

const PLACEMENT_COLOR: Record<string, string> = {
  front_matter: "var(--accent)",
  body:         "#3AA396",
  back_matter:  "#7C6EAF",
  appendix:     "var(--fg-muted)",
};

const BIBTEX_SAFE_STYLES = new Set([
  "numeric", "numeric-comp", "numeric-verb",
  "alphabetic", "alphabetic-verb",
  "authoryear", "authoryear-comp", "authoryear-ibid", "authoryear-icomp",
  "authortitle", "authortitle-comp", "authortitle-ibid", "authortitle-icomp",
  "authortitle-terse", "authortitle-tcomp", "authortitle-ticomp",
]);

// ── Helpers ───────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 60);
}

function recommendedBibliographyBackend(style: string): string {
  return BIBTEX_SAFE_STYLES.has(style) ? "bibtex" : "biber";
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

// ── Componentes de paso ───────────────────────────────────────────

function StepHeader({ step, total, title }: { step: number; total: number; title: string }) {
  const { t } = useTranslation();
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              height: 4, flex: 1, borderRadius: 2,
              background: i < step ? "var(--accent)" : i === step ? "var(--accent)" : "var(--border-firm)",
              opacity: i < step ? 0.4 : 1,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4 }}>
        {t("profile_wizard.step_of", { current: step + 1, total })}
      </div>
      <h2 style={{ margin: 0, fontSize: "var(--fs-xl)", fontWeight: 600, color: "var(--fg-strong)" }}>
        {title}
      </h2>
    </div>
  );
}

function Field({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-default)", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", fontSize: "var(--fs-sm)",
  background: "var(--bg-app)", border: "1px solid var(--border-firm)",
  borderRadius: "var(--r-sm)", color: "var(--fg-strong)", outline: "none",
  boxSizing: "border-box",
};

function SelectField({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, cursor: "pointer" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Vista principal ───────────────────────────────────────────────

export default function ProfileWizardView() {
  const { t } = useTranslation();
  const placementLabel = useMemo<Record<string, string>>(() => ({
    front_matter: t("profile_wizard.placement_front"),
    body:         t("profile_wizard.placement_body"),
    back_matter:  t("profile_wizard.placement_back_matter"),
    appendix:     t("profile_wizard.placement_appendix"),
  }), [t]);
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Estado del formulario ─────────────────────────────────────

  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState("");
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [version, setVersion] = useState("0.1.0");
  const [tags, setTags] = useState("");

  const [engine, setEngine] = useState("xelatex");
  const [docClass, setDocClass] = useState("book");
  const [bibBackend, setBibBackend] = useState("biber");
  const [bibStyle, setBibStyle] = useState("apa");

  const [sections, setSections] = useState<ProfileSectionInfo[]>([
    { id: "title_page",    element_id: "title_page",    placement: "front_matter", required: true,  title: undefined, label: undefined },
    { id: "introduction",  element_id: "introduction",  placement: "body",         required: true,  title: t("library.section_element.introduction"), label: undefined },
    { id: "conclusions",   element_id: "conclusions",   placement: "body",         required: true,  title: t("library.section_element.conclusions"), label: undefined },
    { id: "references",    element_id: "references",    placement: "back_matter",  required: true,  title: undefined, label: undefined },
  ]);

  const [showCatalog, setShowCatalog] = useState(false);
  const [customSection, setCustomSection] = useState({ id: "", title: "", placement: "body" as string });
  const [sourceUrls, setSourceUrls] = useState("");
  const [reviewIntervalDays, setReviewIntervalDays] = useState("180");
  const [paper, setPaper] = useState("letterpaper");
  const [marginTop, setMarginTop] = useState("");
  const [marginBottom, setMarginBottom] = useState("");
  const [marginLeft, setMarginLeft] = useState("");
  const [marginRight, setMarginRight] = useState("");
  const [lineSpacing, setLineSpacing] = useState("1.5");
  const [maxWords, setMaxWords] = useState("");
  const [maxAbstractWords, setMaxAbstractWords] = useState("");
  const [pdfaRequired, setPdfaRequired] = useState(false);
  const [pdfaLevel, setPdfaLevel] = useState("PDF/A-1b");
  const [qualityChecks, setQualityChecks] = useState({
    sources: false,
    titlePage: false,
    layout: false,
    bibliography: false,
    compileSample: false,
    externalAssets: false,
  });

  // ── Derivados ─────────────────────────────────────────────────

  function handleNameChange(v: string) {
    setName(v);
    if (!idManuallyEdited) {
      setProfileId(slugify(v));
    }
  }

  const steps = [
    t("profile_wizard.step_info"),
    t("profile_wizard.step_latex"),
    t("profile_wizard.step_sections"),
    t("profile_wizard.step_quality"),
    t("profile_wizard.step_review"),
  ];
  const qualityDone = Object.values(qualityChecks).filter(Boolean).length;
  const qualityTotal = Object.keys(qualityChecks).length;

  function handleBibStyleChange(style: string) {
    setBibStyle(style);
    setBibBackend(recommendedBibliographyBackend(style));
  }

  const canNext = [
    name.trim().length > 0 && profileId.trim().length > 0,
    true,
    sections.length > 0,
    true,
    true,
  ];

  // ── Acciones de secciones ─────────────────────────────────────

  function addFromCatalog(entry: typeof SECTION_CATALOG[0]) {
    if (sections.some((s) => s.id === entry.id)) return;
    setSections((prev) => [...prev, {
      id: entry.id,
      element_id: entry.id,
      placement: entry.placement,
      required: entry.required,
      title: t(`library.section_element.${entry.id}`),
      label: undefined,
    }]);
  }

  function addCustomSection() {
    const id = slugify(customSection.id || customSection.title);
    if (!id) return;
    if (sections.some((s) => s.id === id)) {
      setError(t("profile_wizard.error_duplicate_section"));
      return;
    }
    setSections((prev) => [...prev, {
      id,
      element_id: id,
      placement: customSection.placement,
      required: false,
      title: customSection.title || id,
      label: undefined,
    }]);
    setCustomSection({ id: "", title: "", placement: "body" });
  }

  function removeSection(idx: number) {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveSection(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= sections.length) return;
    setSections((prev) => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  // ── Guardar ───────────────────────────────────────────────────

  async function handleCreate() {
    setError(null);
    setSaving(true);
    try {
      const payload: ProfileUpdatePayload = {
        name: name.trim(),
        description: description.trim() || undefined,
        author: author.trim() || undefined,
        version: version.trim() || "0.1.0",
        license: undefined,
        latex_engine: engine,
        document_class: docClass,
        bibliography_backend: bibBackend,
        bibliography_style: bibStyle,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        sections,
        source_urls: splitLines(sourceUrls),
        review_interval_days: optionalNumber(reviewIntervalDays),
        page_layout: {
          paper: paper.trim() || undefined,
          margins: {
            top: marginTop.trim() || undefined,
            bottom: marginBottom.trim() || undefined,
            left: marginLeft.trim() || undefined,
            right: marginRight.trim() || undefined,
          },
          line_spacing: optionalNumber(lineSpacing),
        },
        max_words: optionalNumber(maxWords),
        max_abstract_words: optionalNumber(maxAbstractWords),
        pdf_requirements: pdfaRequired ? {
          pdfa: { required: true, level: pdfaLevel.trim() || undefined },
        } : undefined,
      };
      await api.createProfile(profileId.trim(), payload);
      navigate("/library");
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <TxAppbar
        left={
          <>
            <TxLogo />
            <TxBreadcrumb parts={[t("library.title"), t("profile_wizard.new_profile")]} />
          </>
        }
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/library")}>
            <IconX size={13} /> {t("common.cancel")}
          </button>
        }
      />

      <div style={{
        flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start",
        overflow: "auto", background: "var(--bg-app)", padding: "32px 16px",
      }} className="scroll">
        <div style={{ width: "100%", maxWidth: 620 }}>

          <StepHeader step={step} total={steps.length} title={steps[step]} />

          {error && (
            <div style={{
              padding: "10px 14px", marginBottom: 18, borderRadius: "var(--r-sm)",
              background: "rgba(224,80,80,0.10)", color: "#E08080",
              fontSize: "var(--fs-sm)", display: "flex", gap: 8, alignItems: "center",
            }}>
              <IconX size={13} /> {error}
              <button style={{ marginLeft: "auto", background: "none", border: "none", color: "#E08080", cursor: "pointer" }} onClick={() => setError(null)}>
                <IconX size={11} />
              </button>
            </div>
          )}

          {/* ── Paso 0: Información básica ─────────────────────── */}
          {step === 0 && (
            <div>
              <Field label={t("profile_wizard.profile_name_required")} hint={t("profile_wizard.profile_name_hint")}>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={t("profile_wizard.profile_name_placeholder")}
                  autoFocus
                />
              </Field>
              <Field
                label={t("profile_wizard.profile_id_required")}
                hint={t("profile_wizard.profile_id_hint")}
              >
                <input
                  style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 13 }}
                  value={profileId}
                  onChange={(e) => { setProfileId(e.target.value); setIdManuallyEdited(true); }}
                  placeholder={t("profile_wizard.profile_id_placeholder")}
                />
              </Field>
              <Field label={t("library.description")}>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("profile_wizard.description_placeholder")}
                />
              </Field>
              <Field label={t("library.author")}>
                <input style={inputStyle} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t("profile_wizard.author_placeholder")} />
              </Field>
              <Field label={t("library.version")} hint={t("profile_wizard.version_hint")}>
                <input style={{ ...inputStyle, width: 140 }} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="0.1.0" />
              </Field>
              <Field label={t("profile_wizard.tags")} hint={t("profile_wizard.tags_hint")}>
                <input style={inputStyle} value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("profile_wizard.tags_placeholder")} />
              </Field>
            </div>
          )}

          {/* ── Paso 1: Configuración LaTeX ────────────────────── */}
          {step === 1 && (
            <div>
              <Field label={t("profile_wizard.latex_engine_label")} hint={t("profile_wizard.latex_engine_hint")}>
                <SelectField
                  value={engine}
                  onChange={setEngine}
                  options={[
                    { value: "xelatex",  label: t("profile_wizard.engine_xelatex") },
                    { value: "pdflatex", label: t("profile_wizard.engine_pdflatex") },
                    { value: "lualatex", label: t("profile_wizard.engine_lualatex") },
                  ]}
                />
              </Field>
              <Field label={t("profile_wizard.doc_class_label")} hint={t("profile_wizard.doc_class_hint")}>
                <SelectField
                  value={docClass}
                  onChange={setDocClass}
                  options={[
                    { value: "book",    label: t("profile_wizard.class_book") },
                    { value: "article", label: t("profile_wizard.class_article") },
                    { value: "report",  label: t("profile_wizard.class_report") },
                  ]}
                />
              </Field>
              <Field label={t("profile_wizard.bib_backend_label")}>
                <SelectField
                  value={bibBackend}
                  onChange={setBibBackend}
                  options={[
                    { value: "biber",  label: t("profile_wizard.bib_biber") },
                    { value: "bibtex", label: t("profile_wizard.bib_bibtex") },
                  ]}
                />
              </Field>
              <Field label={t("profile_wizard.bib_style_label")}>
                <SelectField
                  value={bibStyle}
                  onChange={handleBibStyleChange}
                  options={[
                    { value: "apa",       label: t("profile_wizard.bib_apa") },
                    { value: "ieee",      label: t("profile_wizard.bib_ieee") },
                    { value: "vancouver", label: t("profile_wizard.bib_vancouver") },
                    { value: "chicago-notes", label: t("library.bib_style_chicago_notes") },
                    { value: "chicago-authordate", label: t("library.bib_style_chicago_authordate") },
                    { value: "mla",       label: t("profile_wizard.bib_mla") },
                    { value: "mhra",      label: "MHRA" },
                    { value: "abnt",      label: "ABNT NBR 6023:2018" },
                    { value: "gb7714-2015", label: t("styles.builtins.gb7714.full_name") },
                    { value: "numeric",   label: t("profile_wizard.bib_numeric") },
                  ]}
                />
              </Field>
            </div>
          )}

          {/* ── Paso 2: Secciones ─────────────────────────────── */}
          {step === 2 && (
            <div>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginTop: 0 }}>
                {t("profile_wizard.sections_intro")}
              </p>

              {/* Lista de secciones */}
              <div style={{ marginBottom: 16 }}>
                {sections.map((s, i) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px", marginBottom: 4,
                      background: "var(--bg-panel)", borderRadius: "var(--r-sm)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "1px 4px", fontSize: 10 }}
                        onClick={() => moveSection(i, -1)}
                        disabled={i === 0}
                      >▲</button>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "1px 4px", fontSize: 10 }}
                        onClick={() => moveSection(i, 1)}
                        disabled={i === sections.length - 1}
                      >▼</button>
                    </div>
                    <div
                      style={{
                        width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                        background: PLACEMENT_COLOR[s.placement] ?? "var(--fg-faint)",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-strong)" }}>
                        {s.title || s.id}
                      </span>
                      <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginLeft: 8 }}>
                        {placementLabel[s.placement] ?? s.placement}
                        {s.required && (
                          <span style={{ marginLeft: 6, color: "var(--accent)" }}>{t("profile_wizard.section_required")}</span>
                        )}
                      </span>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => removeSection(i)}
                      style={{ color: "var(--fg-faint)", padding: "3px 6px" }}
                    >
                      <IconTrash size={11} />
                    </button>
                  </div>
                ))}

                {sections.length === 0 && (
                  <div style={{ textAlign: "center", color: "var(--fg-faint)", padding: "24px 0", fontSize: "var(--fs-sm)" }}>
                    {t("profile_wizard.no_sections")}
                  </div>
                )}
              </div>

              {/* Botón catálogo */}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowCatalog((v) => !v)}
                style={{ marginBottom: 12 }}
              >
                <IconPlus size={11} />
                {showCatalog ? t("profile_wizard.hide_catalog") : t("profile_wizard.add_from_catalog")}
                <IconChevronD size={11} />
              </button>

              {showCatalog && (
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16,
                  padding: 12, background: "var(--bg-panel)", borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border-subtle)",
                }}>
                  {SECTION_CATALOG.map((entry) => {
                    const alreadyAdded = sections.some((s) => s.id === entry.id);
                    return (
                      <button
                        key={entry.id}
                        className="btn btn-ghost btn-sm"
                        disabled={alreadyAdded}
                        onClick={() => addFromCatalog(entry)}
                        style={{
                          justifyContent: "flex-start", gap: 6,
                          opacity: alreadyAdded ? 0.4 : 1,
                        }}
                      >
                        <span
                          style={{
                            width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                            background: PLACEMENT_COLOR[entry.placement] ?? "var(--fg-faint)",
                          }}
                        />
                        {t(`library.section_element.${entry.id}`)}
                        {alreadyAdded && <IconCheck size={10} style={{ marginLeft: "auto", opacity: 0.5 }} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Sección personalizada */}
              <div style={{
                padding: 12, background: "var(--bg-panel)", borderRadius: "var(--r-sm)",
                border: "1px solid var(--border-subtle)",
              }}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 8 }}>
                  {t("profile_wizard.custom_section")}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ ...inputStyle, flex: 2 }}
                    value={customSection.title}
                    onChange={(e) => setCustomSection((v) => ({ ...v, title: e.target.value }))}
                    placeholder={t("profile_wizard.section_title_placeholder")}
                    onKeyDown={(e) => { if (e.key === "Enter") addCustomSection(); }}
                  />
                  <select
                    value={customSection.placement}
                    onChange={(e) => setCustomSection((v) => ({ ...v, placement: e.target.value }))}
                    style={{ ...inputStyle, flex: 1, cursor: "pointer" }}
                  >
                    <option value="front_matter">{t("profile_wizard.placement_front")}</option>
                    <option value="body">{t("profile_wizard.placement_body")}</option>
                    <option value="back_matter">{t("profile_wizard.placement_back_matter")}</option>
                    <option value="appendix">{t("profile_wizard.placement_appendix")}</option>
                  </select>
                  <button className="btn btn-accent btn-sm" onClick={addCustomSection}>
                    <IconPlus size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Paso 3: Calidad profesional ───────────────────── */}
          {step === 3 && (
            <div>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginTop: 0 }}>
                {t("profile_wizard.quality_intro")}
              </p>

              <div style={{
                padding: 12, background: "var(--bg-panel)", borderRadius: "var(--r-sm)",
                border: "1px solid var(--border-subtle)", marginBottom: 16,
              }}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 8 }}>
                  {t("profile_wizard.source_urls_label")}
                </div>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 76, fontFamily: "var(--font-mono)", fontSize: 12 }}
                  value={sourceUrls}
                  onChange={(e) => setSourceUrls(e.target.value)}
                  placeholder={t("profile_wizard.source_urls_placeholder")}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("profile_wizard.review_interval_label")}</span>
                  <input
                    style={{ ...inputStyle, width: 96 }}
                    value={reviewIntervalDays}
                    onChange={(e) => setReviewIntervalDays(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div style={{
                padding: 12, background: "var(--bg-panel)", borderRadius: "var(--r-sm)",
                border: "1px solid var(--border-subtle)", marginBottom: 16,
              }}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 8 }}>
                  {t("profile_wizard.layout_requirements")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input style={inputStyle} value={paper} onChange={(e) => setPaper(e.target.value)} placeholder={t("profile_wizard.paper_placeholder")} />
                  <input style={inputStyle} value={lineSpacing} onChange={(e) => setLineSpacing(e.target.value)} placeholder={t("profile_wizard.line_spacing_placeholder")} />
                  <input style={inputStyle} value={maxAbstractWords} onChange={(e) => setMaxAbstractWords(e.target.value)} placeholder={t("profile_wizard.abstract_words_placeholder")} inputMode="numeric" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
                  <input style={inputStyle} value={marginTop} onChange={(e) => setMarginTop(e.target.value)} placeholder={t("profile_wizard.margin_top_placeholder")} />
                  <input style={inputStyle} value={marginBottom} onChange={(e) => setMarginBottom(e.target.value)} placeholder={t("profile_wizard.margin_bottom_placeholder")} />
                  <input style={inputStyle} value={marginLeft} onChange={(e) => setMarginLeft(e.target.value)} placeholder={t("profile_wizard.margin_left_placeholder")} />
                  <input style={inputStyle} value={marginRight} onChange={(e) => setMarginRight(e.target.value)} placeholder={t("profile_wizard.margin_right_placeholder")} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input style={inputStyle} value={maxWords} onChange={(e) => setMaxWords(e.target.value)} placeholder={t("profile_wizard.max_words_placeholder")} inputMode="numeric" />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
                    <input type="checkbox" checked={pdfaRequired} onChange={(e) => setPdfaRequired(e.target.checked)} />
                    {t("profile_wizard.pdfa_required")}
                    {pdfaRequired && (
                      <input style={{ ...inputStyle, width: 120 }} value={pdfaLevel} onChange={(e) => setPdfaLevel(e.target.value)} />
                    )}
                  </label>
                </div>
              </div>

              <div style={{
                padding: 12, background: "var(--bg-panel)", borderRadius: "var(--r-sm)",
                border: "1px solid var(--border-subtle)",
              }}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 8 }}>
                  {t("profile_wizard.quality_checklist", { done: qualityDone, total: qualityTotal })}
                </div>
                {(["sources", "titlePage", "layout", "bibliography", "compileSample", "externalAssets"] as const).map((key) => (
                  <label key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: "var(--fs-sm)", color: "var(--fg-default)", marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={qualityChecks[key]}
                      onChange={(e) => setQualityChecks((prev) => ({ ...prev, [key]: e.target.checked }))}
                      style={{ marginTop: 2 }}
                    />
                    <span>{t(`profile_wizard.quality_${key}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Paso 4: Revisar y crear ───────────────────────── */}
          {step === 4 && (
            <div>
              <div style={{
                background: "var(--bg-panel)", borderRadius: "var(--r-md)",
                border: "1px solid var(--border-subtle)", padding: "18px 20px", marginBottom: 16,
              }}>
                <div style={{ fontSize: "var(--fs-lg)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 4 }}>
                  {name}
                </div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontFamily: "var(--font-mono)", marginBottom: 12 }}>
                  ID: {profileId}
                </div>
                {description && (
                  <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", marginBottom: 12 }}>
                    {description}
                  </div>
                )}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: "var(--fs-sm)", color: "var(--fg-default)" }}>
                  <span>⚙ {engine === "xelatex" ? "XeLaTeX" : engine === "pdflatex" ? "pdfLaTeX" : "LuaLaTeX"}</span>
                  <span>📄 {docClass}</span>
                  <span>📚 {bibStyle.toUpperCase()} · {bibBackend}</span>
                  <span>📋 {t("profile_wizard.sections_count", { count: sections.length })}</span>
                  <span>{t("profile_wizard.quality_summary", { done: qualityDone, total: qualityTotal })}</span>
                  {author && <span>✍ {author}</span>}
                  <span>🏷 v{version}</span>
                </div>
              </div>

              {/* Resumen de secciones */}
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 8 }}>
                {t("profile_wizard.included_sections")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
                {sections.map((s) => (
                  <span
                    key={s.id}
                    style={{
                      padding: "3px 8px", borderRadius: "var(--r-md)", fontSize: "var(--fs-xs)",
                      background: "var(--bg-panel)", border: "1px solid var(--border-subtle)",
                      color: PLACEMENT_COLOR[s.placement] ?? "var(--fg-default)",
                    }}
                  >
                    {s.title || s.id}
                  </span>
                ))}
              </div>

              <div style={{
                padding: "12px 14px", borderRadius: "var(--r-sm)", fontSize: "var(--fs-sm)",
                background: "var(--accent-tint)", color: "var(--accent-deep)", marginBottom: 20,
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <IconCheck size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  {t("profile_wizard.review_notice")}
                </div>
              </div>
            </div>
          )}

          {/* ── Navegación ───────────────────────────────────── */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button
              className="btn btn-ghost"
              onClick={() => step > 0 ? setStep((s) => s - 1) : navigate("/library")}
            >
              <IconChevronL size={13} />
              {step === 0 ? t("common.cancel") : t("common.back")}
            </button>

            {step < steps.length - 1 ? (
              <button
                className="btn btn-accent"
                disabled={!canNext[step]}
                onClick={() => setStep((s) => s + 1)}
              >
                {t("common.next")} →
              </button>
            ) : (
              <button
                className="btn btn-accent"
                disabled={saving || sections.length === 0}
                onClick={handleCreate}
              >
                {saving ? t("wizard.creating") : <><IconCheck size={13} /> {t("library.create_profile")}</>}
              </button>
            )}
          </div>

        </div>
      </div>

      <TxStatusbar items={[
        { text: t("profile_wizard.new_profile") },
        { text: `${t("profile_wizard.step_of", { current: step + 1, total: steps.length })}: ${steps[step]}` },
      ]} />
    </>
  );
}
