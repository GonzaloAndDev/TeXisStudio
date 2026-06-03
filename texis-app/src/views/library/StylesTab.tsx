import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconCheck, IconEdit, IconLayers, IconPlus, IconRefresh, IconSearch, IconTrash, IconX } from "../../components/Icons";
import { api } from "../../lib/tauri";
import { TYPE_LABEL, CitationStyle, BUILTIN_STYLES, loadStyles, saveStyles } from "./constants";

// ── StylesTab ─────────────────────────────────────────────────────────────────

// Entrada de muestra para el preview bibliográfico (P4.2)
// Renderiza *cursiva* y **negrita** en el texto de preview
function renderPreviewText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

const PREVIEW_BIBTEX = `@article{smith2024,
  author  = {Smith, John A. and Jones, Mary B.},
  title   = {Machine Learning Applications in Academic Writing},
  journal = {Journal of Educational Technology},
  year    = {2024},
  volume  = {15},
  number  = {3},
  pages   = {234--256},
  doi     = {10.1000/xyz123},
}`;

export function StylesTab() {
  const { t } = useTranslation();
  const [styles, setStyles]           = useState<CitationStyle[]>(loadStyles);
  const [selected, setSelected]       = useState<CitationStyle | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [editingCustom, setEditingCustom] = useState<CitationStyle | null>(null);
  const [search, setSearch]           = useState("");
  const [preview, setPreview]         = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // New/edit form state
  const emptyForm = { id: "", name: "", full_name: "", type: "author_date" as const, biblatex_style: "", in_text_format: "", bibliography_title: "References", description: "", disciplines: "" };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  useEffect(() => { saveStyles(styles); }, [styles]);

  useEffect(() => {
    if (!selected) { setPreview(null); return; }
    setPreviewLoading(true);
    setPreview(null);
    api.previewBibEntry(PREVIEW_BIBTEX, selected.biblatex_style)
      .then((text) => setPreview(text))
      .catch(() => setPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [selected]);

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
      setFormError(t("styles.required_fields")); return;
    }
    if (!editingCustom && styles.some((s) => s.id === form.id.trim())) {
      setFormError(t("styles.duplicate_id")); return;
    }
    const newStyle: CitationStyle = {
      id: form.id.trim(), name: form.name.trim(), full_name: form.full_name.trim() || form.name.trim(),
      type: form.type, biblatex_style: form.biblatex_style.trim(),
      in_text_format: form.in_text_format.trim() || t("styles.default_in_text_format"),
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
    if (!window.confirm(t("styles.reset_confirm"))) return;
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
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>{t("styles.title")}</h1>
            <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>
              {t("styles.subtitle")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={resetToDefaults} title={t("styles.restore_defaults")} style={{ fontSize: 11 }}>
              <IconRefresh size={12} /> {t("styles.restore")}
            </button>
            <button className="btn btn-accent btn-sm" onClick={openAdd}>
              <IconPlus size={13} /> {t("styles.add_style")}
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: 380, marginBottom: 20 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-faint)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("styles.search_placeholder")} style={{ width: "100%", padding: "7px 12px 7px 32px", borderRadius: "var(--r-md)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-base)", color: "var(--fg-strong)", outline: "none" }} />
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
                      {style.builtin ? t("styles.builtin") : t("styles.custom")}
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
                  <button onClick={(e) => { e.stopPropagation(); moveStyle(realIdx, -1); }} disabled={realIdx === 0} style={{ background: "none", border: "none", cursor: realIdx === 0 ? "default" : "pointer", color: realIdx === 0 ? "var(--fg-faint)" : "var(--fg-muted)", padding: "2px 4px", fontSize: 13 }} title={t("library.move_up")}>▲</button>
                  <button onClick={(e) => { e.stopPropagation(); moveStyle(realIdx, 1); }} disabled={realIdx === styles.length - 1} style={{ background: "none", border: "none", cursor: realIdx === styles.length - 1 ? "default" : "pointer", color: realIdx === styles.length - 1 ? "var(--fg-faint)" : "var(--fg-muted)", padding: "2px 4px", fontSize: 13 }} title={t("library.move_down")}>▼</button>
                  {!style.builtin && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(style); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-muted)", padding: "2px 4px" }} title={t("common.edit")}><IconEdit size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteCustom(style); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--build-err)", padding: "2px 4px" }} title={t("common.delete")}><IconTrash size={12} /></button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "16px 0", fontSize: "var(--fs-xs)", color: "var(--fg-faint)", borderTop: "1px solid var(--border-subtle)", marginTop: 12 }}>
          {t("styles.footer_summary", { total: styles.length, custom: styles.filter((s) => !s.builtin).length })}
        </div>
      </div>

      {/* Detail / Form panel */}
      <div style={{ width: 340, flexShrink: 0, borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {addingCustom ? (
          <>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>{editingCustom ? t("styles.edit_style") : t("styles.new_style")}</span>
              <button onClick={() => setAddingCustom(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}><IconX size={14} /></button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">
              {[
                { key: "id",           label: "ID *",                  placeholder: "mi_estilo_v1" },
                { key: "name",         label: t("styles.name_required"),              placeholder: t("styles.name_placeholder") },
                { key: "full_name",    label: t("styles.full_name"),       placeholder: t("styles.full_name_placeholder") },
                { key: "biblatex_style", label: "Estilo biblatex *",   placeholder: "apa" },
                { key: "in_text_format", label: t("styles.in_text_format"),    placeholder: t("styles.default_in_text_format") },
                { key: "bibliography_title", label: t("styles.references_title"), placeholder: "References" },
                { key: "disciplines",  label: t("styles.disciplines_comma"),   placeholder: t("styles.disciplines_placeholder") },
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
                <label style={labelStyle}>{t("styles.type")}</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })} style={fieldStyle}>
                  <option value="author_date">{t("styles.type_author_date")}</option>
                  <option value="numeric">{t("styles.type_numeric")}</option>
                  <option value="notes_bibliography">{t("styles.type_notes_bibliography")}</option>
                  <option value="author_page">{t("styles.type_author_page")}</option>
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={labelStyle}>{t("library.description")}</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
              </div>
              {formError && <div style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--build-err-tint, #ffeded)", color: "var(--build-err)", fontSize: "var(--fs-xs)", border: "1px solid var(--build-err)" }}>{formError}</div>}
            </div>
            <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
              <button className="btn btn-accent" style={{ flex: 1 }} onClick={submitForm}><IconCheck size={13} sw={2} /> {editingCustom ? t("common.save") : t("common.add")}</button>
              <button className="btn btn-ghost" onClick={() => setAddingCustom(false)}>{t("common.cancel")}</button>
            </div>
          </>
        ) : selected ? (
          <>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)" }}>{t("styles.style_detail")}</span>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-faint)", padding: 2 }}><IconX size={14} /></button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="scroll">
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", fontWeight: 500, color: "var(--fg-strong)" }}>{selected.name}</div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 8 }}>{selected.full_name}</div>
                <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6, margin: 0 }}>{selected.description || t("styles.no_description")}</p>
              </div>
              <div style={{ padding: "10px 12px", borderRadius: "var(--r-md)", background: "var(--bg-app)", border: "1px solid var(--border-subtle)", marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {[[t("styles.type"), TYPE_LABEL[selected.type] ?? selected.type], ["Biblatex", selected.biblatex_style], [t("styles.in_text"), selected.in_text_format], [t("styles.refs_title_short"), selected.bibliography_title]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{k}</span>
                    <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-default)", fontFamily: "var(--font-mono)" }}>{v}</span>
                  </div>
                ))}
              </div>
              {selected.disciplines.length > 0 && (
                <>
                  <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 8 }}>{t("styles.disciplines")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
                    {selected.disciplines.map((d) => <span key={d} className="chip" style={{ fontSize: 10 }}>{d}</span>)}
                  </div>
                </>
              )}
              {selected.regions_primary && (
                <>
                  <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 8 }}>{t("styles.primary_regions")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
                    {selected.regions_primary.map((r) => <span key={r} className="chip" style={{ fontSize: 10, background: "var(--detail-tint)", color: "var(--detail-deep)" }}>{r}</span>)}
                  </div>
                </>
              )}

              {/* P4.2 — Vista previa bibliográfica */}
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 8 }}>
                  {t("styles.preview")}
                </div>
                <div style={{
                  padding: "12px 14px", borderRadius: "var(--r-md)",
                  background: "var(--bg-app)", border: "1px solid var(--border-subtle)",
                  fontSize: "var(--fs-xs)", color: "var(--fg-default)",
                  lineHeight: 1.8, fontFamily: "var(--font-sans, Georgia, serif)",
                  minHeight: 56,
                }}>
                  {previewLoading && (
                    <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}>{t("styles.generating_preview")}</span>
                  )}
                  {!previewLoading && preview && renderPreviewText(preview)}
                  {!previewLoading && !preview && (
                    <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}>{t("styles.preview_unavailable")}</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 5, lineHeight: 1.5 }}>
                  {t("styles.preview_note")}
                </div>
              </div>
            </div>
            {!selected.builtin && (
              <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => openEdit(selected)}><IconEdit size={13} /> {t("common.edit")}</button>
                <button className="btn btn-ghost" style={{ padding: "6px 10px", color: "var(--build-err)" }} onClick={() => deleteCustom(selected)} title={t("styles.delete_style")}><IconTrash size={13} /></button>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, padding: 24, color: "var(--fg-faint)", textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: "var(--r-lg)", background: "var(--ink-100)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-faint)" }}><IconLayers size={20} /></div>
            <div style={{ fontSize: "var(--fs-sm)" }}>{t("styles.select_style_detail")}</div>
            <div style={{ fontSize: "var(--fs-xs)", lineHeight: 1.6 }}>
              {t("styles.order_hint_line_1")}<br />{t("styles.order_hint_line_2")}
            </div>
            <button className="btn btn-accent btn-sm" onClick={openAdd} style={{ marginTop: 8 }}><IconPlus size={13} /> {t("styles.add_custom_style")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
