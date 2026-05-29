use crate::texis_project::model::{BibliographyTool, BuildConfig, GlossaryTool, IndexTool};
use std::collections::HashMap;
use std::path::PathBuf;

/// Herramientas permitidas para ejecución. NUNCA ejecutar herramientas fuera de esta lista.
pub const ALLOWED_TOOLS: &[&str] = &[
    "pdflatex", "xelatex", "lualatex", "latexmk",
    "biber", "bibtex",
    "makeglossaries", "bib2gls",
    "makeindex", "xindy",
    "epstopdf", "rsvg-convert",
    "pandoc",
];

#[derive(Debug, Clone)]
pub struct ToolInfo {
    pub name: String,
    pub path: PathBuf,
    pub version: Option<String>,
    pub available: bool,
}

/// Estado del toolchain detectado en el sistema.
#[derive(Debug, Clone)]
pub struct Toolchain {
    pub tools: HashMap<String, ToolInfo>,
}

impl Toolchain {
    pub fn is_available(&self, tool: &str) -> bool {
        self.tools.get(tool).map(|t| t.available).unwrap_or(false)
    }

    pub fn path_of(&self, tool: &str) -> Option<&PathBuf> {
        self.tools.get(tool).filter(|t| t.available).map(|t| &t.path)
    }

    /// Verifica que todas las herramientas necesarias para el BuildConfig están disponibles.
    pub fn validate_for_config(&self, config: &BuildConfig) -> Vec<String> {
        let mut missing = Vec::new();

        let engine_name = config.engine.to_string();
        if !self.is_available(&engine_name) {
            missing.push(format!(
                "Motor LaTeX '{}' no encontrado. Instala TeX Live o MiKTeX.",
                engine_name
            ));
        }

        match &config.bibliography_tool {
            BibliographyTool::Biber if !self.is_available("biber") => {
                missing.push("biber no encontrado. Instala con: tlmgr install biber".to_string());
            }
            BibliographyTool::BibTeX if !self.is_available("bibtex") => {
                missing.push("bibtex no encontrado.".to_string());
            }
            _ => {}
        }

        if let Some(GlossaryTool::MakeGlossaries) = &config.glossary_tool {
            if !self.is_available("makeglossaries") {
                missing.push(
                    "makeglossaries no encontrado. Instala con: tlmgr install glossaries".to_string(),
                );
            }
        }

        if let Some(GlossaryTool::Bib2Gls) = &config.glossary_tool {
            if !self.is_available("bib2gls") {
                missing.push("bib2gls no encontrado.".to_string());
            }
        }

        if let Some(IndexTool::MakeIndex) = &config.index_tool {
            if !self.is_available("makeindex") {
                missing.push("makeindex no encontrado.".to_string());
            }
        }

        missing
    }
}

/// Detecta las herramientas LaTeX disponibles en el sistema.
pub fn detect_toolchain() -> Toolchain {
    let mut tools = HashMap::new();

    for &tool in ALLOWED_TOOLS {
        let info = probe_tool(tool);
        tools.insert(tool.to_string(), info);
    }

    Toolchain { tools }
}

fn probe_tool(name: &str) -> ToolInfo {
    // Usar `which` en Unix / `where` en Windows para encontrar el binario
    let (cmd, args) = if cfg!(target_os = "windows") {
        ("where", vec![name])
    } else {
        ("which", vec![name])
    };

    let path_result = std::process::Command::new(cmd)
        .args(&args)
        .output();

    let (available, path) = match path_result {
        Ok(output) if output.status.success() => {
            let p = String::from_utf8_lossy(&output.stdout)
                .trim()
                .lines()
                .next()
                .map(PathBuf::from)
                .unwrap_or_else(|| PathBuf::from(name));
            (true, p)
        }
        _ => (false, PathBuf::from(name)),
    };

    // Intentar obtener versión
    let version = if available {
        probe_version(name)
    } else {
        None
    };

    ToolInfo { name: name.to_string(), path, version, available }
}

fn probe_version(tool: &str) -> Option<String> {
    let version_arg = match tool {
        "biber" => "--version",
        "makeindex" | "xindy" => "--version",
        _ => "--version",
    };

    let output = std::process::Command::new(tool)
        .arg(version_arg)
        .output()
        .ok()?;

    let text = String::from_utf8_lossy(&output.stdout).to_string()
        + &String::from_utf8_lossy(&output.stderr);

    // Extraer la primera línea que contiene dígitos (versión)
    text.lines()
        .find(|line| line.chars().any(|c| c.is_ascii_digit()))
        .map(|l| l.trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allowed_tools_list_contains_core_tools() {
        assert!(ALLOWED_TOOLS.contains(&"xelatex"));
        assert!(ALLOWED_TOOLS.contains(&"biber"));
        assert!(ALLOWED_TOOLS.contains(&"makeglossaries"));
        assert!(!ALLOWED_TOOLS.contains(&"bash"),
            "bash NO debe estar en la lista de herramientas permitidas");
        assert!(!ALLOWED_TOOLS.contains(&"sh"),
            "sh NO debe estar en la lista de herramientas permitidas");
        assert!(!ALLOWED_TOOLS.contains(&"python"),
            "python NO debe estar en la lista de herramientas permitidas");
    }

    #[test]
    fn validate_config_detects_missing_biber() {
        let mut toolchain = Toolchain { tools: Default::default() };
        toolchain.tools.insert("xelatex".to_string(), ToolInfo {
            name: "xelatex".to_string(),
            path: PathBuf::from("xelatex"),
            version: None,
            available: true,
        });
        // biber no está en el toolchain

        let mut config = BuildConfig::default(); // usa Biber
        let missing = toolchain.validate_for_config(&config);
        assert!(!missing.is_empty());
        assert!(missing[0].contains("biber"));
    }
}
