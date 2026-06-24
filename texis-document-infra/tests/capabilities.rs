//! Plan 2 — Capacidades: resolución de requeridas vs. backend, faltantes e
//! incompatibilidades conocidas.

use texis_document_domain::backend::RenderBackend;
use texis_document_domain::capability_registry::{required_capabilities, resolve};
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::{import_project, LatexRenderBackend};

#[test]
fn latex_backend_satisfies_sample() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    let caps = LatexRenderBackend::new().capabilities();
    let res = resolve(&ir, &caps);
    assert!(res.fully_satisfiable, "faltan: {:?}", res.missing);
    assert!(!res.diagnostics.has_blocking());
}

#[test]
fn required_capabilities_reflect_content() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    let req = required_capabilities(&ir);
    use texis_document_contracts::capabilities::Capability;
    assert!(req.contains(&Capability::new("engine.xelatex")));
    assert!(req.contains(&Capability::new("render.body")));
    assert!(req.contains(&Capability::new("render.bibliography.biblatex")));
    assert!(req.contains(&Capability::new("render.appendices")));
}

#[test]
fn missing_capability_is_reported() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    // Backend que no declara nada ⇒ todo lo requerido falta.
    let empty = texis_document_domain::backend::BackendCapabilities {
        capabilities: Default::default(),
        backend_id: "null".into(),
    };
    let res = resolve(&ir, &empty);
    assert!(!res.fully_satisfiable);
    assert!(res.diagnostics.iter().any(|d| d.code.as_str() == "CAP-001"));
}

#[test]
fn pdflatex_custom_font_incompatibility() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    ir.profile.engine = "pdflatex".into();
    // main_font ya viene del fixture (TeX Gyre Termes).
    let caps = LatexRenderBackend::new().capabilities();
    let res = resolve(&ir, &caps);
    assert!(res.diagnostics.iter().any(|d| d.code.as_str() == "CAP-010"));
}
