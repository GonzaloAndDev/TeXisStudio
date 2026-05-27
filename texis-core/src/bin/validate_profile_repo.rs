// Valida todos los perfiles en un repositorio de TeXisStudio-Profiles usando
// el ProfilePolicyValidator del core.
//
// Uso (desde la raíz del workspace TeXisStudio):
//   cargo run --package texis-core --bin validate_profile_repo -- \
//     --profiles-root /path/to/TeXisStudio-Profiles \
//     [--catalog dist/catalog.json]
//
// También se puede invocar desde TeXisStudio-Profiles/.github/workflows/validate.yml:
//   cargo run --package texis-core --bin validate_profile_repo -- \
//     --profiles-root . --catalog dist/catalog.json
//
// Salida:
//   - Lista todos los perfiles procesados con su resultado
//   - Exit 0 si no hay errores de política en ningún perfil
//   - Exit 1 si al menos un perfil tiene errores de política
//
// Propósito: Propuesta B del Audit v2.2 — una sola fuente de verdad para
// las reglas institucionales. Reemplaza las reglas Python duplicadas en CI.

use std::path::PathBuf;
use texis_core::profile::{model::Profile, ProfilePolicyValidator};

fn main() {
    let args: Vec<String> = std::env::args().collect();

    let mut profiles_root = PathBuf::from(".");
    let mut catalog_path: Option<PathBuf> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--profiles-root" => {
                i += 1;
                if let Some(v) = args.get(i) {
                    profiles_root = PathBuf::from(v);
                }
            }
            "--catalog" => {
                i += 1;
                if let Some(v) = args.get(i) {
                    catalog_path = Some(profiles_root.join(v));
                }
            }
            _ => {}
        }
        i += 1;
    }

    if !profiles_root.exists() {
        eprintln!("ERROR: --profiles-root '{}' no existe.", profiles_root.display());
        std::process::exit(2);
    }

    // Cargar IDs del catalog.json si se provee
    let catalog_ids: Option<Vec<String>> = catalog_path.as_ref().and_then(|p| {
        if !p.exists() {
            eprintln!("WARN: --catalog '{}' no existe. Se omite validación de catálogo.", p.display());
            return None;
        }
        let text = std::fs::read_to_string(p).ok()?;
        let json: serde_json::Value = serde_json::from_str(&text).ok()?;
        let ids = json["profiles"]
            .as_array()?
            .iter()
            .filter_map(|e| e["id"].as_str().map(|s| s.to_string()))
            .collect::<Vec<_>>();
        println!("Catálogo cargado: {} perfiles registrados.", ids.len());
        Some(ids)
    });

    // Buscar profile.yaml en profundidad 4: continent/country/institution/style_id/
    let mut total = 0usize;
    let mut total_errors = 0usize;
    let mut total_warnings = 0usize;
    let mut profiles_with_errors: Vec<String> = Vec::new();

    for entry in walkdir::WalkDir::new(&profiles_root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name() == "profile.yaml")
    {
        let profile_path = entry.path();

        // Calcular profundidad relativa al root — solo procesar profundidad 4
        let rel = match profile_path.strip_prefix(&profiles_root) {
            Ok(r) => r,
            Err(_) => continue,
        };
        let depth = rel.components().count();
        // profile.yaml está en: continent/country/institution/style_id/profile.yaml → 5 componentes
        if depth != 5 {
            continue;
        }

        let yaml_text = match std::fs::read_to_string(profile_path) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("ERROR leyendo {:?}: {}", profile_path, e);
                total_errors += 1;
                continue;
            }
        };

        let profile: Profile = match serde_yaml::from_str(&yaml_text) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("ERROR parsing {:?}: {}", profile_path, e);
                total_errors += 1;
                continue;
            }
        };

        let report = match &catalog_ids {
            Some(ids) => ProfilePolicyValidator::validate_with_catalog(&profile, ids),
            None => ProfilePolicyValidator::validate(&profile),
        };

        total += 1;
        let profile_display = profile_path
            .strip_prefix(&profiles_root)
            .unwrap_or(profile_path)
            .display()
            .to_string();

        if report.issues.is_empty() {
            println!("  ✓  {}  ({})", report.profile_id, profile_display);
        } else {
            let errs = report.issues.iter().filter(|i| i.severity == texis_core::profile::policy::PolicySeverity::Error).count();
            let warns = report.issues.iter().filter(|i| i.severity == texis_core::profile::policy::PolicySeverity::Warning).count();

            if errs > 0 {
                println!("  ✗  {}  ({})  → {} error(s), {} warning(s)", report.profile_id, profile_display, errs, warns);
                profiles_with_errors.push(report.profile_id.clone());
            } else {
                println!("  ⚠  {}  ({})  → {} warning(s)", report.profile_id, profile_display, warns);
            }

            for issue in &report.issues {
                let prefix = match issue.severity {
                    texis_core::profile::policy::PolicySeverity::Error   => "    [ERROR]  ",
                    texis_core::profile::policy::PolicySeverity::Warning => "    [WARN]   ",
                    texis_core::profile::policy::PolicySeverity::Info    => "    [INFO]   ",
                };
                println!("{}{}: {}", prefix, issue.code, issue.message);
            }

            total_errors += errs;
            total_warnings += warns;
        }
    }

    println!();
    println!(
        "Resumen: {} perfiles validados, {} errores, {} advertencias",
        total, total_errors, total_warnings
    );

    if total == 0 {
        eprintln!("WARN: No se encontraron perfiles en '{}'. Verificar --profiles-root.", profiles_root.display());
        std::process::exit(2);
    }

    if !profiles_with_errors.is_empty() {
        eprintln!();
        eprintln!("Perfiles con errores:");
        for id in &profiles_with_errors {
            eprintln!("  - {}", id);
        }
        std::process::exit(1);
    }

    println!("OK — todos los perfiles pasan la validación de política.");
    std::process::exit(0);
}
