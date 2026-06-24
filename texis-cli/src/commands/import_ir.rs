//! Comando `import-ir`: importa un proyecto legacy al nuevo `DocumentIR` y lo
//! emite como JSON. Pieza de CI del corte vertical de la Etapa A (§5.1: el IR
//! puede serializarse para depuración y CI).
//!
//! Con `--demo` usa el fixture de referencia en lugar de cargar de disco, útil
//! para humo en CI sin un proyecto real.

use anyhow::Result;
use std::path::Path;
use texis_core::project::loader::ProjectLoader;
use texis_document_application::ports::IrSerializer;
use texis_document_application::ImportProjectUseCase;
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::{JsonIrSerializer, LegacyProjectImporter};

pub fn run(project_dir: &Path, demo: bool) -> Result<()> {
    let model = if demo {
        sample_thesis()
    } else {
        let project_file = project_dir.join("tesis.project.yaml");
        ProjectLoader.load_from_file(&project_file)?
    };

    let use_case = ImportProjectUseCase::new(LegacyProjectImporter::new());
    let resolution = use_case.execute(model);

    // Diagnósticos a stderr (códigos estables, no texto traducido).
    for d in resolution.diagnostics.iter() {
        eprintln!(
            "[{:?}] {} ({}/{:?}) {}",
            d.severity,
            d.code.as_str(),
            d.module,
            d.stage,
            d.message_key
        );
    }

    let ir = resolution
        .value
        .ok_or_else(|| anyhow::anyhow!("la importación no produjo un DocumentIR"))?;

    // IR a stdout.
    let json = JsonIrSerializer::pretty()
        .serialize(&ir)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    println!("{json}");

    if resolution.diagnostics.has_blocking() {
        anyhow::bail!("la importación produjo diagnósticos bloqueantes");
    }
    Ok(())
}
