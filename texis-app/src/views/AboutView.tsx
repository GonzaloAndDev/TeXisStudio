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
              TeXis<em style={{ fontStyle: "italic", color: "var(--accent-deep)" }}>Studio</em>
            </h1>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
              v0.2.0 — Release 0.2 (beta)
            </div>
            <div style={{ marginTop: 16, padding: "12px 20px", background: "var(--accent-tint)", borderRadius: "var(--r-md)", fontSize: "var(--fs-sm)", color: "var(--accent-deep)", lineHeight: 1.6 }}>
              Editor profesional de tesis con LaTeX — sin necesitar aprender LaTeX directamente.
            </div>
          </div>

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
              <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--build-warn-tint)", borderRadius: "var(--r-sm)", color: "var(--build-warn)", fontSize: "var(--fs-xs)" }}>
                ⚠ Licencia pendiente de revisión legal antes del primer release público oficial.
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
            {row("Core", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>Rust · texis-core · Edition 2021</span>)}
            {row("UI", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>Tauri v2 · React 18 · TypeScript</span>)}
            {row("Templates", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>MiniJinja v2</span>)}
            {row("LaTeX", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>XeLaTeX · latexmk · biber · biblatex</span>)}
            {row("Fuentes", <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>Newsreader · Geist · JetBrains Mono</span>)}
          </>)}

          {section("Roadmap", <>
            {[
              ["0.1", "✅", "CLI técnico — crear y compilar desde terminal"],
              ["0.2", "🚧", "App de escritorio — editor visual completo"],
              ["0.3", "⬜", "Perfiles personalizados desde la UI"],
              ["0.4", "⬜", "Asistente de instalación LaTeX + Tectonic"],
              ["0.5", "⬜", "Biblioteca comunitaria de perfiles"],
              ["0.6", "⬜", "Drag & drop y toolbar académico avanzado"],
              ["1.0", "⬜", "Schema 1.0.0 congelado · instaladores firmados · docs completas"],
            ].map(([version, status, desc]) => (
              <div key={version} style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: "var(--fs-sm)", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", width: 32 }}>{version}</span>
                <span style={{ fontSize: 14 }}>{status}</span>
                <span style={{ color: "var(--fg-muted)" }}>{desc}</span>
              </div>
            ))}
          </>)}

        </div>
      </div>

      <TxStatusbar items={[
        { icon: <IconBook size={11} />, text: "TeXisStudio v0.2.0" },
        { icon: <IconFile size={11} />, text: "AGPL v3 + Commons Clause" },
        { right: true, text: "github.com/GonzaloAndDev/TeXisStudio" },
      ]} />
    </>
  );
}
