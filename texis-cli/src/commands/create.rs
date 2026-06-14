use anyhow::{Context, Result};
use chrono::Utc;
use std::collections::HashMap;
use std::path::Path;
use texis_core::project::{model::*, saver::ProjectSaver};
use texis_core::{document::DocumentEngine, events::EventBus};

pub fn run(profile_id: &str, name: &str, output: &Path) -> Result<()> {
    let project_dir = output.join(name);

    if project_dir.exists() {
        anyhow::bail!("El directorio '{}' ya existe.", project_dir.display());
    }

    println!("Creando proyecto '{}' con perfil '{}'...", name, profile_id);

    // Crear estructura de directorios
    std::fs::create_dir_all(project_dir.join("content").join("sections"))
        .context("crear content/sections")?;
    std::fs::create_dir_all(project_dir.join("content").join("bibliography"))
        .context("crear content/bibliography")?;
    std::fs::create_dir_all(project_dir.join("content").join("figures"))
        .context("crear content/figures")?;

    // Crear modelo mínimo
    let model = create_minimal_model(profile_id, name);

    // Serializar a YAML vía ProjectSaver (serde_yaml solo en loaders/savers del core)
    let saver = ProjectSaver;
    saver
        .save_to_file(&model, &project_dir.join("tesis.project.yaml"))
        .context("escribir tesis.project.yaml")?;

    // Generar build/ con .gitignore y README
    let build_dir = project_dir.join("build");
    let mut document_engine = DocumentEngine::new().context("crear generador")?;
    document_engine
        .generate(&model, &build_dir, &EventBus::new())
        .context("generar estructura build/")?;
    document_engine
        .save_checksums(&project_dir)
        .context("guardar checksums del documento")?;

    println!("✓ Proyecto creado en: {}", project_dir.display());
    println!("✓ .gitignore generado");
    println!("✓ README-compilacion.txt generado");
    println!("\nPróximos pasos:");
    println!("  cd {}", name);
    println!("  texis compile . --backend latexmk");

    Ok(())
}

fn create_minimal_model(profile_id: &str, name: &str) -> ProjectModel {
    ProjectModel {
        id: format!("{}-001", name.replace(' ', "-").to_lowercase()),
        schema_version: "0.1.0".to_string(),
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
        metadata: ProjectMetadata {
            title: name.to_string(),
            subtitle: None,
            document_kind: DocumentKind::Tesis,
            academic_level: AcademicLevel::Licenciatura,
            language: "es".to_string(),
            city: "Ciudad de México".to_string(),
            year: Utc::now().format("%Y").to_string().parse().unwrap_or(2026),
            keywords: vec![],
            funding: None,
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
            committee: vec![],
            orcid: None,
        },
        profile_id: profile_id.to_string(),
        latex_config: LatexConfig {
            document_class: DocumentClassConfig {
                name: "book".to_string(),
                options: vec![
                    "12pt".to_string(),
                    "letterpaper".to_string(),
                    "oneside".to_string(),
                ],
            },
            engine: LatexEngine::Xelatex,
            compiler: CompilerKind::Latexmk,
            bibliography_backend: BibliographyBackend::Biber,
            bibliography_style: "apa".to_string(),
            packages_required: vec![],
            typography: LatexTypography::default(),
            page_layout: None,
            packages_with_options: vec![],
            preamble_config: Default::default(),
        },
        sections: vec![
            ProjectSection {
                id: "title_page".to_string(),
                element_id: "title_page".to_string(),
                title: None,
                placement: SectionPlacement::FrontMatter,
                required: true,
                enabled: true,
                label: None,
                status: SectionStatus::Draft,
                notes: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "table_of_contents".to_string(),
                element_id: "table_of_contents".to_string(),
                title: None,
                placement: SectionPlacement::FrontMatter,
                required: true,
                enabled: true,
                label: None,
                status: SectionStatus::Draft,
                notes: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "introduction".to_string(),
                element_id: "introduction".to_string(),
                title: Some("Introducción".to_string()),
                placement: SectionPlacement::Body,
                required: true,
                enabled: true,
                label: None,
                status: SectionStatus::Draft,
                notes: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "references".to_string(),
                element_id: "references".to_string(),
                title: Some("Referencias".to_string()),
                placement: SectionPlacement::BackMatter,
                required: true,
                enabled: true,
                label: None,
                status: SectionStatus::Draft,
                notes: None,
                blocks: vec![],
                fields: HashMap::new(),
                children: vec![],
            },
        ],
        file_states: HashMap::new(),
    }
}
