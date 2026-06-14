// PackageEngine — analiza dependencias LaTeX del proyecto, mantiene el registry
// persistible y detecta conflictos, integrándose con el EventBus.

use super::detector::PackageDetector;
use super::model::PackageAnalysis;
use super::registry::{EntrySource, PackageRegistry};
use crate::error::CoreResult;
use crate::events::{EventBus, ProjectEvent};
use std::collections::HashSet;
use std::path::Path;

pub struct PackageEngine {
    detector: PackageDetector,
    pub registry: PackageRegistry,
}

impl PackageEngine {
    pub fn new() -> Self {
        Self {
            detector: PackageDetector::new(),
            registry: PackageRegistry::new(),
        }
    }

    /// Crea un PackageEngine cargando el registry persistido del proyecto.
    pub fn load(project_root: &Path) -> CoreResult<Self> {
        Ok(Self {
            detector: PackageDetector::new(),
            registry: PackageRegistry::load(project_root)?,
        })
    }

    /// Analiza el proyecto completo: lee todos los .tex y el preamble.
    /// Actualiza el registry interno y emite `PackageAdded` por cada paquete nuevo.
    pub fn analyze_project(
        &mut self,
        project_root: &Path,
        event_bus: &EventBus,
    ) -> CoreResult<PackageAnalysis> {
        let preamble = read_preamble(project_root);
        let tex_sources = collect_tex_sources(project_root)?;
        let tex_refs: Vec<&str> = tex_sources.iter().map(|s| s.as_str()).collect();

        let analysis = self.detector.analyze(&tex_refs, &preamble);

        let before: HashSet<String> = self.registry.packages.keys().cloned().collect();
        self.registry.update_from_analysis(&analysis);

        for name in self.registry.package_names() {
            if before.contains(name) {
                continue;
            }
            event_bus.emit(&ProjectEvent::PackageAdded {
                name: name.to_string(),
                reason: "detected".to_string(),
            });
        }

        Ok(analysis)
    }

    /// Registra un paquete explícitamente (por el usuario) y emite el evento.
    pub fn require_package(&mut self, name: &str, options: Vec<String>, event_bus: &EventBus) {
        self.registry.register(name, options, EntrySource::User);
        event_bus.emit(&ProjectEvent::PackageAdded {
            name: name.to_string(),
            reason: "user_required".to_string(),
        });
    }

    /// Registra paquetes requeridos por el perfil activo.
    pub fn apply_profile_packages(&mut self, packages: &[String], event_bus: &EventBus) {
        for pkg in packages {
            let was_absent = !self.registry.packages.contains_key(pkg.as_str());
            self.registry.register(pkg, vec![], EntrySource::Profile);
            if was_absent {
                event_bus.emit(&ProjectEvent::PackageAdded {
                    name: pkg.clone(),
                    reason: "profile".to_string(),
                });
            }
        }
    }

    /// Detecta conflictos en el registry actual.
    pub fn detect_conflicts(&self) -> Vec<super::registry::KnownConflict> {
        self.registry.detect_conflicts()
    }

    /// Emite `PackageConflictDetected` para cada conflicto encontrado.
    pub fn emit_conflict_events(&self, event_bus: &EventBus) {
        for conflict in self.registry.detect_conflicts() {
            event_bus.emit(&ProjectEvent::PackageConflictDetected {
                package_a: conflict.package_a.clone(),
                package_b: conflict.package_b.clone(),
            });
        }
    }

    /// Persiste el registry en disco.
    pub fn save(&self, project_root: &Path) -> CoreResult<()> {
        self.registry.save(project_root)
    }
}

impl Default for PackageEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn read_preamble(project_root: &Path) -> String {
    let preamble_path = project_root.join("preamble.tex");
    std::fs::read_to_string(&preamble_path).unwrap_or_default()
}

fn collect_tex_sources(root: &Path) -> CoreResult<Vec<String>> {
    let mut sources = Vec::new();
    collect_recursive(root, &mut sources);
    Ok(sources)
}

fn collect_recursive(dir: &Path, out: &mut Vec<String>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.') || name == "build" || name == "target" {
                continue;
            }
            collect_recursive(&path, out);
        } else if path.extension().and_then(|e| e.to_str()) == Some("tex") {
            if let Ok(content) = std::fs::read_to_string(&path) {
                out.push(content);
            }
        }
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::EventBus;
    use std::sync::{Arc, Mutex};
    use tempfile::TempDir;

    fn make_dir() -> TempDir {
        tempfile::tempdir().unwrap()
    }

    fn event_counter(bus: &mut EventBus) -> Arc<Mutex<usize>> {
        let count = Arc::new(Mutex::new(0usize));
        let c = count.clone();
        bus.subscribe(move |_| {
            *c.lock().unwrap() += 1;
        });
        count
    }

    #[test]
    fn new_engine_is_empty() {
        let engine = PackageEngine::new();
        assert!(engine.registry.packages.is_empty());
    }

    #[test]
    fn require_package_adds_to_registry() {
        let mut engine = PackageEngine::new();
        let mut bus = EventBus::new();
        engine.require_package("tikz", vec![], &mut bus);
        assert!(engine.registry.packages.contains_key("tikz"));
    }

    #[test]
    fn require_package_emits_event() {
        let mut engine = PackageEngine::new();
        let mut bus = EventBus::new();
        let count = event_counter(&mut bus);
        engine.require_package("pgfplots", vec![], &bus);
        assert_eq!(*count.lock().unwrap(), 1);
    }

    #[test]
    fn apply_profile_packages_registers_entries() {
        let mut engine = PackageEngine::new();
        let bus = EventBus::new();
        engine.apply_profile_packages(&["biblatex".to_string(), "xcolor".to_string()], &bus);
        assert!(engine.registry.packages.contains_key("biblatex"));
        assert!(engine.registry.packages.contains_key("xcolor"));
    }

    #[test]
    fn detect_conflicts_found_when_conflicting_packages() {
        let mut engine = PackageEngine::new();
        let bus = EventBus::new();
        engine.require_package("babel", vec![], &bus);
        engine.require_package("polyglossia", vec![], &bus);
        let conflicts = engine.detect_conflicts();
        assert!(!conflicts.is_empty());
    }

    #[test]
    fn save_and_load_persists_registry() {
        let dir = make_dir();
        let bus = EventBus::new();

        let mut engine = PackageEngine::new();
        engine.require_package("amsmath", vec![], &bus);
        engine.require_package("hyperref", vec![], &bus);
        engine.save(dir.path()).unwrap();

        let loaded = PackageEngine::load(dir.path()).unwrap();
        assert!(loaded.registry.packages.contains_key("amsmath"));
        assert!(loaded.registry.packages.contains_key("hyperref"));
    }

    #[test]
    fn analyze_project_detects_packages_in_tex_files() {
        let dir = make_dir();
        // Crear archivo .tex con contenido relevante
        std::fs::create_dir_all(dir.path().join("content/sections")).unwrap();
        std::fs::write(
            dir.path().join("content/sections/intro.tex"),
            r"\includegraphics{fig.png}\n\toprule",
        )
        .unwrap();

        let mut engine = PackageEngine::new();
        let bus = EventBus::new();
        let analysis = engine.analyze_project(dir.path(), &bus).unwrap();

        // El detector debe encontrar graphicx y booktabs
        let missing_names: Vec<&str> = analysis
            .missing
            .iter()
            .map(|r| r.package_name.as_str())
            .collect();
        assert!(missing_names.contains(&"graphicx") || missing_names.contains(&"booktabs"));
    }

    #[test]
    fn analyze_project_emits_event_for_the_actual_added_package() {
        let dir = make_dir();
        std::fs::write(dir.path().join("content.tex"), r"\includegraphics{fig.png}").unwrap();

        let mut engine = PackageEngine::new();
        engine.require_package("amsmath", vec![], &EventBus::new());
        let mut bus = EventBus::new();
        let names = Arc::new(Mutex::new(Vec::new()));
        let captured = names.clone();
        bus.subscribe(move |event| {
            if let ProjectEvent::PackageAdded { name, .. } = event {
                captured.lock().unwrap().push(name.clone());
            }
        });

        engine.analyze_project(dir.path(), &bus).unwrap();

        assert_eq!(*names.lock().unwrap(), vec!["graphicx"]);
    }
}
