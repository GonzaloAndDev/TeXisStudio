// Genera schemas/profile.v1.0.0.json desde el struct Profile de texis-core.
//
// Uso:
//   cargo run --package texis-core --bin generate_schema
//
// El schema generado garantiza que nunca queda desincronizado del modelo Rust (D4).
// Solo se edita el modelo; el schema se genera automáticamente.

fn main() {
    use schemars::schema_for;
    use texis_core::profile::model::Profile;

    let schema = schema_for!(Profile);
    let json = serde_json::to_string_pretty(&schema)
        .expect("schema serialization failed");

    // Determinar la ruta de salida
    let workspace_root = std::env::var("CARGO_MANIFEST_DIR")
        .map(std::path::PathBuf::from)
        .expect("CARGO_MANIFEST_DIR not set")
        .parent()
        .expect("no parent of manifest dir")
        .to_path_buf();

    let schemas_dir = workspace_root.join("schemas");
    std::fs::create_dir_all(&schemas_dir).expect("cannot create schemas/");

    let out_path = schemas_dir.join("profile.v1.0.0.json");
    std::fs::write(&out_path, &json).expect("cannot write schema");

    println!("Schema generado: {}", out_path.display());
    println!("Tamaño: {} bytes", json.len());
}
