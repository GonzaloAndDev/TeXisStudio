//! Consolidador de proyectos LaTeX multi-archivo.
//!
//! Convierte una carpeta que puede tener múltiples .tex (con \input, \include,
//! subcarpetas) en un único .tex consolidado listo para parsear.
//!
//! Estrategia:
//!   1. Detectar el "archivo raíz" (contiene \documentclass o \begin{document}).
//!   2. Expandir recursivamente \input{...} e \include{...} desde la raíz.
//!   3. Copiar imágenes y .bib desde cualquier subcarpeta a la carpeta destino.
//!   4. Devolver el tex consolidado + lista de assets copiados.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::error::{CoreError, CoreResult};

/// Resultado de la consolidación.
pub struct ConsolidatedTex {
    /// Contenido .tex unificado (preámbulo + body completos).
    pub tex: String,
    /// Rutas de figuras encontradas en la carpeta origen (para copiar al proyecto).
    pub figure_paths: Vec<PathBuf>,
    /// Rutas de archivos .bib encontrados.
    pub bib_paths: Vec<PathBuf>,
    /// Avisos de expansión (archivos no encontrados, ciclos detectados, etc.)
    pub warnings: Vec<String>,
}

const MAX_DEPTH: usize = 16;
const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10 MB por archivo

/// Consolida todos los archivos .tex de `source_dir` en un único string.
///
/// Si existe un archivo raíz obvio (que contenga \documentclass), se expande
/// desde él. Si hay varios candidatos, se elige el mayor (heurística: suele
/// ser el main.tex).
pub fn consolidate_directory(source_dir: &Path) -> CoreResult<ConsolidatedTex> {
    let mut warnings = Vec::new();

    let root = find_root_tex(source_dir, &mut warnings)?;
    let tex = expand_tex(&root, source_dir, &mut HashSet::new(), 0, &mut warnings)?;

    let (figure_paths, bib_paths) = collect_assets(source_dir);

    Ok(ConsolidatedTex {
        tex,
        figure_paths,
        bib_paths,
        warnings,
    })
}

/// Expande \input{...} e \include{...} de forma recursiva.
fn expand_tex(
    path: &Path,
    root_dir: &Path,
    visited: &mut HashSet<PathBuf>,
    depth: usize,
    warnings: &mut Vec<String>,
) -> CoreResult<String> {
    if depth > MAX_DEPTH {
        warnings.push(format!(
            "Profundidad máxima de inclusión ({MAX_DEPTH}) alcanzada en '{}'",
            path.display()
        ));
        return Ok(String::new());
    }

    let canonical = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    if visited.contains(&canonical) {
        warnings.push(format!(
            "Ciclo detectado: '{}' ya fue incluido.",
            path.display()
        ));
        return Ok(String::new());
    }
    visited.insert(canonical.clone());

    // Guard tamaño
    if let Ok(meta) = std::fs::metadata(path) {
        if meta.len() > MAX_FILE_SIZE {
            warnings.push(format!(
                "Archivo '{}' supera {} MB — se incluye sin expandir subarchivos.",
                path.display(),
                MAX_FILE_SIZE / (1024 * 1024)
            ));
            return std::fs::read_to_string(path).map_err(CoreError::Io);
        }
    }

    let content = std::fs::read_to_string(path).map_err(CoreError::Io)?;
    let mut result = String::with_capacity(content.len() + 512);
    let parent = path.parent().unwrap_or(root_dir);

    for line in content.lines() {
        let trimmed = line.trim_start();

        // Skip \input/\include comment lines
        if trimmed.starts_with('%') {
            result.push_str(line);
            result.push('\n');
            continue;
        }

        if let Some(sub_path) = extract_include(trimmed, parent, root_dir) {
            // Marca el punto de inclusión con un comentario para depuración
            result.push_str(&format!(
                "% --- begin included: {} ---\n",
                sub_path.display()
            ));
            match expand_tex(&sub_path, root_dir, visited, depth + 1, warnings) {
                Ok(expanded) => result.push_str(&expanded),
                Err(_) => {
                    warnings.push(format!("No se pudo leer '{}'", sub_path.display()));
                    // Mantener la línea original como fallback
                    result.push_str(line);
                    result.push('\n');
                }
            }
            result.push_str(&format!("% --- end included: {} ---\n", sub_path.display()));
        } else {
            result.push_str(line);
            result.push('\n');
        }
    }

    Ok(result)
}

/// Extrae la ruta del archivo de un \input{...}, \include{...} o \subfile{...}.
///
/// Búsqueda: primero relativa al directorio padre del archivo actual,
/// luego relativa al `root_dir` (como hace Overleaf y la mayoría de proyectos
/// académicos cuando todos los \input son relativos al main.tex).
fn extract_include(line: &str, parent: &Path, root_dir: &Path) -> Option<PathBuf> {
    // Prefijos con llave abierta (arg termina en '}')
    let brace_prefixes = ["\\input{", "\\include{", "\\subfile{", "\\subimport{"];
    // Prefijos sin llave (arg termina en whitespace o fin de línea)
    let space_prefixes = ["\\input ", "\\include "];

    let mut found_arg = String::new();

    // Intentar con prefijos de llave
    let mut matched = false;
    for prefix in &brace_prefixes {
        if let Some(stripped) = line.strip_prefix(prefix) {
            let rest = stripped.trim();
            // Para \subimport{dir}{file}: tomar solo el segundo argumento
            if *prefix == "\\subimport{" {
                let close1 = rest.find('}')?;
                let after = rest[close1 + 1..].trim_start();
                if let Some(inner) = after.strip_prefix('{') {
                    let close2 = inner.find('}')?;
                    let dir_part = &rest[..close1];
                    let file_part = &inner[..close2];
                    found_arg = format!("{dir_part}/{file_part}");
                }
            } else {
                let end = rest.find('}')?;
                found_arg = rest[..end].trim().to_string();
            }
            matched = true;
            break;
        }
    }
    if !matched {
        for prefix in &space_prefixes {
            if let Some(stripped) = line.strip_prefix(prefix) {
                let rest = stripped.trim();
                found_arg = rest.split_whitespace().next()?.to_string();
                matched = true;
                break;
            }
        }
    }
    if !matched || found_arg.is_empty() {
        return None;
    }
    let arg: &str = &found_arg;

    // Probar primero relativo al padre, luego relativo al root
    let search_bases = [parent, root_dir];
    for base in &search_bases {
        let candidates = [base.join(arg), base.join(format!("{arg}.tex"))];
        for candidate in &candidates {
            if candidate.exists() && candidate.is_file() {
                return Some(candidate.clone());
            }
        }
    }
    None
}

/// Detecta el archivo .tex raíz de la carpeta.
/// Criterios (en orden): tiene \documentclass, nombre "main.tex", el más grande.
fn find_root_tex(dir: &Path, warnings: &mut Vec<String>) -> CoreResult<PathBuf> {
    let mut candidates: Vec<PathBuf> = WalkDir::new(dir)
        .max_depth(6)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file() && e.path().extension().and_then(|x| x.to_str()) == Some("tex")
        })
        .map(|e| e.path().to_path_buf())
        .collect();

    if candidates.is_empty() {
        return Err(CoreError::InvalidProject {
            message: format!("No se encontraron archivos .tex en '{}'", dir.display()),
        });
    }

    // Prioridad 1: tiene \documentclass
    let with_docclass: Vec<_> = candidates
        .iter()
        .filter(|p| {
            std::fs::read_to_string(p)
                .map(|c| c.contains("\\documentclass"))
                .unwrap_or(false)
        })
        .cloned()
        .collect();

    if with_docclass.len() == 1 {
        return Ok(with_docclass.into_iter().next().unwrap());
    }

    if with_docclass.len() > 1 {
        warnings.push(format!(
            "Varios archivos con \\documentclass encontrados. Se usará el primero: '{}'",
            with_docclass[0].display()
        ));
        return Ok(with_docclass.into_iter().next().unwrap());
    }

    // Prioridad 2: nombre main.tex o thesis.tex
    let priority_names = ["main.tex", "thesis.tex", "tesis.tex", "document.tex"];
    for name in &priority_names {
        if let Some(p) = candidates
            .iter()
            .find(|p| p.file_name().and_then(|n| n.to_str()) == Some(name))
        {
            return Ok(p.clone());
        }
    }

    // Prioridad 3: el archivo más grande (heurística)
    candidates.sort_by_key(|p| std::fs::metadata(p).map(|m| m.len()).unwrap_or(0));
    warnings.push(format!(
        "No se detectó un archivo raíz claro. Se usará '{}' (el más grande).",
        candidates.last().unwrap().display()
    ));
    Ok(candidates.pop().unwrap())
}

/// Recolecta figuras (.png, .jpg, .jpeg, .pdf, .eps, .svg) y .bib recursivamente.
fn collect_assets(dir: &Path) -> (Vec<PathBuf>, Vec<PathBuf>) {
    let image_exts = ["png", "jpg", "jpeg", "pdf", "eps", "svg", "tif", "tiff"];
    let mut figures = Vec::new();
    let mut bibs = Vec::new();

    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let ext = entry
            .path()
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if image_exts.contains(&ext.as_str()) {
            figures.push(entry.path().to_path_buf());
        } else if ext == "bib" {
            bibs.push(entry.path().to_path_buf());
        }
    }
    (figures, bibs)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn setup_project(files: &[(&str, &str)]) -> TempDir {
        let dir = tempfile::tempdir().unwrap();
        for (name, content) in files {
            let path = dir.path().join(name);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).unwrap();
            }
            fs::write(&path, content).unwrap();
        }
        dir
    }

    #[test]
    fn consolidate_single_file() {
        let dir = setup_project(&[(
            "main.tex",
            "\\documentclass{book}\n\\begin{document}\nHola\n\\end{document}",
        )]);
        let result = consolidate_directory(dir.path()).unwrap();
        assert!(result.tex.contains("Hola"));
        assert!(
            result.warnings.is_empty(),
            "no debe haber avisos: {:?}",
            result.warnings
        );
    }

    #[test]
    fn consolidate_with_input() {
        let dir = setup_project(&[
            (
                "main.tex",
                "\\documentclass{book}\n\\begin{document}\n\\input{cap1}\n\\end{document}",
            ),
            ("cap1.tex", "Contenido del capítulo 1."),
        ]);
        let result = consolidate_directory(dir.path()).unwrap();
        assert!(result.tex.contains("Contenido del capítulo 1."));
    }

    #[test]
    fn consolidate_with_input_subdir() {
        let dir = setup_project(&[
            (
                "main.tex",
                "\\documentclass{book}\n\\begin{document}\n\\input{chapters/cap1}\n\\end{document}",
            ),
            ("chapters/cap1.tex", "Contenido subcarpeta."),
        ]);
        let result = consolidate_directory(dir.path()).unwrap();
        assert!(
            result.tex.contains("Contenido subcarpeta."),
            "debe expandir subcarpetas"
        );
    }

    #[test]
    fn consolidate_detects_figures() {
        let dir = setup_project(&[(
            "main.tex",
            "\\documentclass{book}\n\\begin{document}\\end{document}",
        )]);
        fs::create_dir_all(dir.path().join("figures")).unwrap();
        fs::write(dir.path().join("figures/img.png"), b"PNG").unwrap();
        fs::write(dir.path().join("img2.jpg"), b"JPG").unwrap();
        let result = consolidate_directory(dir.path()).unwrap();
        assert_eq!(result.figure_paths.len(), 2, "debe detectar 2 figuras");
    }

    #[test]
    fn consolidate_cycle_detection() {
        let dir = setup_project(&[
            (
                "main.tex",
                "\\documentclass{book}\n\\begin{document}\n\\input{a}\n\\end{document}",
            ),
            ("a.tex", "\\input{b}"),
            ("b.tex", "\\input{a}"), // ciclo
        ]);
        let result = consolidate_directory(dir.path()).unwrap();
        assert!(
            result.warnings.iter().any(|w| w.contains("iclo")),
            "debe detectar ciclo"
        );
    }

    #[test]
    fn find_root_prefers_documentclass() {
        let dir = setup_project(&[
            ("chapter.tex", "Solo texto sin documentclass"),
            (
                "main.tex",
                "\\documentclass{book}\n\\begin{document}\\end{document}",
            ),
        ]);
        let mut warnings = Vec::new();
        let root = find_root_tex(dir.path(), &mut warnings).unwrap();
        assert_eq!(root.file_name().unwrap().to_str().unwrap(), "main.tex");
    }

    #[test]
    fn no_tex_files_returns_error() {
        let dir = tempfile::tempdir().unwrap();
        let mut warnings = Vec::new();
        let result = find_root_tex(dir.path(), &mut warnings);
        assert!(result.is_err());
    }
}
