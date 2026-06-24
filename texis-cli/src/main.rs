// texis-cli — CLI para TeXisStudio
// Nota: evitar `gen` como nombre de variable (reservado en edition 2024).

mod commands;

use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "texis", about = "TeXisStudio CLI", version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Crear un nuevo proyecto de tesis
    Create {
        #[arg(long)]
        profile: String,
        #[arg(long)]
        name: String,
        #[arg(long, default_value = ".")]
        output: PathBuf,
    },
    /// Validar un proyecto existente
    Validate { project_dir: PathBuf },
    /// Importar un proyecto al nuevo DocumentIR y emitirlo como JSON (Etapa A)
    ImportIr {
        #[arg(default_value = ".")]
        project_dir: PathBuf,
        /// Usar el fixture de referencia en lugar de cargar de disco
        #[arg(long)]
        demo: bool,
    },
    /// Ensamblar el documento con el núcleo nuevo y emitir main.tex o el manifiesto (Etapa B)
    BuildPlan {
        #[arg(default_value = ".")]
        project_dir: PathBuf,
        /// Usar el fixture de referencia en lugar de cargar de disco
        #[arg(long)]
        demo: bool,
        /// Emitir el manifiesto de build (JSON) en lugar de main.tex
        #[arg(long)]
        manifest: bool,
    },
    /// Certificación del núcleo nuevo sobre la matriz de fixtures (Etapa J)
    Certify {
        /// Incluir el gate de compilación a PDF real (requiere LaTeX instalado)
        #[arg(long)]
        compile: bool,
        /// Exigir compilación, postflight y herramientas PDF esenciales.
        #[arg(long)]
        strict: bool,
    },
    /// Compilar un proyecto a PDF
    Compile {
        project_dir: PathBuf,
        #[arg(long, default_value = "latexmk")]
        backend: String,
        #[arg(long)]
        draft: bool,
    },
    /// Exportar un perfil
    ExportProfile {
        profile_id: String,
        #[arg(long)]
        output: PathBuf,
    },
    /// Importar un perfil
    ImportProfile { pack_file: PathBuf },
    /// Validar un paquete de perfil
    ValidatePack { pack_file: PathBuf },
    /// Exportar paquete de entrega final con artefactos de evidencia
    ExportDelivery {
        project_dir: PathBuf,
        /// Directorio de salida para el ZIP generado
        #[arg(long, default_value = ".")]
        output: PathBuf,
        /// Modo de exportación: draft | review | final
        #[arg(long, default_value = "draft")]
        mode: String,
    },
}

fn main() {
    let cli = Cli::parse();
    let result = match cli.command {
        Commands::Create {
            profile,
            name,
            output,
        } => commands::create::run(&profile, &name, &output),
        Commands::Validate { project_dir } => commands::validate::run_project(&project_dir),
        Commands::ImportIr { project_dir, demo } => commands::import_ir::run(&project_dir, demo),
        Commands::BuildPlan {
            project_dir,
            demo,
            manifest,
        } => commands::build_plan::run(&project_dir, demo, manifest),
        Commands::Certify { compile, strict } => commands::certify::run(compile, strict),
        Commands::Compile {
            project_dir,
            backend,
            draft,
        } => commands::compile::run(&project_dir, &backend, draft),
        Commands::ExportProfile { profile_id, output } => {
            commands::export::run_profile(&profile_id, &output)
        }
        Commands::ImportProfile { pack_file } => commands::import::run_profile(&pack_file),
        Commands::ValidatePack { pack_file } => commands::validate::run_pack(&pack_file),
        Commands::ExportDelivery {
            project_dir,
            output,
            mode,
        } => commands::export::run_delivery(&project_dir, &output, &mode),
    };

    if let Err(e) = result {
        eprintln!("error: {}", e);
        std::process::exit(1);
    }
}
