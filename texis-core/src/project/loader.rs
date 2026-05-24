// ÚNICO módulo en texis-core que importa serde_yaml para proyectos.

use super::model::ProjectModel;
use crate::error::{CoreError, CoreResult};
use crate::schema::{migrator, versions};
use std::path::Path;

pub struct ProjectLoader;

impl ProjectLoader {
    pub fn load_from_file(&self, path: &Path) -> CoreResult<ProjectModel> {
        let content = std::fs::read_to_string(path).map_err(CoreError::Io)?;
        self.load_from_str(&content, &path.to_string_lossy())
    }

    pub fn load_from_str(&self, content: &str, source: &str) -> CoreResult<ProjectModel> {
        let mut model: ProjectModel = serde_yaml::from_str(content).map_err(|e| {
            CoreError::YamlParse {
                path: source.to_string(),
                message: e.to_string(),
            }
        })?;

        // Rechazar versiones completamente desconocidas.
        if !versions::is_acceptable(&model.schema_version) {
            return Err(CoreError::UnsupportedSchemaVersion {
                version: model.schema_version.clone(),
                current: versions::CURRENT_SCHEMA_VERSION.to_string(),
            });
        }

        // Migrar automáticamente versiones legacy (ej. 0.1.0 → 1.0.0).
        migrator::migrate(&mut model);

        Ok(model)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const YAML_1_0: &str = r#"
id: "abc-123"
schema_version: "1.0.0"
created_at: "2024-01-01T00:00:00Z"
updated_at: "2024-01-01T00:00:00Z"
metadata:
  title: "Tesis de prueba"
  document_kind: tesis
  academic_level: licenciatura
  language: es
  city: "CDMX"
  year: 2024
  keywords: []
institution:
  name: "UNAM"
  country: "México"
student:
  full_name: "Prueba"
profile_id: "generic.thesis"
latex_config:
  document_class:
    name: book
    options: []
  engine: xelatex
  compiler: latexmk
  bibliography_backend: biber
  bibliography_style: apa
  packages_required: []
sections: []
file_states: {}
"#;

    const YAML_0_1: &str = r#"
id: "old-001"
schema_version: "0.1.0"
created_at: "2023-06-01T00:00:00Z"
updated_at: "2023-06-01T00:00:00Z"
metadata:
  title: "Proyecto legacy"
  document_kind: tesis
  academic_level: maestria
  language: es
  city: "Guadalajara"
  year: 2023
  keywords: []
institution:
  name: "UDG"
  country: "México"
student:
  full_name: "Estudiante Legacy"
profile_id: "generic.thesis"
latex_config:
  document_class:
    name: book
    options: []
  engine: xelatex
  compiler: latexmk
  bibliography_backend: biber
  bibliography_style: apa
  packages_required: []
sections: []
file_states: {}
"#;

    #[test]
    fn carga_schema_1_0() {
        let loader = ProjectLoader;
        let model = loader.load_from_str(YAML_1_0, "test").unwrap();
        assert_eq!(model.schema_version, "1.0.0");
        assert_eq!(model.id, "abc-123");
    }

    #[test]
    fn migra_schema_0_1_automaticamente() {
        let loader = ProjectLoader;
        let model = loader.load_from_str(YAML_0_1, "test").unwrap();
        // Debe cargarse y quedar en 1.0.0 tras la migración automática.
        assert_eq!(model.schema_version, "1.0.0");
        assert_eq!(model.id, "old-001");
    }

    #[test]
    fn rechaza_version_futura() {
        let yaml = YAML_1_0.replace("\"1.0.0\"", "\"99.0.0\"");
        let loader = ProjectLoader;
        let result = loader.load_from_str(&yaml, "test");
        assert!(result.is_err());
    }
}
