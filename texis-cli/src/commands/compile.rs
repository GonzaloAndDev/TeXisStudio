use anyhow::Result;
use std::path::{Path, PathBuf};
use texis_core::{
    compiler::{
        latexmk::LatexmkBackend, tectonic::TectonicBackend, CompilationBackend, CompilationOptions,
    },
    profile::loader::ProfileLoader,
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

    // Cargar template de portada del perfil si existe en el directorio de perfiles
    // Busca en: <workspace>/profiles/<profile_id>/profile.yaml
    let title_page_template: Option<String> = {
        // CARGO_MANIFEST_DIR es texis-cli/ → parent es la raíz del workspace
        let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .map(|root| root.join("profiles"))
            .unwrap_or_else(|| PathBuf::from("profiles"));
        let profile_yaml = workspace.join(&model.profile_id).join("profile.yaml");
        if profile_yaml.exists() {
            ProfileLoader
                .load_from_file(&profile_yaml)
                .ok()
                .and_then(|p| p.title_page_template)
                .map(|t| t.template)
        } else {
            None
        }
    };

    // Generar archivos LaTeX
    // Nota: no se nombra la variable 'gen' (reservado en edition 2024)
    let latex_gen = LaTeXGenerator::new()?;
    println!("Generando archivos LaTeX...");
    latex_gen.generate_with_profile(&model, &build_dir, None, title_page_template.as_deref())?;

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
        "tectonic" => {
            let backend = TectonicBackend::new();
            if !backend.is_available() {
                anyhow::bail!(
                    "tectonic no está instalado. Instala Tectonic o usa '--backend latexmk'."
                );
            }
            println!("Compilando con tectonic...");
            backend.compile(&build_dir, &options)?
        }
        other => anyhow::bail!(
            "Backend '{}' no reconocido. Usa 'latexmk' o 'tectonic'.",
            other
        ),
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
