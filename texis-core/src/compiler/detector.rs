use std::process::Command;

/// Estado completo de la instalación de LaTeX en el sistema.
#[derive(Debug, Clone)]
pub struct LatexInstallation {
    // ── latexmk + TeX Live / MiKTeX ─────────────────────────────
    pub has_latexmk: bool,
    pub has_xelatex: bool,
    pub has_biber: bool,
    pub latexmk_version: Option<String>,
    pub texlive_year: Option<u32>,

    // ── Tectonic (motor autónomo) ────────────────────────────────
    pub has_tectonic: bool,
    pub tectonic_version: Option<String>,
}

impl LatexInstallation {
    pub fn detect() -> Self {
        Self {
            has_latexmk:       cmd_available("latexmk"),
            has_xelatex:       cmd_available("xelatex"),
            has_biber:         cmd_available("biber"),
            latexmk_version:   version_string("latexmk", &["--version"]),
            texlive_year:      detect_texlive_year(),
            has_tectonic:      cmd_available("tectonic"),
            tectonic_version:  version_string("tectonic", &["--version"]),
        }
    }

    /// Retorna true si hay algún backend usable para compilar.
    pub fn is_usable(&self) -> bool {
        self.latexmk_usable() || self.has_tectonic
    }

    /// latexmk + xelatex disponibles (TeX Live / MiKTeX completo).
    pub fn latexmk_usable(&self) -> bool {
        self.has_latexmk && self.has_xelatex
    }

    /// Backends disponibles en orden de preferencia.
    pub fn available_backends(&self) -> Vec<&'static str> {
        let mut backends = Vec::new();
        if self.latexmk_usable() {
            backends.push("latexmk");
        }
        if self.has_tectonic {
            backends.push("tectonic");
        }
        backends
    }

    /// Backend recomendado: latexmk si está disponible, tectonic si no.
    pub fn preferred_backend(&self) -> Option<&'static str> {
        self.available_backends().into_iter().next()
    }
}

fn cmd_available(cmd: &str) -> bool {
    Command::new(cmd).arg("--version").output().is_ok()
}

fn version_string(cmd: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(cmd).args(args).output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines().next().map(|l| l.trim().to_string())
}

fn detect_texlive_year() -> Option<u32> {
    let output = Command::new("tex").arg("--version").output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    for part in text.split_whitespace() {
        if let Ok(year) = part.parse::<u32>() {
            if year > 2000 && year < 2100 {
                return Some(year);
            }
        }
    }
    None
}
