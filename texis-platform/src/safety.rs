//! Seguridad de rutas (§3 sandbox). Resuelve rutas dentro de una raíz permitida,
//! rechazando rutas absolutas, traversal (`..`) y escapes por symlink. Es la base
//! de la contención de plugins, assets externos e importadores.

use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathSafetyError {
    /// La ruta es absoluta (debe ser relativa a la raíz).
    Absolute,
    /// La ruta contiene `..` o intenta salir de la raíz.
    Traversal,
    /// La ruta resuelta queda fuera de la raíz (p. ej. symlink que escapa).
    OutsideRoot,
}

impl std::fmt::Display for PathSafetyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            PathSafetyError::Absolute => "ruta absoluta no permitida",
            PathSafetyError::Traversal => "traversal (`..`) no permitido",
            PathSafetyError::OutsideRoot => "la ruta resuelta queda fuera de la raíz",
        };
        f.write_str(s)
    }
}

impl std::error::Error for PathSafetyError {}

/// Normaliza léxicamente una ruta relativa: rechaza absolutas, raíces y `..`.
/// No toca el filesystem; valida la forma de la ruta.
fn lexically_safe(relative: &Path) -> Result<PathBuf, PathSafetyError> {
    let mut out = PathBuf::new();
    for comp in relative.components() {
        match comp {
            Component::Normal(c) => out.push(c),
            Component::CurDir => {} // "." es inocuo
            Component::ParentDir => return Err(PathSafetyError::Traversal),
            Component::RootDir | Component::Prefix(_) => {
                return Err(PathSafetyError::Absolute)
            }
        }
    }
    Ok(out)
}

/// Resuelve `relative` dentro de `root` de forma segura. Devuelve la ruta
/// absoluta resultante. Comprueba además, si existe, que la canonicalización real
/// (que sigue symlinks) siga dentro de la raíz canónica.
pub fn resolve_within(root: &Path, relative: &Path) -> Result<PathBuf, PathSafetyError> {
    let safe_rel = lexically_safe(relative)?;
    let candidate = root.join(&safe_rel);

    // Raíz canónica de referencia. Si la raíz no existe aún, usamos su forma tal cual.
    let canon_root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());

    // Para destinos existentes, canonicalizamos el destino; para destinos nuevos,
    // canonicalizamos el ancestro existente más cercano (detecta symlinks en el
    // camino que escaparían de la raíz).
    let to_check = nearest_existing(&candidate);
    if let Ok(canon) = to_check.canonicalize() {
        if !canon.starts_with(&canon_root) {
            return Err(PathSafetyError::OutsideRoot);
        }
    }

    Ok(candidate)
}

/// `true` si `relative` es segura dentro de `root`.
pub fn is_within(root: &Path, relative: &Path) -> bool {
    resolve_within(root, relative).is_ok()
}

fn nearest_existing(path: &Path) -> PathBuf {
    let mut current = path.to_path_buf();
    loop {
        if current.exists() {
            return current;
        }
        match current.parent() {
            Some(parent) if parent != current => current = parent.to_path_buf(),
            _ => return current,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_normal_relative() {
        let dir = tempfile::tempdir().unwrap();
        let r = resolve_within(dir.path(), Path::new("assets/logo.png")).unwrap();
        assert!(r.ends_with("assets/logo.png"));
    }

    #[test]
    fn rejects_absolute() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            resolve_within(dir.path(), Path::new("/etc/passwd")),
            Err(PathSafetyError::Absolute)
        );
    }

    #[test]
    fn rejects_traversal() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(
            resolve_within(dir.path(), Path::new("../../secret")),
            Err(PathSafetyError::Traversal)
        );
        assert_eq!(
            resolve_within(dir.path(), Path::new("a/../../b")),
            Err(PathSafetyError::Traversal)
        );
    }

    #[test]
    fn curdir_is_harmless() {
        let dir = tempfile::tempdir().unwrap();
        assert!(is_within(dir.path(), Path::new("./a/./b.txt")));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escape() {
        use std::os::unix::fs::symlink;
        let dir = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::fs::write(outside.path().join("secret.txt"), "x").unwrap();
        // Symlink dentro de la raíz que apunta fuera.
        symlink(outside.path(), dir.path().join("escape")).unwrap();
        let res = resolve_within(dir.path(), Path::new("escape/secret.txt"));
        assert_eq!(res, Err(PathSafetyError::OutsideRoot));
    }
}
