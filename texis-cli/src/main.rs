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
    /// Exportar para entrega
    ExportDelivery {
        project_dir: PathBuf,
        #[arg(long)]
        output: PathBuf,
    },
}

fn main() {
    let cli = Cli::parse();
    let result = match cli.command {
        Commands::Create { profile, name, output } => {
            commands::create::run(&profile, &name, &output)
        }
        Commands::Validate { project_dir } => {
            commands::validate::run_project(&project_dir)
        }
        Commands::Compile { project_dir, backend, draft } => {
            commands::compile::run(&project_dir, &backend, draft)
        }
        Commands::ExportProfile { profile_id, output } => {
            commands::export::run_profile(&profile_id, &output)
        }
        Commands::ImportProfile { pack_file } => {
            commands::import::run_profile(&pack_file)
        }
        Commands::ValidatePack { pack_file } => {
            commands::validate::run_pack(&pack_file)
        }
        Commands::ExportDelivery { project_dir, output } => {
            commands::export::run_delivery(&project_dir, &output)
        }
    };

    if let Err(e) = result {
        eprintln!("error: {}", e);
        std::process::exit(1);
    }
}
