use std::path::{Path, PathBuf};
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
    /// Directorio bin de TeX Live / MacTeX si se encontró fuera del PATH.
    pub texlive_bin_path: Option<PathBuf>,

    // ── Tectonic (motor autónomo) ────────────────────────────────
    pub has_tectonic: bool,
    pub tectonic_version: Option<String>,
}

impl LatexInstallation {
    pub fn detect() -> Self {
        // Buscar primero en PATH, luego en ubicaciones estándar de MacTeX/TeX Live
        let extra_bin = find_texlive_bin();

        let has_latexmk = cmd_available("latexmk")
            || extra_bin
                .as_ref()
                .map(|p| p.join("latexmk").exists())
                .unwrap_or(false);
        let has_xelatex = cmd_available("xelatex")
            || extra_bin
                .as_ref()
                .map(|p| p.join("xelatex").exists())
                .unwrap_or(false);
        let has_biber = cmd_available("biber")
            || extra_bin
                .as_ref()
                .map(|p| p.join("biber").exists())
                .unwrap_or(false);

        let latexmk_bin = extra_bin
            .as_ref()
            .map(|p| p.join("latexmk"))
            .filter(|p| p.exists());

        let latexmk_version = version_string("latexmk", &["--version"]).or_else(|| {
            latexmk_bin
                .as_ref()
                .and_then(|b| version_path(b, &["--version"]))
        });

        let texlive_year =
            detect_texlive_year().or_else(|| extra_bin.as_ref().and_then(|p| year_from_path(p)));

        Self {
            has_latexmk,
            has_xelatex,
            has_biber,
            latexmk_version,
            texlive_year,
            texlive_bin_path: extra_bin,
            has_tectonic: cmd_available("tectonic"),
            tectonic_version: version_string("tectonic", &["--version"]),
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

// ── Resolución de rutas ───────────────────────────────────────────────────────

/// Devuelve la ruta completa a un comando LaTeX, buscando primero en PATH
/// y luego en el directorio bin de TeX Live/MacTeX detectado.
pub fn resolve_latex_command(cmd: &str) -> String {
    if cmd_available(cmd) {
        return cmd.to_string();
    }
    if let Some(bin) = find_texlive_bin() {
        let full = bin.join(cmd);
        if full.exists() {
            return full.to_string_lossy().to_string();
        }
    }
    cmd.to_string()
}

/// Encuentra el directorio bin de la instalación TeX Live / MacTeX más reciente
/// en ubicaciones estándar fuera del PATH del sistema.
pub fn find_texlive_bin() -> Option<PathBuf> {
    // macOS: MacTeX instala en /usr/local/texlive/<year>/bin/universal-darwin
    //        Las versiones antiguas usan /bin/x86_64-darwin o /bin/aarch64-darwin
    #[cfg(target_os = "macos")]
    {
        if let Some(p) = find_in_dir(
            "/usr/local/texlive",
            &["universal-darwin", "x86_64-darwin", "aarch64-darwin"],
        ) {
            return Some(p);
        }
        // MacTeX también puede estar en /Library/TeX/texbin como symlink
        let texbin = PathBuf::from("/Library/TeX/texbin");
        if texbin.join("latexmk").exists() {
            return Some(texbin);
        }
    }

    // Linux: TeX Live en /usr/local/texlive/<year>/bin/x86_64-linux
    #[cfg(target_os = "linux")]
    {
        if let Some(p) = find_in_dir("/usr/local/texlive", &["x86_64-linux", "aarch64-linux"]) {
            return Some(p);
        }
    }

    // Windows: MiKTeX y TeX Live en rutas estándar
    #[cfg(target_os = "windows")]
    {
        for base in &[
            r"C:\Program Files\MiKTeX\miktex\bin\x64",
            r"C:\texlive\2024\bin\win32",
            r"C:\texlive\2025\bin\win32",
            r"C:\texlive\2026\bin\win32",
        ] {
            let p = PathBuf::from(base);
            if p.join("latexmk.exe").exists() {
                return Some(p);
            }
        }
    }

    None
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn find_in_dir(base: &str, arch_suffixes: &[&str]) -> Option<PathBuf> {
    let base_path = Path::new(base);
    if !base_path.exists() {
        return None;
    }

    // Listar años de instalación (2020, 2021, …) en orden descendente
    let mut years: Vec<u32> = std::fs::read_dir(base_path)
        .ok()?
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().to_str().and_then(|s| s.parse::<u32>().ok()))
        .filter(|&y| y > 2000 && y < 2100)
        .collect();
    years.sort_unstable_by(|a, b| b.cmp(a)); // más reciente primero

    for year in &years {
        for arch in arch_suffixes {
            let candidate = base_path.join(year.to_string()).join("bin").join(arch);
            if candidate.join("latexmk").exists() {
                return Some(candidate);
            }
        }
    }
    None
}

fn year_from_path(bin_path: &Path) -> Option<u32> {
    // Intenta extraer el año desde la ruta: /usr/local/texlive/2026/bin/...
    bin_path
        .ancestors()
        .filter_map(|p| p.file_name()?.to_str()?.parse::<u32>().ok())
        .find(|&y| y > 2000 && y < 2100)
}

// ── Detección básica ──────────────────────────────────────────────────────────

fn cmd_available(cmd: &str) -> bool {
    Command::new(cmd).arg("--version").output().is_ok()
}

fn version_string(cmd: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(cmd).args(args).output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines().next().map(|l| l.trim().to_string())
}

fn version_path(path: &Path, args: &[&str]) -> Option<String> {
    let output = Command::new(path).args(args).output().ok()?;
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_no_panics() {
        let info = LatexInstallation::detect();
        // Puede o no tener LaTeX — solo verificamos que no panic
        let _ = info.is_usable();
        let _ = info.latexmk_usable();
    }

    #[test]
    fn resolve_command_returns_string() {
        let cmd = resolve_latex_command("latexmk");
        assert!(!cmd.is_empty());
    }
}
