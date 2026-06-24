//! Criterio de salida de la Etapa A: una tesis legacy se importa y produce un
//! `DocumentIR` válido (invariantes OK, sin diagnósticos bloqueantes), y el IR
//! serializa/deserializa sin pérdida.

use texis_document_application::ports::IrSerializer;
use texis_document_application::ImportProjectUseCase;
use texis_document_domain::ir::body_node::BodyNode;
use texis_document_domain::ir::meta::{AcademicLevel, DocumentKind};
use texis_document_domain::ir::DocumentIR;
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::{import_project, JsonIrSerializer, LegacyProjectImporter};

#[test]
fn sample_thesis_imports_to_valid_ir() {
    let resolution = import_project(&sample_thesis());
    let ir = resolution.value.as_ref().expect("debe producir un IR");

    // Sin diagnósticos bloqueantes y, por tanto, usable.
    assert!(
        !resolution.diagnostics.has_blocking(),
        "diagnósticos bloqueantes inesperados: {:?}",
        resolution.diagnostics
    );

    // Invariantes del IR (§5.1).
    let invariants = ir.check_invariants();
    assert!(
        invariants.is_empty(),
        "violaciones de invariante: {:?}",
        invariants
    );
}

#[test]
fn use_case_runs_full_validation() {
    // El caso de uso corre validación completa: el fixture cita turing1936 sin
    // entrada en el modelo legacy, así que debe surgir BIB-001 (cita sin
    // resolver) y el resultado NO es usable para revisión/final. Las fuentes
    // nunca se inventan.
    let use_case = ImportProjectUseCase::new(LegacyProjectImporter::new());
    let resolution = use_case.execute(sample_thesis());
    assert!(resolution.value.is_some(), "el IR se produce igualmente");
    assert!(resolution
        .diagnostics
        .iter()
        .any(|d| d.code.as_str() == "BIB-001"));
    assert!(!resolution.is_usable());
}

#[test]
fn import_preserves_semantics() {
    let ir = import_project(&sample_thesis()).value.unwrap();

    // Metadatos canónicos (sin aliases legacy).
    assert_eq!(ir.metadata.document_kind, DocumentKind::GraduateThesis);
    assert_eq!(ir.metadata.academic_level, AcademicLevel::Doctorate);

    // Portada: dos asesores + dos miembros de comité = 4 autoridades.
    assert_eq!(ir.cover.authorities.len(), 4);
    assert!(ir.cover.institution.logo.is_some());

    // Cuerpo: un capítulo con una subsección.
    assert_eq!(ir.body.sections.len(), 1);
    assert_eq!(ir.body.sections[0].children.len(), 1);

    // Anexo presente (fase canónica propia, no back matter).
    assert_eq!(ir.appendices.appendices.len(), 1);

    // Preliminares (resumen + agradecimientos) importados desde FrontMatter.
    assert_eq!(ir.preliminaries.items.len(), 2);

    // El papel se normaliza a canónico.
    assert_eq!(ir.profile.page_geometry.paper, "a4");

    // Bibliografía desde configuración.
    assert_eq!(ir.bibliography.style, "apa7");

    // La figura registró su asset en el grafo de recursos.
    let fig_assets = ir
        .resources
        .assets
        .iter()
        .filter(|a| matches!(a.role, texis_document_contracts::assets::AssetRole::Figure))
        .count();
    assert_eq!(fig_assets, 1);

    // Paquetes de la configuración + babel con opciones.
    assert!(ir.resources.packages.iter().any(|p| p.name == "babel"));

    // Un nodo de ecuación con LaTeX intencional preservado.
    let has_equation = ir
        .all_body_nodes()
        .iter()
        .any(|n| matches!(n, BodyNode::Equation(e) if e.latex == "E = mc^2"));
    assert!(has_equation);
}

#[test]
fn ir_round_trips_through_json() {
    let ir = import_project(&sample_thesis()).value.unwrap();
    let serializer = JsonIrSerializer::pretty();
    let json = serializer.serialize(&ir).expect("serializa");

    let back: DocumentIR = serde_json::from_str(&json).expect("deserializa");
    assert_eq!(ir, back, "el IR no sobrevive el round-trip JSON");
}

#[test]
fn absolute_logo_path_is_normalized_with_diagnostic() {
    let mut model = sample_thesis();
    model.institution.logo_path = Some("/Users/x/secret/logo.png".into());

    let resolution = import_project(&model);
    let ir = resolution.value.as_ref().unwrap();

    // La invariante de "sin rutas absolutas" se mantiene.
    assert!(ir.check_invariants().is_empty());
    assert!(ir.resources.assets.iter().all(|a| a.path_is_relative()));

    // Se registró el diagnóstico de normalización (no bloqueante).
    assert!(resolution
        .diagnostics
        .iter()
        .any(|d| d.code.as_str() == "IMPORT-001"));
    assert!(!resolution.diagnostics.has_blocking());
}
