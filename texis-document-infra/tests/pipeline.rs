//! Criterio de salida de la Etapa B (paso 3 del programa): el ensamblador nuevo
//! produce `main.tex` mediante el servicio único de build, el orden de fases es
//! canónico y el build es **determinista** (mismas entradas → mismo manifiesto).

use texis_document_application::{AssembleDocumentUseCase, BuildMode};
use texis_document_infra::fixtures::sample_thesis_ir;
use texis_document_infra::{JsonIrSerializer, LatexRenderBackend, Sha256Hasher};

fn assemble() -> texis_document_application::AssembledDocument {
    let ir = sample_thesis_ir();
    let use_case = AssembleDocumentUseCase::new(
        LatexRenderBackend::new(),
        JsonIrSerializer::compact(),
        Sha256Hasher,
    );
    // Final: el fixture con bibliografía real no tiene bloqueantes.
    use_case.execute(&ir, BuildMode::Final).expect("pipeline Final")
}

#[test]
fn assembler_emits_main_tex_with_canonical_phase_order() {
    let assembled = assemble();
    let main = assembled
        .rendered
        .main_tex()
        .expect("debe existir main.tex");

    assert!(main.contains("\\input{preamble}"));
    assert!(main.contains("\\begin{document}"));
    assert!(main.contains("\\end{document}"));

    // Orden canónico: portada < cuerpo < bibliografía.
    let cover = main.find("sections/cover").expect("cover");
    let body = main.find("sections/body").expect("body");
    let biblio = main.find("sections/bibliography").expect("bibliography");
    assert!(cover < body, "la portada debe ir antes del cuerpo");
    assert!(body < biblio, "el cuerpo debe ir antes de la bibliografía");

    // book ⇒ \frontmatter y \mainmatter.
    assert!(main.contains("\\frontmatter"));
    assert!(main.contains("\\mainmatter"));
    // Los anexos van tras \appendix.
    let appendix_cmd = main.find("\\appendix").expect("appendix cmd");
    let appendix_input = main.find("sections/appendices").expect("appendix input");
    assert!(appendix_cmd < appendix_input);
}

#[test]
fn preamble_resolves_packages_and_geometry() {
    let assembled = assemble();
    let preamble = assembled
        .rendered
        .files
        .iter()
        .find(|f| f.relative_path == "preamble.tex")
        .map(|f| f.content.as_str())
        .unwrap();

    assert!(preamble.contains("\\documentclass[12pt,oneside]{book}"));
    assert!(preamble.contains("\\usepackage[")); // geometry con opciones
    assert!(preamble.contains("geometry"));
    assert!(preamble.contains("biblatex")); // estilo bibliográfico resuelto
    assert!(preamble.contains("\\setmainfont{TeX Gyre Termes}")); // xelatex + fontspec
    assert!(preamble.contains("pdftitle=")); // metadatos PDF
}

#[test]
fn manifest_lists_inputs_and_artifacts() {
    let assembled = assemble();
    let m = &assembled.manifest;

    assert_eq!(m.document_id, "demo-thesis-001");
    assert_eq!(m.toolchain.engine, "xelatex");
    assert!(m.inputs.iter().any(|h| h.name == "document_ir"));
    // Un artefacto por cada archivo renderizado (preamble + fases + main).
    assert_eq!(m.artifacts.len(), assembled.rendered.files.len());
    assert!(m.artifacts.iter().all(|h| h.algorithm == "sha256"));
    assert!(!m.resolved_capabilities.is_empty());
}

#[test]
fn build_is_deterministic() {
    let a = assemble();
    let b = assemble();

    // Manifiestos idénticos (incluye hashes de entradas y artefactos).
    assert_eq!(a.manifest, b.manifest, "el manifiesto no es determinista");

    // Archivos renderizados idénticos.
    assert_eq!(a.rendered.files, b.rendered.files);

    // Plan idéntico.
    assert_eq!(a.plan.phases, b.plan.phases);
    assert_eq!(a.plan.packages, b.plan.packages);
}

#[test]
fn final_mode_blocks_unresolved_citation_draft_proceeds() {
    use texis_document_infra::import_project;
    // Importación cruda: cita turing1936 SIN entrada bibliográfica.
    let ir = import_project(&texis_document_infra::fixtures::sample_thesis())
        .value
        .unwrap();
    let use_case = AssembleDocumentUseCase::new(
        LatexRenderBackend::new(),
        JsonIrSerializer::compact(),
        Sha256Hasher,
    );

    // Final: bloquea (no inventa fuente).
    let final_res = use_case.execute(&ir, BuildMode::Final);
    assert!(final_res.is_err(), "Final debe bloquear cita sin resolver");
    let err = final_res.err().unwrap();
    assert!(err.diagnostics.iter().any(|d| d.code.as_str() == "BIB-001"));

    // Draft: procede igualmente (para iterar), con el diagnóstico presente.
    let draft = use_case
        .execute(&ir, BuildMode::Draft)
        .expect("Draft procede pese a diagnósticos");
    assert!(draft.diagnostics.iter().any(|d| d.code.as_str() == "BIB-001"));
    assert_eq!(draft.manifest.build_mode, "draft");
}

#[test]
fn plan_carries_capabilities() {
    let assembled = assemble();
    assert!(!assembled.plan.capabilities.is_empty());
    assert!(assembled
        .plan
        .capabilities
        .iter()
        .any(|c| c == "render.body"));
    assert!(!assembled.manifest.required_capabilities.is_empty());
}

#[test]
fn plan_packages_are_sorted_and_deduped() {
    let assembled = assemble();
    let names: Vec<&str> = assembled
        .plan
        .packages
        .packages
        .iter()
        .map(|p| p.name.as_str())
        .collect();
    let mut sorted = names.clone();
    sorted.sort_unstable();
    assert_eq!(names, sorted, "los paquetes deben estar ordenados");

    // graphicx (hay figura), amsmath (hay ecuación), listings (hay código).
    assert!(names.contains(&"graphicx"));
    assert!(names.contains(&"amsmath"));
    assert!(names.contains(&"listings"));
}
