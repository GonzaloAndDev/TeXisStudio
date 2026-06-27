//! Snapshots de proyecto (§2): copias verificables con retención configurable y
//! restauración. Un snapshot guarda las rutas indicadas bajo
//! `.texisstudio/snapshots/<id>/files/` más un `manifest.json`.

use crate::paths;
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

/// Crea un snapshot de las rutas relativas indicadas.
pub fn create(root: &Path, files: &[String], label: Option<&str>) -> io::Result<SnapshotMeta> {
    let id = new_id();
    let base = snapshot_dir(root, &id);
    let files_base = base.join("files");

    let mut included = Vec::new();
    for rel in files {
        let src = root.join(rel);
        if !src.is_file() {
            continue; // se omite lo ausente; el manifiesto refleja lo real
        }
        let dst = files_base.join(rel);
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
        label: label.map(|s| s.to_string()),
    };
    let json = serde_json::to_string_pretty(&meta)
        .map_err(io::Error::other)?;
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
        .filter_map(|e| {
            let manifest = e.path().join("manifest.json");
            let content = fs::read_to_string(manifest).ok()?;
            serde_json::from_str::<SnapshotMeta>(&content).ok()
        })
        .collect();
    metas.sort_by(|a, b| b.id.cmp(&a.id)); // descendente: más reciente primero
    metas
}

/// Restaura un snapshot: reescribe atómicamente los archivos guardados.
pub fn restore(root: &Path, id: &str) -> io::Result<usize> {
    let files_base = snapshot_dir(root, id).join("files");
    let manifest_path = snapshot_dir(root, id).join("manifest.json");
    let content = fs::read_to_string(&manifest_path)?;
    let meta: SnapshotMeta = serde_json::from_str(&content)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    let mut restored = 0;
    for rel in &meta.files {
        let src = files_base.join(rel);
        let bytes = fs::read(&src)?;
        crate::atomic::atomic_write(&root.join(rel), &bytes)?;
        restored += 1;
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
}
