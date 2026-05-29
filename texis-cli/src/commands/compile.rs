use anyhow::Result;
use std::path::Path;
use texis_core::{
    compiler::{latexmk::LatexmkBackend, CompilationBackend, CompilationOptions},
    project::{loader::ProjectLoader, model::LatexEngine},
    LaTeXGenerator,
};

pub fn run(project_dir: &Path, backend_name: &str, draft: bool) -> Result<()> {
    let project_file = project_dir.join("tesis.project.yaml");
    let loader = ProjectLoader;
    let model = loader.load_from_file(&project_file)?;

    let build_dir = project_dir.join("build");

    let engine_str = match model.latex_config.engine {
        LatexEngine::Pdflatex => "pdflatex",
        LatexEngine::Lualatex => "lualatex",
        LatexEngine::Xelatex => "xelatex",
    };

    // Generar archivos LaTeX
    // Nota: no se nombra la variable 'gen' (reservado en edition 2024)
    let latex_gen = LaTeXGenerator::new()?;
    println!("Generando archivos LaTeX...");
    latex_gen.generate(&model, &build_dir)?;

    // Compilar
    let bibliography_backend = match model.latex_config.bibliography_backend {
        texis_core::project::model::BibliographyBackend::Biber => "biber",
        texis_core::project::model::BibliographyBackend::Bibtex => "bibtex",
    };

    let options = CompilationOptions {
        draft,
        clean_temp: false,
        max_runs: None,
        latex_engine: Some(engine_str.to_string()),
        bibliography_backend: Some(bibliography_backend.to_string()),
    };

    let result = match backend_name {
        "latexmk" => {
            let backend = LatexmkBackend::new();
            if !backend.is_available() {
                anyhow::bail!(
                    "latexmk no está instalado. Instala TeX Live o MiKTeX para compilar."
                );
            }
            println!("Compilando con latexmk...");
            backend.compile(&build_dir, &options)?
        }
        other => anyhow::bail!("Backend '{}' no reconocido. Usa 'latexmk'.", other),
    };

    if result.success {
        if let Some(pdf) = &result.pdf_path {
            println!("✓ PDF generado: {}", pdf.display());
        }
    } else {
        eprintln!("✗ La compilación falló.\n");
        for err in &result.user_errors {
            eprintln!("  ERROR: {}", err.message);
            if let Some(sug) = &err.suggestion {
                eprintln!("  → {}", sug);
            }
        }
        if result.user_errors.is_empty() {
            eprintln!("  Revisa el log en build/ para más detalles.");
        }
        anyhow::bail!("Compilación fallida.");
    }

    Ok(())
}
