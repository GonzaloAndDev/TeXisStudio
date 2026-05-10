// Tests de proyectos rotos — verifican que los errores son claros y accionables.

mod fixtures;

use texis_core::validator::Validator;

#[test]
fn broken_missing_image_produce_error_claro() {
    let (model, dir) = fixtures::broken_missing_image();
    let report = Validator::new().validate(&model, dir.path()).unwrap();

    assert!(report.has_errors(), "debe haber al menos un error");

    let err = report.errors().next().unwrap();
    assert!(
        err.message.contains("imagen") || err.message.contains("archivo") || err.message.contains("Imagen"),
        "el mensaje debe mencionar imagen o archivo: '{}'",
        err.message
    );
    assert!(err.suggestion.is_some(), "debe tener sugerencia de corrección");
}

#[test]
fn broken_missing_bib_produce_warning() {
    let (model, dir) = fixtures::broken_missing_bib();
    let report = Validator::new().validate(&model, dir.path()).unwrap();

    let has_bib_issue = report.issues.iter().any(|i| i.code.contains("BIB"));
    assert!(has_bib_issue, "debe haber warning de bibliografía faltante");

    let issue = report.issues.iter().find(|i| i.code.contains("BIB")).unwrap();
    assert!(issue.suggestion.is_some());
}

#[test]
fn broken_duplicate_label_produce_error() {
    let (model, dir) = fixtures::broken_duplicate_label();
    let report = Validator::new().validate(&model, dir.path()).unwrap();

    let has_dup = report.errors().any(|e| e.code.contains("DUPLICATE_LABEL"));
    assert!(has_dup, "debe detectar label duplicado");

    let err = report.errors().find(|e| e.code.contains("DUPLICATE_LABEL")).unwrap();
    assert!(err.suggestion.is_some());
}

#[test]
fn proyecto_valido_sin_errores() {
    use tempfile::tempdir;
    let dir = tempdir().unwrap();

    // Crear estructura mínima para que las validaciones técnicas pasen
    std::fs::create_dir_all(dir.path().join("content").join("figures")).unwrap();
    std::fs::create_dir_all(dir.path().join("content").join("bibliography")).unwrap();
    std::fs::write(
        dir.path().join("content").join("bibliography").join("references.bib"),
        "@article{test, author={Test}, title={Test}, year={2026}}",
    ).unwrap();

    let model = fixtures::generic_thesis_model();
    let report = Validator::new().validate(&model, dir.path()).unwrap();

    assert!(!report.has_errors(), "proyecto válido no debe tener errores: {:?}",
        report.errors().collect::<Vec<_>>());
}
