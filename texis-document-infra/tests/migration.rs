//! Bloqueador #4 — migración semánticamente fiel: preserva fase y orden, no
//! duplica portada/índices y conserva la materia final como tal.

use texis_document_infra::fixtures::migration_fixture;
use texis_document_infra::import_project;

#[test]
fn cover_and_toc_are_not_demoted_to_preliminaries() {
    let resolution = import_project(&migration_fixture());
    let ir = resolution.value.as_ref().unwrap();

    // Front matter: portada e índice se omiten del contenedor de preliminares;
    // sólo queda el resumen.
    assert_eq!(ir.preliminaries.items.len(), 1);
    assert_eq!(
        ir.preliminaries.items[0].kind,
        texis_document_domain::ir::modules::PreliminaryKind::Abstract
    );

    // Se dejó constancia del salto (IMPORT-011) para portada e índice.
    let skipped = resolution
        .diagnostics
        .iter()
        .filter(|d| d.code.as_str() == "IMPORT-011")
        .count();
    assert_eq!(skipped, 2);
}

#[test]
fn back_matter_is_preserved_as_phase() {
    let ir = import_project(&migration_fixture()).value.unwrap();
    // El glosario back matter NO se vuelve preliminar: vive en back_matter.
    assert_eq!(ir.back_matter.sections.len(), 1);
    assert_eq!(
        ir.back_matter.sections[0].title.as_deref(),
        Some("Glosario")
    );
    // Y no se duplicó en preliminares.
    assert!(!ir
        .preliminaries
        .items
        .iter()
        .any(|i| i.id.as_str() == "sec-glosario"));
}

#[test]
fn structural_equivalence_counts_match() {
    let model = migration_fixture();
    let ir = import_project(&model).value.unwrap();

    // Conteo por fase legacy → IR (sin pérdida ni duplicación).
    let count = |pl| {
        model
            .sections
            .iter()
            .filter(|s| std::mem::discriminant(&s.placement) == std::mem::discriminant(&pl))
            .count()
    };
    use texis_core::project::model::SectionPlacement as P;
    assert_eq!(count(P::Body), ir.body.sections.len());
    assert_eq!(count(P::Appendix), ir.appendices.appendices.len());
    assert_eq!(count(P::BackMatter), ir.back_matter.sections.len());

    // IDs únicos entre fases: ninguna sección aparece en dos contenedores.
    let mut ids: Vec<&str> = Vec::new();
    ids.extend(ir.preliminaries.items.iter().map(|i| i.id.as_str()));
    ids.extend(ir.body.sections.iter().map(|s| s.id.as_str()));
    ids.extend(ir.appendices.appendices.iter().map(|a| a.id.as_str()));
    ids.extend(ir.back_matter.sections.iter().map(|s| s.id.as_str()));
    let mut sorted = ids.clone();
    sorted.sort_unstable();
    sorted.dedup();
    assert_eq!(ids.len(), sorted.len(), "hay IDs duplicados entre fases");
}
