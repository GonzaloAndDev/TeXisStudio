// Migradores de schema para TeXisStudio.
//
// POLÍTICA:
// - 0.x → 0.x: sin migradores (schemas inestables durante desarrollo).
// - 0.1.0 → 1.0.0: migración automática al cargar proyectos legacy.
// - 1.x → 2.x (futuro): requerirá migrador explícito + confirmación del usuario.

use crate::project::model::ProjectModel;
use crate::schema::versions;

/// Migra un ProjectModel a la versión actual del schema si es necesario.
///
/// Actualmente soporta:
/// - 0.1.0 → 1.0.0: cambio de versión únicamente (el modelo es compatible).
///
/// Devuelve `true` si se realizó alguna migración, `false` si ya estaba actualizado.
pub fn migrate(model: &mut ProjectModel) -> bool {
    match model.schema_version.as_str() {
        "0.1.0" => {
            migrate_0_1_to_1_0(model);
            true
        }
        _ => false,
    }
}

/// Migración 0.1.0 → 1.0.0.
///
/// El modelo estructural no cambió entre 0.1.0 y 1.0.0 — el schema fue
/// inestable durante el desarrollo pero los campos son compatibles.
/// La migración únicamente actualiza el campo `schema_version`.
fn migrate_0_1_to_1_0(model: &mut ProjectModel) {
    model.schema_version = versions::CURRENT_SCHEMA_VERSION.to_string();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::*;
    use std::collections::HashMap;

    fn stub_model(version: &str) -> ProjectModel {
        ProjectModel {
            id: "test-id".to_string(),
            schema_version: version.to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
            metadata: ProjectMetadata {
                title: "Tesis de prueba".to_string(),
                subtitle: None,
                document_kind: DocumentKind::Tesis,
                academic_level: AcademicLevel::Licenciatura,
                language: "es".to_string(),
                city: "Ciudad de México".to_string(),
                year: 2024,
                keywords: vec![],
                funding: None,
            },
            institution: InstitutionData {
                name: "UNAM".to_string(),
                faculty: None,
                department: None,
                logo_path: None,
                country: "México".to_string(),
            },
            student: StudentData {
                full_name: "Estudiante Prueba".to_string(),
                student_id: None,
                email: None,
                advisor: None,
                advisors: vec![],
                co_authors: vec![],
                co_advisor: None,
                committee: vec![],
                orcid: None,
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
    fn migra_0_1_a_1_0() {
        let mut model = stub_model("0.1.0");
        let migrado = migrate(&mut model);
        assert!(migrado);
        assert_eq!(model.schema_version, "1.0.0");
    }

    #[test]
    fn no_migra_si_ya_es_actual() {
        let mut model = stub_model("1.0.0");
        let migrado = migrate(&mut model);
        assert!(!migrado);
        assert_eq!(model.schema_version, "1.0.0");
    }

    #[test]
    fn version_desconocida_no_migra() {
        let mut model = stub_model("99.0.0");
        let migrado = migrate(&mut model);
        assert!(!migrado);
        assert_eq!(model.schema_version, "99.0.0");
    }
}
