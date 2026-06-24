//! Etapa F — Bibliografía profesional: parseo/normalización, citas resueltas,
//! campos obligatorios, compatibilidad estilo/backend y estilos soportados.

use texis_document_domain::ir::modules::BibliographyBackend;
use texis_document_domain::validation::bibliography;
use texis_document_infra::bibtex_parser;
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::import_project;

const SAMPLE_BIB: &str = r#"
@article{turing1936,
  author = {Alan M. Turing},
  title  = {On Computable Numbers},
  journal= {Proc. London Math. Soc.},
  year   = {1936}
}
"#;

#[test]
fn resolved_citation_passes() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    ir.bibliography.entries = bibtex_parser::parse(SAMPLE_BIB);
    // El fixture cita turing1936, que ahora existe.
    let d = bibliography::validate(&ir);
    assert!(!d.iter().any(|x| x.code.as_str() == "BIB-001"), "{d:?}");
}

#[test]
fn unresolved_citation_is_error() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    // Entradas presentes pero sin la clave citada.
    ir.bibliography.entries =
        bibtex_parser::parse("@book{otra, title={X}, author={Y}, publisher={Z}, year={2000}}");
    let d = bibliography::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "BIB-001"));
    assert!(d.has_blocking());
}

#[test]
fn missing_required_field_warns() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    // article sin journal.
    ir.bibliography.entries =
        bibtex_parser::parse("@article{x, author={A}, title={T}, year={2020}}");
    let d = bibliography::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "BIB-003"
        && x.params.get("field").map(|s| s.as_str()) == Some("journal")));
}

#[test]
fn style_backend_incompatibility_is_error() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    ir.bibliography.style = "apa7".into();
    ir.bibliography.backend = Some(BibliographyBackend::Bibtex); // apa7 exige biber
    ir.bibliography.entries = bibtex_parser::parse(SAMPLE_BIB);
    let d = bibliography::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "BIB-004"));
}

#[test]
fn unsupported_style_warns() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    ir.bibliography.style = "inventado".into();
    let d = bibliography::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "BIB-005"));
}

#[test]
fn duplicate_keys_error() {
    let mut ir = import_project(&sample_thesis()).value.unwrap();
    ir.bibliography.entries = bibtex_parser::parse(
        "@book{k, title={A}, author={B}, publisher={C}, year={2001}}\n@book{k, title={D}, author={E}, publisher={F}, year={2002}}",
    );
    let d = bibliography::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "BIB-002"));
}
