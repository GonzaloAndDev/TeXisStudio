use anyhow::Result;
use std::path::Path;
use texis_core::{project::loader::ProjectLoader, validator::Validator};

pub fn run_project(project_dir: &Path) -> Result<()> {
    let project_file = project_dir.join("tesis.project.yaml");
    let loader = ProjectLoader;
    let model = loader.load_from_file(&project_file)?;

    let validator = Validator::new();
    let report = validator.validate(&model, project_dir)?;

    if report.issues.is_empty() {
        println!("✓ Proyecto válido. Sin problemas detectados.");
        return Ok(());
    }

    let error_count = report.errors().count();
    let warn_count = report.warnings().count();
    let sug_count = report.suggestions().count();

    println!("Resultado de validación:");
    println!("  Errores:     {}", error_count);
    println!("  Advertencias:{}", warn_count);
    println!("  Sugerencias: {}", sug_count);
    println!();

    for issue in &report.issues {
        let prefix = match issue.severity {
            texis_core::validator::IssueSeverity::Error => "✗ ERROR",
            texis_core::validator::IssueSeverity::Warning => "⚠ WARN ",
            texis_core::validator::IssueSeverity::Suggestion => "→ SUGE ",
        };
        println!("[{}] [{}] {}", prefix, issue.code, issue.message);
        if let Some(sug) = &issue.suggestion {
            println!("      Sugerencia: {}", sug);
        }
    }

    if error_count > 0 {
        anyhow::bail!("El proyecto tiene {} error(es) de validación.", error_count);
    }

    Ok(())
}

pub fn run_pack(_pack_file: &Path) -> Result<()> {
    println!("Validación de paquetes de perfiles — Release 0.3");
    Ok(())
}
