// Asistente de instalación de LaTeX.
// Accesible desde: CompileView (banner), HomeView (banner), menú /about.
// Detecta el estado actual y guía al usuario por la opción más adecuada.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconCheck, IconChevronR, IconErr, IconRefresh, IconWarn,
} from "../components/Icons";
import { api } from "../lib/tauri";
import { useSettingsStore } from "../stores/settings";
import type { LatexInfo } from "../types";

// ── Constantes de instalación ─────────────────────────────────────

const INSTALL_OPTIONS = [
  {
    id: "tectonic",
    name: "Tectonic",
    tagline: "Recomendado — mínimo, sin Perl",
    description:
      "Motor LaTeX autónomo escrito en Rust. Descarga solo los paquetes que necesita la primera vez. No requiere TeX Live ni Strawberry Perl. Ideal para Windows 10/11.",
    pros: [
      "Instalación en 1 minuto con winget",
      "No necesita Strawberry Perl",
      "Descarga paquetes bajo demanda (≈ 50 MB la primera compilación)",
      "Actualizable con winget upgrade",
    ],
    cons: ["Primera compilación requiere internet", "No incluye todas las herramientas de TeX Live"],
    steps: [
      {
        title: "Instalar con winget (Windows 10/11)",
        code: "winget install tectonic-typesetting.tectonic",
        note: "Abre PowerShell como usuario normal (no se necesita administrador).",
      },
      {
        title: "Alternativa — instalar con Cargo",
        code: "cargo install tectonic",
        note: "Requiere Rust instalado. Tarda varios minutos en compilar.",
      },
      {
        title: "Verificar la instalación",
        code: "tectonic --version",
        note: "Deberías ver algo como: tectonic 0.14.x",
      },
      {
        title: "Reiniciar TeXisStudio",
        code: null,
        note: "Cierra y vuelve a abrir la aplicación para que detecte tectonic.",
      },
    ],
    download_url: "https://tectonic-typesetting.github.io/en-US/install.html",
    color: "#3AA396",
  },
  {
    id: "miktex",
    name: "MiKTeX",
    tagline: "Fácil en Windows — instalador gráfico",
    description:
      "Distribución LaTeX popular en Windows con instalador gráfico. Descarga paquetes bajo demanda. Incluye latexmk y biber.",
    pros: [
      "Instalador gráfico (.exe) fácil de usar",
      "Descarga paquetes bajo demanda",
      "Incluye latexmk y biber",
      "Buena integración con Windows",
    ],
    cons: [
      "Requiere Strawberry Perl para latexmk (paso adicional)",
      "La consola de MiKTeX puede confundir a principiantes",
    ],
    steps: [
      {
        title: "Descargar el instalador de MiKTeX",
        code: null,
        note: "Ve a miktex.org → Download → Windows. Descarga el instalador de 64 bits.",
      },
      {
        title: "Instalar MiKTeX",
        code: null,
        note: 'Ejecuta el instalador. Elige "Install MiKTeX only for me" (sin admin). Marca "Install missing packages on-the-fly → Yes".',
      },
      {
        title: "Instalar Strawberry Perl (necesario para latexmk)",
        code: "winget install StrawberryPerl.StrawberryPerl",
        note: "Perl es necesario para que latexmk funcione en Windows.",
      },
      {
        title: "Verificar la instalación",
        code: "latexmk --version && xelatex --version",
        note: "Ambos comandos deben responder con número de versión.",
      },
      {
        title: "Reiniciar TeXisStudio",
        code: null,
        note: "Cierra y vuelve a abrir para que detecte la nueva instalación.",
      },
    ],
    download_url: "https://miktex.org/download",
    color: "#4A6FA5",
  },
  {
    id: "texlive",
    name: "TeX Live 2024",
    tagline: "Instalación completa — todas las herramientas",
    description:
      "Distribución LaTeX completa mantenida por TUG. Incluye absolutamente todo. Ocupa entre 4 GB (básico) y 8 GB (completo). No requiere descargas adicionales después.",
    pros: [
      "Incluye todos los paquetes LaTeX (sin descargas adicionales)",
      "Incluye latexmk, biber, xelatex y más",
      "Actualizaciones anuales estables",
    ],
    cons: [
      "Instalación lenta (30–90 minutos)",
      "Ocupa 4–8 GB de disco",
      "Requiere Strawberry Perl para latexmk en Windows",
    ],
    steps: [
      {
        title: "Descargar el instalador de TeX Live",
        code: null,
        note: "Ve a tug.org/texlive → download. Descarga install-tl-windows.exe",
      },
      {
        title: "Instalar TeX Live",
        code: null,
        note: 'Ejecuta el instalador. Elige "Simple install (big)" para tenerlo todo. El proceso tarda 30–90 minutos.',
      },
      {
        title: "Instalar Strawberry Perl",
        code: "winget install StrawberryPerl.StrawberryPerl",
        note: "Necesario para que latexmk funcione.",
      },
      {
        title: "Verificar la instalación",
        code: "latexmk --version && xelatex --version",
        note: "Ambos deben responder con número de versión.",
      },
      {
        title: "Reiniciar TeXisStudio",
        code: null,
        note: "Cierra y vuelve a abrir la aplicación.",
      },
    ],
    download_url: "https://www.tug.org/texlive/acquire-netinstall.html",
    color: "#7C6EAF",
  },
];

// ── Componente de estado de detección ────────────────────────────

function DetectionStatus({ info }: { info: LatexInfo | null }) {
  const items = [
    { label: "latexmk",  ok: info?.has_latexmk  ?? false, version: info?.latexmk_version },
    { label: "xelatex",  ok: info?.has_xelatex  ?? false },
    { label: "biber",    ok: info?.has_biber     ?? false },
    { label: "tectonic", ok: info?.has_tectonic  ?? false, version: info?.tectonic_version },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
      gap: 10, marginBottom: 28,
    }}>
      {items.map((item) => (
        <div key={item.label} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", borderRadius: "var(--r-md)",
          background: "var(--bg-panel)",
          border: `1px solid ${item.ok ? "var(--build-ok)" : "var(--border-soft)"}`,
        }}>
          {item.ok
            ? <IconCheck size={13} style={{ color: "var(--build-ok)", flexShrink: 0 }} />
            : <IconErr   size={13} style={{ color: "var(--build-err)", flexShrink: 0 }} />
          }
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)", color: item.ok ? "var(--fg-strong)" : "var(--fg-faint)" }}>
              {item.label}
            </div>
            {item.version && (
              <div style={{ fontSize: 10, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
                {item.version}
              </div>
            )}
            {!item.ok && (
              <div style={{ fontSize: 10, color: "var(--build-err)", marginTop: 1 }}>no encontrado</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tarjeta de opción de instalación ────────────────────────────

function OptionCard({
  option, selected, installed, onClick,
}: {
  option: typeof INSTALL_OPTIONS[0];
  selected: boolean;
  installed: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "var(--accent-tint)" : "var(--bg-panel)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border-soft)"}`,
        boxShadow: selected ? "0 0 0 3px var(--accent-soft)" : "none",
        borderRadius: "var(--r-lg)", padding: 18, cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
            background: option.color,
          }} />
          <div>
            <span style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--fg-strong)" }}>
              {option.name}
            </span>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginLeft: 8 }}>
              {option.tagline}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {installed && (
            <span className="chip chip-ok" style={{ fontSize: 10 }}>
              <IconCheck size={8} sw={2.5} /> instalado
            </span>
          )}
          {selected && !installed && (
            <span className="chip chip-accent" style={{ fontSize: 10 }}>
              <IconCheck size={8} sw={2.5} /> seleccionado
            </span>
          )}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
        {option.description}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {option.pros.slice(0, 2).map((p, i) => (
          <div key={i} style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", display: "flex", gap: 5, alignItems: "flex-start" }}>
            <span style={{ color: "var(--build-ok)", fontSize: 12, lineHeight: 1 }}>✓</span> {p}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Panel de instrucciones ────────────────────────────────────────

function InstructionsPanel({ option }: { option: typeof INSTALL_OPTIONS[0] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {option.steps.map((step, i) => (
        <div key={i} style={{
          display: "flex", gap: 16, paddingBottom: 20,
        }}>
          {/* Timeline dot */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "var(--accent)", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
              flexShrink: 0,
            }}>
              {i + 1}
            </div>
            {i < option.steps.length - 1 && (
              <div style={{ width: 1, flex: 1, background: "var(--border-soft)", marginTop: 4, minHeight: 16 }} />
            )}
          </div>

          {/* Contenido */}
          <div style={{ flex: 1, paddingTop: 2 }}>
            <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", marginBottom: 6 }}>
              {step.title}
            </div>
            {step.code && (
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 12,
                background: "var(--ink-900)", color: "#A8D49C",
                padding: "8px 12px", borderRadius: "var(--r-sm)",
                marginBottom: 6, userSelect: "all",
              }}>
                {step.code}
              </div>
            )}
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
              {step.note}
            </div>
          </div>
        </div>
      ))}

      <a
        href={option.download_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 18px", borderRadius: "var(--r-md)",
          background: option.color, color: "white",
          fontSize: "var(--fs-sm)", fontWeight: 500,
          textDecoration: "none", alignSelf: "flex-start", marginTop: 4,
        }}
      >
        Ir al sitio oficial de {option.name} <IconChevronR size={12} />
      </a>
    </div>
  );
}

function GuidedSummaryCard({
  title,
  body,
  tone = "info",
}: {
  title: string;
  body: string;
  tone?: "info" | "ok" | "warn";
}) {
  const palette = {
    info: {
      background: "var(--accent-tint)",
      border: "1px solid var(--accent-soft)",
      color: "var(--accent-deep)",
      icon: <IconWarn size={13} />,
    },
    ok: {
      background: "var(--build-ok-tint)",
      border: "1px solid var(--build-ok)",
      color: "var(--build-ok)",
      icon: <IconCheck size={13} sw={2.5} />,
    },
    warn: {
      background: "color-mix(in srgb, var(--build-warn) 10%, var(--bg-panel))",
      border: "1px solid var(--build-warn)",
      color: "var(--build-warn)",
      icon: <IconWarn size={13} />,
    },
  } as const;

  const selected = palette[tone];

  return (
    <div style={{
      padding: "12px 14px",
      borderRadius: "var(--r-md)",
      background: selected.background,
      border: selected.border,
      color: selected.color,
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
    }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>{selected.icon}</div>
      <div>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 4 }}>
          {title}
        </div>
        <div style={{ fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

// ── Vista principal ───────────────────────────────────────────────

export default function SetupLatexView() {
  const navigate = useNavigate();
  const userMode = useSettingsStore((s) => s.userMode);
  const [info, setInfo] = useState<LatexInfo | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [selectedId, setSelectedId] = useState("tectonic");

  useEffect(() => {
    handleDetect();
  }, []);

  async function handleDetect() {
    setDetecting(true);
    try {
      const result = await api.detectLatex();
      setInfo(result);
      // Auto-seleccionar la opción instalada, o tectonic por defecto
      if (result.has_tectonic)       setSelectedId("tectonic");
      else if (result.latexmk_usable) setSelectedId("miktex");
    } catch {
      // silencioso en browser-mode
    } finally {
      setDetecting(false);
    }
  }

  const selectedOption = INSTALL_OPTIONS.find((o) => o.id === selectedId) ?? INSTALL_OPTIONS[0];

  const installedIds = new Set<string>();
  if (info?.has_tectonic)      installedIds.add("tectonic");
  if (info?.latexmk_usable)    installedIds.add("miktex");
  if (info?.latexmk_usable)    installedIds.add("texlive");

  const guidedRecommendation = info?.is_usable
    ? "Ya puedes generar tu PDF desde TeXisStudio. Si un perfil institucional pide algo más, la app te lo irá señalando antes de entregar."
    : selectedOption.id === "tectonic"
      ? "Empieza con Tectonic si quieres la ruta más corta. Es la opción más amigable para probar TeXisStudio sin pelearte con instalaciones grandes."
      : selectedOption.id === "miktex"
        ? "MiKTeX es buena opción si prefieres instalador gráfico y estás en Windows. Te da un camino bastante cómodo para llegar a tu primer PDF."
        : "TeX Live conviene si quieres una instalación completa desde el inicio y no te importa ocupar más espacio en disco.";

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ Preparar generación de PDF</span></>}
        center={null}
        right={
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            ← Volver
          </button>
        }
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)", overflow: "auto" }} className="scroll">
        <div style={{ flex: 1, padding: "40px 56px 40px", maxWidth: 960, margin: "0 auto" }}>

          {/* Encabezado */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: "0 0 6px", color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>
              Preparar la generación de <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>PDF</em>
            </h1>
            <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: "var(--fs-md)", maxWidth: 580 }}>
              TeXisStudio se encarga del formato y de la compilación, pero necesita una herramienta instalada en tu equipo para convertir tu tesis en PDF.
              No necesitas aprender LaTeX: aquí solo eliges la ruta más sencilla para tu caso.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14, marginBottom: 24 }}>
            <GuidedSummaryCard
              title="Qué hace esta pantalla"
              body="Te ayuda a dejar listo el paso técnico que convierte tu trabajo en PDF. Después podrás seguir escribiendo normalmente y TeXisStudio se encargará del resto."
            />
            <GuidedSummaryCard
              title={info?.is_usable ? "Tu equipo ya está listo" : "Recomendación inicial"}
              body={guidedRecommendation}
              tone={info?.is_usable ? "ok" : "info"}
            />
          </div>

          {/* Estado de detección */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)" }}>
              Comprobación del equipo
            </div>
            <button
              className="btn btn-sm"
              onClick={handleDetect}
              disabled={detecting}
              style={{ fontSize: "var(--fs-xs)" }}
            >
              <IconRefresh size={12} /> {detecting ? "Detectando…" : "Volver a detectar"}
            </button>
          </div>

          {info ? (
            <>
              {info.is_usable ? (
                <div style={{
                  padding: "10px 14px", borderRadius: "var(--r-md)", marginBottom: 20,
                  background: "var(--build-ok-tint)", border: "1px solid var(--build-ok)",
                  display: "flex", gap: 8, alignItems: "center",
                  fontSize: "var(--fs-sm)", color: "var(--build-ok)",
                }}>
                  <IconCheck size={13} sw={2.5} />
                  <strong>Todo listo.</strong> Ya puedes generar tu PDF desde el editor. {userMode === "advanced" && <>Motores disponibles: {info.available_backends.join(", ")}.</>}
                </div>
              ) : (
                <div style={{
                  padding: "10px 14px", borderRadius: "var(--r-md)", marginBottom: 20,
                  background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
                  display: "flex", gap: 8, alignItems: "center",
                  fontSize: "var(--fs-sm)", color: "var(--accent-deep)",
                }}>
                  <IconWarn size={13} />
                  Aún no encontramos una herramienta para generar el PDF. Elige una opción debajo y sigue los pasos guiados.
                </div>
              )}
              <DetectionStatus info={info} />
            </>
          ) : (
            <div style={{ padding: "20px 0 24px", color: "var(--fg-faint)", fontSize: "var(--fs-sm)" }}>
              {detecting ? "Detectando instalaciones…" : "No se pudo detectar el estado de LaTeX (modo browser)."}
            </div>
          )}

          {/* Selector de opción */}
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 12 }}>
            Rutas recomendadas
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 32 }}>
            {INSTALL_OPTIONS.map((opt) => (
              <OptionCard
                key={opt.id}
                option={opt}
                selected={selectedId === opt.id}
                installed={installedIds.has(opt.id)}
                onClick={() => setSelectedId(opt.id)}
              />
            ))}
          </div>

          {/* Instrucciones paso a paso */}
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 20 }}>
            Pasos guiados — {selectedOption.name}
          </div>

          <div style={{ maxWidth: 640 }}>
            <InstructionsPanel option={selectedOption} />
          </div>

          {userMode === "advanced" && (
            <div style={{
              maxWidth: 640,
              marginTop: 28,
              padding: "14px 16px",
              background: "var(--bg-panel)",
              border: "1px solid var(--border-soft)",
              borderRadius: "var(--r-md)",
            }}>
              <div style={{ fontSize: "var(--fs-xs)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 8 }}>
                Detalle técnico
              </div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
                TeXisStudio puede apoyarse en motores distintos según lo que encuentre en tu equipo. En modo básico no necesitas preocuparte por eso; en modo avanzado podrás elegir backend y revisar más detalles en la pantalla de entrega.
              </div>
            </div>
          )}

          <div style={{ height: 48 }} />
        </div>
      </div>

      <TxStatusbar items={[
        info?.is_usable
          ? { text: "Listo para generar PDF", dot: "var(--build-ok)" }
          : { text: "Falta preparar la generación de PDF", dot: "var(--build-err)" },
        { right: true, text: "Vuelve a detectar después de instalar" },
      ]} />
    </>
  );
}
