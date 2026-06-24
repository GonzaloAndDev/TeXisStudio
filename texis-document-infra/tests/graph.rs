//! Plan 2 — Grafo incremental: invalidación por dependencias.

use texis_document_domain::graph::{BuildNode, DependencyGraph};
use texis_document_domain::phase::DocumentPhase;
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::import_project;

#[test]
fn changing_body_invalidates_indexes_bib_and_document() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    let g = DependencyGraph::build(&ir);

    let inval = g.invalidation_set(&BuildNode::Phase(DocumentPhase::MainMatter));

    // El cambio del cuerpo invalida índices, bibliografía y el documento final.
    assert!(inval.contains(&BuildNode::Phase(DocumentPhase::Indexes)));
    assert!(inval.contains(&BuildNode::Bibliography));
    assert!(inval.contains(&BuildNode::Phase(DocumentPhase::BackMatter)));
    assert!(inval.contains(&BuildNode::Document));
}

#[test]
fn changing_cover_does_not_invalidate_bibliography() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    let g = DependencyGraph::build(&ir);

    let inval = g.invalidation_set(&BuildNode::Phase(DocumentPhase::Cover));
    // La portada solo afecta al documento final, no a la bibliografía ni índices.
    assert!(inval.contains(&BuildNode::Document));
    assert!(!inval.contains(&BuildNode::Bibliography));
    assert!(!inval.contains(&BuildNode::Phase(DocumentPhase::Indexes)));
}

#[test]
fn preamble_change_invalidates_everything() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    let g = DependencyGraph::build(&ir);

    let inval = g.invalidation_set(&BuildNode::Preamble);
    // El preámbulo es dependencia de todas las fases ⇒ invalida el documento.
    assert!(inval.contains(&BuildNode::Document));
    assert!(inval.contains(&BuildNode::Phase(DocumentPhase::MainMatter)));
}
