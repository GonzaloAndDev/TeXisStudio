import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../components/ConfirmDialog";
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
  const [styles, setStyles]           = useState<CitationStyle[]>(loadStyles);
  const [selected, setSelected]       = useState<CitationStyle | null>(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [editingCustom, setEditingCustom] = useState<CitationStyle | null>(null);
  const [search, setSearch]           = useState("");
  const [preview, setPreview]         = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ kind: "reset" } | { kind: "delete"; style: CitationStyle } | null>(null);

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
    saveStyles(BUILTIN_STYLES);
    setStyles(BUILTIN_STYLES);
    setSelected(null);
    setConfirmAction(null);
  }

  const filtered = styles.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.disciplines.some((d) => d.toLowerCase().includes(search.toLowerCase()))
  );

  const fieldStyle: React.CSSProperties = { width: "100%", padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)", background: "var(--bg-panel)", fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, display: "block" };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.kind === "reset" ? "Restaurar estilos" : "Eliminar estilo"}
          message={confirmAction.kind === "reset"
            ? "Se restaurara el orden predeterminado y se eliminaran los estilos personalizados."
            : `Se eliminara el estilo personalizado "${confirmAction.style.name}".`}
          confirmLabel={confirmAction.kind === "reset" ? "Restaurar" : "Eliminar"}
          destructive
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            if (confirmAction.kind === "reset") resetToDefaults();
            else {
              deleteCustom(confirmAction.style);
              setConfirmAction(null);
            }
          }}
        />
      )}
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
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmAction({ kind: "reset" })} title="Restaurar predeterminados" style={{ fontSize: 11 }}>
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
                      <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ kind: "delete", style }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--build-err)", padding: "2px 4px" }} title="Eliminar"><IconTrash size={12} /></button>
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
                    {selected.regions_primary.map((r) => <span key={r} className="chip" style={{ fontSize: 10, background: "var(--detail-tint)", color: "var(--detail-deep)" }}>{r}</span>)}
                  </div>
                </>
              )}

              {/* P4.2 — Vista previa bibliográfica */}
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 8 }}>
                  Vista previa
                </div>
                <div style={{
                  padding: "12px 14px", borderRadius: "var(--r-md)",
                  background: "var(--bg-app)", border: "1px solid var(--border-subtle)",
                  fontSize: "var(--fs-xs)", color: "var(--fg-default)",
                  lineHeight: 1.8, fontFamily: "var(--font-sans, Georgia, serif)",
                  minHeight: 56,
                }}>
                  {previewLoading && (
                    <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}>Generando vista previa…</span>
                  )}
                  {!previewLoading && preview && renderPreviewText(preview)}
                  {!previewLoading && !preview && (
                    <span style={{ color: "var(--fg-faint)", fontStyle: "italic" }}>Vista previa no disponible.</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 5, lineHeight: 1.5 }}>
                  Ejemplo: artículo con 2 autores, volumen, número, páginas y DOI.
                  Aproximación — el formato final lo produce LaTeX.
                </div>
              </div>
            </div>
            {!selected.builtin && (
              <div style={{ padding: 14, borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => openEdit(selected)}><IconEdit size={13} /> Editar</button>
                <button className="btn btn-ghost" style={{ padding: "6px 10px", color: "var(--build-err)" }} onClick={() => setConfirmAction({ kind: "delete", style: selected })} title="Eliminar estilo"><IconTrash size={13} /></button>
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
