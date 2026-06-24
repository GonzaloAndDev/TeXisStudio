//! Fixture de referencia: una tesis legacy representativa para pruebas y CI
//! (§17.1). Cubre portada con comité, cuerpo con varios tipos de bloque, un
//! anexo y configuración bibliográfica.

use std::collections::HashMap;
use texis_core::project::model::*;

/// Variante de estrés de portada (§ Etapa C): título muy largo, muchos asesores
/// y comité amplio, para ejercitar la política de desbordamiento.
pub fn stress_cover_thesis() -> ProjectModel {
    let mut m = sample_thesis();
    m.metadata.title = "Un título deliberadamente extenso para verificar el \
        comportamiento de la portada ante desbordamiento tipográfico, con \
        cláusulas subordinadas, dos puntos: y una enumeración de conceptos que \
        no cabe cómodamente en una sola línea ni en dos"
        .to_string();
    m.student.advisors = (1..=4).map(|i| format!("Dr. Asesor Número {i}")).collect();
    m.student.committee = (1..=7)
        .map(|i| CommitteeMember {
            full_name: format!("Dra. Sinodal {i}"),
            role: Some(format!("Vocal {i}")),
            institution: None,
        })
        .collect();
    m
}

/// Fixture mínimo y **autocompilable**: sin assets externos (no figuras con
/// archivos en disco), estilo bibliográfico integrado de biblatex (numeric) y
/// fuentes TeX Gyre. Pensado para el gate de compilación real de la Etapa J.
pub fn compilable_thesis() -> ProjectModel {
    let mut m = sample_thesis();
    m.institution.logo_path = None;
    m.latex_config.bibliography_style = "numeric".to_string();
    // Sin fuentes personalizadas: usa la fuente por defecto del motor (evita
    // dependencias de fuentes del sistema en el gate de compilación).
    m.latex_config.preamble_config.main_font = None;
    m.latex_config.preamble_config.sans_font = None;
    m.latex_config.preamble_config.mono_font = None;
    // Cuerpo sin figuras/tablas (evita includegraphics de archivos inexistentes).
    m.sections = vec![ProjectSection {
        id: "sec-intro".into(),
        element_id: "introduccion".into(),
        title: Some("Introducción".into()),
        placement: SectionPlacement::Body,
        required: true,
        enabled: true,
        label: Some("cap:intro".into()),
        status: SectionStatus::Draft,
        notes: None,
        blocks: vec![
            ContentBlock::Paragraph(ParagraphBlock {
                id: "p1".into(),
                content: "Texto de prueba para compilación real.".into(),
                verbatim: false,
            }),
            ContentBlock::Equation(EquationBlock {
                id: "eq1".into(),
                latex_content: "E = mc^2".into(),
                label: Some("eq:emc2".into()),
                numbered: true,
            }),
            ContentBlock::Citation(CitationBlock {
                id: "cit1".into(),
                citation_key: "turing1936".into(),
                citation_type: CitationType::Parenthetical,
                page: None,
                prefix: None,
                suffix: None,
            }),
        ],
        fields: HashMap::new(),
        children: vec![],
    }];
    m
}

/// Construye un `ProjectModel` legacy representativo (no toca disco).
pub fn sample_thesis() -> ProjectModel {
    ProjectModel {
        id: "demo-thesis-001".to_string(),
        schema_version: "1.0.0".to_string(),
        created_at: "2026-01-01T00:00:00Z".to_string(),
        updated_at: "2026-06-23T00:00:00Z".to_string(),
        metadata: ProjectMetadata {
            title: "Métodos formales para la verificación de sistemas concurrentes"
                .to_string(),
            subtitle: Some("Un enfoque modular".to_string()),
            document_kind: DocumentKind::TesisPosgrado,
            academic_level: AcademicLevel::Doctorado,
            language: "es".to_string(),
            city: "Ciudad de México".to_string(),
            year: 2026,
            keywords: vec!["verificación".into(), "concurrencia".into()],
            funding: Some("CONAHCYT beca 123456".to_string()),
        },
        institution: InstitutionData {
            name: "Universidad Nacional".to_string(),
            faculty: Some("Facultad de Ciencias".to_string()),
            department: Some("Departamento de Computación".to_string()),
            logo_path: Some("assets/logo.png".into()),
            country: "México".to_string(),
        },
        student: StudentData {
            full_name: "Ada Lovelace".to_string(),
            student_id: Some("3000001".to_string()),
            email: Some("ada@uni.mx".to_string()),
            advisor: None,
            advisors: vec!["Dr. Alan Turing".into(), "Dra. Grace Hopper".into()],
            co_authors: vec![],
            co_advisor: None,
            committee: vec![
                CommitteeMember {
                    full_name: "Dr. Edsger Dijkstra".into(),
                    role: Some("Presidente".into()),
                    institution: Some("Universidad Nacional".into()),
                },
                CommitteeMember {
                    full_name: "Dra. Barbara Liskov".into(),
                    role: Some("Secretaria".into()),
                    institution: None,
                },
            ],
            orcid: Some("0000-0002-1825-0097".to_string()),
        },
        profile_id: "generic-thesis".to_string(),
        latex_config: LatexConfig {
            document_class: DocumentClassConfig {
                name: "book".to_string(),
                options: vec!["12pt".into(), "oneside".into()],
            },
            engine: LatexEngine::Xelatex,
            compiler: CompilerKind::Latexmk,
            bibliography_backend: BibliographyBackend::Biber,
            bibliography_style: "apa7".to_string(),
            packages_required: vec!["amsmath".into(), "graphicx".into()],
            packages_with_options: vec![PackageConfig {
                name: "babel".into(),
                options: vec!["spanish".into()],
            }],
            typography: LatexTypography {
                font_size: Some("12pt".into()),
                paper_size: Some("a4paper".into()),
                line_spacing: Some("onehalf".into()),
                margin_cm: Some(2.5),
            },
            page_layout: Some(PageLayout {
                paper: Some("a4paper".into()),
                margins: Some(PageMargins {
                    top: Some("2.5cm".into()),
                    bottom: Some("2.5cm".into()),
                    left: Some("38.1mm".into()),
                    right: Some("2.5cm".into()),
                }),
                line_spacing: Some(1.5),
            }),
            preamble_config: PreambleConfig {
                main_font: Some("TeX Gyre Termes".into()),
                ..Default::default()
            },
        },
        sections: vec![
            ProjectSection {
                id: "sec-abstract".into(),
                element_id: "resumen".into(),
                title: Some("Resumen".into()),
                placement: SectionPlacement::FrontMatter,
                required: true,
                enabled: true,
                label: None,
                status: SectionStatus::Approved,
                notes: None,
                blocks: vec![ContentBlock::Paragraph(ParagraphBlock {
                    id: "p-abs".into(),
                    content: "Esta tesis estudia la verificación de sistemas concurrentes.".into(),
                    verbatim: false,
                })],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "sec-ack".into(),
                element_id: "agradecimientos".into(),
                title: Some("Agradecimientos".into()),
                placement: SectionPlacement::FrontMatter,
                required: false,
                enabled: true,
                label: None,
                status: SectionStatus::Approved,
                notes: None,
                blocks: vec![ContentBlock::Paragraph(ParagraphBlock {
                    id: "p-ack".into(),
                    content: "A mi familia.".into(),
                    verbatim: false,
                })],
                fields: HashMap::new(),
                children: vec![],
            },
            ProjectSection {
                id: "sec-intro".into(),
                element_id: "introduccion".into(),
                title: Some("Introducción".into()),
                placement: SectionPlacement::Body,
                required: true,
                enabled: true,
                label: Some("cap:intro".into()),
                status: SectionStatus::Draft,
                notes: None,
                blocks: vec![
                    ContentBlock::Paragraph(ParagraphBlock {
                        id: "p1".into(),
                        content: "Los sistemas concurrentes son difíciles.".into(),
                        verbatim: false,
                    }),
                    ContentBlock::Equation(EquationBlock {
                        id: "eq1".into(),
                        latex_content: "E = mc^2".into(),
                        label: Some("eq:emc2".into()),
                        numbered: true,
                    }),
                    ContentBlock::Figure(FigureBlock {
                        id: "fig1".into(),
                        file: "assets/diagram.png".into(),
                        caption: "Arquitectura del sistema.".into(),
                        source: Some("Elaboración propia".into()),
                        width: FigureWidth::Full,
                        label: "fig:arch".into(),
                        include_in_list: true,
                        verbatim_caption: false,
                    }),
                    ContentBlock::Table(TableBlock {
                        id: "tab1".into(),
                        caption: "Resultados.".into(),
                        source: None,
                        label: "tab:res".into(),
                        include_in_list: true,
                        raw_headers: false,
                        raw_cells: false,
                        verbatim_caption: false,
                        headers: vec!["Caso".into(), "Tiempo".into()],
                        rows: vec![vec!["A".into(), "1.2s".into()]],
                        table_style: TableStyle::Booktabs,
                    }),
                    ContentBlock::Citation(CitationBlock {
                        id: "cit1".into(),
                        citation_key: "turing1936".into(),
                        citation_type: CitationType::Parenthetical,
                        page: Some("12".into()),
                        prefix: None,
                        suffix: None,
                    }),
                ],
                fields: HashMap::new(),
                children: vec![ProjectSection {
                    id: "sec-intro-bg".into(),
                    element_id: "subseccion".into(),
                    title: Some("Antecedentes".into()),
                    placement: SectionPlacement::Body,
                    required: false,
                    enabled: true,
                    label: None,
                    status: SectionStatus::Draft,
                    notes: None,
                    blocks: vec![ContentBlock::Paragraph(ParagraphBlock {
                        id: "p2".into(),
                        content: "Trabajo previo.".into(),
                        verbatim: false,
                    })],
                    fields: HashMap::new(),
                    children: vec![],
                }],
            },
            ProjectSection {
                id: "sec-appendix-a".into(),
                element_id: "anexo".into(),
                title: Some("Código fuente".into()),
                placement: SectionPlacement::Appendix,
                required: false,
                enabled: true,
                label: Some("anx:code".into()),
                status: SectionStatus::Draft,
                notes: None,
                blocks: vec![ContentBlock::Code(CodeBlock {
                    id: "code1".into(),
                    language: "Rust".into(),
                    caption: Some("Función principal.".into()),
                    label: Some("lst:main".into()),
                    content: "fn main() {}".into(),
                    show_line_numbers: true,
                })],
                fields: HashMap::new(),
                children: vec![],
            },
        ],
        file_states: HashMap::new(),
    }
}
