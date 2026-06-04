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
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconCheck, IconChevronD, IconChevronL, IconPlus, IconTrash, IconX,
} from "../components/Icons";
import { api } from "../lib/tauri";
import type { ProfileSectionInfo, ProfileUpdatePayload } from "../types";

// ── Catálogo de secciones predefinidas ────────────────────────────

const SECTION_CATALOG: { id: string; label: string; placement: string; required: boolean }[] = [
  { id: "title_page",           label: "Portada",                placement: "front_matter", required: true  },
  { id: "abstract",             label: "Resumen / Abstract",     placement: "front_matter", required: false },
  { id: "acknowledgements",     label: "Agradecimientos",        placement: "front_matter", required: false },
  { id: "table_of_contents",    label: "Tabla de contenidos",    placement: "front_matter", required: false },
  { id: "list_of_figures",      label: "Lista de figuras",       placement: "front_matter", required: false },
  { id: "list_of_tables",       label: "Lista de tablas",        placement: "front_matter", required: false },
  { id: "introduction",         label: "Introducción",           placement: "body",         required: true  },
  { id: "theoretical_framework",label: "Marco teórico",          placement: "body",         required: false },
  { id: "methodology",          label: "Metodología",            placement: "body",         required: false },
  { id: "results",              label: "Resultados",             placement: "body",         required: false },
  { id: "discussion",           label: "Discusión",              placement: "body",         required: false },
  { id: "conclusions",          label: "Conclusiones",           placement: "body",         required: true  },
  { id: "references",           label: "Referencias",            placement: "back_matter",  required: true  },
  { id: "appendix_a",           label: "Apéndice A",             placement: "appendix",     required: false },
];

// PLACEMENT_LABEL is built dynamically inside the component using i18n

const PLACEMENT_COLOR: Record<string, string> = {
  front_matter: "var(--accent)",
  body:         "#3AA396",
  back_matter:  "#7C6EAF",
  appendix:     "var(--fg-muted)",
};

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
  const { id: editId } = useParams<{ id?: string }>();
  const isEditing = !!editId;

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
    { id: "introduction",  element_id: "introduction",  placement: "body",         required: true,  title: "Introducción", label: undefined },
    { id: "conclusions",   element_id: "conclusions",   placement: "body",         required: true,  title: "Conclusiones", label: undefined },
    { id: "references",    element_id: "references",    placement: "back_matter",  required: true,  title: undefined, label: undefined },
  ]);

  const [showCatalog, setShowCatalog] = useState(false);
  const [customSection, setCustomSection] = useState({ id: "", title: "", placement: "body" as string });

  // ── Derivados ─────────────────────────────────────────────────

  function handleNameChange(v: string) {
    setName(v);
    if (!idManuallyEdited) {
      setProfileId(slugify(v));
    }
  }

  const steps = [t("profile_wizard.step_info"), t("profile_wizard.step_latex"), t("profile_wizard.step_sections"), t("profile_wizard.step_review")];

  const canNext = [
    name.trim().length > 0 && profileId.trim().length > 0,
    true,
    sections.length > 0,
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
      title: entry.label,
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
            <TxBreadcrumb parts={[t("library.title"), isEditing ? t("profile_wizard.editing_profile") : t("profile_wizard.new_profile")]} />
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
                  onChange={setBibStyle}
                  options={[
                    { value: "apa",       label: t("profile_wizard.bib_apa") },
                    { value: "ieee",      label: t("profile_wizard.bib_ieee") },
                    { value: "vancouver", label: t("profile_wizard.bib_vancouver") },
                    { value: "chicago",   label: t("profile_wizard.bib_chicago") },
                    { value: "mla",       label: t("profile_wizard.bib_mla") },
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
                        {entry.label}
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

          {/* ── Paso 3: Revisar y crear ───────────────────────── */}
          {step === 3 && (
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
        { text: isEditing ? t("profile_wizard.editing_profile") : t("profile_wizard.new_profile") },
        { text: `${t("profile_wizard.step_of", { current: step + 1, total: steps.length })}: ${steps[step]}` },
      ]} />
    </>
  );
}
