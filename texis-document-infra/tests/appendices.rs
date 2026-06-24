//! Etapa G — Anexos: labels únicos, anexos vacíos, títulos y orden canónico.

use texis_document_domain::ir::modules::Appendix;
use texis_document_domain::phase::DocumentPhase;
use texis_document_domain::plan_builder::PlanBuilder;
use texis_document_domain::validation::appendices;
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::import_project;

#[test]
fn sample_appendix_is_clean() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    let d = appendices::validate(&ir);
    assert!(!d.has_blocking(), "{d:?}");
}

#[test]
fn duplicate_appendix_label_is_error() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    let first = ir.appendices.appendices[0].clone();
    let mut dup = Appendix {
        id: "apx-dup".into(),
        ..first
    };
    dup.title = Some("Otro anexo".into());
    ir.appendices.appendices.push(dup); // mismo label anx:code
    let d = appendices::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "APX-003"));
    assert!(d.has_blocking());
}

#[test]
fn empty_appendix_warns() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    ir.appendices.appendices.push(Appendix {
        id: "apx-empty".into(),
        title: Some("Vacío".into()),
        label: Some("anx:empty".into()),
        nodes: vec![],
        children: vec![],
    });
    let d = appendices::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "APX-002"));
}

#[test]
fn appendices_phase_precedes_back_matter() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    let plan = PlanBuilder::new().build(&ir);
    let order: Vec<DocumentPhase> = plan.phases.iter().map(|p| p.phase).collect();
    let apx = order.iter().position(|p| *p == DocumentPhase::Appendices);
    let back = order.iter().position(|p| *p == DocumentPhase::BackMatter);
    if let (Some(a), Some(b)) = (apx, back) {
        assert!(a < b, "los anexos deben preceder a la materia final");
    }
}
