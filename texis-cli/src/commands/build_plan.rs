//! Comando `build-plan`: ejecuta el servicio único de build del núcleo nuevo
//! (import → plan → render → manifiesto) y emite el resultado. No compila a PDF
//! ni toca el generador legacy de producción (Etapa B).
//!
//! Por defecto imprime `main.tex`; con `--manifest` imprime el manifiesto de
//! build (JSON determinista) útil para CI.

use anyhow::Result;
use std::path::Path;
use texis_core::project::loader::ProjectLoader;
use texis_document_application::{AssembleDocumentUseCase, BuildMode};
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::{
    import_project, import_project_from_root, JsonIrSerializer, LatexRenderBackend, Sha256Hasher,
};

pub fn run(project_dir: &Path, demo: bool, manifest: bool) -> Result<()> {
    let model = if demo {
        sample_thesis()
    } else {
        ProjectLoader.load_from_file(&project_dir.join("tesis.project.yaml"))?
    };

    let resolution = if demo {
        import_project(&model)
    } else {
        import_project_from_root(&model, project_dir)
    };
    let ir = resolution
        .value
        .ok_or_else(|| anyhow::anyhow!("la importación no produjo un DocumentIR"))?;

    let use_case = AssembleDocumentUseCase::new(
        LatexRenderBackend::new(),
        JsonIrSerializer::compact(),
        Sha256Hasher,
    );
    // Modo Draft: renderiza para inspección aunque haya diagnósticos (sin
    // inventar nada). Para entrega real se usa Review/Final (bloqueantes).
    let assembled = use_case
        .execute(&ir, BuildMode::Draft)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    // Diagnósticos del pipeline (validación + políticas + capacidades) a stderr.
    for d in resolution.diagnostics.iter() {
        eprintln!("[{:?}] {} {}", d.severity, d.code.as_str(), d.message_key);
    }
    for d in assembled.diagnostics.iter() {
        eprintln!("[{:?}] {} {}", d.severity, d.code.as_str(), d.message_key);
    }

    if manifest {
        let json = serde_json::to_string_pretty(&assembled.manifest)?;
        println!("{json}");
    } else {
        let main = assembled
            .rendered
            .main_tex()
            .ok_or_else(|| anyhow::anyhow!("el render no produjo main.tex"))?;
        println!("{main}");
    }
    Ok(())
}
