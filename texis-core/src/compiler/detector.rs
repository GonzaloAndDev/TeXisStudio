use std::process::Command;

#[derive(Debug, Clone)]
pub struct LatexInstallation {
    pub has_latexmk: bool,
    pub has_xelatex: bool,
    pub has_biber: bool,
    pub latexmk_version: Option<String>,
    pub texlive_year: Option<u32>,
}

impl LatexInstallation {
    pub fn detect() -> Self {
        Self {
            has_latexmk: cmd_available("latexmk"),
            has_xelatex: cmd_available("xelatex"),
            has_biber: cmd_available("biber"),
            latexmk_version: version_string("latexmk", &["--version"]),
            texlive_year: detect_texlive_year(),
        }
    }

    pub fn is_usable(&self) -> bool {
        self.has_latexmk && self.has_xelatex
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
