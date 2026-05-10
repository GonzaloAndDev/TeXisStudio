use serde_json::Value;
use texis_core::compiler::detector::LatexInstallation;

/// Devuelve los perfiles disponibles (builtin + desde directorio de la app).
#[tauri::command]
pub fn get_profiles() -> Result<Value, String> {
    // Por ahora devuelve los perfiles builtin hardcodeados.
    // En Release 0.3 se cargará desde el directorio de perfiles.
    Ok(serde_json::json!([
        {
            "id": "generic.thesis",
            "name": "Tesis genérica",
            "description": "Estructura clásica con marco teórico, metodología, resultados y conclusiones.",
            "meta": "XeLaTeX · biber · APA 7",
            "tags": ["tesis", "licenciatura", "maestria", "doctorado"],
        },
        {
            "id": "generic.tesina",
            "name": "Tesina",
            "description": "Versión simplificada para licenciatura: introducción, desarrollo y cierre.",
            "meta": "XeLaTeX · biber · APA 7",
            "tags": ["tesina", "licenciatura"],
        },
    ]))
}

/// Detecta si LaTeX está instalado en el sistema.
#[tauri::command]
pub fn detect_latex() -> Result<Value, String> {
    let info = LatexInstallation::detect();
    Ok(serde_json::json!({
        "has_latexmk": info.has_latexmk,
        "has_xelatex": info.has_xelatex,
        "has_biber": info.has_biber,
        "is_usable": info.is_usable(),
        "latexmk_version": info.latexmk_version,
        "texlive_year": info.texlive_year,
    }))
}
