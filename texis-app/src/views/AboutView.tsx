import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import { IconBook, IconFile } from "../components/Icons";

export default function AboutView() {
  const navigate = useNavigate();

  const section = (title: string, children: React.ReactNode) => (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: 16, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "var(--fs-sm)" }}>
      <div style={{ width: 160, flexShrink: 0, color: "var(--fg-muted)" }}>{label}</div>
      <div style={{ color: "var(--fg-strong)" }}>{value}</div>
    </div>
  );

  const roadmap: [string, "✅" | "🚧" | "⬜", string][] = [
    ["0.1", "✅", "CLI técnico — crear, compilar y validar proyectos desde terminal"],
    ["0.2", "✅", "App de escritorio — editor visual con bloques de contenido"],
    ["0.3", "✅", "Perfiles personalizados — crear, editar y gestionar desde la UI"],
    ["0.4", "✅", "Asistente LaTeX — detección automática de backends y guía de instalación"],
    ["0.5", "✅", "Biblioteca de perfiles — editor completo con persistencia y eliminación"],
    ["0.6", "✅", "Drag & drop — reordenamiento de bloques con toolbar académico"],
    ["0.7", "✅", "CommandPalette (⌘K) y CitationPicker (Ctrl+[) — flujo de escritura avanzado"],
    ["0.8", "✅", "Perfiles comunitarios — instalación remota vía URL de repositorio ZIP"],
    ["1.0", "✅", "Schema 1.0.0 congelado · migración automática 0.1.0→1.0.0 · release oficial"],
  ];

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ Acerca de</span></>}
        center={null}
        right={<button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>← Inicio</button>}
      />

      <div style={{ flex: 1, overflow: "auto", background: "var(--bg-app)" }} className="scroll">
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>

          {/* Logo + nombre */}
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ marginBottom: 16 }}>
              <TxLogo size={32} />
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-3xl)", fontWeight: 400, color: "var(--fg-strong)", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
              TeXis<em style={{ fontStyle: "italic", color: "var(--detail)" }}>Studio</em>
            </h1>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
              v1.0.0 — Release oficial
            </div>
            <div style={{ marginTop: 16, padding: "12px 20px", background: "var(--accent-tint)", borderRadius: "var(--r-md)", fontSize: "var(--fs-sm)", color: "var(--accent-deep)", lineHeight: 1.6 }}>
              Editor profesional de tesis con LaTeX — sin necesitar aprender LaTeX directamente.
            </div>
          </div>

          {/* Notas del release */}
          {section("Release 1.0.0", <>
            <div style={{ padding: "14px 16px", background: "var(--bg-panel)", borderRadius: "var(--r-md)", border: "1px solid var(--border-soft)", fontSize: "var(--fs-sm)", lineHeight: 1.75, color: "var(--fg-muted)" }}>
              <div style={{ fontWeight: 600, color: "var(--fg-strong)", marginBottom: 8 }}>✅ Schema 1.0.0 congelado</div>
              <ul style={{ margin: "0 0 0 16px", padding: 0 }}>
                <li>Primer schema estable — los proyectos creados son compatibles hacia adelante.</li>
                <li>Migración automática de proyectos 0.1.0 al abrir (sin pérdida de datos).</li>
                <li>Editor visual completo: bloques, drag & drop, CommandPalette, CitationPicker.</li>
                <li>Biblioteca de perfiles con editor, eliminación e instalación comunitaria remota.</li>
                <li>Detección de backends LaTeX (latexmk, tectonic, xelatex) con guía de configuración.</li>
                <li>BibTeX parser integrado — las referencias del proyecto aparecen en el editor.</li>
              </ul>
            </div>
          </>)}

          {section("Autoría", <>
            {row("Autor original", "Gonzalo Andrade Estrella")}
            {row("GitHub", <a href="https://github.com/GonzaloAndDev" style={{ color: "var(--link)", textDecoration: "none" }}>@GonzaloAndDev</a>)}
            {row("Repositorio", <a href="https://github.com/GonzaloAndDev/TeXisStudio" style={{ color: "var(--link)", textDecoration: "none" }}>GonzaloAndDev/TeXisStudio</a>)}
          </>)}

          {section("Licencia", <>
            <div style={{ padding: "14px 16px", background: "var(--bg-panel)", borderRadius: "var(--r-md)", border: "1px solid var(--border-soft)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>AGPL v3 + Commons Clause</div>
              <div style={{ color: "var(--fg-muted)" }}>
                Source-available. Gratuito para uso personal, académico, educativo y comunitario.
                La explotación comercial directa requiere acuerdo con el autor original.
              </div>
            </div>
          </>)}

          {section("Disclaimer académico", <>
            <div style={{ padding: "14px 16px", background: "var(--bg-panel)", borderRadius: "var(--r-md)", border: "1px solid var(--border-soft)", fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
              TeXisStudio ayuda a generar estructura y formato. <strong style={{ color: "var(--fg-default)" }}>No sustituye</strong> los lineamientos
              oficiales de la institución ni la revisión de asesores, sinodales o comités académicos.
              Los documentos generados pertenecen completamente a sus autores.
            </div>
          </>)}

          {section("Stack técnico", <>
            {row("Core", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>Rust · texis-core 1.0.0 · Edition 2021</span>)}
            {row("UI", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>Tauri v2 · React 18 · TypeScript 5</span>)}
            {row("Templates", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>MiniJinja v2</span>)}
            {row("LaTeX", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>XeLaTeX · latexmk · tectonic · biber · biblatex</span>)}
            {row("Red", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>reqwest 0.12 · rustls · zip 2</span>)}
            {row("Fuentes", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>Newsreader · Geist · JetBrains Mono</span>)}
          </>)}

          {section("Roadmap — completado", <>
            {roadmap.map(([version, status, desc]) => (
              <div key={version} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "var(--fs-sm)", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", width: 32 }}>{version}</span>
                <span style={{ fontSize: 14 }}>{status}</span>
                <span style={{ color: status === "✅" ? "var(--fg-muted)" : "var(--fg-default)" }}>{desc}</span>
              </div>
            ))}
          </>)}

        </div>
      </div>

      <TxStatusbar items={[
        { icon: <IconBook size={11} />, text: "TeXisStudio v1.0.0" },
        { icon: <IconFile size={11} />, text: "AGPL v3 + Commons Clause" },
        { right: true, text: "github.com/GonzaloAndDev/TeXisStudio" },
      ]} />
    </>
  );
}
