use serde::{Deserialize, Serialize};

/// Por qué se necesita un paquete.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RequirementReason {
    /// Detectado por \includegraphics, \begin{figure}, etc.
    Asset,
    /// Detectado por \begin{tabular}, \toprule, etc.
    Table,
    /// Detectado por \cref, \Cref, \ref, \autoref.
    CrossReference,
    /// Detectado por \gls, \newacronym, \printglossary.
    Glossary,
    /// Requerido por el perfil institucional activo.
    Profile,
    /// Detectado por \addbibresource, \printbibliography.
    Bibliography,
    /// Detectado por \begin{lstlisting}, \begin{minted}.
    Code,
    /// Detectado por \begin{algorithm}.
    Algorithm,
    /// Detectado por notación disciplinar: \ce{}, \SI{}, \begin{circuitikz}, etc.
    Discipline,
    /// Declarado explícitamente por el usuario en el preámbulo.
    UserExplicit,
}

/// Prioridad de instalación.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PackagePriority {
    Required,
    Recommended,
    Optional,
}

/// Un paquete requerido por el proyecto.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageRequirement {
    pub package_name: String,
    pub options: Vec<String>,
    pub reason: RequirementReason,
    pub priority: PackagePriority,
    /// Si está presente en el preámbulo actual.
    pub already_declared: bool,
}

/// Severidad de un conflicto.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConflictResolution {
    RemoveA,
    RemoveB,
    LoadOrderFix,
    NoAutomaticFix,
    Informational,
}

/// Conflicto entre dos paquetes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageConflict {
    pub package_a: String,
    pub package_b: String,
    pub description: String,
    pub resolution: ConflictResolution,
    /// Si `true`, bloquea la compilación.
    pub is_blocking: bool,
}

/// Resultado del análisis de paquetes de un proyecto.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PackageAnalysis {
    /// Paquetes detectados como necesarios pero que no están en el preámbulo.
    pub missing: Vec<PackageRequirement>,
    /// Paquetes en el preámbulo que la app detectó como correctos.
    pub declared: Vec<String>,
    /// Conflictos detectados.
    pub conflicts: Vec<PackageConflict>,
    /// Si `true`, se necesita `\usepackage{shellesc}` o shell-escape.
    pub requires_shell_escape: bool,
}

impl PackageAnalysis {
    pub fn has_blocking_issues(&self) -> bool {
        self.conflicts.iter().any(|c| c.is_blocking)
            || self
                .missing
                .iter()
                .any(|r| r.priority == PackagePriority::Required && !r.already_declared)
    }
}
