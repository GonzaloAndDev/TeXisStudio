// Test E2E: pipeline completo crear→generar→validar→drift
//
// No requiere LaTeX instalado — verifica que los archivos generados sean
// estructuralmente correctos LaTeX (tienen las macros esperadas) y que
// el validator detecte problemas reales en proyectos rotos.

mod fixtures;

use std::collections::HashMap;
use std::fs;
use texis_core::project::model::*;
use texis_core::validator::Validator;
use texis_core::LaTeXGenerator;
use texis_core::{document::DocumentEngine, events::EventBus};

// ── Proyecto rico con todos los tipos de bloques ──────────────────────────────

fn rich_thesis_model() -> ProjectModel {
    let mut m = fixtures::generic_thesis_model();

    // Añadir contenido diverso a la sección de introducción
    let intro = m
        .sections
        .iter_mut()
        .find(|s| s.id == "introduction")
        .unwrap();

    // Párrafo con math verbatim
    intro.blocks.push(ContentBlock::Paragraph(ParagraphBlock {
        id: "p-math".to_string(),
        content: "La ecuación fundamental es $E = mc^2$.".to_string(),
        verbatim: true,
    }));

    // Ecuación numerada
    intro.blocks.push(ContentBlock::Equation(EquationBlock {
        id: "eq1".to_string(),
        latex_content: "\\Delta V = V_1 - V_0".to_string(),
        label: Some("eq:delta".to_string()),
        numbered: true,
    }));

    // Referencia a la ecuación en un párrafo
    intro.blocks.push(ContentBlock::Paragraph(ParagraphBlock {
        id: "p-eqref".to_string(),
        content: "Como muestra la ecuación \\eqref{eq:delta}, el volumen cambia.".to_string(),
        verbatim: true,
    }));

    // Tabla booktabs
    intro.blocks.push(ContentBlock::Table(TableBlock {
        id: "t1".to_string(),
        caption: "Resultados de muestreo".to_string(),
        source: None,
        label: "tab:resultados".to_string(),
        include_in_list: true,
        raw_headers: false,
        raw_cells: false,
        verbatim_caption: false,
        headers: vec![
            "Muestra".to_string(),
            "pH".to_string(),
            "Turbidez".to_string(),
        ],
        rows: vec![
            vec!["M-01".to_string(), "7.2".to_string(), "0.5 NTU".to_string()],
            vec!["M-02".to_string(), "7.8".to_string(), "1.2 NTU".to_string()],
        ],
        table_style: TableStyle::Booktabs,
    }));

    // Referencia a la tabla
    intro.blocks.push(ContentBlock::Paragraph(ParagraphBlock {
        id: "p-tabref".to_string(),
        content: "Los resultados se muestran en la Tabla~\\ref{tab:resultados}.".to_string(),
        verbatim: true,
    }));

    // Código
    intro.blocks.push(ContentBlock::Code(CodeBlock {
        id: "lst1".to_string(),
        language: "Python".to_string(),
        caption: Some("Procesamiento de datos".to_string()),
        label: Some("lst:proc".to_string()),
        content: "df = pd.read_csv('datos.csv')\nprint(df.describe())".to_string(),
        show_line_numbers: true,
    }));

    // VisualBlock: Venn
    intro.blocks.push(ContentBlock::Visual(VisualBlock {
        id: "venn1".to_string(),
        caption: "Intersección de conjuntos A y B".to_string(),
        label: "fig:venn".to_string(),
        include_in_list: true,
        advanced_latex_override: None,
        advanced_override_confirmed: false,
        config: VisualConfig::VennEuler(VennEulerConfig {
            sets: vec![
                VennSet {
                    label: "Aguas superficiales".to_string(),
                    color: "blue".to_string(),
                },
                VennSet {
                    label: "Aguas subterráneas".to_string(),
                    color: "green".to_string(),
                },
            ],
            intersections: [("01".to_string(), "Acuíferos".to_string())].into(),
            style: "circles".to_string(),
        }),
    }));

    // Sección de glosario
    m.sections.push(ProjectSection {
        id: "glosario".to_string(),
        element_id: "glossary_section".to_string(),
        title: Some("Glosario".to_string()),
        label: None,
        placement: SectionPlacement::BackMatter,
        required: false,
        enabled: true,
        status: Default::default(),
        notes: None,
        blocks: vec![
            ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                id: "turbidez".to_string(),
                term: "Turbidez".to_string(),
                definition: "Medida de la claridad de un líquido.".to_string(),
                verbatim: false,
            }),
            ContentBlock::AcronymEntry(AcronymEntryBlock {
                id: "ntu".to_string(),
                acronym: "NTU".to_string(),
                full_form: "Nephelometric Turbidity Unit".to_string(),
                description: Some("Unidad de medida de turbidez.".to_string()),
            }),
        ],
        fields: HashMap::new(),
        children: vec![],
    });

    m
}

// ── Test 1: Generación completa produce archivos esperados ────────────────────

#[test]
fn e2e_generacion_produce_archivos_principales() {
    let model = rich_thesis_model();
    let generator = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();

    generator.generate(&model, dir.path()).unwrap();

    // Archivos que siempre deben existir
    assert!(
        dir.path().join("main.tex").exists(),
        "main.tex debe existir"
    );
    assert!(
        dir.path().join("configuracion/paquetes.tex").exists(),
        "paquetes.tex debe existir"
    );
    assert!(
        dir.path().join("configuracion/estilo.tex").exists(),
        "estilo.tex debe existir"
    );
    assert!(
        dir.path().join("configuracion/datos_tesis.tex").exists(),
        "datos_tesis.tex debe existir"
    );

    // Capítulo de introducción
    assert!(
        dir.path().join("capitulos/01_introduction.tex").exists(),
        "capítulo de introducción debe existir"
    );
}

#[test]
fn e2e_main_tex_tiene_estructura_correcta() {
    let model = rich_thesis_model();
    let generator = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();
    generator.generate(&model, dir.path()).unwrap();

    let main = fs::read_to_string(dir.path().join("main.tex")).unwrap();

    assert!(main.contains("\\documentclass"), "debe tener documentclass");
    assert!(
        main.contains("\\input{configuracion/paquetes}"),
        "debe incluir paquetes"
    );
    assert!(
        main.contains("\\begin{document}"),
        "debe tener begin document"
    );
    assert!(main.contains("\\end{document}"), "debe tener end document");
    assert!(main.contains("\\frontmatter"), "debe tener frontmatter");
    assert!(main.contains("\\mainmatter"), "debe tener mainmatter");
    assert!(
        main.contains("\\printbibliography"),
        "debe imprimir bibliografía"
    );
}

#[test]
fn e2e_paquetes_incluye_glosario_cuando_hay_entradas() {
    let model = rich_thesis_model();
    let generator = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();
    generator.generate(&model, dir.path()).unwrap();

    let paquetes = fs::read_to_string(dir.path().join("configuracion/paquetes.tex")).unwrap();
    assert!(
        paquetes.contains("\\usepackage") && paquetes.contains("glossaries"),
        "debe cargar glossaries"
    );
    assert!(
        paquetes.contains("\\makeglossaries"),
        "debe incluir makeglossaries"
    );
}

#[test]
fn e2e_glossary_tex_tiene_entradas() {
    let model = rich_thesis_model();
    let generator = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();
    generator.generate(&model, dir.path()).unwrap();

    let glossary_path = dir.path().join("configuracion/glossary.tex");
    assert!(glossary_path.exists(), "glossary.tex debe existir");

    let content = fs::read_to_string(&glossary_path).unwrap();
    assert!(
        content.contains("\\newglossaryentry{turbidez}"),
        "debe tener la entrada turbidez"
    );
    // El acrónimo puede tener opciones adicionales [description=...] si tiene descripción
    assert!(
        content.contains("\\newacronym") && content.contains("{ntu}") && content.contains("{NTU}"),
        "debe tener el acrónimo NTU"
    );
}

#[test]
fn e2e_capitulo_intro_tiene_todos_los_bloques() {
    let model = rich_thesis_model();
    let generator = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();
    generator.generate(&model, dir.path()).unwrap();

    let intro = fs::read_to_string(dir.path().join("capitulos/01_introduction.tex")).unwrap();

    // Ecuación
    assert!(intro.contains("\\begin{equation}"), "debe tener ecuación");
    assert!(
        intro.contains("\\label{eq:delta}"),
        "debe tener label de ecuación"
    );

    // Tabla booktabs
    assert!(intro.contains("\\toprule"), "debe tener toprule");
    assert!(intro.contains("\\midrule"), "debe tener midrule");
    assert!(intro.contains("\\bottomrule"), "debe tener bottomrule");
    assert!(
        intro.contains("tab:resultados"),
        "debe tener label de tabla"
    );

    // Código
    assert!(
        intro.contains("\\begin{lstlisting}"),
        "debe tener lstlisting"
    );
    assert!(
        intro.contains("language=Python"),
        "debe tener lenguaje Python"
    );

    // VisualBlock Venn (TikZ)
    assert!(
        intro.contains("\\begin{figure}"),
        "visual block debe envolver en figure"
    );
    assert!(
        intro.contains("tikzpicture"),
        "venn debe generar tikzpicture"
    );
    assert!(
        intro.contains("\\caption{Intersecci"),
        "debe tener caption del venn"
    );
}

#[test]
fn e2e_paquetes_auto_detecta_tikz_por_visual_blocks() {
    let model = rich_thesis_model();
    let generator = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();
    generator.generate(&model, dir.path()).unwrap();

    let paquetes = fs::read_to_string(dir.path().join("configuracion/paquetes.tex")).unwrap();
    assert!(
        paquetes.contains("\\usepackage{tikz}"),
        "debe auto-detectar tikz del VennBlock"
    );
    assert!(
        paquetes.contains("\\usetikzlibrary"),
        "debe cargar tikz libraries"
    );
}

// ── Test 2: Validador detecta problemas reales ────────────────────────────────

#[test]
fn e2e_validator_acepta_proyecto_correcto() {
    let model = rich_thesis_model();
    let validator = Validator::new();
    let dir = tempfile::tempdir().unwrap();

    // Crear estructura de directorio con .bib
    std::fs::create_dir_all(dir.path().join("content/bibliography")).unwrap();
    std::fs::write(dir.path().join("content/bibliography/references.bib"), b"").unwrap();
    std::fs::create_dir_all(dir.path().join("content/figures")).unwrap();

    let report = validator.validate(&model, dir.path()).unwrap();

    // No debe haber errores (solo posibles warnings de figuras/tablas no citadas)
    let errors: Vec<_> = report
        .issues
        .iter()
        .filter(|i| matches!(i.severity, texis_core::validator::IssueSeverity::Error))
        .collect();

    // El proyecto rico tiene refs a todas las figuras/tablas, no debe haber errores críticos
    assert!(
        errors.is_empty(),
        "proyecto correcto no debe tener errores; encontrados: {:?}",
        errors.iter().map(|e| &e.code).collect::<Vec<_>>()
    );
}

#[test]
fn e2e_validator_detecta_bib_faltante() {
    let model = rich_thesis_model();
    let validator = Validator::new();
    let dir = tempfile::tempdir().unwrap();

    // No crear el .bib → error esperado
    std::fs::create_dir_all(dir.path().join("content/figures")).unwrap();

    let report = validator.validate(&model, dir.path()).unwrap();
    assert!(
        report.issues.iter().any(|i| i.code == "W_MISSING_BIB"),
        "debe detectar .bib faltante (W_MISSING_BIB)"
    );
}

// ── Test 3: DriftReport — ediciones manuales preservadas ─────────────────────

#[test]
fn e2e_drift_report_preserva_archivos_manuales() {
    use texis_core::project::model::FileState;

    let mut model = rich_thesis_model();
    model.file_states.insert(
        "capitulos/01_introduction.tex".to_string(),
        FileState::Manual,
    );

    let generator = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();

    // Escribir un archivo "editado" manualmente
    std::fs::create_dir_all(dir.path().join("capitulos")).unwrap();
    std::fs::create_dir_all(dir.path().join("configuracion")).unwrap();
    std::fs::write(
        dir.path().join("capitulos/01_introduction.tex"),
        b"% Edicion manual del usuario\n",
    )
    .unwrap();

    let report = generator
        .generate_respecting_manual_edits(&model, dir.path(), None, None)
        .unwrap();

    // El archivo manual debe estar en preserved_manual
    assert!(
        report
            .preserved_manual
            .contains(&"capitulos/01_introduction.tex".to_string()),
        "archivo manual debe estar en preserved_manual"
    );

    // El contenido manual debe estar intacto
    let content = fs::read_to_string(dir.path().join("capitulos/01_introduction.tex")).unwrap();
    assert!(
        content.contains("Edicion manual"),
        "contenido manual debe preservarse"
    );

    // main.tex debe haberse generado normalmente
    assert!(
        report.generated.contains(&"main.tex".to_string()),
        "main.tex debe aparecer en generated"
    );
}

#[test]
fn document_engine_adopts_legacy_project_without_overwriting_main_tex() {
    let dir = tempfile::tempdir().unwrap();
    let build_dir = dir.path().join("build");
    std::fs::create_dir_all(&build_dir).unwrap();
    std::fs::write(build_dir.join("main.tex"), "% manual legacy main").unwrap();

    let model = fixtures::generic_thesis_model();
    let mut engine = DocumentEngine::new().unwrap();
    let report = engine
        .sync_preserving_external_edits(&model, &build_dir, None, None, &EventBus::new())
        .unwrap();
    engine.save_checksums(dir.path()).unwrap();

    assert!(report.preserved_manual.contains(&"main.tex".to_string()));
    assert_eq!(
        std::fs::read_to_string(build_dir.join("main.tex")).unwrap(),
        "% manual legacy main"
    );

    let mut reloaded = DocumentEngine::load(dir.path()).unwrap();
    let second_report = reloaded
        .sync_preserving_external_edits(&model, &build_dir, None, None, &EventBus::new())
        .unwrap();
    assert!(second_report
        .preserved_manual
        .contains(&"main.tex".to_string()));
}

#[test]
fn document_engine_adopts_unmodified_generated_main_as_auto() {
    let dir = tempfile::tempdir().unwrap();
    let build_dir = dir.path().join("build");
    let model = fixtures::generic_thesis_model();
    LaTeXGenerator::new()
        .unwrap()
        .generate(&model, &build_dir)
        .unwrap();

    let mut engine = DocumentEngine::new().unwrap();
    let report = engine
        .sync_preserving_external_edits(&model, &build_dir, None, None, &EventBus::new())
        .unwrap();

    assert!(report.regenerated.contains(&"main.tex".to_string()));
    assert!(!report.preserved_manual.contains(&"main.tex".to_string()));
    assert!(engine.last_main_tex_checksum().is_some());
}

#[test]
fn e2e_drift_report_sin_manuales_genera_todo() {
    let model = rich_thesis_model();
    let generator = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();

    let report = generator
        .generate_respecting_manual_edits(&model, dir.path(), None, None)
        .unwrap();

    assert!(
        report.preserved_manual.is_empty(),
        "sin archivos manuales, preserved debe estar vacío"
    );
    assert!(
        !report.generated.is_empty(),
        "debe haber generado al menos un archivo"
    );
    assert!(
        report.generated.contains(&"main.tex".to_string()),
        "main.tex debe estar en generated"
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests de PluginFigureBlock — pipeline completo sin LaTeX instalado
// ══════════════════════════════════════════════════════════════════════════════

fn model_with_plugin_figure(packages: Vec<String>) -> ProjectModel {
    let mut m = fixtures::generic_thesis_model();
    let intro = m.sections.iter_mut().find(|s| s.id == "introduction").unwrap();

    intro.blocks.push(ContentBlock::PluginFigure(PluginFigureBlock {
        id: "pf-test-01".to_string(),
        figure_id: "fig_0042".to_string(),
        plugin_id: "bar-charts".to_string(),
        latex_block: concat!(
            "% texisstudio-figure-id: fig_0042\n",
            "\\begin{figure}[htbp]\n",
            "    \\centering\n",
            "    \\input{texisstudio-assets/figures/fig_0042/output.tex}\n",
            "    \\caption{Distribución de resultados.}\n",
            "    \\label{fig:bar-results}\n",
            "\\end{figure}\n",
            "% /texisstudio-figure-id",
        ).to_string(),
        caption: "Distribución de resultados.".to_string(),
        label: "fig:bar-results".to_string(),
        required_packages: packages,
        source_json: r#"{"engineId":"pgfplots-engine","version":"1.0.0"}"#.to_string(),
        warnings: vec![],
    }));
    m
}

#[test]
fn plugin_figure_latex_block_aparece_en_capitulo() {
    let model = model_with_plugin_figure(vec!["pgfplots".to_string(), "tikz".to_string()]);
    let gen = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();
    gen.generate(&model, dir.path()).unwrap();

    let chapter = fs::read_to_string(dir.path().join("capitulos/01_introduction.tex")).unwrap();

    assert!(
        chapter.contains("texisstudio-figure-id: fig_0042"),
        "el marcador de figura de plugin debe aparecer en el capítulo"
    );
    assert!(
        chapter.contains("\\input{texisstudio-assets/figures/fig_0042/output.tex}"),
        "el \\input del plugin debe aparecer en el capítulo"
    );
    assert!(
        chapter.contains("\\caption{Distribución de resultados.}"),
        "la caption del plugin debe aparecer en el capítulo"
    );
    assert!(
        chapter.contains("\\label{fig:bar-results}"),
        "la label del plugin debe aparecer en el capítulo"
    );
}

#[test]
fn plugin_figure_paquetes_aparecen_en_preamble() {
    let model = model_with_plugin_figure(vec!["pgfplots".to_string(), "tikz".to_string()]);
    let gen = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();
    gen.generate(&model, dir.path()).unwrap();

    // Los paquetes visuales se emiten en configuracion/paquetes.tex, no en main.tex
    let paquetes = fs::read_to_string(dir.path().join("configuracion/paquetes.tex")).unwrap();

    assert!(
        paquetes.contains("\\usepackage{pgfplots}"),
        "pgfplots debe inyectarse en paquetes.tex cuando lo requiere el plugin — contenido:\n{paquetes}"
    );
    assert!(
        paquetes.contains("\\usepackage{tikz}"),
        "tikz debe inyectarse en paquetes.tex cuando lo requiere el plugin"
    );
}

#[test]
fn plugin_figure_sin_paquetes_no_rompe_generacion() {
    let model = model_with_plugin_figure(vec![]);
    let gen = LaTeXGenerator::new().unwrap();
    let dir = tempfile::tempdir().unwrap();

    // No debe fallar aunque el plugin no declare paquetes
    gen.generate(&model, dir.path()).unwrap();

    let chapter = fs::read_to_string(dir.path().join("capitulos/01_introduction.tex")).unwrap();
    assert!(chapter.contains("fig_0042"), "el bloque debe aparecer aunque no haya paquetes");
}

#[test]
fn plugin_figure_serde_round_trip() {
    // Serializar → deserializar → comparar: garantiza que el YAML del proyecto
    // preserva el bloque correctamente entre saves y loads.
    let original = PluginFigureBlock {
        id: "rt-01".to_string(),
        figure_id: "fig_0099".to_string(),
        plugin_id: "scatter-regression".to_string(),
        latex_block: "\\begin{figure}[htbp]\\end{figure}".to_string(),
        caption: "Regresión lineal.".to_string(),
        label: "fig:regression".to_string(),
        required_packages: vec!["pgfplots".to_string()],
        source_json: r#"{"pluginId":"scatter-regression"}"#.to_string(),
        warnings: vec!["Some warning".to_string()],
    };

    let block = ContentBlock::PluginFigure(original.clone());

    // YAML round-trip (formato de persistencia del proyecto)
    let yaml = serde_yaml::to_string(&block).expect("serialización YAML debe funcionar");
    assert!(yaml.contains("plugin_figure"), "type tag debe ser plugin_figure");
    assert!(yaml.contains("fig_0099"), "figureId debe preservarse");

    let recovered: ContentBlock = serde_yaml::from_str(&yaml).expect("deserialización YAML debe funcionar");

    if let ContentBlock::PluginFigure(pf) = recovered {
        assert_eq!(pf.figure_id, original.figure_id);
        assert_eq!(pf.plugin_id, original.plugin_id);
        assert_eq!(pf.caption, original.caption);
        assert_eq!(pf.label, original.label);
        assert_eq!(pf.latex_block, original.latex_block);
        assert_eq!(pf.required_packages, original.required_packages);
        assert_eq!(pf.source_json, original.source_json);
        assert_eq!(pf.warnings, original.warnings);
    } else {
        panic!("el bloque recuperado debe ser PluginFigure");
    }
}

#[test]
fn plugin_figure_json_camel_case_round_trip() {
    // El frontend envía JSON con camelCase — verificar compatibilidad.
    let json = r#"{
        "type": "plugin_figure",
        "id": "pf-json-01",
        "figureId": "fig_1234",
        "pluginId": "kaplan-meier",
        "latexBlock": "% block content",
        "caption": "Curva de supervivencia.",
        "label": "fig:km",
        "requiredPackages": ["pgfplots","tikz"],
        "sourceJson": "{}",
        "warnings": []
    }"#;

    let block: ContentBlock = serde_json::from_str(json).expect("JSON camelCase debe deserializar");

    if let ContentBlock::PluginFigure(pf) = block {
        assert_eq!(pf.figure_id, "fig_1234");
        assert_eq!(pf.plugin_id, "kaplan-meier");
        assert_eq!(pf.required_packages, vec!["pgfplots", "tikz"]);
    } else {
        panic!("debe deserializar como PluginFigure");
    }
}
