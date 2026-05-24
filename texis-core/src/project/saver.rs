// ÚNICO módulo en texis-core que escribe project YAML a disco.
#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::loader::ProjectLoader;
    use std::collections::HashMap;

    fn dummy_model(title: &str) -> ProjectModel {
        use crate::project::model::*;
        ProjectModel {
            id: "test-001".to_string(),
            schema_version: "1.0.0".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
            metadata: ProjectMetadata {
                title: title.to_string(),
                subtitle: None,
                document_kind: DocumentKind::Tesis,
                academic_level: AcademicLevel::Licenciatura,
                language: "es".to_string(),
                city: "Ciudad de México".to_string(),
                year: 2026,
                keywords: vec![],
            },
            institution: InstitutionData {
                name: "Universidad".to_string(),
                faculty: None,
                department: None,
                logo_path: None,
                country: "México".to_string(),
            },
            student: StudentData {
                full_name: "Autor".to_string(),
                student_id: None,
                email: None,
                advisor: None,
                co_advisor: None,
                advisors: vec![],
                co_authors: vec![],
            },
            profile_id: "generic.thesis".to_string(),
            latex_config: LatexConfig {
                document_class: DocumentClassConfig {
                    name: "book".to_string(),
                    options: vec![],
                },
                engine: LatexEngine::Xelatex,
                compiler: CompilerKind::Latexmk,
                bibliography_backend: BibliographyBackend::Biber,
                bibliography_style: "apa".to_string(),
                packages_required: vec![],
                typography: Default::default(),
            },
            sections: vec![],
            file_states: HashMap::new(),
        }
    }

    #[test]
    fn guardado_inicial_crea_archivo() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tesis.project.yaml");
        let saver = ProjectSaver;

        saver.save_to_file(&dummy_model("Primera versión"), &path).unwrap();

        assert!(path.exists(), "El archivo final debe existir");
        assert!(!path.with_extension("yaml.tmp").exists(), "No debe quedar .tmp");
        assert!(!path.with_extension("yaml.bak").exists(), "En primer guardado no hay .bak");
    }

    #[test]
    fn segundo_guardado_crea_bak_y_actualiza_yaml() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tesis.project.yaml");
        let saver = ProjectSaver;

        saver.save_to_file(&dummy_model("Primera versión"), &path).unwrap();
        saver.save_to_file(&dummy_model("Segunda versión"), &path).unwrap();

        assert!(path.exists(), "El archivo final debe existir");
        assert!(path.with_extension("yaml.bak").exists(), "Debe existir .bak tras segundo guardado");
        assert!(!path.with_extension("yaml.tmp").exists(), "No debe quedar .tmp");

        // El .yaml final debe tener el título de la segunda versión
        let loader = ProjectLoader;
        let model = loader.load_from_file(&path).unwrap();
        assert_eq!(model.metadata.title, "Segunda versión");

        // El .bak debe tener el título de la primera versión
        let bak = loader.load_from_file(&path.with_extension("yaml.bak")).unwrap();
        assert_eq!(bak.metadata.title, "Primera versión");
    }

    #[test]
    fn tercer_guardado_rota_bak() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tesis.project.yaml");
        let saver = ProjectSaver;

        saver.save_to_file(&dummy_model("v1"), &path).unwrap();
        saver.save_to_file(&dummy_model("v2"), &path).unwrap();
        saver.save_to_file(&dummy_model("v3"), &path).unwrap();

        let loader = ProjectLoader;
        let model = loader.load_from_file(&path).unwrap();
        assert_eq!(model.metadata.title, "v3");

        let bak = loader.load_from_file(&path.with_extension("yaml.bak")).unwrap();
        assert_eq!(bak.metadata.title, "v2");
    }
}

use super::model::ProjectModel;
use crate::error::{CoreError, CoreResult};
use std::path::Path;

pub struct ProjectSaver;

impl ProjectSaver {
    /// Guarda el modelo con escritura segura:
    ///   1. Serializa a string
    ///   2. Escribe en archivo `.tmp` al lado del destino
    ///   3. Si el destino ya existe, copia a `.bak`
    ///   4. Renombra `.tmp` → destino (atómico en la mayoría de SO)
    pub fn save_to_file(&self, model: &ProjectModel, path: &Path) -> CoreResult<()> {
        let content = serde_yaml::to_string(model).map_err(|e| CoreError::YamlParse {
            path: path.to_string_lossy().to_string(),
            message: e.to_string(),
        })?;

        let tmp_path = path.with_extension("yaml.tmp");
        let bak_path = path.with_extension("yaml.bak");

        // Paso 1: escribir contenido en archivo temporal
        std::fs::write(&tmp_path, &content).map_err(CoreError::Io)?;

        // Paso 2: mover el archivo actual a .bak (rename, no copy → no falla en Windows
        //         porque el destino .bak no existe o lo sobreescribe en Unix)
        if path.exists() {
            // En Windows rename sobre destino existente falla; eliminar .bak primero
            if bak_path.exists() {
                let _ = std::fs::remove_file(&bak_path);
            }
            std::fs::rename(path, &bak_path).map_err(CoreError::Io)?;
        }

        // Paso 3: mover temporal al destino final (el destino ya no existe)
        if let Err(e) = std::fs::rename(&tmp_path, path) {
            // Rollback: restaurar .bak al nombre original
            if bak_path.exists() {
                let _ = std::fs::rename(&bak_path, path);
            }
            let _ = std::fs::remove_file(&tmp_path);
            return Err(CoreError::Io(e));
        }

        Ok(())
    }
}
