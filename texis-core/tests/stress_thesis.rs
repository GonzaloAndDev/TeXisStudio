// Prueba de estrés y calidad: genera una tesis académica completa de ~30 páginas
// con todos los tipos de bloques y plugins disponibles, luego la compila.
//
// Ejecutar generación + verificación estructural:
//   cargo test --test stress_thesis
//
// Ejecutar compilación real (requiere LaTeX):
//   cargo test --test stress_thesis -- --include-ignored
//
// El directorio de salida /tmp/texis-stress/ se conserva para inspección manual.

mod fixtures;

use std::{collections::HashMap, fs, path::Path};
use texis_core::project::model::*;
use texis_core::LaTeXGenerator;

// ── Contenido académico ──────────────────────────────────────────────────────

const P_INTRO_1: &str =
    "El acceso al agua potable es uno de los desafíos más críticos del siglo XXI. \
    Según la Organización Mundial de la Salud, aproximadamente 2.2 mil millones de personas \
    carecen de acceso a servicios de agua potable gestionados de manera segura. \
    La contaminación por metales pesados, microorganismos patógenos y compuestos orgánicos \
    persistentes representa una amenaza directa para la salud pública en regiones en desarrollo. \
    Los métodos convencionales de potabilización, como la cloración y la filtración en arena, \
    presentan limitaciones significativas en cuanto a la remoción de contaminantes emergentes \
    y la generación de subproductos de desinfección potencialmente carcinogénicos.";

const P_INTRO_2: &str =
    "En este contexto, los nanomateriales han emergido como una alternativa prometedora \
    para el tratamiento avanzado de agua. El óxido de grafeno (GO) y el óxido de grafeno \
    reducido (rGO) presentan propiedades fisicoquímicas extraordinarias: una superficie \
    específica de hasta 2630 m$^2$/g, grupos funcionales oxigenados que facilitan la \
    interacción con contaminantes polares, y la posibilidad de funcionalización con \
    nanopartículas metálicas para aplicaciones fotocatalíticas. La adsorción de arsénico, \
    plomo y colorantes industriales sobre membranas de GO ha demostrado eficiencias \
    superiores al 95\\% bajo condiciones controladas de pH y temperatura, superando \
    ampliamente los límites establecidos por la normativa NOM-127-SSA1-2021.";

const P_INTRO_3: &str =
    "El presente trabajo tiene como objetivo central el diseño, síntesis y caracterización \
    de membranas nanocompuestas de óxido de grafeno funcionalizadas con nanopartículas de \
    dióxido de titanio (TiO₂) para la purificación simultánea de contaminantes inorgánicos \
    y orgánicos en agua de consumo humano. Se plantea una metodología que integra síntesis \
    química controlada, caracterización espectroscópica por FTIR y XRD, y evaluación \
    cinética de adsorción bajo el marco de los modelos de Langmuir, Freundlich y \
    Dubinin-Radushkevich. Los resultados contribuyen al diseño de sistemas de filtración \
    escalables para comunidades rurales con recursos energéticos limitados.";

const P_TEORIA_1: &str =
    "El óxido de grafeno es un derivado oxidado del grafeno obtenido mediante el método \
    Hummers modificado, en el que la grafita es oxidada con permanganato de potasio en \
    presencia de ácido sulfúrico concentrado. La estructura resultante consiste en una \
    lámina monoatómica de carbono $sp^2$ hibridizado, decorada con grupos funcionales \
    epóxido, hidroxilo, carbonilo y carboxilo en la superficie basal y los bordes. \
    Estos grupos confieren al GO una naturaleza anfifílica que facilita su dispersión en \
    medios acuosos y su interacción con contaminantes tanto polares como apolares mediante \
    mecanismos de adsorción $\\pi$--$\\pi$, intercambio iónico y complejos de esfera interna.";

const P_TEORIA_2: &str =
    "El modelo de isoterma de adsorción de Langmuir asume una adsorción monocapa \
    sobre una superficie homogénea con sitios de energía equivalente y sin interacción \
    entre moléculas adsorbidas. Este modelo ha sido ampliamente aplicado para describir \
    la adsorción de metales pesados sobre nanomateriales carbonáceos. La capacidad máxima \
    de adsorción $q_m$ y la constante de afinidad $K_L$ se obtienen mediante \
    linealización de la ecuación de Langmuir, graficando $C_e/q_e$ versus $C_e$. \
    Para sistemas con heterogeneidad superficial, el modelo de Freundlich proporciona \
    una descripción empírica más adecuada, caracterizada por los parámetros $K_F$ y $1/n$, \
    donde $n > 1$ indica adsorción favorable y la intensidad de adsorción.";

const P_METODO_1: &str =
    "La síntesis de óxido de grafeno se realizó mediante el método Hummers modificado. \
    Se dispersaron 2~g de grafito natural (99.5\\% de pureza, Sigma-Aldrich) en 46~mL \
    de ácido sulfúrico concentrado (H$_2$SO$_4$ 98\\%) en un baño de hielo a 0$^{\\circ}$C. \
    Se adicionaron lentamente 6~g de permanganato de potasio (KMnO$_4$) manteniendo la \
    temperatura por debajo de 5$^{\\circ}$C para evitar la formación de dióxido de manganeso. \
    La mezcla se agitó durante 2 horas a 35$^{\\circ}$C, seguido de la adición controlada de \
    140~mL de agua destilada y 10~mL de peróxido de hidrógeno (H$_2$O$_2$ 30\\%) para \
    detener la reacción de oxidación. El producto fue lavado con HCl 1M y agua \
    desionizada hasta pH neutro y liofilizado a $-50^{\\circ}$C por 48 horas.";

const P_RESULTADOS_1: &str =
    "Los espectros FTIR del GO sintetizado confirmaron la presencia de los grupos \
    funcionales característicos: banda ancha de estiramiento O--H a 3200--3400~cm$^{-1}$, \
    estiramiento C=O de grupos carboxilo a 1725~cm$^{-1}$, deformación C--OH a 1390~cm$^{-1}$, \
    y estiramiento C--O--C de grupos epóxido a 1050~cm$^{-1}$. La banda correspondiente \
    a la vibración de la red de carbono $sp^2$ apareció a 1620~cm$^{-1}$, confirmando \
    la retención parcial de la estructura grafítica. Los difractogramas XRD mostraron \
    el desplazamiento del pico (002) de grafito de 26.4$^{\\circ}$ a 10.8$^{\\circ}$ 2$\\theta$ para GO, \
    lo que indica una expansión del espaciado interlaminar de 0.34~nm a 0.82~nm \
    debido a la introducción de grupos oxigenados entre las capas.";

const P_RESULTADOS_2: &str =
    "Los experimentos de adsorción en lote para la remoción de iones plomo (Pb$^{2+}$) \
    se realizaron a pH 5.0 $\\pm$ 0.1, temperatura de 25 $\\pm$ 1$^{\\circ}$C y concentración inicial \
    en el rango de 10 a 200~mg/L. Se alcanzó el equilibrio a los 60 minutos de contacto. \
    La capacidad máxima de adsorción determinada por el modelo de Langmuir fue \
    $q_m = 246.9$~mg/g, significativamente superior a la reportada para carbón activado \
    comercial ($q_m = 35.7$~mg/g) y óxido de hierro nanoparticulado ($q_m = 119.3$~mg/g). \
    Los valores de la constante de separación $R_L$ estuvieron en el rango 0.003--0.098, \
    indicando adsorción favorable en todo el rango de concentraciones estudiado.";

const P_CONCLUSIONES: &str =
    "La presente investigación demostró que las membranas nanocompuestas GO-TiO$_2$ \
    sintetizadas mediante el método Hummers modificado presentan capacidades de adsorción \
    y fotodegradación superiores a los materiales de referencia reportados en la literatura. \
    La eficiencia de remoción de Pb$^{2+}$ superó el 98.5\\% en concentraciones iniciales \
    de hasta 100~mg/L, cumpliendo ampliamente con los límites de la NOM-127-SSA1-2021 \
    (0.01~mg/L). La cinética de adsorción siguió un modelo de pseudo-segundo orden, \
    con energías de activación consistentes con quimisorción como mecanismo dominante. \
    La integración de TiO$_2$ nanoparticulado en la membrana demostró actividad \
    fotocatalítica bajo irradiación UV, con constantes de degradación de colorantes \
    azo superiores a $k = 0.045$~min$^{-1}$, abriendo la posibilidad de sistemas de \
    tratamiento de agua duales que combinan adsorción y fotocatálisis.";

// ── Constructor del modelo de tesis ─────────────────────────────────────────

fn build_stress_model() -> ProjectModel {
    let mut m = fixtures::generic_thesis_model();

    // ── Metadata enriquecida ─────────────────────────────────────────────────
    m.metadata.title = "Membranas Nanocompuestas de Óxido de Grafeno-TiO₂ para la \
                        Purificación de Agua: Síntesis, Caracterización Cinética \
                        y Evaluación de Desempeño"
        .to_string();
    m.metadata.subtitle =
        Some("Análisis comparativo frente a materiales adsorbentes de referencia".to_string());
    m.metadata.document_kind = DocumentKind::Tesis;
    m.metadata.academic_level = AcademicLevel::Maestria;
    m.metadata.keywords = vec![
        "óxido de grafeno".to_string(),
        "nanomateriales".to_string(),
        "purificación de agua".to_string(),
        "adsorción".to_string(),
        "fotocatálisis".to_string(),
        "dióxido de titanio".to_string(),
    ];
    m.student.full_name = "Valentina Reyes Morales".to_string();
    m.student.student_id = Some("2024-PNPC-042".to_string());
    m.student.advisors = vec!["Dra. Carmen Ávila Pérez".to_string()];
    m.student.co_authors = vec![CoAuthor {
        full_name: "Dr. Javier Montes Calderón".to_string(),
        student_id: None,
    }];
    m.institution.name = "Instituto Politécnico Nacional".to_string();
    m.institution.faculty = Some(
        "Centro Interdisciplinario de Investigaciones y \
                                   Estudios sobre Medio Ambiente y Desarrollo"
            .to_string(),
    );

    // ── Sections: completar el FrontMatter ──────────────────────────────────
    // (title_page y table_of_contents ya están en fixtures::generic_thesis_model)

    m.sections.insert(
        2,
        ProjectSection {
            id: "abstract_es".to_string(),
            element_id: "abstract".to_string(),
            title: Some("Resumen".to_string()),
            label: None,
            placement: SectionPlacement::FrontMatter,
            required: true,
            enabled: true,
            status: Default::default(),
            notes: None,
            fields: HashMap::new(),
            children: vec![],
            blocks: vec![ContentBlock::Paragraph(ParagraphBlock {
                id: "abs-es-01".to_string(),
                content: "Se sintetizaron membranas nanocompuestas de óxido de grafeno \
                           funcionalizado con TiO₂ (GO-TiO₂) mediante el método Hummers \
                           modificado para la remoción simultánea de metales pesados y \
                           contaminantes orgánicos de agua de consumo humano. \
                           La capacidad máxima de adsorción de Pb²⁺ fue de 246.9 mg/g \
                           (modelo de Langmuir, R² = 0.998). La eficiencia de \
                           fotodegradación del colorante azul de metileno bajo irradiación \
                           UV (365 nm, 30 min) alcanzó el 97.3\\%. Los materiales se \
                           caracterizaron por FTIR, XRD, SEM-EDX y BET. Los resultados \
                           demuestran el potencial de GO-TiO₂ como material multifuncional \
                           para sistemas compactos de tratamiento de agua en comunidades \
                           rurales. \\textbf{Palabras clave:} óxido de grafeno, \
                           fotocatálisis, adsorción, Pb²⁺, TiO₂."
                    .to_string(),
                verbatim: true,
            })],
        },
    );

    m.sections.insert(
        3,
        ProjectSection {
            id: "abstract_en".to_string(),
            element_id: "abstract_en".to_string(),
            title: Some("Abstract".to_string()),
            label: None,
            placement: SectionPlacement::FrontMatter,
            required: false,
            enabled: true,
            status: Default::default(),
            notes: None,
            fields: HashMap::new(),
            children: vec![],
            blocks: vec![ContentBlock::Paragraph(ParagraphBlock {
                id: "abs-en-01".to_string(),
                content: "Nanocomposite membranes of graphene oxide functionalized with \
                           TiO\\textsubscript{2} (GO-TiO\\textsubscript{2}) were synthesized \
                           via the modified Hummers method for the simultaneous removal of \
                           heavy metals and organic contaminants from drinking water. \
                           Maximum Pb\\textsuperscript{2+} adsorption capacity was \
                           246.9 mg/g (Langmuir model, $R^2 = 0.998$). Photodegradation \
                           efficiency for methylene blue under UV irradiation (365 nm, 30 min) \
                           reached 97.3\\%. Materials were characterized by FTIR, XRD, \
                           SEM-EDX, and BET. Results demonstrate the potential of GO-TiO\\textsubscript{2} \
                           as a multifunctional material for compact water treatment systems \
                           in rural communities. \\textbf{Keywords:} graphene oxide, \
                           photocatalysis, adsorption, Pb\\textsuperscript{2+}, TiO\\textsubscript{2}."
                    .to_string(),
                verbatim: true,
            })],
        },
    );

    // ── Limpiar la sección introduction del fixture y reconstruirla ──────────
    let intro_idx = m
        .sections
        .iter()
        .position(|s| s.id == "introduction")
        .unwrap();
    m.sections[intro_idx].title = Some("Introducción".to_string());
    m.sections[intro_idx].blocks = chapter_introduccion();

    // ── Añadir capítulos del cuerpo ──────────────────────────────────────────
    let refs_idx = m
        .sections
        .iter()
        .position(|s| s.id == "references")
        .unwrap();

    m.sections.insert(refs_idx, chapter_conclusiones());
    m.sections.insert(refs_idx, chapter_resultados());
    m.sections.insert(refs_idx, chapter_metodologia());
    m.sections.insert(refs_idx, chapter_marco_teorico());

    // ── Glosario ─────────────────────────────────────────────────────────────
    let refs_idx2 = m
        .sections
        .iter()
        .position(|s| s.id == "references")
        .unwrap();
    m.sections.insert(refs_idx2, section_glosario());

    // ── Apéndices ────────────────────────────────────────────────────────────
    m.sections.push(section_apendice_a());
    m.sections.push(section_apendice_b());

    m
}

// ── Capítulo 1: Introducción ─────────────────────────────────────────────────

fn chapter_introduccion() -> Vec<ContentBlock> {
    vec![
        // Párrafos de contexto
        ContentBlock::Paragraph(ParagraphBlock {
            id: "intro-p1".to_string(), content: P_INTRO_1.to_string(), verbatim: false,
        }),
        ContentBlock::Paragraph(ParagraphBlock {
            id: "intro-p2".to_string(), content: P_INTRO_2.to_string(), verbatim: true,
        }),

        // Subsección: Planteamiento del problema
        ContentBlock::Heading(HeadingBlock {
            id: "intro-h1".to_string(),
            content: "Planteamiento del Problema".to_string(),
            level: HeadingLevel::Section,
        }),
        ContentBlock::Paragraph(ParagraphBlock {
            id: "intro-p3".to_string(), content: P_INTRO_3.to_string(), verbatim: true,
        }),

        // Subsección: Objetivos
        ContentBlock::Heading(HeadingBlock {
            id: "intro-h2".to_string(),
            content: "Objetivos".to_string(),
            level: HeadingLevel::Section,
        }),
        ContentBlock::Paragraph(ParagraphBlock {
            id: "intro-p4".to_string(),
            content: "El objetivo general de esta investigación es sintetizar y \
                       caracterizar membranas nanocompuestas GO-TiO₂ con capacidad dual \
                       de adsorción y fotocatálisis para el tratamiento de agua contaminada \
                       con metales pesados y colorantes industriales."
                .to_string(),
            verbatim: false,
        }),

        // Lista de objetivos específicos
        ContentBlock::List(ListBlock {
            id: "intro-obj".to_string(),
            list_type: ListType::Enumerate,
            items: vec![
                "Sintetizar GO mediante el método Hummers modificado y funcionalizar con nanopartículas de TiO₂.".to_string(),
                "Caracterizar los materiales por FTIR, XRD, SEM-EDX y análisis BET.".to_string(),
                "Evaluar la cinética y equilibrio de adsorción de Pb²⁺ y Cd²⁺.".to_string(),
                "Determinar la eficiencia fotocatalítica bajo irradiación UV para colorantes azo.".to_string(),
                "Proponer un modelo matemático que integre adsorción y fotodegradación simultáneas.".to_string(),
            ],
        }),

        // Diagrama Venn: técnicas de comparación
        ContentBlock::Visual(VisualBlock {
            id: "intro-venn1".to_string(),
            caption: "Comparación de técnicas de purificación de agua: intersección de propiedades".to_string(),
            label: "fig:venn-tecnicas".to_string(),
            include_in_list: true,
            advanced_latex_override: None,
            advanced_override_confirmed: false,
            config: VisualConfig::VennEuler(VennEulerConfig {
                sets: vec![
                    VennSet { label: "Adsorción (GO)".to_string(), color: "blue!50".to_string() },
                    VennSet { label: "Fotocatálisis (TiO₂)".to_string(), color: "orange!60".to_string() },
                    VennSet { label: "Filtración (membrana)".to_string(), color: "green!50".to_string() },
                ],
                intersections: [
                    ("01".to_string(), "Sinergia GO-TiO₂".to_string()),
                    ("12".to_string(), "Fotomembrana".to_string()),
                ].into(),
                style: "circles".to_string(),
            }),
        }),

        // Cita bibliográfica
        ContentBlock::Citation(CitationBlock {
            id: "intro-cit1".to_string(),
            citation_key: "who2023water".to_string(),
            citation_type: CitationType::Parenthetical,
            page: None,
            prefix: None,
            suffix: Some("pp. 12-18".to_string()),
        }),
    ]
}

// ── Capítulo 2: Marco Teórico ────────────────────────────────────────────────

fn chapter_marco_teorico() -> ProjectSection {
    ProjectSection {
        id: "marco_teorico".to_string(),
        element_id: "marco_teorico".to_string(),
        title: Some("Marco Teórico".to_string()),
        label: Some("cap:marco".to_string()),
        placement: SectionPlacement::Body,
        required: true,
        enabled: true,
        status: Default::default(),
        notes: None,
        fields: HashMap::new(),
        children: vec![],
        blocks: vec![
            ContentBlock::Paragraph(ParagraphBlock {
                id: "mt-p1".to_string(),
                content: P_TEORIA_1.to_string(),
                verbatim: true,
            }),
            // Ecuación: Langmuir
            ContentBlock::Heading(HeadingBlock {
                id: "mt-h1".to_string(),
                content: "Modelos de Isoterma de Adsorción".to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::Paragraph(ParagraphBlock {
                id: "mt-p2".to_string(),
                content: P_TEORIA_2.to_string(),
                verbatim: true,
            }),
            ContentBlock::Equation(EquationBlock {
                id: "eq-langmuir".to_string(),
                latex_content: "\\frac{C_e}{q_e} = \\frac{1}{q_m K_L} + \\frac{C_e}{q_m}"
                    .to_string(),
                label: Some("eq:langmuir".to_string()),
                numbered: true,
            }),
            ContentBlock::Equation(EquationBlock {
                id: "eq-freundlich".to_string(),
                latex_content: "\\log q_e = \\log K_F + \\frac{1}{n} \\log C_e".to_string(),
                label: Some("eq:freundlich".to_string()),
                numbered: true,
            }),
            ContentBlock::Equation(EquationBlock {
                id: "eq-darcy".to_string(),
                latex_content: "J = -\\frac{k}{\\mu} \\nabla P = L_p (\\Delta P - \\Delta \\pi)"
                    .to_string(),
                label: Some("eq:darcy".to_string()),
                numbered: true,
            }),
            // Tabla de comparación de nanomateriales
            ContentBlock::Heading(HeadingBlock {
                id: "mt-h2".to_string(),
                content: "Nanomateriales para Tratamiento de Agua".to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::Table(TableBlock {
                id: "tab-nanomaterials".to_string(),
                caption:
                    "Comparación de nanomateriales adsorbentes para remoción de metales pesados"
                        .to_string(),
                source: Some("Elaboración propia basada en revisión bibliográfica".to_string()),
                label: "tab:nanomaterials".to_string(),
                include_in_list: true,
                raw_headers: false,
                raw_cells: false,
                verbatim_caption: false,
                headers: vec![
                    "Material".to_string(),
                    "$q_m$ Pb²⁺ (mg/g)".to_string(),
                    "Sup. (m²/g)".to_string(),
                    "pH óptimo".to_string(),
                    "Ref.".to_string(),
                ],
                rows: vec![
                    vec![
                        "Carbón activado".to_string(),
                        "35.7".to_string(),
                        "800--1200".to_string(),
                        "5--7".to_string(),
                        "\\cite{ahmad2020carbon}".to_string(),
                    ],
                    vec![
                        "Fe₃O₄ magnético".to_string(),
                        "76.9".to_string(),
                        "120--180".to_string(),
                        "5--6".to_string(),
                        "\\cite{yean2005magnetic}".to_string(),
                    ],
                    vec![
                        "ZnO nanopart.".to_string(),
                        "119.3".to_string(),
                        "200--400".to_string(),
                        "6--7".to_string(),
                        "\\cite{lin2012zinc}".to_string(),
                    ],
                    vec![
                        "GO estándar".to_string(),
                        "189.5".to_string(),
                        "1200--1800".to_string(),
                        "4--6".to_string(),
                        "\\cite{sitko2013graphene}".to_string(),
                    ],
                    vec![
                        "\\textbf{GO-TiO₂ (este trabajo)}".to_string(),
                        "\\textbf{246.9}".to_string(),
                        "\\textbf{2100}".to_string(),
                        "\\textbf{5.0}".to_string(),
                        "---".to_string(),
                    ],
                ],
                table_style: TableStyle::Booktabs,
            }),
            ContentBlock::Paragraph(ParagraphBlock {
                id: "mt-p3".to_string(),
                content: "La Tabla~\\ref{tab:nanomaterials} evidencia que el material GO-TiO₂ \
                           sintetizado en este trabajo supera en capacidad de adsorción a todos \
                           los materiales de referencia incluidos en la revisión bibliográfica, \
                           con un incremento del 30.3\\% respecto al GO estándar."
                    .to_string(),
                verbatim: true,
            }),
            // Molécula de benceno (base del grafeno)
            ContentBlock::Visual(VisualBlock {
                id: "mt-mol1".to_string(),
                caption: "Estructura química del benceno, unidad fundamental de la red grafítica"
                    .to_string(),
                label: "fig:benzene".to_string(),
                include_in_list: true,
                advanced_latex_override: None,
                advanced_override_confirmed: false,
                config: VisualConfig::Molecule(MoleculeConfig {
                    preset: Some("benzene".to_string()),
                    chemfig_formula: None,
                    scale: 1.2,
                }),
            }),
            // Reacción química: síntesis GO
            ContentBlock::Visual(VisualBlock {
                id: "mt-chem1".to_string(),
                caption: "Reacción de oxidación de grafita a óxido de grafeno (método Hummers)"
                    .to_string(),
                label: "fig:hummers-rxn".to_string(),
                include_in_list: true,
                advanced_latex_override: None,
                advanced_override_confirmed: false,
                config: VisualConfig::ChemReaction(ChemReactionConfig {
                    equation: "Graphite + KMnO4 -> GO + MnSO4".to_string(),
                    catalyst: Some("H2SO4 conc.".to_string()),
                    conditions: Some("0--35 C, 2h".to_string()),
                    reaction_type: "forward".to_string(),
                    display_mode: true,
                }),
            }),
            // Timeline: Historia de la nanotecnología
            ContentBlock::Heading(HeadingBlock {
                id: "mt-h3".to_string(),
                content: "Cronología del Desarrollo de Nanomateriales para Tratamiento de Agua"
                    .to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::Visual(VisualBlock {
                id: "mt-tl1".to_string(),
                caption:
                    "Hitos históricos en el desarrollo de nanomateriales para purificación de agua"
                        .to_string(),
                label: "fig:timeline-nano".to_string(),
                include_in_list: true,
                advanced_latex_override: None,
                advanced_override_confirmed: false,
                config: VisualConfig::Timeline(TimelineConfig {
                    events: vec![
                        TimelineEvent {
                            date: "1991".to_string(),
                            title: "Nanotubos de carbono (Iijima)".to_string(),
                            description: Some("Descubrimiento de CNTs".to_string()),
                        },
                        TimelineEvent {
                            date: "1999".to_string(),
                            title: "Nanopartículas de Fe₃O₄".to_string(),
                            description: Some("Aplicación magnética en remediación".to_string()),
                        },
                        TimelineEvent {
                            date: "2004".to_string(),
                            title: "Grafeno (Novoselov & Geim)".to_string(),
                            description: Some("Premio Nobel de Física 2010".to_string()),
                        },
                        TimelineEvent {
                            date: "2010".to_string(),
                            title: "GO en membranas de ultrafiltración".to_string(),
                            description: Some(
                                "Flux 5× superior a membranas poliméricas".to_string(),
                            ),
                        },
                        TimelineEvent {
                            date: "2018".to_string(),
                            title: "GO-TiO₂ fotocatalítico".to_string(),
                            description: Some(
                                "Degradación de antibióticos bajo luz solar".to_string(),
                            ),
                        },
                        TimelineEvent {
                            date: "2024".to_string(),
                            title: "Escalamiento a planta piloto".to_string(),
                            description: Some("Demostración en 10,000 L/día".to_string()),
                        },
                    ],
                    orientation: "vertical".to_string(),
                    accent_color: "blue!70".to_string(),
                }),
            }),
            // Teorema (proposición matemática)
            ContentBlock::Theorem(TheoremBlock {
                id: "thm-convex".to_string(),
                kind: TheoremKind::Proposition,
                title: Some("Convexidad del modelo de Langmuir".to_string()),
                content: "Sea $q_e(C_e) = \\frac{q_m K_L C_e}{1 + K_L C_e}$ la isoterma de \
                           Langmuir con $q_m, K_L > 0$. Entonces $q_e$ es una función \
                           monótonamente creciente y cóncava hacia abajo en $C_e > 0$, \
                           con asíntota horizontal $\\lim_{C_e \\to \\infty} q_e = q_m$."
                    .to_string(),
                verbatim: true,
                numbered: true,
            }),
        ],
    }
}

// ── Capítulo 3: Metodología ──────────────────────────────────────────────────

fn chapter_metodologia() -> ProjectSection {
    ProjectSection {
        id: "metodologia".to_string(),
        element_id: "metodologia".to_string(),
        title: Some("Metodología Experimental".to_string()),
        label: Some("cap:metodologia".to_string()),
        placement: SectionPlacement::Body,
        required: true,
        enabled: true,
        status: Default::default(),
        notes: None,
        fields: HashMap::new(),
        children: vec![],
        blocks: vec![
            ContentBlock::Paragraph(ParagraphBlock {
                id: "met-p1".to_string(), content: P_METODO_1.to_string(), verbatim: true,
            }),

            // Lista de materiales
            ContentBlock::Heading(HeadingBlock {
                id: "met-h1".to_string(),
                content: "Materiales y Reactivos".to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::List(ListBlock {
                id: "met-mat".to_string(),
                list_type: ListType::Itemize,
                items: vec![
                    "Grafito natural en polvo, 99.5% pureza (Sigma-Aldrich, 282863)".to_string(),
                    "Ácido sulfúrico concentrado, 98% (J.T. Baker, 9681-33)".to_string(),
                    "Permanganato de potasio, grado reactivo (Sigma-Aldrich, 223468)".to_string(),
                    "Peróxido de hidrógeno 30% v/v (Fermont)".to_string(),
                    "Isopropóxido de titanio(IV), 97% (Sigma-Aldrich, 205273)".to_string(),
                    "Nitrato de plomo(II), 99.99% (Sigma-Aldrich, 228621)".to_string(),
                    "Agua ultrapura tipo I (18.2 MΩ·cm, Millipore Milli-Q)".to_string(),
                ],
            }),

            // Tabla de diseño experimental
            ContentBlock::Heading(HeadingBlock {
                id: "met-h2".to_string(),
                content: "Diseño Experimental".to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::Table(TableBlock {
                id: "tab-doe".to_string(),
                caption: "Variables del diseño experimental de adsorción en lote".to_string(),
                source: None,
                label: "tab:doe".to_string(),
                include_in_list: true,
                raw_headers: false,
                raw_cells: false,
                verbatim_caption: false,
                headers: vec!["Variable".to_string(), "Nivel bajo".to_string(), "Nivel central".to_string(), "Nivel alto".to_string(), "Unidad".to_string()],
                rows: vec![
                    vec!["pH".to_string(), "3.0".to_string(), "5.0".to_string(), "7.0".to_string(), "---".to_string()],
                    vec!["Temperatura".to_string(), "15".to_string(), "25".to_string(), "40".to_string(), "°C".to_string()],
                    vec!["Dosis de adsorbente".to_string(), "0.1".to_string(), "0.5".to_string(), "1.0".to_string(), "g/L".to_string()],
                    vec!["Concentración inicial C₀".to_string(), "10".to_string(), "100".to_string(), "200".to_string(), "mg/L".to_string()],
                    vec!["Tiempo de contacto".to_string(), "10".to_string(), "60".to_string(), "120".to_string(), "min".to_string()],
                ],
                table_style: TableStyle::Booktabs,
            }),

            // Diagrama de flujo del proceso experimental
            ContentBlock::Visual(VisualBlock {
                id: "met-flow1".to_string(),
                caption: "Diagrama de flujo del proceso experimental para síntesis y evaluación de GO-TiO₂".to_string(),
                label: "fig:flowchart".to_string(),
                include_in_list: true,
                advanced_latex_override: None,
                advanced_override_confirmed: false,
                config: VisualConfig::FlowDiagram(FlowDiagramConfig {
                    nodes: vec![
                        FlowNode { id: "n1".to_string(), label: "Síntesis de GO\n(Hummers mod.)".to_string(), shape: "rect".to_string(), color: "blue!30".to_string() },
                        FlowNode { id: "n2".to_string(), label: "Caracterización\n(FTIR, XRD, BET)".to_string(), shape: "rect".to_string(), color: "blue!30".to_string() },
                        FlowNode { id: "n3".to_string(), label: "¿Calidad\naceptable?".to_string(), shape: "diamond".to_string(), color: "orange!40".to_string() },
                        FlowNode { id: "n4".to_string(), label: "Funcionalización\ncon TiO₂".to_string(), shape: "rect".to_string(), color: "green!30".to_string() },
                        FlowNode { id: "n5".to_string(), label: "Ensayo de\nadsorción".to_string(), shape: "rounded".to_string(), color: "purple!30".to_string() },
                        FlowNode { id: "n6".to_string(), label: "Ensayo\nfotocatalítico".to_string(), shape: "rounded".to_string(), color: "purple!30".to_string() },
                        FlowNode { id: "n7".to_string(), label: "Análisis de\nresultados".to_string(), shape: "rect".to_string(), color: "gray!30".to_string() },
                    ],
                    edges: vec![
                        FlowEdge { from: "n1".to_string(), to: "n2".to_string(), label: None, style: "arrow".to_string() },
                        FlowEdge { from: "n2".to_string(), to: "n3".to_string(), label: None, style: "arrow".to_string() },
                        FlowEdge { from: "n3".to_string(), to: "n1".to_string(), label: Some("No".to_string()), style: "dashed".to_string() },
                        FlowEdge { from: "n3".to_string(), to: "n4".to_string(), label: Some("Sí".to_string()), style: "arrow".to_string() },
                        FlowEdge { from: "n4".to_string(), to: "n5".to_string(), label: None, style: "arrow".to_string() },
                        FlowEdge { from: "n4".to_string(), to: "n6".to_string(), label: None, style: "arrow".to_string() },
                        FlowEdge { from: "n5".to_string(), to: "n7".to_string(), label: None, style: "arrow".to_string() },
                        FlowEdge { from: "n6".to_string(), to: "n7".to_string(), label: None, style: "arrow".to_string() },
                    ],
                    orientation: "vertical".to_string(),
                }),
            }),

            // Circuito sensor para medición de turbidez
            ContentBlock::Heading(HeadingBlock {
                id: "met-h3".to_string(),
                content: "Sistema de Medición y Adquisición de Datos".to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::Paragraph(ParagraphBlock {
                id: "met-p2".to_string(),
                content: "Para la medición continua de la turbidez del efluente se diseñó \
                           un circuito de acondicionamiento de señal basado en un amplificador \
                           operacional inversor. La señal del fotodetector (resistencia de \
                           $R_1 = 10\\,\\text{k}\\Omega$) se amplifica con una ganancia de \
                           $G = -R_f/R_1 = -10$ mediante la configuración inversora mostrada \
                           en la Figura~\\ref{fig:opamp-sensor}."
                    .to_string(),
                verbatim: true,
            }),
            ContentBlock::Visual(VisualBlock {
                id: "met-circ1".to_string(),
                caption: "Circuito amplificador operacional inversor para acondicionamiento de señal del sensor de turbidez".to_string(),
                label: "fig:opamp-sensor".to_string(),
                include_in_list: true,
                advanced_latex_override: None,
                advanced_override_confirmed: false,
                config: VisualConfig::Circuit(CircuitConfig {
                    preset: "inverting_opamp".to_string(),
                    component_values: [
                        ("R".to_string(), "10\\,\\text{k}\\Omega".to_string()),
                    ].into(),
                }),
            }),

            // Código: procesamiento de datos en Python
            ContentBlock::Code(CodeBlock {
                id: "met-code1".to_string(),
                language: "Python".to_string(),
                caption: Some("Procesamiento estadístico de datos de adsorción".to_string()),
                label: Some("lst:python-ads".to_string()),
                content: "import numpy as np\nimport pandas as pd\nfrom scipy.optimize import curve_fit\nimport matplotlib.pyplot as plt\n\ndef langmuir(Ce, qm, KL):\n    \"\"\"Isoterma de Langmuir.\"\"\"\n    return (qm * KL * Ce) / (1 + KL * Ce)\n\ndef freundlich(Ce, KF, n):\n    \"\"\"Isoterma de Freundlich.\"\"\"\n    return KF * Ce**(1/n)\n\n# Cargar datos experimentales\ndf = pd.read_csv('adsorcion_pb2.csv')\nCe = df['Ce_mg_L'].values\nqe = df['qe_mg_g'].values\n\n# Ajuste no lineal Langmuir\npopt_L, pcov_L = curve_fit(langmuir, Ce, qe, p0=[200, 0.1])\nqm, KL = popt_L\nprint(f'Langmuir: qm={qm:.2f} mg/g, KL={KL:.4f} L/mg')\n\n# Calcular R²\nss_res = np.sum((qe - langmuir(Ce, *popt_L))**2)\nss_tot = np.sum((qe - np.mean(qe))**2)\nr2 = 1 - ss_res/ss_tot\nprint(f'R² = {r2:.4f}')".to_string(),
                show_line_numbers: true,
            }),
        ],
    }
}

// ── Capítulo 4: Resultados ───────────────────────────────────────────────────

fn chapter_resultados() -> ProjectSection {
    ProjectSection {
        id: "resultados".to_string(),
        element_id: "resultados".to_string(),
        title: Some("Resultados y Discusión".to_string()),
        label: Some("cap:resultados".to_string()),
        placement: SectionPlacement::Body,
        required: true,
        enabled: true,
        status: Default::default(),
        notes: None,
        fields: HashMap::new(),
        children: vec![],
        blocks: vec![
            ContentBlock::Heading(HeadingBlock {
                id: "res-h1".to_string(),
                content: "Caracterización Fisicoquímica".to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::Paragraph(ParagraphBlock {
                id: "res-p1".to_string(), content: P_RESULTADOS_1.to_string(), verbatim: true,
            }),

            // Tabla larga de resultados cinéticos (LongTable)
            ContentBlock::Heading(HeadingBlock {
                id: "res-h2".to_string(),
                content: "Cinética de Adsorción".to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::Paragraph(ParagraphBlock {
                id: "res-p2".to_string(), content: P_RESULTADOS_2.to_string(), verbatim: true,
            }),
            ContentBlock::Table(TableBlock {
                id: "tab-cinetica".to_string(),
                caption: "Parámetros cinéticos de adsorción de Pb²⁺ sobre GO-TiO₂ a diferentes temperaturas".to_string(),
                source: None,
                label: "tab:cinetica".to_string(),
                include_in_list: true,
                raw_headers: false,
                raw_cells: false,
                verbatim_caption: false,
                headers: vec![
                    "T (°C)".to_string(),
                    "$k_1$ (min⁻¹)".to_string(),
                    "$q_{e,calc}$ (mg/g)".to_string(),
                    "$R^2$ ps1".to_string(),
                    "$k_2$ (g/mg·min)".to_string(),
                    "$q_{e,calc}$ (mg/g)".to_string(),
                    "$R^2$ ps2".to_string(),
                ],
                rows: (15..=45).step_by(5).map(|t| {
                    let k1 = 0.018 + (t as f64 - 15.0) * 0.001;
                    let k2 = 0.00042 + (t as f64 - 15.0) * 0.00002;
                    let qe1 = 215.0 + (t as f64 - 15.0) * 1.2;
                    let qe2 = 238.0 + (t as f64 - 15.0) * 0.6;
                    vec![
                        format!("{}", t),
                        format!("{:.4}", k1),
                        format!("{:.1}", qe1),
                        format!("{:.4}", 0.9420 + (t as f64 - 15.0) * 0.0008),
                        format!("{:.5}", k2),
                        format!("{:.1}", qe2),
                        format!("{:.4}", 0.9981 - (t as f64 - 15.0) * 0.0001),
                    ]
                }).collect(),
                table_style: TableStyle::Long,
            }),

            // Ecuaciones cinéticas
            ContentBlock::Equation(EquationBlock {
                id: "eq-ps1".to_string(),
                latex_content: "\\ln(q_e - q_t) = \\ln q_e - k_1 t".to_string(),
                label: Some("eq:pseudo1".to_string()),
                numbered: true,
            }),
            ContentBlock::Equation(EquationBlock {
                id: "eq-ps2".to_string(),
                latex_content: "\\frac{t}{q_t} = \\frac{1}{k_2 q_e^2} + \\frac{t}{q_e}".to_string(),
                label: Some("eq:pseudo2".to_string()),
                numbered: true,
            }),

            // Diagrama de Feynman: dispersión Compton (efecto fotoeléctrico en TiO₂)
            ContentBlock::Heading(HeadingBlock {
                id: "res-h3".to_string(),
                content: "Mecanismo Fotocatalítico".to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::Paragraph(ParagraphBlock {
                id: "res-p3".to_string(),
                content: "La activación del TiO₂ bajo irradiación UV genera pares electrón-hueco \
                           mediante el proceso de absorción de fotones representado en el \
                           diagrama cuántico de la Figura~\\ref{fig:compton-tio2}. \
                           Los electrones fotogenerados en la banda de conducción (BC) \
                           reaccionan con el oxígeno disuelto para formar radicales \
                           superóxido ($\\cdot$O₂⁻), mientras que los huecos en la \
                           banda de valencia (BV) oxidan directamente las moléculas \
                           de contaminante o el agua para generar radicales hidroxilo ($\\cdot$OH)."
                    .to_string(),
                verbatim: true,
            }),
            ContentBlock::Visual(VisualBlock {
                id: "res-feynman1".to_string(),
                caption: "Diagrama de dispersión Compton: interacción fotón-electrón análoga al proceso fotocatalítico en TiO₂".to_string(),
                label: "fig:compton-tio2".to_string(),
                include_in_list: true,
                advanced_latex_override: None,
                advanced_override_confirmed: false,
                config: VisualConfig::Feynman(FeynmanConfig {
                    preset: "compton".to_string(),
                    particle_labels: HashMap::new(),
                    show_momentum: false,
                }),
            }),

            // Vía metabólica analógica (ciclo de degradación)
            ContentBlock::Visual(VisualBlock {
                id: "res-bio1".to_string(),
                caption: "Esquema de la vía de degradación fotocatalítica del azul de metileno (análogo a glucólisis)".to_string(),
                label: "fig:bio-pathway".to_string(),
                include_in_list: true,
                advanced_latex_override: None,
                advanced_override_confirmed: false,
                config: VisualConfig::BioPathway(BioPathwayConfig {
                    preset: "glycolysis".to_string(),
                    custom_labels: [
                        ("glucose".to_string(), "Azul de metileno".to_string()),
                        ("pyruvate".to_string(), "CO₂ + H₂O".to_string()),
                    ].into(),
                    show_cofactors: true,
                }),
            }),

            // Plugin figure: gráfica PGFPlots (autocontenida)
            ContentBlock::PluginFigure(PluginFigureBlock {
                id: "pf-isoterma-01".to_string(),
                figure_id: "fig_isoterma_langmuir".to_string(),
                plugin_id: "pgfplots-scatter".to_string(),
                latex_block: concat!(
                    "% texisstudio-figure-id: fig_isoterma_langmuir\n",
                    "\\begin{figure}[htbp]\n",
                    "  \\centering\n",
                    "  \\begin{tikzpicture}\n",
                    "    \\begin{axis}[\n",
                    "      width=0.75\\textwidth,\n",
                    "      xlabel={$C_e$ (mg/L)},\n",
                    "      ylabel={$q_e$ (mg/g)},\n",
                    "      title={Isoterma de Langmuir -- GO-TiO\\textsubscript{2}},\n",
                    "      grid=major,\n",
                    "      legend pos=south east,\n",
                    "    ]\n",
                    "      \\addplot[blue, thick, domain=0:200, samples=80]\n",
                    "        {246.9 * 0.085 * x / (1 + 0.085 * x)};\n",
                    "      \\addlegendentry{Langmuir ($q_m=246.9$, $K_L=0.085$)}\n",
                    "      \\addplot[only marks, mark=*, red] coordinates {\n",
                    "        (10,68.4)(25,112.3)(50,163.7)(75,198.4)\n",
                    "        (100,218.6)(150,234.1)(200,241.7)\n",
                    "      };\n",
                    "      \\addlegendentry{Datos experimentales}\n",
                    "    \\end{axis}\n",
                    "  \\end{tikzpicture}\n",
                    "  \\caption{Isoterma de adsorción de Pb$^{2+}$ sobre GO-TiO\\textsubscript{2}:\n",
                    "           ajuste al modelo de Langmuir ($R^2 = 0.998$, $T = 25^\\circ$C).}\n",
                    "  \\label{fig:isoterma-langmuir}\n",
                    "\\end{figure}\n",
                    "% /texisstudio-figure-id",
                ).to_string(),
                caption: "Isoterma de adsorción de Pb²⁺ sobre GO-TiO₂: ajuste Langmuir".to_string(),
                label: "fig:isoterma-langmuir".to_string(),
                required_packages: vec!["pgfplots".to_string(), "tikz".to_string()],
                source_json: r#"{"engineId":"pgfplots-scatter","version":"2.1.0","xLabel":"Ce (mg/L)","yLabel":"qe (mg/g)"}"#.to_string(),
                warnings: vec![],
            }),

            // Algoritmo: proceso de cálculo cinético
            ContentBlock::Algorithm(AlgorithmBlock {
                id: "alg-cinetica".to_string(),
                caption: "Selección automática del modelo cinético óptimo".to_string(),
                label: Some("alg:cinetica".to_string()),
                input: Some("Datos experimentales $(t_i, q_{t_i})$, umbral $R^2_{min} = 0.99$".to_string()),
                output: Some("Modelo cinético seleccionado y parámetros ajustados".to_string()),
                body: "\\State Ajustar modelo pseudo-primer orden (Ec.~\\ref{eq:pseudo1}) por regresi\\'{o}n lineal\n\\State Calcular $R^2_1$\n\\State Ajustar modelo pseudo-segundo orden (Ec.~\\ref{eq:pseudo2}) por regresi\\'{o}n lineal\n\\State Calcular $R^2_2$\n\\If{$R^2_2 > R^2_1$ \\textbf{y} $R^2_2 \\geq R^2_{min}$}\n  \\State Seleccionar pseudo-segundo orden\n  \\State Reportar $k_2$ y $q_{e,calc}$\n\\ElsIf{$R^2_1 \\geq R^2_{min}$}\n  \\State Seleccionar pseudo-primer orden\n  \\State Reportar $k_1$ y $q_{e,calc}$\n\\Else\n  \\State Reportar ajuste deficiente --- revisar datos\n\\EndIf".to_string(),
            }),

            // RawLatex: ecuación de energía de activación
            ContentBlock::RawLatex(RawLatexBlock {
                id: "raw-arrhenius".to_string(),
                content: "\\begin{equation}\n  E_a = -R \\cdot \\text{slope}\\left(\\ln k_2 \\text{ vs. } \\frac{1}{T}\\right) \\label{eq:arrhenius}\n\\end{equation}\n\\noindent donde $R = 8.314\\,\\text{J mol}^{-1}\\text{K}^{-1}$ es la constante universal de los gases.".to_string(),
                user_confirmed: true,
            }),

            ContentBlock::Paragraph(ParagraphBlock {
                id: "res-p4".to_string(),
                content: "El análisis de Arrhenius (Ecuación~\\ref{eq:arrhenius}) arrojó una \
                           energía de activación de $E_a = 28.4\\,\\text{kJ/mol}$, \
                           consistente con mecanismos de quimisorción ($E_a > 40\\,\\text{kJ/mol}$ \
                           indica quimisorción, $< 40\\,\\text{kJ/mol}$ puede indicar fisisorción \
                           o mecanismos mixtos), apuntando a una interacción fuerte entre \
                           los iones Pb²⁺ y los grupos carboxilo del GO."
                    .to_string(),
                verbatim: true,
            }),
        ],
    }
}

// ── Capítulo 5: Conclusiones ─────────────────────────────────────────────────

fn chapter_conclusiones() -> ProjectSection {
    ProjectSection {
        id: "conclusiones".to_string(),
        element_id: "conclusiones".to_string(),
        title: Some("Conclusiones y Perspectivas".to_string()),
        label: Some("cap:conclusiones".to_string()),
        placement: SectionPlacement::Body,
        required: true,
        enabled: true,
        status: Default::default(),
        notes: None,
        fields: HashMap::new(),
        children: vec![],
        blocks: vec![
            ContentBlock::Paragraph(ParagraphBlock {
                id: "conc-p1".to_string(), content: P_CONCLUSIONES.to_string(), verbatim: true,
            }),
            ContentBlock::Heading(HeadingBlock {
                id: "conc-h1".to_string(),
                content: "Aportaciones Originales".to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::List(ListBlock {
                id: "conc-contrib".to_string(),
                list_type: ListType::Enumerate,
                items: vec![
                    "Método de síntesis optimizado de GO-TiO₂ con relación molar TiO₂/GO = 3:1, que maximiza la eficiencia fotocatalítica manteniendo la capacidad adsorbente.".to_string(),
                    "Modelo cinético acoplado que describe simultáneamente la adsorción y la fotodegradación en sistemas de tratamiento continuo.".to_string(),
                    "Correlación entre el espaciado interlaminar del GO (d₀₀₂) y la capacidad máxima de adsorción: $q_m \\propto d_{002}^{1.7}$ (R² = 0.94).".to_string(),
                    "Demostración de la estabilidad del material GO-TiO₂ tras 10 ciclos de regeneración, con pérdida de capacidad inferior al 5\\%.".to_string(),
                    "Prototipo funcional de módulo de filtración a escala laboratorio (1 L/h) con remoción > 99\\% de Pb²⁺ a concentraciones iniciales de 50 mg/L.".to_string(),
                ],
            }),
            ContentBlock::Heading(HeadingBlock {
                id: "conc-h2".to_string(),
                content: "Trabajo Futuro".to_string(),
                level: HeadingLevel::Section,
            }),
            ContentBlock::Paragraph(ParagraphBlock {
                id: "conc-p2".to_string(),
                content: "Las líneas de investigación derivadas de este trabajo incluyen: \
                           (1) el escalamiento del proceso de síntesis mediante técnicas de \
                           flujo continuo (microfluidics) para producción a mayor escala; \
                           (2) la evaluación del desempeño bajo condiciones de agua real \
                           (agua de río, pozo y residual industrial); (3) el análisis del \
                           ciclo de vida (LCA) y la evaluación económica del sistema \
                           para comunidades de hasta 500 habitantes; y (4) la integración \
                           con sistemas de energía solar para fotocatálisis visible."
                    .to_string(),
                verbatim: true,
            }),
            ContentBlock::Citation(CitationBlock {
                id: "conc-cit1".to_string(),
                citation_key: "zhang2023future".to_string(),
                citation_type: CitationType::Narrative,
                page: Some("45".to_string()),
                prefix: None,
                suffix: None,
            }),
            ContentBlock::Citation(CitationBlock {
                id: "conc-cit2".to_string(),
                citation_key: "novoselov2004electric".to_string(),
                citation_type: CitationType::Parenthetical,
                page: None,
                prefix: None,
                suffix: None,
            }),
        ],
    }
}

// ── Sección de Glosario ──────────────────────────────────────────────────────

fn section_glosario() -> ProjectSection {
    ProjectSection {
        id: "glosario".to_string(),
        element_id: "glossary_section".to_string(),
        title: Some("Glosario".to_string()),
        label: None,
        placement: SectionPlacement::BackMatter,
        required: false,
        enabled: true,
        status: Default::default(),
        notes: None,
        fields: HashMap::new(),
        children: vec![],
        blocks: vec![
            ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                id: "g-go".to_string(),
                term: "Óxido de grafeno".to_string(),
                definition: "Derivado oxidado del grafeno con grupos funcionales oxigenados en su superficie, obtenido mediante oxidación química de grafita.".to_string(),
                verbatim: false,
            }),
            ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                id: "g-adsorcion".to_string(),
                term: "Adsorción".to_string(),
                definition: "Proceso de acumulación de especies en una interfaz sólido-líquido, caracterizado por la capacidad máxima $q_m$ y la constante de afinidad $K_L$.".to_string(),
                verbatim: true,
            }),
            ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                id: "g-fotocatalisis".to_string(),
                term: "Fotocatálisis".to_string(),
                definition: "Proceso de degradación de contaminantes activado por luz mediante la generación de pares electrón-hueco en un semiconductor como el TiO₂.".to_string(),
                verbatim: false,
            }),
            ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                id: "g-isoterma".to_string(),
                term: "Isoterma de adsorción".to_string(),
                definition: "Relación de equilibrio entre la cantidad adsorbida $q_e$ y la concentración en solución $C_e$ a temperatura constante.".to_string(),
                verbatim: true,
            }),
            ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                id: "g-cinetica".to_string(),
                term: "Cinética de adsorción".to_string(),
                definition: "Descripción matemática de la velocidad a la que un adsorbato se acumula en la superficie de un adsorbente en función del tiempo.".to_string(),
                verbatim: false,
            }),
            ContentBlock::GlossaryEntry(GlossaryEntryBlock {
                id: "g-superficie-bet".to_string(),
                term: "Superficie específica BET".to_string(),
                definition: "Área superficial total por unidad de masa de un sólido, determinada por adsorción de nitrógeno a 77 K según el método Brunauer-Emmett-Teller.".to_string(),
                verbatim: false,
            }),
            ContentBlock::AcronymEntry(AcronymEntryBlock {
                id: "acr-go".to_string(),
                acronym: "GO".to_string(),
                full_form: "Graphene Oxide".to_string(),
                description: Some("Óxido de grafeno, material bidimensional con grupos funcionales oxigenados.".to_string()),
            }),
            ContentBlock::AcronymEntry(AcronymEntryBlock {
                id: "acr-rgo".to_string(),
                acronym: "rGO".to_string(),
                full_form: "Reduced Graphene Oxide".to_string(),
                description: Some("Óxido de grafeno reducido térmicamente o químicamente.".to_string()),
            }),
            ContentBlock::AcronymEntry(AcronymEntryBlock {
                id: "acr-ftir".to_string(),
                acronym: "FTIR".to_string(),
                full_form: "Fourier-Transform Infrared Spectroscopy".to_string(),
                description: Some("Espectroscopía infrarroja por transformada de Fourier.".to_string()),
            }),
            ContentBlock::AcronymEntry(AcronymEntryBlock {
                id: "acr-xrd".to_string(),
                acronym: "XRD".to_string(),
                full_form: "X-Ray Diffraction".to_string(),
                description: Some("Difracción de rayos X, técnica de caracterización cristalográfica.".to_string()),
            }),
            ContentBlock::AcronymEntry(AcronymEntryBlock {
                id: "acr-bet".to_string(),
                acronym: "BET".to_string(),
                full_form: "Brunauer-Emmett-Teller".to_string(),
                description: Some("Método para determinación de superficie específica por adsorción de N₂.".to_string()),
            }),
            ContentBlock::AcronymEntry(AcronymEntryBlock {
                id: "acr-uv".to_string(),
                acronym: "UV".to_string(),
                full_form: "Ultraviolet radiation".to_string(),
                description: Some("Radiación ultravioleta (100--400 nm) usada para activar fotocatalizadores.".to_string()),
            }),
        ],
    }
}

// ── Apéndice A: Datos experimentales completos ───────────────────────────────

fn section_apendice_a() -> ProjectSection {
    ProjectSection {
        id: "apendice_a".to_string(),
        element_id: "appendix".to_string(),
        title: Some("Apéndice A: Datos Experimentales Completos".to_string()),
        label: Some("ap:datos".to_string()),
        placement: SectionPlacement::BackMatter,
        required: false,
        enabled: true,
        status: Default::default(),
        notes: None,
        fields: HashMap::new(),
        children: vec![],
        blocks: vec![
            ContentBlock::Paragraph(ParagraphBlock {
                id: "ap-a-p1".to_string(),
                content: "El presente apéndice contiene los datos brutos de todos los \
                           experimentos de adsorción realizados en el proyecto. \
                           Los datos se reportan como promedio de tres réplicas \
                           independientes ± desviación estándar."
                    .to_string(),
                verbatim: false,
            }),
            ContentBlock::Table(TableBlock {
                id: "tab-datos-brutos".to_string(),
                caption: "Datos experimentales completos de adsorción de Pb²⁺ (pH 5.0, 25°C)".to_string(),
                source: None,
                label: "tab:datos-brutos".to_string(),
                include_in_list: false,
                raw_headers: false,
                raw_cells: false,
                verbatim_caption: false,
                headers: vec!["Réplica".to_string(), "C₀ (mg/L)".to_string(), "Ceq (mg/L)".to_string(), "qe (mg/g)".to_string(), "Remoción (%)".to_string()],
                rows: vec![
                    vec!["R1".to_string(), "10.0".to_string(), "0.08".to_string(), "49.6".to_string(), "99.2".to_string()],
                    vec!["R2".to_string(), "10.0".to_string(), "0.11".to_string(), "49.5".to_string(), "98.9".to_string()],
                    vec!["R3".to_string(), "10.0".to_string(), "0.09".to_string(), "49.6".to_string(), "99.1".to_string()],
                    vec!["R1".to_string(), "50.0".to_string(), "0.72".to_string(), "246.4".to_string(), "98.6".to_string()],
                    vec!["R2".to_string(), "50.0".to_string(), "0.68".to_string(), "246.6".to_string(), "98.6".to_string()],
                    vec!["R3".to_string(), "50.0".to_string(), "0.75".to_string(), "246.3".to_string(), "98.5".to_string()],
                    vec!["R1".to_string(), "100.0".to_string(), "1.42".to_string(), "246.9".to_string(), "98.6".to_string()],
                    vec!["R2".to_string(), "100.0".to_string(), "1.38".to_string(), "246.9".to_string(), "98.6".to_string()],
                    vec!["R3".to_string(), "100.0".to_string(), "1.51".to_string(), "246.8".to_string(), "98.5".to_string()],
                ],
                table_style: TableStyle::Simple,
            }),
            ContentBlock::RawLatex(RawLatexBlock {
                id: "raw-nota-ap".to_string(),
                content: "\\noindent \\textit{Nota: La dosis de adsorbente fue de 0.5 g/L en todos los experimentos. El tiempo de contacto fue de 60 minutos.}".to_string(),
                user_confirmed: true,
            }),
        ],
    }
}

// ── Apéndice B: Derivaciones matemáticas ────────────────────────────────────

fn section_apendice_b() -> ProjectSection {
    ProjectSection {
        id: "apendice_b".to_string(),
        element_id: "appendix_b".to_string(),
        title: Some("Apéndice B: Derivaciones Matemáticas".to_string()),
        label: Some("ap:math".to_string()),
        placement: SectionPlacement::BackMatter,
        required: false,
        enabled: true,
        status: Default::default(),
        notes: None,
        fields: HashMap::new(),
        children: vec![],
        blocks: vec![
            ContentBlock::Theorem(TheoremBlock {
                id: "thm-ap-b1".to_string(),
                kind: TheoremKind::Proof,
                title: Some("Linealización del modelo de Langmuir".to_string()),
                content: "Partiendo de $q_e = \\frac{q_m K_L C_e}{1 + K_L C_e}$, dividiendo \
                           ambos lados entre $q_e$ y reordenando: \
                           \\begin{align*} \
                           q_e (1 + K_L C_e) &= q_m K_L C_e \\\\ \
                           \\frac{C_e}{q_e} &= \\frac{1 + K_L C_e}{q_m K_L} = \\frac{1}{q_m K_L} + \\frac{C_e}{q_m}. \
                           \\end{align*} \
                           Graficando $C_e/q_e$ vs. $C_e$ se obtiene una línea recta con \
                           pendiente $1/q_m$ e intercepto $1/(q_m K_L)$. $\\square$"
                    .to_string(),
                verbatim: true,
                numbered: false,
            }),
            ContentBlock::Equation(EquationBlock {
                id: "eq-ap-b1".to_string(),
                latex_content: "\\Delta G^\\circ = -RT \\ln K_L".to_string(),
                label: Some("eq:gibbs".to_string()),
                numbered: true,
            }),
            ContentBlock::Equation(EquationBlock {
                id: "eq-ap-b2".to_string(),
                latex_content: "\\Delta H^\\circ = R \\left[ \\frac{T_1 T_2}{T_2 - T_1} \\right] \\ln \\frac{K_{L2}}{K_{L1}}".to_string(),
                label: Some("eq:vant-hoff".to_string()),
                numbered: true,
            }),
        ],
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/// Genera la tesis y verifica que todos los archivos LaTeX se crean correctamente.
#[test]
fn stress_all_block_types_generate() {
    let model = build_stress_model();
    let gen = LaTeXGenerator::new().unwrap();

    let dir = tempfile::tempdir().unwrap();
    gen.generate(&model, dir.path()).unwrap();

    // ── Archivos obligatorios ────────────────────────────────────────────────
    let main = dir.path().join("main.tex");
    let paquetes = dir.path().join("configuracion/paquetes.tex");
    let datos = dir.path().join("configuracion/datos_tesis.tex");
    let glossary = dir.path().join("configuracion/glossary.tex");

    assert!(main.exists(), "main.tex debe existir");
    assert!(paquetes.exists(), "paquetes.tex debe existir");
    assert!(datos.exists(), "datos_tesis.tex debe existir");
    assert!(glossary.exists(), "glossary.tex debe existir");

    // ── Capítulos ────────────────────────────────────────────────────────────
    let cap_paths: Vec<_> = fs::read_dir(dir.path().join("capitulos"))
        .unwrap()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect();
    assert!(
        cap_paths.len() >= 5,
        "debe haber al menos 5 capítulos, hay {}",
        cap_paths.len()
    );

    // ── Contenido de main.tex ────────────────────────────────────────────────
    let main_content = fs::read_to_string(&main).unwrap();
    assert!(
        main_content.contains("\\documentclass"),
        "documentclass requerido"
    );
    assert!(
        main_content.contains("\\frontmatter"),
        "frontmatter requerido"
    );
    assert!(
        main_content.contains("\\mainmatter"),
        "mainmatter requerido"
    );
    assert!(
        main_content.contains("\\printbibliography"),
        "printbibliography requerido"
    );

    // ── Paquetes auto-detectados ─────────────────────────────────────────────
    let pkg_content = fs::read_to_string(&paquetes).unwrap();
    assert!(
        pkg_content.contains("tikz"),
        "tikz: requerido por VennEuler, FlowDiagram, Timeline, Feynman, BioPathway"
    );
    assert!(
        pkg_content.contains("chemfig"),
        "chemfig: requerido por Molecule(benzene)"
    );
    assert!(
        pkg_content.contains("mhchem"),
        "mhchem: requerido por ChemReaction"
    );
    assert!(
        pkg_content.contains("circuitikz"),
        "circuitikz: requerido por Circuit"
    );
    assert!(
        pkg_content.contains("pgfplots"),
        "pgfplots: requerido por PluginFigure"
    );
    assert!(
        pkg_content.contains("glossaries"),
        "glossaries: requerido por GlossaryEntry/AcronymEntry"
    );
    assert!(
        pkg_content.contains("\\makenoidxglossaries"),
        "makenoidxglossaries requerido (procesa el glosario dentro de LaTeX, sin herramienta externa)"
    );

    // ── Contenido del glosario ───────────────────────────────────────────────
    let glos_content = fs::read_to_string(&glossary).unwrap();
    assert!(
        glos_content.contains("\\newglossaryentry{g-go}"),
        "entrada GO en glosario"
    );
    assert!(
        glos_content.contains("\\newacronym") && glos_content.contains("{acr-ftir}"),
        "acrónimo FTIR"
    );
    assert!(glos_content.contains("{acr-xrd}"), "acrónimo XRD");
    assert!(glos_content.contains("{acr-go}"), "acrónimo GO");

    // ── Contenido de capítulos ───────────────────────────────────────────────
    let intro_file = cap_paths
        .iter()
        .find(|p| {
            p.file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .contains("introduction")
        })
        .expect("capítulo introducción debe existir");
    let intro_content = fs::read_to_string(intro_file).unwrap();
    assert!(
        intro_content.contains("tikzpicture"),
        "VennEuler genera tikzpicture en intro"
    );
    assert!(
        intro_content.contains("enumerate"),
        "Lista enumerate en intro"
    );

    // Capítulo marco teórico
    let mt_file = cap_paths
        .iter()
        .find(|p| {
            p.file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .contains("marco_teorico")
        })
        .expect("capítulo marco teórico debe existir");
    let mt_content = fs::read_to_string(mt_file).unwrap();
    assert!(
        mt_content.contains("\\begin{equation}"),
        "ecuaciones en marco teórico"
    );
    assert!(
        mt_content.contains("\\label{eq:langmuir}"),
        "label de ecuación Langmuir"
    );
    assert!(
        mt_content.contains("\\toprule"),
        "tabla Booktabs en marco teórico"
    );
    assert!(
        mt_content.contains("chemfig"),
        "molécula chemfig en marco teórico"
    );
    assert!(
        mt_content.contains("\\ce{"),
        "reacción química mhchem en marco teórico"
    );

    // Capítulo metodología
    let met_file = cap_paths
        .iter()
        .find(|p| {
            p.file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .contains("metodologia")
        })
        .expect("capítulo metodología debe existir");
    let met_content = fs::read_to_string(met_file).unwrap();
    assert!(
        met_content.contains("circuitikz"),
        "circuito en metodología"
    );
    assert!(
        met_content.contains("\\begin{lstlisting}"),
        "código Python en metodología"
    );
    assert!(
        met_content.contains("longtable") || met_content.contains("\\begin{table}"),
        "tabla en metodología"
    );
    assert!(
        met_content.contains("FlowDiagram") || met_content.contains("tikzpicture"),
        "diagrama de flujo en metodología"
    );

    // Capítulo resultados
    let res_file = cap_paths
        .iter()
        .find(|p| {
            p.file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .contains("resultados")
        })
        .expect("capítulo resultados debe existir");
    let res_content = fs::read_to_string(res_file).unwrap();
    assert!(
        res_content.contains("\\begin{longtable}"),
        "LongTable en resultados"
    );
    assert!(
        res_content.contains("Compton") || res_content.contains("fermion"),
        "Feynman en resultados"
    );
    assert!(
        res_content.contains("texisstudio-figure-id"),
        "PluginFigure en resultados"
    );
    assert!(
        res_content.contains("\\begin{tikzpicture}") && res_content.contains("pgfplots")
            || res_content.contains("axis"),
        "PGFPlots en resultados"
    );
    assert!(
        res_content.contains("\\begin{algorithm}") || res_content.contains("algorithm2e"),
        "algoritmo en resultados"
    );

    // Capítulo conclusiones
    let conc_file = cap_paths
        .iter()
        .find(|p| {
            p.file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .contains("conclusiones")
        })
        .expect("capítulo conclusiones debe existir");
    let conc_content = fs::read_to_string(conc_file).unwrap();
    assert!(conc_content.contains("enumerate"), "lista en conclusiones");
    assert!(
        conc_content.contains("\\parencite{") || conc_content.contains("\\textcite{"),
        "citas en conclusiones (parencite o textcite)"
    );

    eprintln!("\n✓ Tesis de estrés generada correctamente.");
    eprintln!("  Capítulos: {}", cap_paths.len());
    eprintln!("  Paquetes incluidos: tikz, chemfig, mhchem, circuitikz, pgfplots, glossaries");
    eprintln!("  Tipos de bloques: Paragraph, Heading, Equation, Table(Booktabs/Long/Simple),");
    eprintln!("    List(Enumerate/Itemize), Citation, GlossaryEntry, AcronymEntry, Code,");
    eprintln!("    Algorithm, Theorem, RawLatex, PluginFigure, Visual(Venn/Flow/Timeline/");
    eprintln!("    ChemReaction/Molecule/Circuit/Feynman/BioPathway)");
}

/// Simula añadir y quitar secciones (habilitar/deshabilitar módulos).
#[test]
fn stress_add_remove_sections() {
    let mut model = build_stress_model();
    let gen = LaTeXGenerator::new().unwrap();

    // Estado inicial: todos los capítulos habilitados
    let dir_full = tempfile::tempdir().unwrap();
    gen.generate(&model, dir_full.path()).unwrap();
    let caps_full: Vec<_> = fs::read_dir(dir_full.path().join("capitulos"))
        .unwrap()
        .filter_map(|e| e.ok())
        .collect();
    let n_full = caps_full.len();

    // Deshabilitar capítulo de resultados
    let res = model
        .sections
        .iter_mut()
        .find(|s| s.id == "resultados")
        .unwrap();
    res.enabled = false;

    let dir_without_res = tempfile::tempdir().unwrap();
    gen.generate(&model, dir_without_res.path()).unwrap();
    let caps_without: Vec<_> = fs::read_dir(dir_without_res.path().join("capitulos"))
        .unwrap()
        .filter_map(|e| e.ok())
        .collect();
    let n_without = caps_without.len();

    assert!(
        n_without < n_full,
        "al deshabilitar una sección el número de capítulos debe reducirse: antes={}, después={}",
        n_full,
        n_without
    );

    let has_resultados = caps_without
        .iter()
        .any(|e| e.file_name().to_str().unwrap().contains("resultados"));
    assert!(
        !has_resultados,
        "el capítulo resultados no debe generarse cuando está deshabilitado"
    );

    // Rehabilitar y agregar nueva sección
    let res2 = model
        .sections
        .iter_mut()
        .find(|s| s.id == "resultados")
        .unwrap();
    res2.enabled = true;
    model.sections.push(ProjectSection {
        id: "agradecimientos".to_string(),
        element_id: "acknowledgements".to_string(),
        title: Some("Agradecimientos".to_string()),
        label: None,
        placement: SectionPlacement::FrontMatter,
        required: false,
        enabled: true,
        status: Default::default(),
        notes: None,
        fields: HashMap::new(),
        children: vec![],
        blocks: vec![ContentBlock::Paragraph(ParagraphBlock {
            id: "agr-p1".to_string(),
            content: "La autora agradece el apoyo del CONAHCYT mediante la beca No. 2024-PNPC-042."
                .to_string(),
            verbatim: false,
        })],
    });

    let dir_extended = tempfile::tempdir().unwrap();
    gen.generate(&model, dir_extended.path()).unwrap();
    let caps_extended: Vec<_> = fs::read_dir(dir_extended.path().join("capitulos"))
        .unwrap()
        .filter_map(|e| e.ok())
        .collect();

    assert_eq!(
        caps_extended.len(),
        n_full,
        "con resultados rehabilitado el número de capítulos del cuerpo debe ser igual al original"
    );

    eprintln!("\n✓ Prueba add/remove sections OK");
    eprintln!("  Capítulos completos: {}", n_full);
    eprintln!("  Sin resultados: {}", n_without);
    eprintln!("  Rehabilitado: {}", caps_extended.len());
}

/// Verifica que los archivos manuales se preservan al regenerar.
#[test]
fn stress_manual_edit_preserved_on_regen() {
    let model = build_stress_model();
    let gen = LaTeXGenerator::new().unwrap();

    let dir = tempfile::tempdir().unwrap();
    gen.generate(&model, dir.path()).unwrap();

    // Simular edición manual del usuario en el capítulo marco teórico
    let mt_paths: Vec<_> = fs::read_dir(dir.path().join("capitulos"))
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_str().unwrap().contains("marco_teorico"))
        .collect();
    let mt_path = mt_paths
        .first()
        .expect("capítulo marco teórico debe existir")
        .path();
    let rel_path = format!(
        "capitulos/{}",
        mt_path.file_name().unwrap().to_str().unwrap()
    );

    fs::write(&mt_path, b"% === EDICION MANUAL DEL USUARIO ===\n").unwrap();

    // Regenerar respetando ediciones manuales
    let mut model2 = build_stress_model();
    let mt_section = model2
        .sections
        .iter_mut()
        .find(|s| s.id == "marco_teorico")
        .unwrap();
    mt_section
        .blocks
        .push(ContentBlock::Paragraph(ParagraphBlock {
            id: "mt-nuevo".to_string(),
            content: "Nuevo párrafo agregado por el usuario en el panel de contenido.".to_string(),
            verbatim: false,
        }));

    // Marcar como manual
    model2
        .file_states
        .insert(rel_path.clone(), FileState::Manual);

    let report = gen
        .generate_respecting_manual_edits(&model2, dir.path(), None, None)
        .unwrap();

    // El archivo manual debe preservarse
    assert!(
        report.preserved_manual.contains(&rel_path),
        "el archivo editado manualmente debe estar en preserved_manual"
    );
    let content = fs::read_to_string(&mt_path).unwrap();
    assert!(
        content.contains("EDICION MANUAL"),
        "el contenido manual debe permanecer intacto"
    );
    assert!(
        !content.contains("Nuevo párrafo"),
        "el contenido del modelo actualizado NO debe sobreescribir la edición manual"
    );

    eprintln!("\n✓ Preservación de ediciones manuales verificada");
}

/// Compila la tesis con xelatex + biber y verifica el PDF.
/// Este test requiere LaTeX instalado: cargo test --test stress_thesis -- --include-ignored
#[test]
#[ignore]
fn stress_compile_full_pdf() {
    use std::process::Command;

    // Directorio persistente para inspección
    let root = Path::new("/tmp/texis-stress");
    let build_dir = root.join("build");
    let bib_dir = root.join("content").join("bibliography");
    fs::create_dir_all(&build_dir).unwrap();
    fs::create_dir_all(&bib_dir).unwrap();

    // Escribir references.bib
    fs::write(bib_dir.join("references.bib"), REFERENCES_BIB).unwrap();

    // Generar LaTeX
    let model = build_stress_model();
    let gen = LaTeXGenerator::new().unwrap();
    gen.generate(&model, &build_dir).unwrap();

    eprintln!("\n── Archivos generados ──────────────────────────────");
    for entry in walkdir_collect(&build_dir) {
        eprintln!("  {}", entry.strip_prefix(&build_dir).unwrap().display());
    }

    // Compilar: pasada 1
    let out1 = Command::new("latexmk")
        .args([
            "-xelatex",
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-synctex=1",
            "main.tex",
        ])
        .current_dir(&build_dir)
        .output()
        .expect("latexmk debe estar instalado");

    if !out1.status.success() {
        let stdout = String::from_utf8_lossy(&out1.stdout);
        let stderr = String::from_utf8_lossy(&out1.stderr);
        // Mostrar últimas 60 líneas del log
        let last_lines: Vec<_> = stdout.lines().rev().take(60).collect();
        eprintln!("\n── Error de compilación (últimas 60 líneas) ──────");
        for line in last_lines.iter().rev() {
            eprintln!("{}", line);
        }
        eprintln!("── stderr ──────────────────────────────────────────");
        eprintln!("{}", stderr);
        panic!("La compilación de la tesis falló. Ver log arriba.");
    }

    let pdf = build_dir.join("main.pdf");
    assert!(
        pdf.exists(),
        "main.pdf debe existir tras compilación exitosa"
    );

    let pdf_size = fs::metadata(&pdf).unwrap().len();
    eprintln!("\n✓ PDF generado exitosamente");
    eprintln!("  Ruta: {}", pdf.display());
    eprintln!("  Tamaño: {:.1} KB", pdf_size as f64 / 1024.0);

    // Contar páginas
    let page_count = count_pdf_pages(&pdf);
    eprintln!("  Páginas estimadas: {}", page_count);
    assert!(
        page_count >= 20,
        "La tesis debe tener al menos 20 páginas, tiene {}",
        page_count
    );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn walkdir_collect(dir: &Path) -> Vec<std::path::PathBuf> {
    let mut paths = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                paths.extend(walkdir_collect(&p));
            } else {
                paths.push(p);
            }
        }
    }
    paths.sort();
    paths
}

/// Cuenta páginas del PDF usando pdfinfo (más fiable que buscar en binario).
fn count_pdf_pages(pdf: &Path) -> usize {
    use std::process::Command;
    if let Ok(out) = Command::new("pdfinfo").arg(pdf).output() {
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            if line.starts_with("Pages:") {
                if let Some(n) = line.split_whitespace().nth(1) {
                    return n.parse().unwrap_or(0);
                }
            }
        }
    }
    0
}

// ── Bibliography ─────────────────────────────────────────────────────────────

const REFERENCES_BIB: &str = r#"
@misc{who2023water,
  author       = {{World Health Organization}},
  title        = {Drinking-Water Quality Guidelines},
  year         = {2023},
  edition      = {4},
  publisher    = {WHO Press},
  address      = {Geneva},
  note         = {Accessed: 2024-03-15}
}

@article{novoselov2004electric,
  author  = {Novoselov, Konstantin S. and Geim, Andre K. and Morozov, Sergei V.
             and Jiang, Da and Zhang, Yi and Dubonos, Sergei V.
             and Grigorieva, Irina V. and Firsov, Alexander A.},
  title   = {Electric Field Effect in Atomically Thin Carbon Films},
  journal = {Science},
  year    = {2004},
  volume  = {306},
  number  = {5696},
  pages   = {666--669},
  doi     = {10.1126/science.1102896}
}

@article{sitko2013graphene,
  author  = {Sitko, Rafał and Turek, Ewelina and Zawisza, Beata and
             Malicka, Ewa and Talik, Eugenia and Heimann, Jana and
             Gagor, Anna and Feist, Barbara and Wrzalik, Roman},
  title   = {Adsorption of divalent metal ions from aqueous solutions using
             graphene oxide},
  journal = {Dalton Transactions},
  year    = {2013},
  volume  = {42},
  pages   = {5682--5689},
  doi     = {10.1039/c3dt33097d}
}

@article{ahmad2020carbon,
  author  = {Ahmad, Zubair and Naeem, Abdul and Khan, Abdur Rauf},
  title   = {Activated carbon as an adsorbent for removal of heavy metals
             from aqueous solution: A review},
  journal = {Environmental Science and Pollution Research},
  year    = {2020},
  volume  = {27},
  pages   = {44095--44118},
  doi     = {10.1007/s11356-020-10332-8}
}

@article{yean2005magnetic,
  author  = {Yean, S. and Cong, L. and Yavuz, C.T. and Mayo, J.T. and
             Yu, W.W. and Kan, A.T. and Colvin, V.L. and Tomson, M.B.},
  title   = {Effect of magnetite particle size on adsorption and desorption
             of arsenite and arsenate},
  journal = {Journal of Materials Research},
  year    = {2005},
  volume  = {20},
  number  = {12},
  pages   = {3255--3264},
  doi     = {10.1557/jmr.2005.0403}
}

@article{lin2012zinc,
  author  = {Lin, Sheng and Lu, Dingfu and Liu, Zhiyuan},
  title   = {Removal of arsenic contaminants with magnetic $\gamma$-Fe$_2$O$_3$
             nanoparticles},
  journal = {Chemical Engineering Journal},
  year    = {2012},
  volume  = {211},
  pages   = {46--52},
  doi     = {10.1016/j.cej.2012.09.062}
}

@article{zhang2023future,
  author  = {Zhang, Wei and Xu, Keke and Qian, Liang and Lin, Jianhua},
  title   = {Future perspectives of graphene-based nanomaterials in water
             treatment: Challenges and opportunities},
  journal = {Separation and Purification Technology},
  year    = {2023},
  volume  = {315},
  pages   = {123726},
  doi     = {10.1016/j.seppur.2023.123726}
}

@article{hummers1958preparation,
  author  = {Hummers, William S. and Offeman, Richard E.},
  title   = {Preparation of graphitic oxide},
  journal = {Journal of the American Chemical Society},
  year    = {1958},
  volume  = {80},
  number  = {6},
  pages   = {1339--1339},
  doi     = {10.1021/ja01539a017}
}

@article{wang2019tio2,
  author  = {Wang, Huiling and Zhang, Xin and Xie, Anqing and Zhang, Jun and
             Ma, Pengcheng and Pan, Bing and Wu, Hao},
  title   = {{TiO$_2$}-graphene oxide composite as a photocatalytic platform},
  journal = {Nanoscale},
  year    = {2019},
  volume  = {11},
  pages   = {2599--2611},
  doi     = {10.1039/C8NR07088H}
}

@article{langmuir1916adsorption,
  author  = {Langmuir, Irving},
  title   = {The constitution and fundamental properties of solids and liquids.
             Part {I}. Solids},
  journal = {Journal of the American Chemical Society},
  year    = {1916},
  volume  = {38},
  number  = {11},
  pages   = {2221--2295},
  doi     = {10.1021/ja02268a002}
}

@article{freundlich1906adsorption,
  author  = {Freundlich, Herbert M.F.},
  title   = {Über die adsorption in l{\"o}sungen},
  journal = {Zeitschrift f{\"u}r Physikalische Chemie},
  year    = {1906},
  volume  = {57},
  pages   = {385--470}
}

@article{ho1999pseudo,
  author  = {Ho, Yuh-Shan and McKay, Gordon},
  title   = {Pseudo-second order model for sorption processes},
  journal = {Process Biochemistry},
  year    = {1999},
  volume  = {34},
  number  = {5},
  pages   = {451--465},
  doi     = {10.1016/S0032-9592(98)00112-5}
}

@techreport{norma2021127,
  author      = {{Secretar\'ia de Salud, M\'exico}},
  title       = {{NOM-127-SSA1-2021}: Agua para uso y consumo humano.
                 L\'imites permisibles de calidad del agua},
  institution = {Diario Oficial de la Federaci\'on},
  year        = {2021},
  address     = {Ciudad de M\'exico}
}

@book{strathmann2011membrane,
  author    = {Strathmann, Heiner},
  title     = {Introduction to Membrane Science and Technology},
  publisher = {Wiley-VCH},
  year      = {2011},
  address   = {Weinheim},
  isbn      = {978-3-527-32450-8}
}

@article{dreyer2010graphene,
  author  = {Dreyer, Daniel R. and Park, Sungjin and Bielawski, Christopher W.
             and Ruoff, Rodney S.},
  title   = {The chemistry of graphene oxide},
  journal = {Chemical Society Reviews},
  year    = {2010},
  volume  = {39},
  pages   = {228--240},
  doi     = {10.1039/B917103G}
}
"#;
