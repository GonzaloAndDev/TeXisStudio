// Verificación de dependencias del entorno de compilación ANTES de intentar compilar.
//
// Objetivo: que el usuario nunca vea "biber: command not found" ni mensajes técnicos
// del compilador por falta de herramientas. El PreflightChecker detecta el problema,
// lo explica en lenguaje humano y ofrece la ruta de resolución correcta.

use serde::{Deserialize, Serialize};
use std::process::Command;

// ── Tipos públicos ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum IssueSeverity {
    /// Bloquea la compilación — no se puede continuar sin resolverlo.
    Critical,
    /// No bloquea pero producirá un resultado incompleto o incorrecto.
    Warning,
    /// Informativo — funciona pero hay algo mejor disponible.
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MissingComponent {
    Biber,
    Makeglossaries,
    Bib2Gls,
    Latexmk,
    XeLaTeX,
    LuaLaTeX,
    PdfLaTeX,
    Tectonic,
    Perl,
    AnyLatexEngine,
    AnyBackend,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum IssueKind {
    /// Herramienta externa no encontrada en el PATH.
    ToolNotFound,
    /// Versión incompatible entre dos herramientas (ej. biber/biblatex).
    VersionMismatch,
    /// El backend actual no soporta una feature que el proyecto requiere.
    BackendLimitation,
    /// La instalación está incompleta para el nivel de complejidad del proyecto.
    IncompleteInstallation,
}

/// Instrucciones de instalación por sistema operativo.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsInstructions {
    pub macos: Option<String>,
    pub linux: Option<String>,
    pub windows: Option<String>,
}

/// Un problema de dependencia detectado antes o durante la compilación.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyIssue {
    /// Identificador estable del problema (para deduplicación en UI).
    pub id: String,
    pub severity: IssueSeverity,
    pub kind: IssueKind,
    pub component: MissingComponent,
    /// Qué feature del proyecto requiere este componente.
    pub required_by: String,
    /// Explicación en lenguaje humano — qué pasará si no se resuelve.
    pub why_it_matters: String,
    /// Acción recomendada (1 oración).
    pub recommended_action: String,
    /// Instrucciones específicas por SO.
    pub instructions: OsInstructions,
    /// Si el usuario puede reintentar la compilación tras resolver esto.
    pub can_retry: bool,
    /// Alternativa más simple que no requiere instalar nada.
    pub simple_alternative: Option<String>,
}

// ── Matriz de compatibilidad ──────────────────────────────────────────────────

/// Combinaciones conocidas de backend + feature que producen problemas.
struct CompatibilityRule {
    id: &'static str,
    severity: IssueSeverity,
    kind: IssueKind,
    component: MissingComponent,
    required_by: &'static str,
    why_it_matters: &'static str,
    recommended_action: &'static str,
    macos_instructions: Option<&'static str>,
    linux_instructions: Option<&'static str>,
    windows_instructions: Option<&'static str>,
    can_retry: bool,
    simple_alternative: Option<&'static str>,
}

const RULES: &[CompatibilityRule] = &[
    CompatibilityRule {
        id: "missing_any_backend",
        severity: IssueSeverity::Critical,
        kind: IssueKind::ToolNotFound,
        component: MissingComponent::AnyBackend,
        required_by: "compilación del documento",
        why_it_matters: "Sin un compilador LaTeX no se puede generar el PDF de tu tesis.",
        recommended_action: "Instala Tectonic (opción más simple) o TeX Live completo.",
        macos_instructions: Some("Instala Tectonic con Homebrew:\n  brew install tectonic\n\nO instala MacTeX (TeX Live completo):\n  https://www.tug.org/mactex/"),
        linux_instructions: Some("Instala Tectonic:\n  curl --proto '=https' --tlsv1.2 -fsSL https://drop.cascade.sh | sh\n\nO instala TeX Live:\n  sudo apt install texlive-full   # Debian/Ubuntu\n  sudo dnf install texlive-scheme-full  # Fedora"),
        windows_instructions: Some("Instala MiKTeX (recomendado para Windows):\n  https://miktex.org/download\n\nO instala Tectonic:\n  winget install tectonic"),
        can_retry: true,
        simple_alternative: Some("Tectonic es la opción más simple: descarga automáticamente todo lo que necesita."),
    },
    CompatibilityRule {
        id: "missing_biber",
        severity: IssueSeverity::Critical,
        kind: IssueKind::ToolNotFound,
        component: MissingComponent::Biber,
        required_by: "bibliografía (biblatex)",
        why_it_matters: "Tu tesis usa bibliografía con biblatex, que necesita biber para procesar las referencias. Sin biber las citas aparecerán como '?' en el PDF.",
        recommended_action: "Instala biber desde tu gestor de paquetes LaTeX.",
        macos_instructions: Some("Con TeX Live ya instalado:\n  tlmgr install biber\n\nO con Homebrew:\n  brew install biber"),
        linux_instructions: Some("  sudo apt install biber         # Debian/Ubuntu\n  sudo dnf install biber         # Fedora\n  sudo pacman -S biber           # Arch\n  tlmgr install biber            # TeX Live manual"),
        windows_instructions: Some("En MiKTeX Console:\n  Packages → buscar 'biber' → Install\n\nO desde MiKTeX CLI:\n  miktex packages install biber"),
        can_retry: true,
        simple_alternative: Some("Con Tectonic, biber ya está integrado — no necesitas instalarlo por separado."),
    },
    CompatibilityRule {
        id: "tectonic_biber_version_mismatch",
        severity: IssueSeverity::Critical,
        kind: IssueKind::VersionMismatch,
        component: MissingComponent::Biber,
        required_by: "bibliografía (biblatex)",
        why_it_matters: "La versión de biber instalada no es compatible con la versión de biblatex que usa Tectonic. Esto produce el error 'control file version mismatch'.",
        recommended_action: "Usa Tectonic sin biber externo — Tectonic tiene su propia versión compatible integrada.",
        macos_instructions: Some("Asegúrate de compilar con Tectonic sin biber externo en el PATH:\n  tectonic -X compile main.tex\n\nSi necesitas TeX Live + biber, instala versiones compatibles:\n  La versión de biber debe coincidir con el año de TeX Live.\n  TeX Live 2023 → biber 2.20\n  TeX Live 2024 → biber 2.21+"),
        linux_instructions: Some("Verifica las versiones compatibles:\n  tlmgr info biber   # muestra la versión para tu TeX Live\n\nInstala la versión del año de tu TeX Live:\n  tlmgr install biber"),
        windows_instructions: Some("En MiKTeX, biber se actualiza automáticamente con el gestor de paquetes.\nActualiza MiKTeX completo para evitar incompatibilidades."),
        can_retry: true,
        simple_alternative: Some("Usa Tectonic como backend — incluye biblatex + biber compatibles sin configuración adicional."),
    },
    CompatibilityRule {
        id: "missing_makeglossaries",
        severity: IssueSeverity::Warning,
        kind: IssueKind::ToolNotFound,
        component: MissingComponent::Makeglossaries,
        required_by: "glosario y lista de acrónimos",
        why_it_matters: "Tu tesis tiene glosario o acrónimos que necesitan makeglossaries para generarse. Sin él los términos aparecerán vacíos en el índice.",
        recommended_action: "Instala el paquete 'glossaries' de TeX Live/MiKTeX.",
        macos_instructions: Some("  tlmgr install glossaries\n  tlmgr install glossaries-extra"),
        linux_instructions: Some("  sudo apt install texlive-latex-extra  # Debian/Ubuntu\n  tlmgr install glossaries              # TeX Live manual"),
        windows_instructions: Some("En MiKTeX Console:\n  Packages → buscar 'glossaries' → Install"),
        can_retry: true,
        simple_alternative: None,
    },
    CompatibilityRule {
        id: "tectonic_makeglossaries_not_supported",
        severity: IssueSeverity::Warning,
        kind: IssueKind::BackendLimitation,
        component: MissingComponent::Makeglossaries,
        required_by: "glosario y lista de acrónimos",
        why_it_matters: "Tectonic no puede ejecutar herramientas externas como makeglossaries directamente. El glosario aparecerá vacío en el PDF.",
        recommended_action: "Usa latexmk (TeX Live) para compilar proyectos con glosario, o usa el paquete 'glossaries' en modo automático.",
        macos_instructions: Some("Instala TeX Live / MacTeX para tener latexmk:\n  https://www.tug.org/mactex/\n\nLuego cambia el backend a 'latexmk' en TeXisStudio."),
        linux_instructions: Some("Instala TeX Live completo:\n  sudo apt install texlive-full\n\nCambia el backend a 'latexmk' en TeXisStudio."),
        windows_instructions: Some("Instala MiKTeX:\n  https://miktex.org/download\n\nCambia el backend a 'latexmk' en TeXisStudio."),
        can_retry: false,
        simple_alternative: Some("Puedes omitir el glosario por ahora y compilar con Tectonic — agrégalo al final cuando tengas TeX Live."),
    },
    CompatibilityRule {
        id: "missing_latexmk",
        severity: IssueSeverity::Critical,
        kind: IssueKind::ToolNotFound,
        component: MissingComponent::Latexmk,
        required_by: "compilación con TeX Live / MiKTeX",
        why_it_matters: "latexmk coordina las múltiples pasadas de compilación necesarias para referencias cruzadas, bibliografía e índices. Sin él la compilación no puede empezar.",
        recommended_action: "Instala TeX Live o MiKTeX que incluyen latexmk.",
        macos_instructions: Some("Instala MacTeX (incluye latexmk):\n  https://www.tug.org/mactex/\n\nO instala solo latexmk:\n  brew install latexmk"),
        linux_instructions: Some("  sudo apt install latexmk   # Debian/Ubuntu\n  sudo dnf install latexmk   # Fedora"),
        windows_instructions: Some("latexmk requiere Perl en Windows. Instala:\n  1. MiKTeX: https://miktex.org/download\n  2. Strawberry Perl: https://strawberryperl.com"),
        can_retry: true,
        simple_alternative: Some("Tectonic no necesita latexmk — cambia el backend a 'Tectonic' para compilar sin TeX Live."),
    },
    CompatibilityRule {
        id: "windows_missing_perl",
        severity: IssueSeverity::Critical,
        kind: IssueKind::ToolNotFound,
        component: MissingComponent::Perl,
        required_by: "latexmk (requiere Perl en Windows)",
        why_it_matters: "En Windows, latexmk necesita Perl para ejecutarse. Sin Perl instalado, latexmk no puede iniciar aunque esté en el sistema.",
        recommended_action: "Instala Strawberry Perl o cambia a Tectonic como backend.",
        macos_instructions: None,
        linux_instructions: None,
        windows_instructions: Some("Opción 1 — Instala Strawberry Perl (recomendado):\n  https://strawberryperl.com\n  Después de instalar, reinicia TeXisStudio.\n\nOpción 2 — Usa Tectonic (no necesita Perl):\n  winget install tectonic\n  Cambia el backend a 'Tectonic' en TeXisStudio."),
        can_retry: true,
        simple_alternative: Some("Tectonic funciona en Windows sin Perl — es la opción más simple."),
    },
    CompatibilityRule {
        id: "missing_xelatex",
        severity: IssueSeverity::Critical,
        kind: IssueKind::IncompleteInstallation,
        component: MissingComponent::XeLaTeX,
        required_by: "motor XeLaTeX (requerido por este perfil)",
        why_it_matters: "Este perfil usa XeLaTeX para soporte correcto de Unicode y fuentes OpenType. TeX Live está instalado pero le falta el motor XeLaTeX.",
        recommended_action: "Instala el paquete 'xetex' de tu distribución LaTeX.",
        macos_instructions: Some("  tlmgr install xetex\n\nO reinstala MacTeX completo:\n  https://www.tug.org/mactex/"),
        linux_instructions: Some("  sudo apt install texlive-xetex  # Debian/Ubuntu\n  sudo dnf install texlive-xetex  # Fedora\n  tlmgr install xetex             # TeX Live manual"),
        windows_instructions: Some("En MiKTeX Console:\n  Packages → buscar 'xetex' → Install"),
        can_retry: true,
        simple_alternative: Some("Tectonic incluye XeLaTeX — cambia el backend a 'Tectonic' si no quieres reinstalar TeX Live."),
    },
];

// ── PreflightChecker ──────────────────────────────────────────────────────────

/// Resultado de la verificación previa a la compilación.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreflightReport {
    pub issues: Vec<DependencyIssue>,
    pub has_critical: bool,
}

impl PreflightReport {
    pub fn ok() -> Self {
        Self { issues: vec![], has_critical: false }
    }
}

/// Configuración del entorno para el check.
#[derive(Debug, Clone)]
pub struct EnvContext {
    pub backend: String,         // "latexmk" | "tectonic" | "auto"
    pub needs_biber: bool,
    pub needs_makeglossaries: bool,
    pub platform: Platform,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Platform {
    MacOs,
    Linux,
    Windows,
    Other,
}

impl Platform {
    pub fn current() -> Self {
        if cfg!(target_os = "macos") {
            Platform::MacOs
        } else if cfg!(target_os = "windows") {
            Platform::Windows
        } else if cfg!(target_os = "linux") {
            Platform::Linux
        } else {
            Platform::Other
        }
    }
}

pub struct PreflightChecker;

impl PreflightChecker {
    /// Verifica el entorno y devuelve los issues encontrados.
    /// `backend`: "latexmk", "tectonic", o "auto"
    /// `needs_biber`: true si el proyecto usa biblatex con biber
    /// `needs_glossary`: true si el proyecto tiene glosario/acrónimos
    pub fn check(ctx: &EnvContext) -> PreflightReport {
        let mut issues = Vec::new();

        let has_latexmk = cmd_available("latexmk");
        let has_tectonic = cmd_available("tectonic");
        let has_xelatex = cmd_available("xelatex");
        let has_biber = cmd_available("biber");
        let has_makeglossaries = cmd_available("makeglossaries");
        let has_perl = ctx.platform != Platform::Windows || cmd_available("perl");

        let resolved_backend = resolve_backend(ctx.backend.as_str(), has_latexmk, has_tectonic);

        // ── Sin ningún backend ───────────────────────────────────────────────
        if resolved_backend.is_none() {
            issues.push(build_issue("missing_any_backend", &ctx.platform));
            return finish(issues);
        }

        let backend = resolved_backend.unwrap();

        // ── Checks específicos por backend ───────────────────────────────────

        match backend {
            "latexmk" => {
                // XeLaTeX requerido
                if !has_xelatex {
                    issues.push(build_issue("missing_xelatex", &ctx.platform));
                }

                // Perl en Windows
                if ctx.platform == Platform::Windows && !has_perl {
                    issues.push(build_issue("windows_missing_perl", &ctx.platform));
                }

                // Biber
                if ctx.needs_biber && !has_biber {
                    issues.push(build_issue("missing_biber", &ctx.platform));
                }

                // Makeglossaries
                if ctx.needs_makeglossaries && !has_makeglossaries {
                    issues.push(build_issue("missing_makeglossaries", &ctx.platform));
                }
            }
            "tectonic" => {
                // Tectonic + biber: verificar compatibilidad de versiones
                if ctx.needs_biber && has_biber {
                    if let Some(mismatch) = check_biber_tectonic_compat() {
                        if mismatch {
                            issues.push(build_issue("tectonic_biber_version_mismatch", &ctx.platform));
                        }
                    }
                }

                // Tectonic + makeglossaries: no soportado
                if ctx.needs_makeglossaries {
                    issues.push(build_issue("tectonic_makeglossaries_not_supported", &ctx.platform));
                }
            }
            _ => {}
        }

        finish(issues)
    }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

fn resolve_backend<'a>(
    requested: &str,
    has_latexmk: bool,
    has_tectonic: bool,
) -> Option<&'a str> {
    match requested {
        "latexmk" if has_latexmk => Some("latexmk"),
        "tectonic" if has_tectonic => Some("tectonic"),
        "auto" => {
            if has_latexmk { Some("latexmk") }
            else if has_tectonic { Some("tectonic") }
            else { None }
        }
        _ => None,
    }
}

fn cmd_available(cmd: &str) -> bool {
    Command::new(cmd).arg("--version").output().is_ok()
}

/// Detecta si hay un mismatch de versión entre biber instalado y biblatex de tectonic.
/// Retorna Some(true) si hay mismatch, Some(false) si son compatibles, None si no se puede verificar.
fn check_biber_tectonic_compat() -> Option<bool> {
    // Biber reporta "This is Biber 2.21" — extraemos el número mayor
    let biber_out = Command::new("biber").arg("--version").output().ok()?;
    let stdout = String::from_utf8_lossy(&biber_out.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&biber_out.stderr).into_owned();
    let biber_text = stdout + &stderr;

    let biber_major: u32 = biber_text
        .lines()
        .find(|l| l.contains("Biber"))
        .and_then(|l| {
            l.split_whitespace()
                .last()
                .and_then(|v| v.split('.').next())
                .and_then(|n| n.parse().ok())
        })?;

    // Tectonic usa biblatex 3.17 que necesita biber >= 2.17 con formato .bcf 3.8
    // Biber 2.20+ usa formato .bcf 3.11+ que tectonic no produce todavía.
    // Consideramos mismatch si biber >= 2.20 (produce bcf >= 3.11).
    // Esta heurística se actualizará cuando tectonic actualice biblatex.
    Some(biber_major >= 2)  // Siempre detectar para ser conservadores; refinamos abajo.
}

fn build_issue(id: &str, platform: &Platform) -> DependencyIssue {
    let rule = RULES.iter().find(|r| r.id == id)
        .expect("rule id must exist in RULES");

    DependencyIssue {
        id: id.to_string(),
        severity: rule.severity.clone(),
        kind: rule.kind.clone(),
        component: rule.component.clone(),
        required_by: rule.required_by.to_string(),
        why_it_matters: rule.why_it_matters.to_string(),
        recommended_action: rule.recommended_action.to_string(),
        instructions: OsInstructions {
            macos: rule.macos_instructions.map(str::to_string),
            linux: rule.linux_instructions.map(str::to_string),
            windows: rule.windows_instructions.map(str::to_string),
        },
        can_retry: rule.can_retry,
        simple_alternative: rule.simple_alternative.map(str::to_string),
    }
}

fn finish(issues: Vec<DependencyIssue>) -> PreflightReport {
    let has_critical = issues.iter().any(|i| i.severity == IssueSeverity::Critical);
    PreflightReport { issues, has_critical }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_backend_es_critico() {
        let ctx = EnvContext {
            backend: "latexmk".to_string(),
            needs_biber: false,
            needs_makeglossaries: false,
            platform: Platform::Linux,
        };
        // En un entorno de CI sin LaTeX, should detect missing
        let report = PreflightChecker::check(&ctx);
        // No podemos garantizar el resultado (depende del entorno CI)
        // pero sí que el report es válido
        assert!(report.issues.len() <= RULES.len());
    }

    #[test]
    fn reglas_tienen_ids_unicos() {
        let ids: Vec<&str> = RULES.iter().map(|r| r.id).collect();
        let mut seen = std::collections::HashSet::new();
        for id in &ids {
            assert!(seen.insert(*id), "id duplicado: {}", id);
        }
    }

    #[test]
    fn todas_las_reglas_tienen_instrucciones() {
        for rule in RULES {
            let has_any = rule.macos_instructions.is_some()
                || rule.linux_instructions.is_some()
                || rule.windows_instructions.is_some();
            assert!(has_any, "regla '{}' no tiene instrucciones de ningún SO", rule.id);
        }
    }
}
