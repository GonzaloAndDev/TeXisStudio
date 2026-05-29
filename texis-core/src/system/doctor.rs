// System Doctor — verificador pasivo de entorno LaTeX.
//
// Detecta y reporta. No instala, no bloquea la UI, no repara.
// El bloqueo activo de `export final` por dependencias críticas es responsabilidad
// de la capa de exportación (P1.9), no de este módulo.

use serde::{Deserialize, Serialize};
use std::process::Command;

/// Resultado de verificar una herramienta del entorno.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ToolStatus {
    /// La herramienta está disponible en el PATH.
    Available,
    /// La herramienta no fue encontrada en el PATH.
    Missing,
    /// La verificación no pudo completarse (error de ejecución).
    Unknown,
}

/// Resultado de verificar una dependencia del entorno.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorCheck {
    /// Nombre del ejecutable o paquete verificado.
    pub name: String,
    pub status: ToolStatus,
    /// Versión detectada, si es posible extraerla.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Descripción del rol de esta herramienta.
    pub description: String,
    /// Si su ausencia bloquea `export final` para el perfil activo.
    pub critical: bool,
    /// Instrucciones de instalación por plataforma, si está ausente.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub install_hint: Option<InstallHint>,
}

/// Instrucciones de instalación diferenciadas por plataforma.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallHint {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub macos: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linux: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub windows: Option<String>,
}

/// Reporte completo del diagnóstico del entorno.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorReport {
    /// Lista de verificaciones de herramientas y paquetes del entorno.
    pub checks: Vec<DoctorCheck>,
    /// El entorno es suficiente para compilar con el perfil activo.
    pub environment_ok: bool,
    /// Hay herramientas críticas faltantes que bloquearán `export final`.
    pub has_critical_missing: bool,
}

/// Ejecuta el diagnóstico del entorno para el perfil activo.
///
/// `profile_engine`: motor LaTeX declarado por el perfil activo ("xelatex", "pdflatex", "lualatex").
/// `bibliography_backend`: backend bibliográfico del perfil ("biber", "bibtex").
/// `bibliography_style`: estilo bibliográfico del perfil (para detectar paquetes .bbx requeridos).
/// `requires_pdfa`: el perfil activo declara `pdf_requirements.pdfa.required: true`.
pub fn run_doctor(
    profile_engine: &str,
    bibliography_backend: &str,
    bibliography_style: &str,
    requires_pdfa: bool,
) -> DoctorReport {
    let mut checks = Vec::new();

    // ── Herramientas base ────────────────────────────────────────────────────

    checks.push(check_cmd(
        "latexmk",
        &["--version"],
        "Motor de compilación principal (orquesta xelatex/biber/etc.)",
        true,
        Some(InstallHint {
            macos: Some("tlmgr install latexmk".into()),
            linux: Some("tlmgr install latexmk  # o apt install latexmk".into()),
            windows: Some("tlmgr install latexmk  (desde MiKTeX Console o TeX Live)".into()),
        }),
    ));

    // Motor declarado por el perfil (siempre crítico)
    let engine_name = profile_engine;
    let engine_desc = format!("Motor LaTeX declarado por el perfil activo ({engine_name})");
    checks.push(check_cmd(
        engine_name,
        &["--version"],
        &engine_desc,
        true,
        Some(InstallHint {
            macos: Some(format!("tlmgr install {engine_name}")),
            linux: Some(format!(
                "tlmgr install {engine_name}  # o apt install texlive-xetex"
            )),
            windows: Some(format!(
                "tlmgr install {engine_name}  (desde MiKTeX Console)"
            )),
        }),
    ));

    // Si el motor del perfil no es xelatex, también verificamos xelatex como motor recomendado
    if engine_name != "xelatex" {
        checks.push(check_cmd(
            "xelatex",
            &["--version"],
            "Motor recomendado para perfiles con fuentes especiales (Unicode/OpenType)",
            false,
            Some(InstallHint {
                macos: Some("tlmgr install xetex".into()),
                linux: Some("tlmgr install xetex  # o apt install texlive-xetex".into()),
                windows: Some("tlmgr install xetex  (desde MiKTeX Console)".into()),
            }),
        ));
    }

    if engine_name != "pdflatex" {
        checks.push(check_cmd(
            "pdflatex",
            &["--version"],
            "Motor básico de fallback",
            false,
            Some(InstallHint {
                macos: Some("tlmgr install pdftex".into()),
                linux: Some("tlmgr install pdftex  # o apt install texlive".into()),
                windows: Some("tlmgr install pdftex  (desde MiKTeX Console)".into()),
            }),
        ));
    }

    // Biber — crítico si el perfil usa biber
    let biber_critical = bibliography_backend == "biber";
    checks.push(check_cmd(
        "biber",
        &["--version"],
        "Backend bibliográfico para biblatex",
        biber_critical,
        Some(InstallHint {
            macos: Some("tlmgr install biber".into()),
            linux: Some("tlmgr install biber  # o apt install biber".into()),
            windows: Some("tlmgr install biber  (desde MiKTeX Console)".into()),
        }),
    ));

    // Poppler — para postflight (pdfinfo, pdffonts); warning si ausente
    checks.push(check_cmd(
        "pdfinfo",
        &["-v"],
        "Herramienta Poppler para postflight (metadatos del PDF)",
        false,
        Some(InstallHint {
            macos: Some("brew install poppler".into()),
            linux: Some("apt install poppler-utils".into()),
            windows: Some(
                "Instalar Poppler for Windows (github.com/oschwartz10612/poppler-windows)".into(),
            ),
        }),
    ));

    checks.push(check_cmd(
        "pdffonts",
        &["-v"],
        "Herramienta Poppler para verificar fuentes embebidas en el PDF",
        false,
        Some(InstallHint {
            macos: Some("brew install poppler".into()),
            linux: Some("apt install poppler-utils".into()),
            windows: Some("Instalar Poppler for Windows".into()),
        }),
    ));

    // veraPDF — crítico solo si el perfil exige PDF/A
    checks.push(check_cmd(
        "verapdf",
        &["--version"],
        "Validador PDF/A (pdf_requirements.pdfa.required)",
        requires_pdfa,
        Some(InstallHint {
            macos: Some("brew install verapdf  # o descargar desde verapdf.org".into()),
            linux: Some("Descargar instalador desde verapdf.org".into()),
            windows: Some("Descargar instalador desde verapdf.org".into()),
        }),
    ));

    // ── Paquetes LaTeX por estilo bibliográfico ──────────────────────────────

    if let Some(bbx_pkg) = bbx_package_for_style(bibliography_style) {
        let bbx_available = kpsewhich_available(bbx_pkg);
        checks.push(DoctorCheck {
            name: bbx_pkg.to_string(),
            status: if bbx_available {
                ToolStatus::Available
            } else {
                ToolStatus::Missing
            },
            version: None,
            description: format!(
                "Paquete biblatex requerido por el estilo bibliográfico '{bibliography_style}'"
            ),
            critical: true,
            install_hint: if bbx_available {
                None
            } else {
                Some(InstallHint {
                    macos: Some(format!("tlmgr install {bbx_pkg}")),
                    linux: Some(format!(
                        "tlmgr install {bbx_pkg}  # o apt install texlive-bibtex-extra"
                    )),
                    windows: Some(format!("tlmgr install {bbx_pkg}  (desde MiKTeX Console)")),
                })
            },
        });
    }

    // ── Calcular estado global ───────────────────────────────────────────────

    let has_critical_missing = checks
        .iter()
        .any(|c| c.critical && c.status == ToolStatus::Missing);

    let environment_ok = !has_critical_missing;

    DoctorReport {
        checks,
        environment_ok,
        has_critical_missing,
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn check_cmd(
    cmd: &str,
    args: &[&str],
    description: &str,
    critical: bool,
    install_hint: Option<InstallHint>,
) -> DoctorCheck {
    match Command::new(cmd).args(args).output() {
        Ok(output) => {
            let version = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .map(|l| l.trim().to_string())
                .filter(|s| !s.is_empty());
            DoctorCheck {
                name: cmd.to_string(),
                status: ToolStatus::Available,
                version,
                description: description.to_string(),
                critical,
                install_hint: None,
            }
        }
        Err(_) => DoctorCheck {
            name: cmd.to_string(),
            status: ToolStatus::Missing,
            version: None,
            description: description.to_string(),
            critical,
            install_hint,
        },
    }
}

/// Usa `kpsewhich` para detectar si un archivo .bbx o .sty está disponible
/// en la instalación LaTeX del sistema.
fn kpsewhich_available(pkg: &str) -> bool {
    let filename = if pkg.ends_with(".bbx") || pkg.ends_with(".sty") {
        pkg.to_string()
    } else {
        format!("{pkg}.bbx")
    };
    Command::new("kpsewhich")
        .arg(&filename)
        .output()
        .map(|o| o.status.success() && !o.stdout.is_empty())
        .unwrap_or(false)
}

/// Devuelve el paquete .bbx requerido por un estilo bibliográfico conocido.
fn bbx_package_for_style(style: &str) -> Option<&'static str> {
    match style {
        "apa" | "apa7" => Some("biblatex-apa"),
        "chicago" | "chicago-notes" | "chicago17" => Some("biblatex-chicago"),
        "ieee" => Some("biblatex-ieee"),
        "abnt" => Some("biblatex-abnt"),
        "mhra" => Some("biblatex-mhra"),
        "vancouver" => Some("biblatex-vancouver"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bbx_package_apa_correcto() {
        assert_eq!(bbx_package_for_style("apa"), Some("biblatex-apa"));
        assert_eq!(bbx_package_for_style("chicago17"), Some("biblatex-chicago"));
        assert_eq!(bbx_package_for_style("ieee"), Some("biblatex-ieee"));
        assert_eq!(bbx_package_for_style("custom"), None);
    }

    #[test]
    fn doctor_report_tiene_campos() {
        let report = run_doctor("xelatex", "biber", "apa", false);
        assert!(!report.checks.is_empty());
        // biber es crítico cuando el backend es biber
        let biber = report.checks.iter().find(|c| c.name == "biber").unwrap();
        assert!(biber.critical);
        // latexmk siempre es crítico
        let latexmk = report.checks.iter().find(|c| c.name == "latexmk").unwrap();
        assert!(latexmk.critical);
    }

    #[test]
    fn doctor_biber_no_critico_con_bibtex() {
        let report = run_doctor("pdflatex", "bibtex", "plain", false);
        let biber = report.checks.iter().find(|c| c.name == "biber").unwrap();
        assert!(!biber.critical);
    }
}
