// Fixtures para tests de integración.
// Nota: no se nombra ninguna variable 'gen' (reservado en edition 2024).
#![allow(dead_code)]

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
            funding: None,
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
            committee: vec![],
            orcid: None,
        },
        profile_id: "generic.thesis".to_string(),
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
            typography: Default::default(),
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
                blocks: vec![ContentBlock::Paragraph(ParagraphBlock {
                    id: "p1".to_string(),
                    content:
                        "Este trabajo presenta un análisis del 100% de las fuentes de agua en A&B."
                            .to_string(),
                    verbatim: false,
                })],
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

// ── Fixture de QA de entrega (~8-10 páginas, todos los bloques clave) ────────

fn qa_para(id: &str, content: &str) -> ContentBlock {
    ContentBlock::Paragraph(ParagraphBlock {
        id: id.to_string(),
        content: content.to_string(),
        verbatim: false,
    })
}

fn qa_front(id: &str, element_id: &str, title: Option<&str>, blocks: Vec<ContentBlock>) -> ProjectSection {
    ProjectSection {
        id: id.to_string(),
        element_id: element_id.to_string(),
        title: title.map(|s| s.to_string()),
        placement: SectionPlacement::FrontMatter,
        required: true,
        enabled: true,
        label: None,
        blocks,
        status: SectionStatus::Revised,
        notes: None,
        fields: HashMap::new(),
        children: vec![],
    }
}

fn qa_body(id: &str, element_id: &str, title: &str, blocks: Vec<ContentBlock>) -> ProjectSection {
    ProjectSection {
        id: id.to_string(),
        element_id: element_id.to_string(),
        title: Some(title.to_string()),
        placement: SectionPlacement::Body,
        required: true,
        enabled: true,
        label: None,
        blocks,
        status: SectionStatus::Revised,
        notes: None,
        fields: HashMap::new(),
        children: vec![],
    }
}

/// Bibliografía de referencia para el fixture de QA. Las tres claves se citan en
/// el cuerpo, de modo que no quedan referencias sin usar.
pub fn qa_delivery_bib() -> &'static str {
    r#"@book{goodfellow2016,
  title = {Deep Learning}, author = {Goodfellow, Ian and Bengio, Yoshua and Courville, Aaron},
  year = {2016}, publisher = {MIT Press}
}
@article{lecun2015,
  title = {Deep learning}, author = {LeCun, Yann and Bengio, Yoshua and Hinton, Geoffrey},
  journal = {Nature}, volume = {521}, pages = {436--444}, year = {2015},
  doi = {10.1038/nature14539}
}
@inproceedings{vaswani2017,
  title = {Attention is All You Need}, author = {Vaswani, Ashish and others},
  booktitle = {NeurIPS}, year = {2017}
}
"#
}

/// Modelo de tesis **rico** para QA de entrega: portada con subtítulo, resumen,
/// índices, cuatro capítulos con párrafos sustanciales, lista, ecuación, tabla
/// booktabs, código y citas a las tres entradas de [`qa_delivery_bib`]. Sin
/// metadatos placeholder, de modo que pasa la compuerta de calidad en `final`.
pub fn qa_delivery_model() -> ProjectModel {
    let mut m = generic_thesis_model();
    m.metadata.title = "Redes neuronales convolucionales para el diagnóstico por imagen".to_string();
    m.metadata.subtitle = Some("Un estudio comparativo en histopatología".to_string());
    m.metadata.academic_level = AcademicLevel::Maestria;
    m.metadata.keywords = vec!["aprendizaje profundo".into(), "diagnóstico".into()];
    m.institution.department = Some("Departamento de Computación".to_string());

    let intro = qa_body(
        "introduction",
        "introduction",
        "Introducción",
        vec![
            qa_para("i1", "Las redes neuronales convolucionales han transformado el análisis de imágenes médicas en la última década, alcanzando un desempeño comparable al de especialistas clínicos en múltiples dominios. Su adopción real, sin embargo, exige reproducibilidad y validación rigurosa."),
            ContentBlock::Heading(HeadingBlock { id: "ih".into(), level: HeadingLevel::Section, content: "Motivación".into() }),
            qa_para("i2", "El diagnóstico tardío de enfermedades como el cáncer impacta directamente en la supervivencia del paciente. Un sistema de apoyo basado en aprendizaje profundo puede operar como segunda opinión y priorizar casos urgentes en flujos hospitalarios saturados."),
            ContentBlock::List(ListBlock { id: "il".into(), list_type: ListType::Enumerate, items: vec![
                "Construir un protocolo de entrenamiento reproducible.".into(),
                "Comparar arquitecturas representativas con validación cruzada.".into(),
                "Cuantificar el costo de cómputo frente a la exactitud.".into(),
            ]}),
            ContentBlock::Citation(CitationBlock { id: "ic".into(), citation_key: "lecun2015".into(), citation_type: CitationType::Narrative, page: None, prefix: None, suffix: None }),
        ],
    );

    let marco = qa_body(
        "marco_teorico",
        "theoretical_framework",
        "Marco teórico",
        vec![
            qa_para("m1", "Una red convolucional aprende una jerarquía de representaciones aplicando filtros entrenables sobre la imagen de entrada. El entrenamiento minimiza una función de pérdida mediante descenso de gradiente estocástico, ajustando los pesos para reducir el error de clasificación a lo largo de muchas épocas."),
            qa_para("m2", "La pérdida de entropía cruzada categórica usada en este trabajo se define en la siguiente expresión, donde N es el número de muestras y la suma interior recorre las clases del problema."),
            ContentBlock::Equation(EquationBlock { id: "me".into(), latex_content: "\\mathcal{L} = -\\frac{1}{N}\\sum_{i=1}^{N}\\sum_{c=1}^{C} y_{i,c}\\log(\\hat{y}_{i,c})".into(), label: Some("eq:loss".into()), numbered: true }),
            ContentBlock::Citation(CitationBlock { id: "mc".into(), citation_key: "vaswani2017".into(), citation_type: CitationType::Parenthetical, page: None, prefix: None, suffix: None }),
        ],
    );

    let metodo = qa_body(
        "metodologia",
        "methodology",
        "Metodología",
        vec![
            qa_para("e1", "Se utilizó un conjunto de diez mil imágenes histológicas etiquetadas por patólogos certificados, divididas en entrenamiento, validación y prueba. El preprocesamiento incluyó normalización de color y aumento de datos."),
            ContentBlock::Table(TableBlock {
                id: "et".into(), caption: "Distribución del conjunto de datos.".into(), source: None,
                label: "tab:dataset".into(), include_in_list: true, raw_headers: false, raw_cells: false,
                verbatim_caption: false,
                headers: vec!["Partición".into(), "Imágenes".into(), "Proporción".into()],
                rows: vec![
                    vec!["Entrenamiento".into(), "7000".into(), "70 por ciento".into()],
                    vec!["Validación".into(), "1500".into(), "15 por ciento".into()],
                    vec!["Prueba".into(), "1500".into(), "15 por ciento".into()],
                ],
                table_style: TableStyle::Booktabs,
            }),
            qa_para("e2", "El entrenamiento se ejecutó durante cien épocas con detención temprana. El siguiente fragmento resume el ciclo principal de optimización empleado en los experimentos."),
            ContentBlock::Code(CodeBlock { id: "ec".into(), language: "Python".into(), caption: Some("Ciclo de entrenamiento.".into()), label: Some("lst:train".into()), content: "for epoch in range(EPOCHS):\n    for x, y in loader:\n        opt.zero_grad()\n        loss = crit(model(x), y)\n        loss.backward()\n        opt.step()".into(), show_line_numbers: true }),
            ContentBlock::Citation(CitationBlock { id: "ecit".into(), citation_key: "goodfellow2016".into(), citation_type: CitationType::Narrative, page: None, prefix: None, suffix: None }),
        ],
    );

    let result = qa_body(
        "resultados",
        "results",
        "Resultados",
        vec![
            qa_para("r1", "El modelo alcanzó una precisión de validación cercana al noventa por ciento tras cinco épocas de ajuste fino, con una curva de aprendizaje estable y sin signos de sobreajuste severo en el conjunto de prueba reservado."),
            ContentBlock::Table(TableBlock {
                id: "rt".into(), caption: "Desempeño comparativo de las arquitecturas.".into(), source: None,
                label: "tab:results".into(), include_in_list: true, raw_headers: false, raw_cells: false,
                verbatim_caption: false,
                headers: vec!["Modelo".into(), "Precisión".into(), "F1".into()],
                rows: vec![
                    vec!["ResNet-50".into(), "0.90".into(), "0.89".into()],
                    vec!["VGG-16".into(), "0.86".into(), "0.85".into()],
                ],
                table_style: TableStyle::Booktabs,
            }),
        ],
    );

    let concl = qa_body(
        "conclusiones",
        "conclusions",
        "Conclusiones",
        vec![
            qa_para("c1", "Los resultados confirman que las redes convolucionales constituyen una herramienta viable para el diagnóstico asistido por imagen, alcanzando niveles de exactitud clínicamente relevantes con un protocolo reproducible y auditable."),
            qa_para("c2", "Como trabajo futuro se plantea la validación prospectiva en entornos hospitalarios reales y el estudio de la interpretabilidad de las predicciones del modelo."),
        ],
    );

    // Reconstruir el árbol: portada, resumen, índices, capítulos, referencias.
    let references = m.sections.pop().expect("references"); // último es references
    m.sections = vec![
        qa_front("title_page", "title_page", None, vec![]),
        qa_front("resumen", "abstract", Some("Resumen"), vec![qa_para(
            "ab1",
            "Esta tesis evalúa el uso de redes neuronales convolucionales para clasificar imágenes histológicas con una precisión comparable a la de especialistas clínicos, describiendo el diseño experimental, el conjunto de datos y las métricas de validación.",
        )]),
        qa_front("table_of_contents", "table_of_contents", None, vec![]),
        qa_front("list_of_figures", "list_of_figures", None, vec![]),
        qa_front("list_of_tables", "list_of_tables", None, vec![]),
        intro,
        marco,
        metodo,
        result,
        concl,
        references,
    ];
    m
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
    let intro = model
        .sections
        .iter_mut()
        .find(|s| s.id == "introduction")
        .unwrap();
    intro.blocks.push(ContentBlock::Figure(FigureBlock {
        id: "fig1".to_string(),
        file: "missing_image.png".to_string(),
        caption: "Diagrama del sistema".to_string(),
        source: None,
        width: FigureWidth::Full,
        label: "fig:diagrama".to_string(),
        include_in_list: true,
        verbatim_caption: false,
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
    let intro = model
        .sections
        .iter_mut()
        .find(|s| s.id == "introduction")
        .unwrap();

    intro.blocks.push(ContentBlock::Figure(FigureBlock {
        id: "fig1".to_string(),
        file: "img1.png".to_string(),
        caption: "Figura 1".to_string(),
        source: None,
        width: FigureWidth::Full,
        label: "fig:duplicado".to_string(),
        include_in_list: true,
        verbatim_caption: false,
    }));
    intro.blocks.push(ContentBlock::Figure(FigureBlock {
        id: "fig2".to_string(),
        file: "img2.png".to_string(),
        caption: "Figura 2".to_string(),
        source: None,
        width: FigureWidth::Full,
        label: "fig:duplicado".to_string(), // mismo label
        include_in_list: true,
        verbatim_caption: false,
    }));

    (model, dir)
}
