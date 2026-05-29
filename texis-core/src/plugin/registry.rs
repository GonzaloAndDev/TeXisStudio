use super::model::{PluginCapability, PluginError, PluginId, TexisPlugin};
use std::collections::HashMap;

pub struct PluginRegistry {
    plugins: HashMap<PluginId, Box<dyn TexisPlugin>>,
    disabled: std::collections::HashSet<PluginId>,
    /// Plugins agrupados por capacidad para búsqueda rápida
    by_capability: CapabilityIndex,
}

#[derive(Default)]
struct CapabilityIndex {
    asset_renderers: Vec<(Vec<String>, PluginId)>, // (formatos, plugin_id)
    export_providers: Vec<(Vec<String>, PluginId)>,
    bib_providers: Vec<PluginId>,
    dict_providers: Vec<(Vec<String>, PluginId)>,
    diagnostic_providers: Vec<PluginId>,
    build_step_providers: Vec<(String, PluginId)>,
    template_providers: Vec<PluginId>,
    command_providers: Vec<(Vec<String>, PluginId)>,
    ui_panel_providers: Vec<(String, PluginId)>,
}

impl Default for PluginRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl PluginRegistry {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
            disabled: std::collections::HashSet::new(),
            by_capability: CapabilityIndex::default(),
        }
    }

    /// Registra un plugin. Valida dependencias y permisos antes de cargarlo.
    pub fn register(&mut self, plugin: Box<dyn TexisPlugin>) -> Result<(), PluginError> {
        let id = plugin.id().to_string();

        if self.plugins.contains_key(&id) {
            return Err(PluginError::AlreadyLoaded(id));
        }

        // Verificar dependencias
        for dep in plugin.dependencies() {
            if !dep.optional && !self.plugins.contains_key(&dep.name) {
                return Err(PluginError::MissingDependency {
                    plugin_id: id,
                    dep: dep.name,
                });
            }
        }

        // Llamar on_load
        plugin.on_load().map_err(|e| PluginError::LoadError {
            plugin_id: id.clone(),
            message: e.to_string(),
        })?;

        // Indexar capacidades
        for cap in plugin.capabilities() {
            match cap {
                PluginCapability::AssetRenderer { formats } => {
                    self.by_capability
                        .asset_renderers
                        .push((formats, id.clone()));
                }
                PluginCapability::ExportProvider { formats } => {
                    self.by_capability
                        .export_providers
                        .push((formats, id.clone()));
                }
                PluginCapability::BibliographyProvider => {
                    self.by_capability.bib_providers.push(id.clone());
                }
                PluginCapability::DictionaryProvider { languages } => {
                    self.by_capability
                        .dict_providers
                        .push((languages, id.clone()));
                }
                PluginCapability::DiagnosticProvider => {
                    self.by_capability.diagnostic_providers.push(id.clone());
                }
                PluginCapability::BuildStepProvider { step_name } => {
                    self.by_capability
                        .build_step_providers
                        .push((step_name, id.clone()));
                }
                PluginCapability::TemplateProvider => {
                    self.by_capability.template_providers.push(id.clone());
                }
                PluginCapability::CommandProvider { commands } => {
                    self.by_capability
                        .command_providers
                        .push((commands, id.clone()));
                }
                PluginCapability::UiPanelProvider { panel_id } => {
                    self.by_capability
                        .ui_panel_providers
                        .push((panel_id, id.clone()));
                }
            }
        }

        self.plugins.insert(id, plugin);
        Ok(())
    }

    /// Desactiva un plugin sin descargarlo (para reactivar sin reiniciar).
    pub fn disable(&mut self, id: &str) -> Result<(), PluginError> {
        if !self.plugins.contains_key(id) {
            return Err(PluginError::NotFound(id.to_string()));
        }
        self.disabled.insert(id.to_string());
        Ok(())
    }

    pub fn enable(&mut self, id: &str) -> Result<(), PluginError> {
        if !self.plugins.contains_key(id) {
            return Err(PluginError::NotFound(id.to_string()));
        }
        self.disabled.remove(id);
        Ok(())
    }

    /// Descarga un plugin llamando on_unload.
    pub fn unregister(&mut self, id: &str) -> Result<(), PluginError> {
        let plugin = self
            .plugins
            .remove(id)
            .ok_or_else(|| PluginError::NotFound(id.to_string()))?;
        self.disabled.remove(id);
        plugin.on_unload().map_err(|e| PluginError::LoadError {
            plugin_id: id.to_string(),
            message: e.to_string(),
        })?;
        // Limpiar índices
        self.by_capability
            .asset_renderers
            .retain(|(_, pid)| pid != id);
        self.by_capability
            .export_providers
            .retain(|(_, pid)| pid != id);
        self.by_capability.bib_providers.retain(|pid| pid != id);
        self.by_capability
            .dict_providers
            .retain(|(_, pid)| pid != id);
        self.by_capability
            .diagnostic_providers
            .retain(|pid| pid != id);
        self.by_capability
            .build_step_providers
            .retain(|(_, pid)| pid != id);
        self.by_capability
            .template_providers
            .retain(|pid| pid != id);
        self.by_capability
            .command_providers
            .retain(|(_, pid)| pid != id);
        self.by_capability
            .ui_panel_providers
            .retain(|(_, pid)| pid != id);
        Ok(())
    }

    pub fn get(&self, id: &str) -> Option<&dyn TexisPlugin> {
        self.plugins.get(id).map(|p| p.as_ref())
    }

    pub fn is_active(&self, id: &str) -> bool {
        self.plugins.contains_key(id) && !self.disabled.contains(id)
    }

    pub fn all_active(&self) -> impl Iterator<Item = &dyn TexisPlugin> {
        self.plugins
            .iter()
            .filter(|(id, _)| !self.disabled.contains(id.as_str()))
            .map(|(_, p)| p.as_ref())
    }

    /// Plugins que pueden renderizar un formato de asset específico.
    pub fn renderers_for(&self, format: &str) -> Vec<&str> {
        self.by_capability
            .asset_renderers
            .iter()
            .filter(|(fmts, pid)| {
                fmts.iter().any(|f| f.eq_ignore_ascii_case(format)) && self.is_active(pid)
            })
            .map(|(_, pid)| pid.as_str())
            .collect()
    }

    /// Plugins que pueden exportar a un formato específico.
    pub fn exporters_for(&self, format: &str) -> Vec<&str> {
        self.by_capability
            .export_providers
            .iter()
            .filter(|(fmts, pid)| {
                fmts.iter().any(|f| f.eq_ignore_ascii_case(format)) && self.is_active(pid)
            })
            .map(|(_, pid)| pid.as_str())
            .collect()
    }

    /// Plugins de diagnóstico activos.
    pub fn diagnostic_providers(&self) -> Vec<&str> {
        self.by_capability
            .diagnostic_providers
            .iter()
            .filter(|pid| self.is_active(pid))
            .map(|pid| pid.as_str())
            .collect()
    }

    pub fn total_registered(&self) -> usize {
        self.plugins.len()
    }
    pub fn total_active(&self) -> usize {
        self.plugins.len() - self.disabled.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin::model::{PluginCapability, PluginPermissions, TexisPlugin};

    struct FakePlugin {
        id: String,
        formats: Vec<String>,
    }
    impl TexisPlugin for FakePlugin {
        fn id(&self) -> &str {
            &self.id
        }
        fn name(&self) -> &str {
            "Fake"
        }
        fn version(&self) -> &str {
            "1.0"
        }
        fn description(&self) -> &str {
            ""
        }
        fn capabilities(&self) -> Vec<PluginCapability> {
            vec![PluginCapability::AssetRenderer {
                formats: self.formats.clone(),
            }]
        }
    }

    #[test]
    fn register_and_retrieve() {
        let mut reg = PluginRegistry::new();
        reg.register(Box::new(FakePlugin {
            id: "svg_renderer".to_string(),
            formats: vec!["svg".to_string()],
        }))
        .unwrap();
        assert!(reg.get("svg_renderer").is_some());
        assert_eq!(reg.total_registered(), 1);
    }

    #[test]
    fn reject_duplicate_registration() {
        let mut reg = PluginRegistry::new();
        reg.register(Box::new(FakePlugin {
            id: "p1".to_string(),
            formats: vec![],
        }))
        .unwrap();
        let err = reg
            .register(Box::new(FakePlugin {
                id: "p1".to_string(),
                formats: vec![],
            }))
            .unwrap_err();
        assert!(matches!(err, PluginError::AlreadyLoaded(_)));
    }

    #[test]
    fn disable_and_enable() {
        let mut reg = PluginRegistry::new();
        reg.register(Box::new(FakePlugin {
            id: "p1".to_string(),
            formats: vec!["svg".to_string()],
        }))
        .unwrap();
        reg.disable("p1").unwrap();
        assert!(!reg.is_active("p1"));
        assert_eq!(reg.renderers_for("svg").len(), 0);
        reg.enable("p1").unwrap();
        assert!(reg.is_active("p1"));
        assert_eq!(reg.renderers_for("svg").len(), 1);
    }

    #[test]
    fn unregister_cleans_capability_index() {
        let mut reg = PluginRegistry::new();
        reg.register(Box::new(FakePlugin {
            id: "svg".to_string(),
            formats: vec!["svg".to_string()],
        }))
        .unwrap();
        reg.unregister("svg").unwrap();
        assert_eq!(reg.renderers_for("svg").len(), 0);
        assert_eq!(reg.total_registered(), 0);
    }

    #[test]
    fn renderers_for_format_case_insensitive() {
        let mut reg = PluginRegistry::new();
        reg.register(Box::new(FakePlugin {
            id: "r".to_string(),
            formats: vec!["SVG".to_string()],
        }))
        .unwrap();
        assert_eq!(reg.renderers_for("svg").len(), 1);
        assert_eq!(reg.renderers_for("SVG").len(), 1);
    }
}
