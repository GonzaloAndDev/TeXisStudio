// PackageRegistry — catálogo persistible de paquetes LaTeX del proyecto.
// Guardado en .texisstudio/package-registry.json.

use super::model::{PackageAnalysis, PackagePriority};
use crate::error::{CoreError, CoreResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PackageRegistry {
    /// Paquetes registrados, indexados por nombre.
    pub packages: HashMap<String, RegistryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryEntry {
    pub name: String,
    pub options: Vec<String>,
    pub priority: PackagePriority,
    pub source: EntrySource,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EntrySource {
    /// Detectado automáticamente del contenido del proyecto.
    Detected,
    /// Requerido por el perfil activo.
    Profile,
    /// Añadido explícitamente por el usuario.
    User,
}

impl PackageRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Carga el registry desde disco. Si el archivo no existe, retorna uno vacío.
    pub fn load(project_root: &Path) -> CoreResult<Self> {
        let path = registry_path(project_root);
        if !path.exists() {
            return Ok(Self::new());
        }
        let content = std::fs::read_to_string(&path).map_err(CoreError::Io)?;
        serde_json::from_str::<Self>(&content).map_err(|e| CoreError::InvalidProject {
            message: e.to_string(),
        })
    }

    /// Persiste el registry en `.texisstudio/package-registry.json`.
    pub fn save(&self, project_root: &Path) -> CoreResult<()> {
        let path = registry_path(project_root);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(CoreError::Io)?;
        }
        let json = serde_json::to_string_pretty(self).map_err(|e| CoreError::InvalidProject {
            message: e.to_string(),
        })?;
        std::fs::write(&path, json).map_err(CoreError::Io)?;
        Ok(())
    }

    /// Añade o actualiza un paquete con fuente dada.
    /// Si ya existe, solo actualiza si la nueva fuente tiene mayor prioridad.
    pub fn register(&mut self, name: &str, options: Vec<String>, source: EntrySource) {
        let priority = match &source {
            EntrySource::User => PackagePriority::Required,
            EntrySource::Profile => PackagePriority::Required,
            EntrySource::Detected => PackagePriority::Recommended,
        };
        match self.packages.entry(name.to_string()) {
            std::collections::hash_map::Entry::Vacant(entry) => {
                entry.insert(RegistryEntry {
                    name: name.to_string(),
                    options,
                    priority,
                    source,
                });
            }
            std::collections::hash_map::Entry::Occupied(mut entry) => {
                if source_rank(&source) > source_rank(&entry.get().source) {
                    entry.insert(RegistryEntry {
                        name: name.to_string(),
                        options,
                        priority,
                        source,
                    });
                }
            }
        }
    }

    /// Actualiza el registry desde un `PackageAnalysis` (resultado del detector).
    pub fn update_from_analysis(&mut self, analysis: &PackageAnalysis) {
        self.packages
            .retain(|_, entry| entry.source != EntrySource::Detected);

        for req in &analysis.missing {
            self.packages
                .entry(req.package_name.clone())
                .or_insert_with(|| RegistryEntry {
                    name: req.package_name.clone(),
                    options: req.options.clone(),
                    priority: req.priority.clone(),
                    source: EntrySource::Detected,
                });
        }
        for declared in &analysis.declared {
            self.packages
                .entry(declared.clone())
                .or_insert_with(|| RegistryEntry {
                    name: declared.clone(),
                    options: vec![],
                    priority: PackagePriority::Optional,
                    source: EntrySource::Detected,
                });
        }
    }

    /// Devuelve los nombres de todos los paquetes registrados ordenados.
    pub fn package_names(&self) -> Vec<&str> {
        let mut names: Vec<&str> = self.packages.keys().map(|s| s.as_str()).collect();
        names.sort_unstable();
        names
    }

    /// Detecta conflictos conocidos entre paquetes del registry.
    pub fn detect_conflicts(&self) -> Vec<KnownConflict> {
        let known: &[(&str, &str, &str)] = &[
            (
                "babel",
                "polyglossia",
                "Son mutuamente excluyentes; usa uno de los dos.",
            ),
            (
                "subfig",
                "subcaption",
                "Conflicto de definiciones; usa subcaption.",
            ),
            (
                "epsfig",
                "graphicx",
                "epsfig está obsoleto; usa solo graphicx.",
            ),
        ];

        let mut found = Vec::new();
        for (a, b, hint) in known {
            if self.packages.contains_key(*a) && self.packages.contains_key(*b) {
                found.push(KnownConflict {
                    package_a: a.to_string(),
                    package_b: b.to_string(),
                    hint: hint.to_string(),
                });
            }
        }
        found
    }
}

#[derive(Debug, Clone)]
pub struct KnownConflict {
    pub package_a: String,
    pub package_b: String,
    pub hint: String,
}

fn registry_path(project_root: &Path) -> std::path::PathBuf {
    project_root
        .join(".texisstudio")
        .join("package-registry.json")
}

fn source_rank(source: &EntrySource) -> u8 {
    match source {
        EntrySource::Detected => 0,
        EntrySource::Profile => 1,
        EntrySource::User => 2,
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_dir() -> TempDir {
        tempfile::tempdir().unwrap()
    }

    #[test]
    fn register_adds_package() {
        let mut reg = PackageRegistry::new();
        reg.register("graphicx", vec![], EntrySource::Detected);
        assert!(reg.packages.contains_key("graphicx"));
    }

    #[test]
    fn register_does_not_duplicate() {
        let mut reg = PackageRegistry::new();
        reg.register("amsmath", vec![], EntrySource::Detected);
        reg.register("amsmath", vec!["fleqn".to_string()], EntrySource::User);
        assert_eq!(reg.packages.len(), 1);
        let entry = reg.packages.get("amsmath").unwrap();
        assert_eq!(entry.source, EntrySource::User);
        assert_eq!(entry.options, vec!["fleqn"]);
    }

    #[test]
    fn analysis_removes_stale_detected_packages_but_keeps_user_packages() {
        let mut reg = PackageRegistry::new();
        reg.register("graphicx", vec![], EntrySource::Detected);
        reg.register("tikz", vec![], EntrySource::User);

        reg.update_from_analysis(&PackageAnalysis::default());

        assert!(!reg.packages.contains_key("graphicx"));
        assert!(reg.packages.contains_key("tikz"));
    }

    #[test]
    fn package_names_sorted() {
        let mut reg = PackageRegistry::new();
        reg.register("zzlast", vec![], EntrySource::Detected);
        reg.register("aafirst", vec![], EntrySource::Detected);
        reg.register("mmiddle", vec![], EntrySource::Detected);
        let names = reg.package_names();
        assert_eq!(names, vec!["aafirst", "mmiddle", "zzlast"]);
    }

    #[test]
    fn detect_conflicts_babel_polyglossia() {
        let mut reg = PackageRegistry::new();
        reg.register("babel", vec![], EntrySource::Detected);
        reg.register("polyglossia", vec![], EntrySource::Detected);
        let conflicts = reg.detect_conflicts();
        assert!(!conflicts.is_empty());
        assert_eq!(conflicts[0].package_a, "babel");
    }

    #[test]
    fn detect_conflicts_empty_when_no_conflict() {
        let mut reg = PackageRegistry::new();
        reg.register("graphicx", vec![], EntrySource::Detected);
        reg.register("amsmath", vec![], EntrySource::Detected);
        assert!(reg.detect_conflicts().is_empty());
    }

    #[test]
    fn save_and_load_roundtrip() {
        let dir = make_dir();
        let mut reg = PackageRegistry::new();
        reg.register("tikz", vec![], EntrySource::Detected);
        reg.register(
            "pgfplots",
            vec!["compat=1.18".to_string()],
            EntrySource::User,
        );
        reg.save(dir.path()).unwrap();

        let loaded = PackageRegistry::load(dir.path()).unwrap();
        assert_eq!(loaded.packages.len(), 2);
        assert!(loaded.packages.contains_key("tikz"));
        assert!(loaded.packages.contains_key("pgfplots"));
    }

    #[test]
    fn load_missing_returns_empty() {
        let dir = make_dir();
        let reg = PackageRegistry::load(dir.path()).unwrap();
        assert!(reg.packages.is_empty());
    }

    #[test]
    fn update_from_analysis_registers_packages() {
        use super::super::model::{PackageRequirement, RequirementReason};
        let mut reg = PackageRegistry::new();
        let analysis = PackageAnalysis {
            missing: vec![PackageRequirement {
                package_name: "hyperref".to_string(),
                options: vec![],
                reason: RequirementReason::CrossReference,
                priority: PackagePriority::Required,
                already_declared: false,
            }],
            declared: vec!["amsmath".to_string()],
            conflicts: vec![],
            requires_shell_escape: false,
        };
        reg.update_from_analysis(&analysis);
        assert!(reg.packages.contains_key("hyperref"));
        assert!(reg.packages.contains_key("amsmath"));
    }
}
