//! Pruebas de arquitectura (§16.1): las fronteras de dependencias se comprueban
//! automáticamente. El grafo de crates ya impide físicamente la mayoría de las
//! violaciones; este test añade una red de seguridad legible que falla con un
//! mensaje claro si alguien introduce una dependencia prohibida en el dominio.

use std::path::PathBuf;

/// Crates que el dominio NUNCA debe declarar como dependencia (§16.1):
/// serialización de formatos, plantillas, filesystem-heavy, red, UI, backend.
const FORBIDDEN_IN_DOMAIN: &[&str] = &[
    "serde_yaml",
    "serde_json",
    "minijinja",
    "walkdir",
    "zip",
    "jsonschema",
    "reqwest",
    "tauri",
    "texis-core",
    "texis-document-application",
    "texis-document-infra",
];

fn read_manifest(crate_dir: &str) -> String {
    // CARGO_MANIFEST_DIR apunta a texis-document-domain/.
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop(); // -> raíz del workspace
    path.push(crate_dir);
    path.push("Cargo.toml");
    std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", path.display()))
}

/// Extrae las claves de dependencia de la sección `[dependencies]` (ignora
/// comentarios y otras secciones).
fn dependency_names(manifest: &str) -> Vec<String> {
    let mut names = Vec::new();
    let mut in_deps = false;
    for raw in manifest.lines() {
        let line = raw.trim();
        if line.starts_with('[') {
            in_deps = line == "[dependencies]";
            continue;
        }
        if !in_deps || line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((name, _)) = line.split_once('=') {
            names.push(name.trim().to_string());
        }
    }
    names
}

#[test]
fn domain_has_no_forbidden_dependencies() {
    let manifest = read_manifest("texis-document-domain");
    let deps = dependency_names(&manifest);
    for forbidden in FORBIDDEN_IN_DOMAIN {
        assert!(
            !deps.iter().any(|d| d == forbidden),
            "el dominio no puede depender de `{forbidden}` (§16.1). Deps: {deps:?}"
        );
    }
}

#[test]
fn domain_only_depends_on_contracts_and_serde() {
    let manifest = read_manifest("texis-document-domain");
    let deps = dependency_names(&manifest);
    for dep in &deps {
        assert!(
            dep == "texis-document-contracts" || dep == "serde",
            "dependencia inesperada en el dominio: `{dep}`. Solo se permiten \
             `texis-document-contracts` y `serde`."
        );
    }
}

#[test]
fn contracts_has_no_internal_dependencies() {
    // El Shared Kernel es la base del grafo: no depende de ningún otro crate
    // interno del núcleo documental (§16.2).
    let manifest = read_manifest("texis-document-contracts");
    let deps = dependency_names(&manifest);
    for dep in &deps {
        assert!(
            !dep.starts_with("texis-"),
            "contracts no puede depender de crates internos: `{dep}`"
        );
    }
}

#[test]
fn application_does_not_depend_on_infra() {
    // La aplicación depende del dominio, no de la infraestructura (§16.1).
    let manifest = read_manifest("texis-document-application");
    let deps = dependency_names(&manifest);
    assert!(
        !deps.iter().any(|d| d == "texis-document-infra"),
        "la aplicación no puede depender de infraestructura. Deps: {deps:?}"
    );
}
