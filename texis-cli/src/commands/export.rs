use anyhow::Result;
use std::path::Path;

pub fn run_profile(_profile_id: &str, _output: &Path) -> Result<()> {
    println!("Exportación de perfiles — Release 0.3");
    Ok(())
}

pub fn run_delivery(_project_dir: &Path, _output: &Path) -> Result<()> {
    println!("Exportación para entrega — Release 0.2");
    Ok(())
}
