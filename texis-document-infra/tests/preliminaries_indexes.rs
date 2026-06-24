//! Etapa D — Preliminares e Índices: abstract/keywords, listas vacías,
//! profundidad y consistencia con el contenido real.

use texis_document_domain::ir::modules::{IndexKind, IndexList, PreliminaryKind};
use texis_document_domain::validation::{indexes, preliminaries};
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::import_project;

#[test]
fn sample_has_abstract_and_keywords() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    assert!(ir
        .preliminaries
        .items
        .iter()
        .any(|i| i.kind == PreliminaryKind::Abstract));
    let d = preliminaries::validate(&ir);
    assert!(!d.iter().any(|x| x.code.as_str() == "PRELIM-001"));
    assert!(!d.iter().any(|x| x.code.as_str() == "PRELIM-002"));
}

#[test]
fn missing_abstract_warns() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    ir.preliminaries
        .items
        .retain(|i| i.kind != PreliminaryKind::Abstract);
    let d = preliminaries::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "PRELIM-001"));
}

#[test]
fn indexes_match_content() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    // El fixture tiene figura, tabla y código → esas listas son válidas.
    let d = indexes::validate(&ir);
    assert!(
        !d.iter().any(|x| x.code.as_str() == "IDX-001"),
        "no debería haber listas vacías: {d:?}"
    );
}

#[test]
fn empty_list_enabled_warns() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    // Habilitar lista de algoritmos sin que existan algoritmos.
    ir.indexes.lists.push(IndexList {
        kind: IndexKind::ListOfAlgorithms,
        enabled: true,
        depth: None,
    });
    let d = indexes::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "IDX-001"));
}

#[test]
fn toc_depth_out_of_range_warns() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    for l in &mut ir.indexes.lists {
        if l.kind == IndexKind::TableOfContents {
            l.depth = Some(9);
        }
    }
    let d = indexes::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "IDX-003"));
}
