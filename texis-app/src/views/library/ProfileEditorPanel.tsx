import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconCheck, IconPlus, IconX } from "../../components/Icons";
import { api } from "../../lib/tauri";
import type { ProfileInfo, ProfileSectionInfo, ProfileUpdatePayload } from "../../types";
import { KNOWN_SECTION_ELEMENTS, PLACEMENT_COLOR } from "./constants";

// ── ProfileEditorPanel ────────────────────────────────────────────────────────

export function ProfileEditorPanel({ profile, onSave, onCancel }: {
  profile: ProfileInfo; onSave: (updated: ProfileInfo) => void; onCancel: () => void;
}) {
  const { t } = useTranslation();
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
    if (!name.trim()) { setError(t("library.profile_name_required")); return; }
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
          <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>{t("library.edit_profile")}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", marginLeft: 8 }}>{profile.id}</span>
        </div>
        <button onClick={onCancel} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}><IconX size={14} /></button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">
        <div style={{ marginBottom: 18 }}>
          <div style={sectionLabel}>{t("library.metadata")}</div>
          <div style={{ marginBottom: 10 }}><label style={labelStyle}>{t("library.name_required")}</label><input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} /></div>
          <div style={{ marginBottom: 10 }}><label style={labelStyle}>{t("library.description")}</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...fieldStyle, resize: "vertical" }} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div><label style={labelStyle}>{t("library.author")}</label><input value={author} onChange={(e) => setAuthor(e.target.value)} style={fieldStyle} /></div>
            <div><label style={labelStyle}>{t("library.version")}</label><input value={version} onChange={(e) => setVersion(e.target.value)} style={fieldStyle} /></div>
          </div>
          <div style={{ marginBottom: 10 }}><label style={labelStyle}>{t("library.license")}</label><input value={license} onChange={(e) => setLicense(e.target.value)} placeholder={t("library.license_placeholder")} style={fieldStyle} /></div>
          <div><label style={labelStyle}>{t("library.tags_comma")}</label><input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder={t("library.tags_placeholder")} style={fieldStyle} /></div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={sectionLabel}>{t("library.technical_config")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>{t("library.latex_engine")}</label>
              <select value={latexEngine} onChange={(e) => setLatexEngine(e.target.value)} style={fieldStyle}>
                <option value="xelatex">XeLaTeX</option>
                <option value="pdflatex">pdfLaTeX</option>
                <option value="lualatex">LuaLaTeX</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t("library.document_class")}</label>
              <select value={docClass} onChange={(e) => setDocClass(e.target.value)} style={fieldStyle}>
                <option value="book">book</option>
                <option value="article">article</option>
                <option value="report">report</option>
                <option value="memoir">memoir</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>{t("library.bibliography_style")}</label>
            <select value={bibStyle} onChange={(e) => setBibStyle(e.target.value)} style={fieldStyle}>
              <option value="apa">APA 7</option>
              <option value="vancouver">Vancouver</option>
              <option value="ieee">IEEE</option>
              <option value="chicago-notes">{t("library.bib_style_chicago_notes")}</option>
              <option value="chicago-authordate">{t("library.bib_style_chicago_authordate")}</option>
              <option value="mla">MLA 9</option>
              <option value="mhra">MHRA</option>
              <option value="abnt">ABNT</option>
              <option value="gb7714">GB/T 7714</option>
            </select>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={sectionLabel}>{t("library.sections_count", { count: sections.length })}</div>
            <button className="btn btn-sm" onClick={() => setAddingSection(!addingSection)} style={{ fontSize: 11, padding: "3px 8px" }}><IconPlus size={11} /> {t("common.add")}</button>
          </div>
          {addingSection && (
            <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--accent-tint)", border: "1px solid var(--accent-soft)", marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={labelStyle}>{t("library.section_type")}</label>
              <select value={newSectionEl} onChange={(e) => setNewSectionEl(e.target.value)} style={fieldStyle}>
                {KNOWN_SECTION_ELEMENTS.map((el) => <option key={el.id} value={el.id}>{t(`library.section_element.${el.id}`, { defaultValue: el.id })} ({t(`library.placement.${el.placement}`, { defaultValue: el.placement })})</option>)}
              </select>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-accent btn-sm" style={{ flex: 1 }} onClick={addSection}><IconCheck size={11} sw={2.5} /> {t("library.add_section")}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingSection(false)}>{t("common.cancel")}</button>
              </div>
            </div>
          )}
          {sections.map((sec, i) => (
            <div key={`${sec.id}-${i}`} style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", marginBottom: 5, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: PLACEMENT_COLOR[sec.placement] ?? "var(--fg-faint)" }} />
                <span style={{ flex: 1, fontSize: "var(--fs-xs)", color: "var(--fg-strong)", fontFamily: "var(--font-mono)" }}>{sec.id}</span>
                <button onClick={() => moveSection(i, -1)} disabled={i === 0} style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "var(--fg-faint)" : "var(--fg-muted)", padding: "0 2px", fontSize: 12 }} title={t("library.move_up")}>▲</button>
                <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} style={{ background: "none", border: "none", cursor: i === sections.length - 1 ? "default" : "pointer", color: i === sections.length - 1 ? "var(--fg-faint)" : "var(--fg-muted)", padding: "0 2px", fontSize: 12 }} title={t("library.move_down")}>▼</button>
                <button onClick={() => removeSection(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--build-err)", padding: "0 2px" }} title={t("library.delete_section")}><IconX size={11} /></button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select value={sec.placement} onChange={(e) => changePlacement(i, e.target.value)} style={{ ...fieldStyle, padding: "3px 6px", fontSize: 11, flex: 1 }}>
                  {["front_matter", "body", "back_matter", "appendix"].map((p) => <option key={p} value={p}>{t(`library.placement.${p}`)}</option>)}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--fg-muted)", cursor: "pointer", flexShrink: 0 }}>
                  <input type="checkbox" checked={sec.required} onChange={() => toggleRequired(i)} style={{ accentColor: "var(--accent)" }} />
                  {t("library.required")}
                </label>
              </div>
            </div>
          ))}
          {sections.length === 0 && <div style={{ padding: "16px 0", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-xs)" }}>{t("library.no_sections_add_one")}</div>}
        </div>

        {error && <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--build-err-tint, #ffeded)", color: "var(--build-err)", fontSize: "var(--fs-xs)", border: "1px solid var(--build-err)" }}>{error}</div>}
      </div>

      <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
        <button className="btn btn-accent" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
          {saving ? t("editor.saving") : <><IconCheck size={13} sw={2} /> {t("library.save_changes")}</>}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}
