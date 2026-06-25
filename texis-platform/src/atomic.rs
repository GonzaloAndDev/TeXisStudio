//! Escritura atómica de archivos (§2 persistencia transaccional).
//!
//! Patrón: escribir a temporal → `fsync` → `rename` atómico → verificar relectura.
//! El `rename` dentro del mismo directorio es atómico en los sistemas soportados,
//! de modo que un corte de energía nunca deja el archivo destino a medias.

use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

/// Nombre de temporal único por proceso e instante (evita choque entre ventanas).
fn temp_sibling(path: &Path) -> std::path::PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id();
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    let tmp = format!(".{name}.{pid}.{nanos}.tmp");
    match path.parent() {
        Some(parent) => parent.join(tmp),
        None => std::path::PathBuf::from(tmp),
    }
}

/// Escribe `contents` en `path` de forma atómica y verifica la relectura.
pub fn atomic_write(path: &Path, contents: &[u8]) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)?;
        }
    }

    let tmp = temp_sibling(path);
    {
        let mut f = File::create(&tmp)?;
        f.write_all(contents)?;
        f.sync_all()?; // fsync: persiste el contenido antes del rename
    }

    // rename atómico (mismo directorio).
    if let Err(e) = fs::rename(&tmp, path) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }

    // Verificación de relectura: el destino debe contener exactamente lo escrito.
    let mut read_back = Vec::with_capacity(contents.len());
    File::open(path)?.read_to_end(&mut read_back)?;
    if read_back != contents {
        return Err(io::Error::other("verificación de relectura falló tras escritura atómica"));
    }
    Ok(())
}

/// Conveniencia para texto UTF-8.
pub fn atomic_write_str(path: &Path, contents: &str) -> io::Result<()> {
    atomic_write(path, contents.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_reads_back() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sub/dir/data.txt");
        atomic_write_str(&path, "hola").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "hola");
        // Sin temporales residuales en el directorio.
        let leftovers: Vec<_> = fs::read_dir(path.parent().unwrap())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".tmp"))
            .collect();
        assert!(leftovers.is_empty(), "quedaron temporales: {leftovers:?}");
    }

    #[test]
    fn overwrite_is_atomic_and_consistent() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data.txt");
        atomic_write_str(&path, "v1").unwrap();
        atomic_write_str(&path, "v2-mas-largo").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "v2-mas-largo");
    }
}
