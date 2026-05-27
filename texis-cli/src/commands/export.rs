use anyhow::{bail, Result};
use std::path::Path;
use texis_core::{
    exporter::{create_delivery_package, DeliveryInput, DeliveryOptions},
    postflight::PdfChecker,
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
        LatexEngine::Xelatex  => "xelatex",
    };

    println!(
        "Exportando: '{}' — modo {} (motor: {})",
        model.metadata.title, mode.to_uppercase(), engine_str
    );

    // ── 2. Validación preflight ───────────────────────────────────
    println!("Ejecutando validación preflight…");
    let validation = Validator::new().validate(&model, project_dir)?;

    let error_count = validation.issues.iter()
        .filter(|i| matches!(i.severity, texis_core::validator::IssueSeverity::Error))
        .count();
    let warn_count = validation.issues.iter()
        .filter(|i| matches!(i.severity, texis_core::validator::IssueSeverity::Warning))
        .count();

    println!("  → {} error(es), {} aviso(s)", error_count, warn_count);

    // ── 3. Gate de modo ───────────────────────────────────────────
    if (mode == "review" || mode == "final") && error_count > 0 {
        let msgs: Vec<String> = validation.issues.iter()
            .filter(|i| matches!(i.severity, texis_core::validator::IssueSeverity::Error))
            .map(|i| format!("  ✗ [{}] {}", i.code, i.message))
            .collect();
        bail!(
            "Exportación bloqueada en modo '{}' — {} error(es) de validación:\n{}",
            mode, error_count, msgs.join("\n")
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
        let pf_errs = postflight.issues.iter()
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
            let msgs: Vec<String> = postflight.issues.iter()
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

    let input = DeliveryInput {
        project_dir,
        model: &model,
        // CLI no carga perfil por defecto — policy_report.json se omite si None.
        // En futuro: --profile-path flag para cargar perfil explícitamente.
        profile: None,
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
