pub type PluginId = String;

/// Capacidades que un plugin puede declarar.
/// El host verifica estas capacidades antes de cargar el plugin.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum PluginCapability {
    /// Renderiza assets de los formatos declarados a PNG/PDF
    AssetRenderer { formats: Vec<String> },
    /// Proporciona exportación en los formatos declarados
    ExportProvider { formats: Vec<String> },
    /// Provee referencias bibliográficas adicionales
    BibliographyProvider,
    /// Proporciona un diccionario para los idiomas declarados
    DictionaryProvider { languages: Vec<String> },
    /// Proporciona diagnósticos adicionales
    DiagnosticProvider,
    /// Añade un paso al proceso de compilación
    BuildStepProvider { step_name: String },
    /// Proporciona plantillas adicionales
    TemplateProvider,
    /// Añade comandos a la Command Palette
    CommandProvider { commands: Vec<String> },
    /// Añade un panel a la UI
    UiPanelProvider { panel_id: String },
}

/// Dependencia de un plugin.
#[derive(Debug, Clone)]
pub struct PluginDependency {
    pub name: String,
    pub version_req: Option<String>,
    pub optional: bool,
}

/// Declaración de acceso a recursos externos.
#[derive(Debug, Clone, Default)]
pub struct PluginPermissions {
    pub requires_filesystem_access: bool,
    pub filesystem_paths: Vec<String>, // rutas específicas permitidas
    pub requires_network_access: bool,
    pub allowed_hosts: Vec<String>, // hosts permitidos
    pub requires_process_spawn: bool,
    pub allowed_processes: Vec<String>, // procesos permitidos
}

/// Trait principal que deben implementar todos los plugins.
/// Reglas de seguridad:
/// - Los plugins NO acceden al filesystem sin permiso del host.
/// - Los plugins NO modifican archivos sin pasar por CommandDispatcher.
/// - Los plugins NO ejecutan procesos sin declarar requires_process_spawn.
/// - Los plugins NO hacen peticiones HTTP sin declarar requires_network_access.
pub trait TexisPlugin: Send + Sync + 'static {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn version(&self) -> &str;
    fn description(&self) -> &str;
    fn capabilities(&self) -> Vec<PluginCapability>;
    fn dependencies(&self) -> Vec<PluginDependency> {
        Vec::new()
    }
    fn permissions(&self) -> PluginPermissions {
        PluginPermissions::default()
    }
    fn on_load(&self) -> Result<(), PluginError> {
        Ok(())
    }
    fn on_unload(&self) -> Result<(), PluginError> {
        Ok(())
    }
    fn is_enabled(&self) -> bool {
        true
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PluginError {
    #[error("Plugin '{plugin_id}': {message}")]
    LoadError { plugin_id: String, message: String },
    #[error("Plugin '{plugin_id}': dependencia faltante '{dep}'")]
    MissingDependency { plugin_id: String, dep: String },
    #[error("Plugin '{plugin_id}': permiso denegado — '{permission}'")]
    PermissionDenied {
        plugin_id: String,
        permission: String,
    },
    #[error("Plugin no encontrado: '{0}'")]
    NotFound(String),
    #[error("Plugin '{0}' ya está cargado")]
    AlreadyLoaded(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    struct NoopPlugin;
    impl TexisPlugin for NoopPlugin {
        fn id(&self) -> &str {
            "noop"
        }
        fn name(&self) -> &str {
            "Noop Plugin"
        }
        fn version(&self) -> &str {
            "1.0.0"
        }
        fn description(&self) -> &str {
            "No hace nada"
        }
        fn capabilities(&self) -> Vec<PluginCapability> {
            Vec::new()
        }
    }

    #[test]
    fn plugin_default_permissions_deny_all() {
        let p = NoopPlugin;
        let perms = p.permissions();
        assert!(!perms.requires_filesystem_access);
        assert!(!perms.requires_network_access);
        assert!(!perms.requires_process_spawn);
    }

    #[test]
    fn plugin_default_is_enabled() {
        let p = NoopPlugin;
        assert!(p.is_enabled());
    }

    #[test]
    fn plugin_on_load_succeeds_by_default() {
        let p = NoopPlugin;
        assert!(p.on_load().is_ok());
    }
}
