use anyhow::{bail, Result};
use std::path::{Path, PathBuf};
use texis_core::{
    exporter::{create_delivery_package, DeliveryInput, DeliveryOptions},
    postflight::PdfChecker,
    profile::loader::ProfileLoader,
    project::{loader::ProjectLoader, model::LatexEngine},
    validator::Validator,
};

pub fn run_profile(_profile_id: &str, _output: &Path) -> Result<()> {
    println!("Exportación de perfiles — Release 0.3");
    Ok(())
}

/// Genera el paquete de entrega final para un proyecto TeXisStudio.
///
/// Ejecuta:
///  1. Carga del proyecto
///  2. Validación preflight
///  3. Gate de modo (review/final bloquea en errores)
///  4. Postflight del PDF compilado
///  5. Generación del ZIP con todos los artefactos de evidencia
///
/// Uso:
///   texis export-delivery <project_dir> [--output <dir>] [--mode draft|review|final]
pub fn run_delivery(project_dir: &Path, output_dir: &Path, mode: &str) -> Result<()> {
    let project_yaml = project_dir.join("tesis.project.yaml");
    if !project_yaml.exists() {
        bail!(
            "No se encontró tesis.project.yaml en '{}'.\n\
             Verifica que la ruta apunta al directorio del proyecto.",
            project_dir.display()
        );
    }

    // ── 1. Cargar proyecto ────────────────────────────────────────
    let loader = ProjectLoader;
    let model = loader.load_from_file(&project_yaml)?;
    let engine_str = match model.latex_config.engine {
        LatexEngine::Pdflatex => "pdflatex",
        LatexEngine::Lualatex => "lualatex",
        LatexEngine::Xelatex => "xelatex",
    };

    println!(
        "Exportando: '{}' — modo {} (motor: {})",
        model.metadata.title,
        mode.to_uppercase(),
        engine_str
    );

    // ── 2. Validación preflight ───────────────────────────────────
    println!("Ejecutando validación preflight…");
    let validation = Validator::new().validate(&model, project_dir)?;

    let error_count = validation
        .issues
        .iter()
        .filter(|i| matches!(i.severity, texis_core::validator::IssueSeverity::Error))
        .count();
    let warn_count = validation
        .issues
        .iter()
        .filter(|i| matches!(i.severity, texis_core::validator::IssueSeverity::Warning))
        .count();

    println!("  → {} error(es), {} aviso(s)", error_count, warn_count);

    // ── 3. Gate de modo ───────────────────────────────────────────
    if (mode == "review" || mode == "final") && error_count > 0 {
        let msgs: Vec<String> = validation
            .issues
            .iter()
            .filter(|i| matches!(i.severity, texis_core::validator::IssueSeverity::Error))
            .map(|i| format!("  ✗ [{}] {}", i.code, i.message))
            .collect();
        bail!(
            "Exportación bloqueada en modo '{}' — {} error(es) de validación:\n{}",
            mode,
            error_count,
            msgs.join("\n")
        );
    }

    // ── 4. Postflight del PDF ─────────────────────────────────────
    let pdf_path = project_dir.join("build").join("main.pdf");
    if !pdf_path.exists() {
        if mode == "final" {
            bail!(
                "Exportación final bloqueada — no existe PDF compilado en build/main.pdf.\n\
                 Ejecuta 'texis compile {}' primero.",
                project_dir.display()
            );
        }
        println!(
            "  → PDF no encontrado (modo {}); el ZIP no incluirá thesis.pdf.",
            mode
        );
    }

    println!("Ejecutando postflight PDF…");
    let postflight = PdfChecker::check(&pdf_path);

    if postflight.pdf_exists {
        let pf_errs = postflight
            .issues
            .iter()
            .filter(|i| matches!(i.severity, texis_core::postflight::PdfIssueSeverity::Error))
            .count();
        println!(
            "  → postflight: {} — fuentes: {}",
            if postflight.passed { "OK" } else { "FALLÓ" },
            if postflight.all_fonts_embedded {
                "todas incrustadas"
            } else {
                "ADVERTENCIA: fuentes no incrustadas"
            }
        );
        if mode == "final" && pf_errs > 0 {
            let msgs: Vec<String> = postflight
                .issues
                .iter()
                .filter(|i| matches!(i.severity, texis_core::postflight::PdfIssueSeverity::Error))
                .map(|i| format!("  ✗ [{}] {}", i.code, i.message))
                .collect();
            bail!(
                "Exportación final bloqueada — {} problema(s) en el PDF:\n{}",
                pf_errs,
                msgs.join("\n")
            );
        }
    }

    // ── 5. Generar ZIP ────────────────────────────────────────────
    std::fs::create_dir_all(output_dir)?;

    // Intentar cargar el perfil para incluir policy_report.json en el ZIP.
    // Busca en TEXIS_PROFILES_PATH (env) o en <workspace>/profiles/<profile_id>/profile.yaml.
    let profile_opt = load_profile_for_model(&model.profile_id);

    let input = DeliveryInput {
        project_dir,
        model: &model,
        profile: profile_opt.as_ref(),
        validation: &validation,
        postflight: &postflight,
    };
    let options = DeliveryOptions {
        output_dir,
        mode,
        app_version: env!("CARGO_PKG_VERSION"),
    };

    println!("Generando paquete de entrega…");
    let result = create_delivery_package(&input, &options)?;

    println!(
        "\n✓ Paquete generado: {}\n  → Modo:              {}\n  → Errores preflight: {}\n  → Postflight PDF:    {}\n  → Fuentes:           {}",
        result.zip_path.display(),
        result.export_mode.to_uppercase(),
        result.validation_errors,
        if result.postflight_passed { "OK" } else { "FALLÓ" },
        if result.all_fonts_embedded {
            "todas incrustadas"
        } else {
            "ADVERTENCIA: no incrustadas"
        },
    );

    Ok(())
}

/// Intenta cargar el perfil institucional a partir del profile_id del modelo.
///
/// Busca en:
///   1. TEXIS_PROFILES_PATH env → busca recursivamente profile.yaml con el id correcto
///   2. profiles/<profile_id>/profile.yaml relativo al workspace de cargo
fn load_profile_for_model(profile_id: &str) -> Option<texis_core::profile::model::Profile> {
    for path in profile_search_paths(profile_id) {
        if path.exists() {
            if let Ok(p) = ProfileLoader.load_from_file(&path) {
                return Some(p);
            }
        }
    }
    None
}

fn profile_search_paths(profile_id: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    // 1. TEXIS_PROFILES_PATH env (CI y desarrollo)
    if let Ok(base) = std::env::var("TEXIS_PROFILES_PATH") {
        let root = PathBuf::from(&base);
        // Atajo directo (estructura plana tipo profiles/<id>/profile.yaml)
        paths.push(root.join(profile_id).join("profile.yaml"));
        // Búsqueda recursiva en árbol continent/country/institution/style
        if let Ok(found) = glob_profile_yaml(&root, profile_id) {
            paths.extend(found);
        }
    }

    // 2. profiles/ relativo al workspace de cargo (desarrollo local)
    let workspace_profiles = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join("profiles"))
        .unwrap_or_else(|| PathBuf::from("profiles"));
    paths.push(workspace_profiles.join(profile_id).join("profile.yaml"));

    paths
}

/// Busca recursivamente (máx 5 niveles) un profile.yaml cuyo campo `id` sea profile_id.
fn glob_profile_yaml(root: &Path, profile_id: &str) -> std::io::Result<Vec<PathBuf>> {
    let mut found = Vec::new();
    visit_profile_dirs(root, 0, 5, profile_id, &mut found)?;
    Ok(found)
}

fn visit_profile_dirs(
    dir: &Path,
    depth: usize,
    max_depth: usize,
    profile_id: &str,
    found: &mut Vec<PathBuf>,
) -> std::io::Result<()> {
    if depth > max_depth {
        return Ok(());
    }
    let candidate = dir.join("profile.yaml");
    if candidate.exists() {
        if let Ok(content) = std::fs::read_to_string(&candidate) {
            if content.contains(&format!("id: {}", profile_id))
                || content.contains(&format!("id: \"{}\"", profile_id))
            {
                found.push(candidate);
                return Ok(());
            }
        }
    }
    if depth < max_depth {
        for entry in std::fs::read_dir(dir)?.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                visit_profile_dirs(&entry.path(), depth + 1, max_depth, profile_id, found)?;
            }
        }
    }
    Ok(())
}
