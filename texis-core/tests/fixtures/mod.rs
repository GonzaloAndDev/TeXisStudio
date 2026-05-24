// Fixtures para tests de integración.
// Nota: no se nombra ninguna variable 'gen' (reservado en edition 2024).

use std::collections::HashMap;
use tempfile::TempDir;
use texis_core::project::model::*;

/// Modelo mínimo pero completo de una tesis genérica.
/// Contiene frontmatter, body y backmatter para snapshot tests.
pub fn generic_thesis_model() -> ProjectModel {
    ProjectModel {
        id: "test-thesis-001".to_string(),
        schema_version: "0.1.0".to_string(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-01-01T00:00:00Z".to_string(),
        metadata: ProjectMetadata {
            title: "Análisis de la Calidad del Agua".to_string(),
            subtitle: None,
            document_kind: DocumentKind::Tesis,
            academic_level: AcademicLevel::Licenciatura,
            language: "es".to_string(),
            city: "Ciudad de México".to_string(),
            year: 2026,
            keywords: vec!["agua".to_string(), "calidad".to_string()],
        },
        institution: InstitutionData {
            name: "Universidad Nacional Autónoma de México".to_string(),
            faculty: Some("Facultad de Ingeniería".to_string()),
            department: None,
            logo_path: None,
            country: "México".to_string(),
        },
        student: StudentData {
            full_name: "Juan Pérez García".to_string(),
            student_id: Some("123456789".to_string()),
            email: None,
            advisor: None,
            co_advisor: None,
            advisors: vec!["Dr. María López".to_string()],
            co_authors: vec![],
        },
        profile_id: "generic.thesis".to_string(),
        latex_config: LatexConfig {
            document_class: DocumentClassConfig {
                name: "book".to_string(),
                options: vec!["12pt".to_string(), "letterpaper".to_string(), "oneside".to_string()],
            },
            engine: LatexEngine::Xelatex,
            compiler: CompilerKind::Latexmk,
            bibliography_backend: BibliographyBackend::Biber,
            bibliography_style: "apa".to_string(),
            packages_required: vec![],
            typography: Default::default(),
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
                blocks: vec![],
                status: Default::default(),
                notes: None,
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
                blocks: vec![],
                status: Default::default(),
                notes: None,
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
                label: Some("sec:introduccion".to_string()),
                blocks: vec![
                    ContentBlock::Paragraph(ParagraphBlock {
                        id: "p1".to_string(),
                        content: "Este trabajo presenta un análisis del 100% de las fuentes de agua en A&B.".to_string(),
                    }),
                ],
                status: Default::default(),
                notes: None,
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
                blocks: vec![],
                status: Default::default(),
                notes: None,
                fields: HashMap::new(),
                children: vec![],
            },
        ],
        file_states: HashMap::new(),
    }
}

/// Modelo con una figura que referencia un archivo que no existe.
/// Retorna el modelo y un TempDir (directorio de proyecto sin content/figures/).
pub fn broken_missing_image() -> (ProjectModel, TempDir) {
    let dir = tempfile::tempdir().expect("tempdir");

    // Crear estructura mínima pero SIN el archivo de imagen
    std::fs::create_dir_all(dir.path().join("content").join("bibliography")).unwrap();
    // content/figures/ no se crea → imagen missing

    let mut model = generic_thesis_model();

    // Agregar un bloque figura con imagen inexistente a la sección de introducción
    let intro = model.sections.iter_mut().find(|s| s.id == "introduction").unwrap();
    intro.blocks.push(ContentBlock::Figure(FigureBlock {
        id: "fig1".to_string(),
        file: "missing_image.png".to_string(),
        caption: "Diagrama del sistema".to_string(),
        source: None,
        width: FigureWidth::Full,
        label: "fig:diagrama".to_string(),
        include_in_list: true,
    }));

    (model, dir)
}

/// Modelo con un .bib referenciado pero el archivo no existe.
pub fn broken_missing_bib() -> (ProjectModel, TempDir) {
    let dir = tempfile::tempdir().expect("tempdir");
    std::fs::create_dir_all(dir.path().join("content").join("figures")).unwrap();
    // content/bibliography/ no se crea → .bib missing

    let model = generic_thesis_model();
    (model, dir)
}

/// Modelo con labels duplicados.
pub fn broken_duplicate_label() -> (ProjectModel, TempDir) {
    let dir = tempfile::tempdir().expect("tempdir");

    let mut model = generic_thesis_model();
    let intro = model.sections.iter_mut().find(|s| s.id == "introduction").unwrap();

    intro.blocks.push(ContentBlock::Figure(FigureBlock {
        id: "fig1".to_string(),
        file: "img1.png".to_string(),
        caption: "Figura 1".to_string(),
        source: None,
        width: FigureWidth::Full,
        label: "fig:duplicado".to_string(),
        include_in_list: true,
    }));
    intro.blocks.push(ContentBlock::Figure(FigureBlock {
        id: "fig2".to_string(),
        file: "img2.png".to_string(),
        caption: "Figura 2".to_string(),
        source: None,
        width: FigureWidth::Full,
        label: "fig:duplicado".to_string(), // mismo label
        include_in_list: true,
    }));

    (model, dir)
}
