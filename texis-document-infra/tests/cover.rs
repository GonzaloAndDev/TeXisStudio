//! Etapa C — Portada: validación de campos, firmas, overflow y render.

use texis_document_domain::ir::modules::CoverOverflowPolicy;
use texis_document_domain::validation::{cover, validate_document};
use texis_document_infra::fixtures::{sample_thesis, stress_cover_thesis};
use texis_document_infra::{import_project, LatexRenderBackend};
use texis_document_domain::backend::RenderBackend;
use texis_document_domain::plan_builder::PlanBuilder;

#[test]
fn sample_cover_validates_clean() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    let d = cover::validate(&ir.cover);
    assert!(d.is_empty(), "portada base con diagnósticos: {d:?}");
}

#[test]
fn committee_becomes_signatures() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    // 2 asesores + 2 sinodales = 4 firmas.
    assert_eq!(ir.cover.signatures.len(), 4);
    assert!(ir.cover.signatures.iter().any(|s| s.role == "Presidente"));
}

#[test]
fn stress_cover_warns_overflow_but_not_blocking() {
    let ir = import_project(&stress_cover_thesis()).value.unwrap();
    let d = validate_document(&ir);
    // Política por defecto: advertencia, no bloqueo.
    assert!(d.iter().any(|x| x.code.as_str() == "COVER-010"));
    assert!(!d.has_blocking());
    // 4 asesores + 7 sinodales = 11 autoridades.
    assert_eq!(ir.cover.authorities.len(), 11);
}

#[test]
fn fail_loud_policy_blocks_overflow() {
    let mut ir = import_project(&stress_cover_thesis()).value.unwrap();
    ir.cover.overflow_policy = CoverOverflowPolicy::FailLoud;
    let d = validate_document(&ir);
    assert!(d.has_blocking());
}

#[test]
fn render_emits_signature_page() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    let plan = PlanBuilder::new().build(&ir);
    let rendered = LatexRenderBackend::new().render_document(&ir, &plan);
    let cover = rendered
        .files
        .iter()
        .find(|f| f.relative_path == "sections/cover.tex")
        .unwrap();
    assert!(cover.content.contains("Acta de aprobación"));
    assert!(cover.content.contains("Dr. Alan Turing"));
}
