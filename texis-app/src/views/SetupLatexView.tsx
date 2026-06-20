// Asistente de instalación de LaTeX.
// Accesible desde: CompileView (banner), HomeView (banner), menú /about.
// Detecta el OS y muestra solo las opciones válidas con instrucciones específicas.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { TxAppbar, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconCheck, IconChevronR, IconErr, IconRefresh, IconWarn,
} from "../components/Icons";
import { AiHelpButton } from "../components/AiHelpButton";
import { api } from "../lib/tauri";
import { useSettingsStore } from "../stores/settings";
import { useProjectStore } from "../stores/project";
import { getBestAvailableBackend, backendForSetupOption } from "../lib/latexBackendPreference";
import type { LatexInfo } from "../types";

// ── Tipos ─────────────────────────────────────────────────────────

type Platform = "macos" | "windows" | "linux" | string;

interface InstallStep {
  title: string;
  code: string | null;
  note: string;
}

interface InstallOption {
  id: string;
  name: string;
  tagline: string;
  description: string;
  pros: string[];
  cons: string[];
  steps: InstallStep[];
  download_url: string;
  color: string;
  /** Cómo mantener la instalación al día (comando + nota). */
  update?: { code: string | null; note: string };
}

// ── Opciones por sistema operativo ────────────────────────────────

const OPTIONS_BY_OS: Record<string, InstallOption[]> = {
  macos: [
    {
      id: "mactex",
      name: "MacTeX",
      tagline: "Recomendado — resultados más finos, estables y completos",
      description:
        "MacTeX es la distribución TeX Live completa para macOS. Produce los resultados más precisos y estables: tipografía perfecta, bibliografías APA/IEEE/Vancouver correctas al 100%, soporte nativo para Cirílico, CJK, Devanagari y cualquier paquete LaTeX publicado. Ideal para tesis finales, revistas y cualquier documento que deba verse impecable.",
      pros: [
        "Tipografía y salida más fina que cualquier alternativa ligera",
        "Bibliografías compatibles al 100% (biber versión correcta incluida)",
        "Todos los paquetes CTAN disponibles sin restricción",
        "Soporte nativo multilingüe: Cirílico, CJK, Árabe, Devanagari",
        "Compilación multi-pasada correcta: TOC, índices, referencias cruzadas",
        "Instalación con Homebrew en un comando",
      ],
      cons: [
        "Descarga grande (~5 GB)",
        "Instalación tarda 10–20 minutos",
      ],
      steps: [
        {
          title: "Instalar Homebrew (si no lo tienes)",
          code: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
          note: "Homebrew es el gestor de paquetes estándar de macOS. Si ya lo tienes, salta este paso.",
        },
        {
          title: "Instalar MacTeX con Homebrew",
          code: "brew install --cask mactex",
          note: "Descarga ~5 GB. El proceso tarda entre 10 y 20 minutos según tu conexión.",
        },
        {
          title: "Actualizar las variables de entorno",
          code: 'eval "$(/usr/libexec/path_helper)"',
          note: "O simplemente cierra y vuelve a abrir la Terminal para que tome el nuevo PATH.",
        },
        {
          title: "Verificar la instalación",
          code: "latexmk --version && xelatex --version && biber --version",
          note: "Los tres comandos deben responder con número de versión.",
        },
        {
          title: "Reiniciar TeXisStudio",
          code: null,
          note: "Cierra y vuelve a abrir la aplicación para que detecte la nueva instalación.",
        },
      ],
      download_url: "https://www.tug.org/mactex/",
      color: "#3AA396",
      update: {
        code: "sudo tlmgr update --self --all",
        note: "Mantiene los paquetes al día dentro del año de TeX Live. Para la versión anual nueva, reinstala con: brew upgrade --cask mactex (o descarga el .pkg). También puedes usar la app «TeX Live Utility».",
      },
    },
    {
      id: "tectonic",
      name: "Tectonic",
      tagline: "Ligero — descarga solo lo que necesita",
      description:
        "Motor LaTeX moderno y autónomo. Cubre el 80% de las tesis sin necesidad de instalar gigabytes. Si durante la escritura algún paquete muy específico falla, puedes instalar MacTeX junto a Tectonic — conviven sin conflicto y la app te deja elegir cuál usar.",
      pros: [
        "Instalación en menos de 1 minuto",
        "Descarga solo los paquetes que usa tu tesis",
        "Convive con MacTeX si necesitas ambos",
        "Actualizable con brew upgrade",
      ],
      cons: [
        "Primera compilación requiere conexión a internet",
        "Paquetes muy especializados (física avanzada, etc.) pueden requerir MacTeX",
      ],
      steps: [
        {
          title: "Instalar Homebrew (si no lo tienes)",
          code: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
          note: "Si ya tienes Homebrew, salta este paso.",
        },
        {
          title: "Instalar Tectonic con Homebrew",
          code: "brew install tectonic",
          note: "Descarga liviana. Listo en menos de 1 minuto.",
        },
        {
          title: "Verificar la instalación",
          code: "tectonic --version",
          note: "Deberías ver algo como: tectonic 0.15.x",
        },
        {
          title: "Reiniciar TeXisStudio",
          code: null,
          note: "Cierra y vuelve a abrir la aplicación para que detecte tectonic.",
        },
      ],
      download_url: "https://tectonic-typesetting.github.io/en-US/install.html",
      color: "#7C6EAF",
    },
  ],

  linux: [
    {
      id: "texlive",
      name: "TeX Live",
      tagline: "Recomendado — resultados más finos, estables y completos",
      description:
        "TeX Live es la distribución LaTeX completa estándar en Linux. Produce resultados más precisos y estables que cualquier opción ligera: tipografía perfecta, bibliografías correctas al 100%, soporte multilingüe completo (Cirílico, CJK, Devanagari) y todos los paquetes CTAN disponibles. La opción correcta para documentos que deben verse impecables.",
      pros: [
        "Tipografía y salida más fina que alternativas ligeras",
        "Bibliografías 100% correctas — biber versión compatible incluida",
        "Todos los paquetes CTAN sin restricción",
        "Soporte multilingüe nativo: Cirílico, CJK, Árabe, Devanagari",
        "Compilación multi-pasada correcta: TOC, índices, referencias cruzadas",
        "Instalación con un solo comando del sistema",
      ],
      cons: [
        "Instalación completa ocupa 3–5 GB",
        "La versión del repositorio puede ser algo anterior a la oficial",
      ],
      steps: [
        {
          title: "Ubuntu / Debian / Linux Mint",
          code: "sudo apt install texlive-full",
          note: "Incluye todo. Si el espacio es limitado, usa texlive-xetex en lugar de texlive-full.",
        },
        {
          title: "Fedora / RHEL / CentOS Stream",
          code: "sudo dnf install texlive-scheme-full",
          note: "Instala el esquema completo de TeX Live.",
        },
        {
          title: "Arch / Manjaro",
          code: "sudo pacman -S texlive-most texlive-lang biber",
          note: "Instala los grupos principales y biber para bibliografía.",
        },
        {
          title: "openSUSE",
          code: "sudo zypper install texlive-scheme-full",
          note: "Esquema completo vía zypper.",
        },
        {
          title: "Verificar la instalación",
          code: "latexmk --version && xelatex --version && biber --version",
          note: "Los tres comandos deben responder con número de versión.",
        },
        {
          title: "Reiniciar TeXisStudio",
          code: null,
          note: "Cierra y vuelve a abrir la aplicación para que detecte la nueva instalación.",
        },
      ],
      download_url: "https://www.tug.org/texlive/",
      color: "#3AA396",
      update: {
        code: "sudo tlmgr update --self --all",
        note: "Si instalaste TeX Live con el gestor de tu distro (apt/dnf/pacman), actualiza con él: p. ej. sudo apt update && sudo apt upgrade. Para la versión anual nueva, reinstala el paquete texlive-full.",
      },
    },
    {
      id: "tectonic",
      name: "Tectonic",
      tagline: "Ligero — sin gestor de paquetes de sistema",
      description:
        "Motor LaTeX moderno que cubre el 80% de las tesis sin necesitar gigabytes de espacio. Si algún paquete muy específico falla, puedes instalar TeX Live junto a Tectonic — conviven sin conflicto y la app te deja elegir cuál usar.",
      pros: [
        "No requiere sudo para instalar",
        "Descarga solo lo que necesita tu tesis",
        "Convive con TeX Live si necesitas ambos",
      ],
      cons: [
        "Primera compilación requiere internet",
        "Paquetes muy especializados (física avanzada, etc.) pueden requerir TeX Live",
      ],
      steps: [
        {
          title: "Instalar con el script oficial",
          code: "curl --proto '=https' --tlsv1.2 -fsSL https://drop.casey.li/tectonic | sh",
          note: "Descarga e instala el binario en ~/.cargo/bin o ~/bin según tu configuración.",
        },
        {
          title: "Alternativa: instalar con Cargo",
          code: "cargo install tectonic",
          note: "Requiere Rust instalado. Compila desde fuente, tarda varios minutos.",
        },
        {
          title: "Verificar la instalación",
          code: "tectonic --version",
          note: "Deberías ver algo como: tectonic 0.15.x",
        },
        {
          title: "Reiniciar TeXisStudio",
          code: null,
          note: "Cierra y vuelve a abrir la aplicación.",
        },
      ],
      download_url: "https://tectonic-typesetting.github.io/en-US/install.html",
      color: "#7C6EAF",
    },
  ],

  windows: [
    {
      id: "miktex",
      name: "MiKTeX",
      tagline: "Recomendado en Windows — resultados más finos, completo sin Perl",
      description:
        "MiKTeX es la distribución LaTeX completa para Windows. Produce resultados más precisos y estables que Tectonic: tipografía perfecta, bibliografías correctas al 100%, soporte multilingüe completo y todos los paquetes CTAN disponibles. Descarga automáticamente solo lo que necesitas — eficiente y completo al mismo tiempo.",
      pros: [
        "Tipografía y salida más fina que alternativas ligeras",
        "Bibliografías 100% correctas — biber incluido y compatible",
        "Todos los paquetes CTAN, descargados bajo demanda",
        "No necesita Strawberry Perl (a diferencia de latexmk manual)",
        "Soporte multilingüe: Cirílico, CJK, Árabe, Devanagari",
        "Instalador gráfico .exe fácil de usar",
      ],
      cons: [
        "La consola de MiKTeX puede confundir al principio",
        "Requiere aceptar la instalación de paquetes durante la primera compilación",
      ],
      steps: [
        {
          title: "Instalar MiKTeX con winget",
          code: "winget install MiKTeX.MiKTeX",
          note: "Abre PowerShell como usuario normal (no se necesita administrador). winget está incluido en Windows 10/11.",
        },
        {
          title: "Alternativa: instalador gráfico",
          code: null,
          note: "Ve a miktex.org → Download → Windows. Descarga el instalador de 64 bits y ejecútalo. Elige Install MiKTeX only for me.",
        },
        {
          title: "Verificar la instalación",
          code: "latexmk --version",
          note: "Debe responder con número de versión.",
        },
        {
          title: "Reiniciar TeXisStudio",
          code: null,
          note: "Cierra y vuelve a abrir la aplicación para que detecte MiKTeX.",
        },
      ],
      download_url: "https://miktex.org/download",
      color: "#3AA396",
      update: {
        code: "miktex packages update",
        note: "Lo más simple: abre «MiKTeX Console» → pestaña Updates → Check for updates → Update now. MiKTeX también suele avisarte de actualizaciones automáticamente.",
      },
    },
    {
      id: "tectonic",
      name: "Tectonic",
      tagline: "Ligero — un comando, sin Perl",
      description:
        "Motor LaTeX autónomo que cubre el 80% de las tesis. No requiere TeX Live ni Strawberry Perl. Si algún paquete muy específico falla, puedes instalar MiKTeX junto a Tectonic — conviven sin conflicto y la app te deja elegir cuál usar.",
      pros: [
        "Instalación en 1 minuto con winget",
        "No necesita Strawberry Perl",
        "Convive con MiKTeX si necesitas ambos",
        "Actualizable con winget upgrade",
      ],
      cons: [
        "Primera compilación requiere internet",
        "Paquetes muy especializados (física avanzada, etc.) pueden requerir MiKTeX",
      ],
      steps: [
        {
          title: "Instalar con winget",
          code: "winget install tectonic-typesetting.tectonic",
          note: "Abre PowerShell como usuario normal. No necesitas administrador.",
        },
        {
          title: "Verificar la instalación",
          code: "tectonic --version",
          note: "Deberías ver algo como: tectonic 0.15.x",
        },
        {
          title: "Reiniciar TeXisStudio",
          code: null,
          note: "Cierra y vuelve a abrir la aplicación para que detecte tectonic.",
        },
      ],
      download_url: "https://tectonic-typesetting.github.io/en-US/install.html",
      color: "#7C6EAF",
    },
    {
      id: "texlive",
      name: "TeX Live",
      tagline: "Completo — resultados más finos, estables, sin sorpresas",
      description:
        "TeX Live en Windows produce los resultados más precisos y estables posibles: tipografía perfecta, bibliografías al 100%, soporte multilingüe completo y todos los paquetes CTAN. Para tesis que deben verse impecables — física teórica, matemáticas avanzadas, documentos multilingüe — es la elección correcta.",
      pros: [
        "Tipografía y salida más fina que alternativas ligeras",
        "Todos los paquetes CTAN incluidos, sin descargas adicionales",
        "Bibliografías 100% correctas — biber compatible incluido",
        "Soporte multilingüe nativo: Cirílico, CJK, Árabe, Devanagari",
        "Compatible con cualquier perfil institucional",
      ],
      cons: [
        "Instalación lenta (30–90 minutos)",
        "Ocupa 4–8 GB de disco",
        "Requiere Strawberry Perl para latexmk",
      ],
      steps: [
        {
          title: "Descargar el instalador de TeX Live",
          code: null,
          note: "Ve a tug.org/texlive → download → install-tl-windows.exe. Descarga el instalador.",
        },
        {
          title: "Ejecutar el instalador",
          code: null,
          note: "Elige Simple install (big) para instalar todo. El proceso tarda 30–90 minutos.",
        },
        {
          title: "Instalar Strawberry Perl (necesario para latexmk)",
          code: "winget install StrawberryPerl.StrawberryPerl",
          note: "Perl es necesario para que latexmk funcione en Windows.",
        },
        {
          title: "Verificar la instalación",
          code: "latexmk --version && xelatex --version && biber --version",
          note: "Los tres comandos deben responder con número de versión.",
        },
        {
          title: "Reiniciar TeXisStudio",
          code: null,
          note: "Cierra y vuelve a abrir la aplicación.",
        },
      ],
      download_url: "https://www.tug.org/texlive/acquire-netinstall.html",
      color: "#4A6FA5",
      update: {
        code: "tlmgr update --self --all",
        note: "Ejecútalo en «Command Prompt» (cmd). Mantiene los paquetes al día dentro del año de TeX Live. Para la versión anual nueva, vuelve a correr el instalador install-tl-windows.exe.",
      },
    },
  ],
};

function getOptionsForPlatform(platform: Platform): InstallOption[] {
  return OPTIONS_BY_OS[platform] ?? OPTIONS_BY_OS["linux"];
}


function getPlatformLabel(platform: Platform): string {
  if (platform === "macos") return "macOS";
  if (platform === "windows") return "Windows";
  if (platform === "linux") return "Linux";
  return platform;
}

function localizeOption(option: InstallOption, platform: Platform, t: TFunction): InstallOption {
  const baseKey = `setup_latex.options.${platform}.${option.id}`;
  return {
    ...option,
    tagline: t(`${baseKey}.tagline`, { defaultValue: option.tagline }),
    description: t(`${baseKey}.description`, { defaultValue: option.description }),
    pros: option.pros.map((value, index) => t(`${baseKey}.pros.${index}`, { defaultValue: value })),
    cons: option.cons.map((value, index) => t(`${baseKey}.cons.${index}`, { defaultValue: value })),
    steps: option.steps.map((step, index) => ({
      ...step,
      title: t(`${baseKey}.steps.${index}.title`, { defaultValue: step.title }),
      note: t(`${baseKey}.steps.${index}.note`, { defaultValue: step.note }),
    })),
  };
}

// ── Componente de estado de detección ────────────────────────────

function DetectionStatus({ info }: { info: LatexInfo | null }) {
  const { t } = useTranslation();
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
              <div style={{ fontSize: 10, color: "var(--build-err)", marginTop: 1 }}>{t("setup_latex.not_found")}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tarjeta de opción ─────────────────────────────────────────────

function OptionCard({
  option, selected, installed, recommended, onClick,
}: {
  option: InstallOption;
  selected: boolean;
  installed: boolean;
  recommended: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
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
          {recommended && !installed && (
            <span className="chip chip-accent" style={{ fontSize: 10 }}>{t("wizard.recommended")}</span>
          )}
          {installed && (
            <span className="chip chip-ok" style={{ fontSize: 10 }}>
              <IconCheck size={8} sw={2.5} /> {t("settings.community_installed")}
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

function InstructionsPanel({ option }: { option: InstallOption }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {option.steps.map((step, i) => (
        <div key={i} style={{ display: "flex", gap: 16, paddingBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "var(--accent)", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, flexShrink: 0,
            }}>
              {i + 1}
            </div>
            {i < option.steps.length - 1 && (
              <div style={{ width: 1, flex: 1, background: "var(--border-soft)", marginTop: 4, minHeight: 16 }} />
            )}
          </div>
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
        {t("setup_latex.official_site", { name: option.name })} <IconChevronR size={12} />
      </a>
      {option.update && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", marginBottom: 6 }}>
            {t("setup_latex.how_to_update")}
          </div>
          {option.update.code && (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 12,
              background: "var(--ink-900)", color: "#A8D49C",
              padding: "8px 12px", borderRadius: "var(--r-sm)", marginBottom: 6, userSelect: "all",
            }}>
              {option.update.code}
            </div>
          )}
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
            {option.update.note}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title, body, tone = "info",
}: {
  title: string; body: string; tone?: "info" | "ok" | "warn";
}) {
  const palette = {
    info: { background: "var(--accent-tint)", border: "1px solid var(--accent-soft)", color: "var(--accent-deep)", icon: <IconWarn size={13} /> },
    ok:   { background: "var(--build-ok-tint)", border: "1px solid var(--build-ok)", color: "var(--build-ok)", icon: <IconCheck size={13} sw={2.5} /> },
    warn: { background: "color-mix(in srgb, var(--build-warn) 10%, var(--bg-panel))", border: "1px solid var(--build-warn)", color: "var(--build-warn)", icon: <IconWarn size={13} /> },
  } as const;
  const s = palette[tone];
  return (
    <div style={{ padding: "12px 14px", borderRadius: "var(--r-md)", background: s.background, border: s.border, color: s.color, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>{s.icon}</div>
      <div>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>{body}</div>
      </div>
    </div>
  );
}

// ── Vista principal ───────────────────────────────────────────────

export default function SetupLatexView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const userMode = useSettingsStore((s) => s.userMode);
  const latexPrimaryBackend = useSettingsStore((s) => s.latexPrimaryBackend);
  const latexBackendUserExplicit = useSettingsStore((s) => s.latexBackendUserExplicit);
  const setLatexPrimaryBackend = useSettingsStore((s) => s.setLatexPrimaryBackend);
  const setLatexBackendUserExplicit = useSettingsStore((s) => s.setLatexBackendUserExplicit);
  const setLatexInfo = useProjectStore((s) => s.setLatexInfo);
  const [info, setInfo]         = useState<LatexInfo | null>(null);
  const [platform, setPlatform] = useState<Platform>("linux");
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await api.getPlatform().catch(() => "linux");
      setPlatform(p);
      handleDetect();
    })();
  }, []);

  async function handleDetect() {
    setDetecting(true);
    try {
      const result = await api.detectLatex();
      setInfo(result);
      setLatexInfo(result); // share detection with the Settings screen
      // Auto-select the most powerful engine unless the user explicitly chose one
      if (!latexBackendUserExplicit) {
        const best = getBestAvailableBackend(result);
        if (best !== latexPrimaryBackend) setLatexPrimaryBackend(best);
      }
    } catch {
      /* detection failed — keep the current preference */
    } finally {
      setDetecting(false);
    }
  }

  const options      = getOptionsForPlatform(platform);
  const recommendedId = options[0].id;
  const suiteId      = options[0].id; // the OS suite (mactex / texlive / miktex)
  // Selection mirrors the shared compilation backend: suite ↔ "latexmk".
  const activeId     = latexPrimaryBackend === "tectonic" ? "tectonic" : suiteId;

  // Selecting a card sets the shared engine preference, reflected in Settings
  // and used by the compiler. Marks the choice explicit so auto-select won't
  // override it — "prefer the fuller suite unless the user changes it".
  function selectEngine(optionId: string) {
    setLatexBackendUserExplicit(true);
    setLatexPrimaryBackend(backendForSetupOption(optionId));
  }
  const displayOptions = options.map((option) => localizeOption(option, platform, t));
  const selectedDisplayOption = displayOptions.find((o) => o.id === activeId) ?? displayOptions[0];

  const installedIds = new Set<string>();
  if (info?.has_tectonic)   installedIds.add("tectonic");
  if (info?.latexmk_usable) { installedIds.add("miktex"); installedIds.add("texlive"); installedIds.add("mactex"); }

  const guidedBody = info?.is_usable
    ? t("setup_latex.guided_ready")
    : t("setup_latex.guided_recommendation", { platform: getPlatformLabel(platform), name: displayOptions[0].name });

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><span style={{ color: "var(--fg-muted)", fontSize: "var(--fs-sm)" }}>/ {t("setup_latex.nav_title")}</span></>}
        center={null}
        right={<button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← {t("common.back")}</button>}
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-app)", overflow: "auto" }} className="scroll">
        <div style={{ flex: 1, padding: "40px 56px 40px", maxWidth: 960, margin: "0 auto" }}>

          {/* Encabezado */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 400, margin: "0 0 6px", color: "var(--fg-strong)", letterSpacing: "-0.015em" }}>
              {t("setup_latex.heading_prefix")} <em style={{ color: "var(--accent-deep)", fontStyle: "italic" }}>PDF</em>
            </h1>
            <p style={{ margin: 0, color: "var(--fg-muted)", fontSize: "var(--fs-md)", maxWidth: 580 }}>
              {t("setup_latex.intro")}
            </p>
            <div style={{ marginTop: 10 }}>
              <AiHelpButton
                panel="setup_latex"
                mode="app_help"
                label={t("setup_latex.help_label")}
                question={t("setup_latex.help_question")}
                variant="ghost"
              />
            </div>
          </div>

          {/* Resumen */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14, marginBottom: 24 }}>
            <SummaryCard
              title={t("setup_latex.detected_system", { platform: getPlatformLabel(platform) })}
              body={t("setup_latex.system_body")}
            />
            <SummaryCard
              title={info?.is_usable ? t("setup_latex.ready_title") : t("setup_latex.initial_recommendation")}
              body={guidedBody}
              tone={info?.is_usable ? "ok" : "info"}
            />
          </div>

          {/* Detección */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)" }}>
              {t("setup_latex.environment_check")}
            </div>
            <button className="btn btn-sm" onClick={() => handleDetect()} disabled={detecting} style={{ fontSize: "var(--fs-xs)" }}>
              <IconRefresh size={12} /> {detecting ? t("setup_latex.detecting") : t("setup_latex.detect_again")}
            </button>
          </div>

          {info ? (
            <>
              {info.is_usable ? (
                <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", marginBottom: 20, background: "var(--build-ok-tint)", border: "1px solid var(--build-ok)", display: "flex", gap: 8, alignItems: "center", fontSize: "var(--fs-sm)", color: "var(--build-ok)" }}>
                  <IconCheck size={13} sw={2.5} />
                  <strong>{t("setup_latex.all_ready")}</strong> {t("setup_latex.can_generate_pdf")}{userMode === "advanced" && <> {t("setup_latex.available_engines", { engines: info.available_backends.join(", ") })}</>}
                </div>
              ) : (
                <div style={{ padding: "10px 14px", borderRadius: "var(--r-md)", marginBottom: 20, background: "var(--accent-tint)", border: "1px solid var(--accent-soft)", display: "flex", gap: 8, alignItems: "center", fontSize: "var(--fs-sm)", color: "var(--accent-deep)" }}>
                  <IconWarn size={13} />
                  {t("setup_latex.no_tool_found")}
                </div>
              )}
              <DetectionStatus info={info} />
            </>
          ) : (
            <div style={{ padding: "20px 0 24px", color: "var(--fg-faint)", fontSize: "var(--fs-sm)" }}>
              {detecting ? t("setup_latex.detecting_installs") : t("setup_latex.detect_failed_browser")}
            </div>
          )}

          {/* Camino recomendado — solo para básico y cuando no está instalado */}
          {userMode === "basic" && !info?.is_usable && options.length > 0 && (
            <div style={{
              marginBottom: 24, padding: "16px 18px",
              borderRadius: "var(--r-lg)", background: "var(--accent-tint)",
              border: "1px solid var(--accent)",
              display: "flex", gap: 14, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>⭐</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--accent-deep)", fontSize: "var(--fs-md)", marginBottom: 4 }}>
                  {t("setup_latex.basic_recommend_title", { name: displayOptions[0].name })}
                </div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.6 }}>
                  {displayOptions[0].tagline} — {t("setup_latex.basic_recommend_body")}
                </div>
                <button
                  className="btn btn-sm btn-accent"
                  style={{ marginTop: 10 }}
                  onClick={() => selectEngine(options[0].id)}
                >
                  {t("setup_latex.view_install_steps", { name: displayOptions[0].name })}
                </button>
              </div>
            </div>
          )}

          {/* Opciones para este OS */}
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 12 }}>
            {userMode === "basic" ? t("setup_latex.all_options") : t("setup_latex.options_for_platform", { platform: getPlatformLabel(platform) })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 32 }}>
            {displayOptions.map((opt) => (
              <OptionCard
                key={opt.id}
                option={opt}
                selected={activeId === opt.id}
                installed={installedIds.has(opt.id)}
                recommended={opt.id === recommendedId}
                onClick={() => selectEngine(opt.id)}
              />
            ))}
          </div>

          {/* Instrucciones */}
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 20 }}>
            {t("setup_latex.guided_steps", { name: selectedDisplayOption.name, platform: getPlatformLabel(platform) })}
          </div>
          <div style={{ maxWidth: 640 }}>
            <InstructionsPanel option={selectedDisplayOption} />
          </div>

          {userMode === "advanced" && (
            <div style={{ maxWidth: 640, marginTop: 28, padding: "14px 16px", background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)" }}>
              <div style={{ fontSize: "var(--fs-xs)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-faint)", marginBottom: 8 }}>
                {t("setup_latex.technical_detail")}
              </div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-muted)", lineHeight: 1.7 }}>
                {t("setup_latex.technical_detail_body")}
              </div>
            </div>
          )}

          <div style={{ height: 48 }} />
        </div>
      </div>

      <TxStatusbar items={[
        info?.is_usable
          ? { text: t("setup_latex.status_ready"), dot: "var(--build-ok)" }
          : { text: t("setup_latex.status_missing"), dot: "var(--build-err)" },
        { right: true, text: t("setup_latex.status_system", { platform: getPlatformLabel(platform) }) },
      ]} />
    </>
  );
}
