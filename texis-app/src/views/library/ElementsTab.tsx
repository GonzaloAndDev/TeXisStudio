import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconCode, IconDoc, IconHeading, IconImage, IconList, IconSigma, IconTable, IconText, IconX } from "../../components/Icons";


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



// ── Estilos bibliográficos integrados ─────────────────────────────────────────

// ── ElementsTab ───────────────────────────────────────────────────────────────

export function ElementsTab() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const sel = BLOCK_CATALOG.find((b) => b.type === selected);
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }} className="scroll">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: 0, color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>{t("elements_tab.title")}</h1>
          <p style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)", marginTop: 4 }}>{t("elements_tab.subtitle")}</p>
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
            <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 6 }}>{t("elements_tab.latex_output_label")}</div>
            <div style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--bg-app)", border: "1px solid var(--border-firm)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-default)", lineHeight: 1.6 }}>{sel.latex_output}</div>
          </div>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 6 }}>{t("elements_tab.internal_type_label")}</div>
          <span className="chip tx-mono" style={{ fontSize: 11 }}>{sel.type}</span>
        </div>
      )}
    </div>
  );
}

