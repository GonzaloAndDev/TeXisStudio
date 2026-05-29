import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBook,
  IconCheck,
  IconFile,
  IconInfo,
  IconWarn,
} from "../components/Icons";

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontSize: "var(--fs-xs)",
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--fg-faint)",
        marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoCard({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: ReactNode;
  tone?: "neutral" | "ok" | "warn";
}) {
  const palette = {
    neutral: {
      background: "var(--bg-panel)",
      border: "1px solid var(--border-soft)",
      icon: <IconInfo size={13} style={{ color: "var(--accent)" }} />,
    },
    ok: {
      background: "var(--build-ok-tint)",
      border: "1px solid var(--build-ok)",
      icon: <IconCheck size={13} sw={2.5} style={{ color: "var(--build-ok)" }} />,
    },
    warn: {
      background: "color-mix(in srgb, var(--build-warn) 10%, var(--bg-panel))",
      border: "1px solid var(--build-warn)",
      icon: <IconWarn size={13} style={{ color: "var(--build-warn)" }} />,
    },
  } as const;

  const current = palette[tone];

  return (
    <div style={{
      padding: "14px 16px",
      background: current.background,
      border: current.border,
      borderRadius: "var(--r-md)",
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
    }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>{current.icon}</div>
      <div>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.65 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function SimpleList({
  items,
}: {
  items: string[];
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((item) => (
        <div key={item} style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          fontSize: "var(--fs-sm)",
          color: "var(--fg-muted)",
          lineHeight: 1.6,
        }}>
          <span style={{ color: "var(--build-ok)", fontSize: 13, lineHeight: 1 }}>✓</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function AboutView() {
  const navigate = useNavigate();

  const capabilities = [
    "Te ayuda a organizar la estructura de tu trabajo por secciones y capítulos.",
    "Aplica formato institucional mediante perfiles sin obligarte a editar LaTeX a mano.",
    "Gestiona citas, bibliografía y compilación para que tú te concentres en el contenido.",
    "Revisa la salud del proyecto y te avisa qué te falta antes de entregar.",
    "Prepara exportaciones finales con evidencia técnica cuando el flujo lo requiere.",
  ];

  const boundaries = [
    "No sustituye los lineamientos oficiales de tu institución ni el juicio de tu asesor o jurado.",
    "Algunos perfiles tienen más evidencia y verificación que otros; la Biblioteca lo indica.",
    "La calidad académica de la investigación, redacción y argumentación sigue dependiendo del autor.",
  ];

  const stack = [
    "App de escritorio sobre Tauri + React + TypeScript.",
    "Core académico y de compilación en Rust.",
    "Soporte de perfiles, bibliografía, exportación final y verificación de entorno.",
    "Corrección ortográfica y lingüística modular con packs y vocabularios especializados.",
  ];

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ Acerca de</span></>}
        center={null}
        right={<button className="btn btn-ghost btn-sm" onClick={() => navigate("/")}>← Inicio</button>}
      />

      <div style={{ flex: 1, overflow: "auto", background: "var(--bg-app)" }} className="scroll">
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
          <div style={{ textAlign: "center", marginBottom: 42 }}>
            <div style={{ marginBottom: 16 }}>
              <TxLogo size={32} />
            </div>
            <h1 style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--fs-3xl)",
              fontWeight: 400,
              color: "var(--fg-strong)",
              margin: "0 0 10px",
              letterSpacing: "-0.02em",
            }}>
              TeXis<em style={{ fontStyle: "italic", color: "var(--detail)" }}>Studio</em>
            </h1>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)", color: "var(--fg-muted)" }}>
              v1.0.0 · asistente de tesis desktop-first
            </div>
            <div style={{
              marginTop: 18,
              padding: "14px 18px",
              background: "var(--accent-tint)",
              borderRadius: "var(--r-md)",
              fontSize: "var(--fs-sm)",
              color: "var(--accent-deep)",
              lineHeight: 1.7,
            }}>
              La idea central es simple: tú trabajas en tu tesis, tesina o investigación;
              TeXisStudio te ayuda con estructura, formato, bibliografía, compilación y entrega.
            </div>
          </div>

          <Section title="Qué es">
            <InfoCard
              title="Una herramienta pensada para quien no quiere aprender LaTeX para poder titularse"
              tone="ok"
              body={(
                <>
                  TeXisStudio busca que estudiantes de licenciatura, especialidad, maestría, doctorado y posdoctorado
                  puedan producir trabajos académicos serios sin cargar con el peso técnico de LaTeX como condición previa.
                </>
              )}
            />
          </Section>

          <Section title="Qué hace por ti">
            <SimpleList items={capabilities} />
          </Section>

          <Section title="Qué sigue siendo tu responsabilidad">
            <InfoCard
              title="La app te acompaña; no reemplaza el criterio académico"
              tone="warn"
              body={<SimpleList items={boundaries} />}
            />
          </Section>

          <Section title="En qué base técnica se apoya">
            <div style={{ padding: "14px 16px", background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)" }}>
              <SimpleList items={stack} />
            </div>
          </Section>

          <Section title="Estado de madurez">
            <div style={{ display: "grid", gap: 12 }}>
              <InfoCard
                title="Base técnica fuerte"
                tone="ok"
                body="El núcleo de validación, compilación, perfiles, idiomas y exportación ya existe y ya resuelve trabajo académico real."
              />
              <InfoCard
                title="Transición activa hacia experiencia neófito-first"
                body="La app se está reorganizando para que el flujo principal sea guiado, simple y centrado en momentos del trabajo en vez de herramientas técnicas."
              />
              <InfoCard
                title="Promesa honesta"
                tone="warn"
                body="TeXisStudio ya es un producto académico serio, pero todavía está cerrando algunos contratos de UX, CI y cobertura institucional antes de poder prometer una experiencia premium universal sin asteriscos."
              />
            </div>
          </Section>

          <Section title="Autoría y proyecto">
            <div style={{ padding: "14px 16px", background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
              <div style={{ marginBottom: 8, color: "var(--fg-strong)", fontWeight: 600 }}>
                Gonzalo Andrade Estrella
              </div>
              <div style={{ color: "var(--fg-muted)" }}>
                Repositorio principal:{" "}
                <a href="https://github.com/GonzaloAndDev/TeXisStudio" style={{ color: "var(--link)", textDecoration: "none" }}>
                  GonzaloAndDev/TeXisStudio
                </a>
              </div>
              <div style={{ color: "var(--fg-muted)" }}>
                GitHub:{" "}
                <a href="https://github.com/GonzaloAndDev" style={{ color: "var(--link)", textDecoration: "none" }}>
                  @GonzaloAndDev
                </a>
              </div>
            </div>
          </Section>

          <Section title="Licencia">
            <div style={{ padding: "14px 16px", background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--fg-strong)" }}>
                AGPL v3 + Commons Clause
              </div>
              <div style={{ color: "var(--fg-muted)" }}>
                Source-available. Gratuito para uso personal, académico, educativo y comunitario.
                La explotación comercial directa requiere acuerdo con el autor original.
              </div>
            </div>
          </Section>
        </div>
      </div>

      <TxStatusbar items={[
        { icon: <IconBook size={11} />, text: "TeXisStudio v1.0.0" },
        { icon: <IconFile size={11} />, text: "Desktop-first · tesis guiada" },
        { right: true, text: "github.com/GonzaloAndDev/TeXisStudio" },
      ]} />
    </>
  );
}
