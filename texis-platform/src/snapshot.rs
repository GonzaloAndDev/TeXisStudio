//! Snapshots de proyecto (§2): copias verificables con retención configurable y
//! restauración. Un snapshot guarda las rutas indicadas bajo
//! `.texisstudio/snapshots/<id>/files/` más un `manifest.json`.

use crate::{paths, safety};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapshotMeta {
    /// Id ordenable (nanos del instante de creación, en decimal con padding).
    pub id: String,
    #[serde(with = "crate::serde_u128")]
    pub created_unix_nanos: u128,
    /// Rutas relativas (al proyecto) incluidas en el snapshot.
    pub files: Vec<String>,
    /// Rutas relativas que fueron solicitadas pero no existían al tomar el snapshot.
    ///
    /// Esto es crítico para rollback real: si una operación crea un archivo nuevo
    /// y luego falla, restaurar el snapshot debe borrar ese archivo, no dejarlo vivo.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub missing_files: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

fn new_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    // Padding para orden lexicográfico == orden temporal.
    format!("{nanos:039}")
}

fn snapshot_dir(root: &Path, id: &str) -> PathBuf {
    paths::snapshots_dir(root).join(id)
}

fn validate_snapshot_id(id: &str) -> io::Result<()> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_digit()) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "id de snapshot inválido",
        ));
    }
    Ok(())
}

fn safe_project_path(root: &Path, rel: &str) -> io::Result<PathBuf> {
    safety::resolve_within(root, Path::new(rel))
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))
}

fn safe_snapshot_file_path(files_base: &Path, rel: &str) -> io::Result<PathBuf> {
    safety::resolve_within(files_base, Path::new(rel))
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))
}

/// Crea un snapshot de las rutas relativas indicadas.
pub fn create(root: &Path, files: &[String], label: Option<&str>) -> io::Result<SnapshotMeta> {
    let id = new_id();
    let base = snapshot_dir(root, &id);
    let files_base = base.join("files");
    fs::create_dir_all(&files_base)?;

    let mut included = Vec::new();
    let mut missing_files = Vec::new();
    for rel in files {
        let src = safe_project_path(root, rel)?;
        match fs::symlink_metadata(&src) {
            Ok(_) => match fs::metadata(&src) {
                Ok(meta) if meta.is_file() => {}
                _ => continue,
            },
            Err(e) if e.kind() == io::ErrorKind::NotFound => {
                missing_files.push(rel.clone());
                continue;
            }
            Err(e) => return Err(e),
        }
        let dst = safe_snapshot_file_path(&files_base, rel)?;
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&src, &dst)?;
        included.push(rel.clone());
    }

    let meta = SnapshotMeta {
        id: id.clone(),
        created_unix_nanos: id.parse().unwrap_or(0),
        files: included,
        missing_files,
        label: label.map(|s| s.to_string()),
    };
    let json = serde_json::to_string_pretty(&meta).map_err(io::Error::other)?;
    crate::atomic::atomic_write_str(&base.join("manifest.json"), &json)?;
    Ok(meta)
}

/// Lista los snapshots, del más reciente al más antiguo.
pub fn list(root: &Path) -> Vec<SnapshotMeta> {
    let dir = paths::snapshots_dir(root);
    let Ok(entries) = fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut metas: Vec<SnapshotMeta> = entries
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .filter_map(|e| e.file_name().to_str().and_then(|id| load(root, id).ok()))
        .collect();
    metas.sort_by(|a, b| b.id.cmp(&a.id)); // descendente: más reciente primero
    metas
}

/// Carga el manifiesto de un snapshot por id.
pub fn load(root: &Path, id: &str) -> io::Result<SnapshotMeta> {
    validate_snapshot_id(id)?;
    let manifest_path = snapshot_dir(root, id).join("manifest.json");
    let content = fs::read_to_string(&manifest_path)?;
    let meta: SnapshotMeta = serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    if meta.id != id {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "manifest de snapshot no coincide con el directorio",
        ));
    }
    validate_snapshot_id(&meta.id)?;
    for rel in &meta.files {
        safe_project_path(root, rel)?;
        safe_snapshot_file_path(&snapshot_dir(root, id).join("files"), rel)?;
    }
    for rel in &meta.missing_files {
        safe_project_path(root, rel)?;
    }
    Ok(meta)
}

/// Restaura un snapshot: reescribe atómicamente los archivos guardados.
///
/// Nota: esta función es de bajo nivel y **no** crea un snapshot del estado
/// actual antes de sobrescribir ni recalcula integridad. Para una restauración
/// segura desde la app, usa [`crate::lifecycle::transactional_restore`].
pub fn restore(root: &Path, id: &str) -> io::Result<usize> {
    let files_base = snapshot_dir(root, id).join("files");
    let meta = load(root, id)?;

    let mut restored = 0;
    for rel in &meta.files {
        let src = safe_snapshot_file_path(&files_base, rel)?;
        let bytes = fs::read(&src)?;
        crate::atomic::atomic_write(&safe_project_path(root, rel)?, &bytes)?;
        restored += 1;
    }
    for rel in &meta.missing_files {
        let target = safe_project_path(root, rel)?;
        match fs::symlink_metadata(&target) {
            Ok(meta) if meta.file_type().is_dir() && !meta.file_type().is_symlink() => {
                fs::remove_dir_all(&target)?;
                restored += 1;
            }
            Ok(_) => {
                fs::remove_file(&target)?;
                restored += 1;
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
    }
    Ok(restored)
}

/// Retención: conserva los `keep` snapshots más recientes y borra el resto.
pub fn prune(root: &Path, keep: usize) -> io::Result<usize> {
    let metas = list(root);
    let mut removed = 0;
    for meta in metas.into_iter().skip(keep) {
        fs::remove_dir_all(snapshot_dir(root, &meta.id))?;
        removed += 1;
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_list_restore() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("project.yaml"), "v1").unwrap();

        let snap = create(root, &["project.yaml".into()], Some("antes")).unwrap();
        assert_eq!(snap.files, vec!["project.yaml".to_string()]);
        assert!(snap.missing_files.is_empty());

        // Modificar y restaurar.
        fs::write(root.join("project.yaml"), "v2").unwrap();
        let n = restore(root, &snap.id).unwrap();
        assert_eq!(n, 1);
        assert_eq!(fs::read_to_string(root.join("project.yaml")).unwrap(), "v1");

        let listed = list(root);
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].label.as_deref(), Some("antes"));
    }

    #[test]
    fn prune_keeps_newest() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("a.txt"), "x").unwrap();
        // Tres snapshots con ids crecientes garantizados.
        let s1 = create(root, &["a.txt".into()], None).unwrap();
        let s2 = create(root, &["a.txt".into()], None).unwrap();
        let s3 = create(root, &["a.txt".into()], None).unwrap();
        assert!(s1.id < s2.id && s2.id < s3.id);
        assert_eq!(list(root).len(), 3);

        let removed = prune(root, 2).unwrap();
        assert_eq!(removed, 1);
        let remaining = list(root);
        assert_eq!(remaining.len(), 2);
        // Se conservaron los dos más recientes.
        assert_eq!(remaining[0].id, s3.id);
        assert_eq!(remaining[1].id, s2.id);
    }

    #[test]
    fn restore_removes_files_that_were_absent_in_snapshot() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        let snap = create(root, &["new.yaml".into()], Some("before-create")).unwrap();
        assert!(snap.files.is_empty());
        assert_eq!(snap.missing_files, vec!["new.yaml".to_string()]);

        fs::write(root.join("new.yaml"), "created later").unwrap();
        let changed = restore(root, &snap.id).unwrap();
        assert_eq!(changed, 1);
        assert!(!root.join("new.yaml").exists());
    }

    #[test]
    fn create_does_not_mark_existing_directories_as_missing() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir(root.join("build")).unwrap();

        let snap = create(root, &["build".into()], Some("dir")).unwrap();

        assert!(snap.files.is_empty());
        assert!(snap.missing_files.is_empty());
        fs::write(root.join("build/created.txt"), "still here").unwrap();
        restore(root, &snap.id).unwrap();
        assert!(root.join("build/created.txt").exists());
    }

    #[test]
    fn rejects_traversal_in_snapshot_id_and_manifest_paths() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        assert!(load(root, "../escape").is_err());

        let id = "000000000000000000000000000000000000001";
        let base = snapshot_dir(root, id);
        fs::create_dir_all(&base).unwrap();
        let malicious = SnapshotMeta {
            id: id.to_string(),
            created_unix_nanos: 1,
            files: vec!["../outside.txt".to_string()],
            missing_files: vec![],
            label: None,
        };
        fs::write(
            base.join("manifest.json"),
            serde_json::to_string(&malicious).unwrap(),
        )
        .unwrap();

        assert!(load(root, id).is_err());
        assert!(restore(root, id).is_err());

        let mismatch_id = "000000000000000000000000000000000000002";
        let mismatch_base = snapshot_dir(root, mismatch_id);
        fs::create_dir_all(&mismatch_base).unwrap();
        let mismatch = SnapshotMeta {
            id: "000000000000000000000000000000000000003".to_string(),
            created_unix_nanos: 1,
            files: vec![],
            missing_files: vec![],
            label: None,
        };
        fs::write(
            mismatch_base.join("manifest.json"),
            serde_json::to_string(&mismatch).unwrap(),
        )
        .unwrap();
        assert!(load(root, mismatch_id).is_err());
    }
}
