use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub type AssetId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AssetType {
    RasterImage { format: RasterFormat },
    VectorImage { format: VectorFormat },
    Pdf,
    Diagram,
    ExternalTex,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RasterFormat {
    Png,
    Jpg,
    Bmp,
    Tiff,
    WebP,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum VectorFormat {
    Svg,
    Eps,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AssetStatus {
    Present,
    Missing,
    Moved { new_path: PathBuf },
    Modified,
    Unused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub id: AssetId,
    pub canonical_name: String,
    pub original_path: PathBuf,
    pub project_path: PathBuf, // siempre relativa al root del proyecto
    pub asset_type: AssetType,
    pub file_size_bytes: u64,
    pub checksum_sha256: String,
    pub imported_at: DateTime<Utc>,
    pub last_verified_at: DateTime<Utc>,
    pub status: AssetStatus,
}

impl Asset {
    pub fn from_file(
        source_path: &Path,
        project_path: PathBuf,
        canonical_name: String,
    ) -> Result<Self, std::io::Error> {
        let content = std::fs::read(source_path)?;
        let metadata = std::fs::metadata(source_path)?;
        let checksum = compute_sha256(&content);
        let asset_type = infer_asset_type(source_path);
        let now = Utc::now();

        Ok(Asset {
            id: Uuid::new_v4(),
            canonical_name,
            original_path: source_path.to_path_buf(),
            project_path,
            asset_type,
            file_size_bytes: metadata.len(),
            checksum_sha256: checksum,
            imported_at: now,
            last_verified_at: now,
            status: AssetStatus::Present,
        })
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct AssetRegistry {
    assets: HashMap<AssetId, Asset>,
    by_canonical_name: HashMap<String, AssetId>,
    by_checksum: HashMap<String, AssetId>,
}

#[derive(Debug, thiserror::Error)]
pub enum AssetError {
    #[error("Nombre canónico duplicado: '{0}'")]
    DuplicateCanonicalName(String),
    #[error("Checksum duplicado: '{0}' ya existe como '{1}'")]
    DuplicateChecksum(String, String),
    #[error("Asset no encontrado: {0}")]
    NotFound(AssetId),
    #[error("Error de E/S: {0}")]
    Io(#[from] std::io::Error),
}

pub struct VerificationReport {
    pub present: Vec<AssetId>,
    pub missing: Vec<AssetId>,
    pub moved: Vec<(AssetId, PathBuf)>,
    pub modified: Vec<AssetId>,
}

impl AssetRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, asset: Asset) -> Result<(), AssetError> {
        if self.by_canonical_name.contains_key(&asset.canonical_name) {
            return Err(AssetError::DuplicateCanonicalName(
                asset.canonical_name.clone(),
            ));
        }
        if let Some(existing_id) = self.by_checksum.get(&asset.checksum_sha256) {
            let existing_name = self.assets[existing_id].canonical_name.clone();
            return Err(AssetError::DuplicateChecksum(
                asset.checksum_sha256.clone(),
                existing_name,
            ));
        }
        self.by_canonical_name
            .insert(asset.canonical_name.clone(), asset.id);
        self.by_checksum
            .insert(asset.checksum_sha256.clone(), asset.id);
        self.assets.insert(asset.id, asset);
        Ok(())
    }

    pub fn remove(&mut self, id: &AssetId) -> Option<Asset> {
        let asset = self.assets.remove(id)?;
        self.by_canonical_name.remove(&asset.canonical_name);
        self.by_checksum.remove(&asset.checksum_sha256);
        Some(asset)
    }

    pub fn find_by_id(&self, id: &AssetId) -> Option<&Asset> {
        self.assets.get(id)
    }

    pub fn find_by_canonical_name(&self, name: &str) -> Option<&Asset> {
        self.by_canonical_name
            .get(name)
            .and_then(|id| self.assets.get(id))
    }

    pub fn find_by_checksum(&self, checksum: &str) -> Option<&Asset> {
        self.by_checksum
            .get(checksum)
            .and_then(|id| self.assets.get(id))
    }

    pub fn all(&self) -> impl Iterator<Item = &Asset> {
        self.assets.values()
    }

    pub fn len(&self) -> usize {
        self.assets.len()
    }

    pub fn is_empty(&self) -> bool {
        self.assets.is_empty()
    }

    /// Verifica el estado de todos los assets en disco.
    /// Actualiza los estados en el registry.
    pub fn verify_all(&mut self, project_root: &Path) -> VerificationReport {
        let mut report = VerificationReport {
            present: Vec::new(),
            missing: Vec::new(),
            moved: Vec::new(),
            modified: Vec::new(),
        };

        let ids: Vec<AssetId> = self.assets.keys().copied().collect();

        for id in ids {
            let asset = self.assets.get_mut(&id).unwrap();
            let abs_path = project_root.join(&asset.project_path);

            if abs_path.exists() {
                // Verificar checksum
                if let Ok(content) = std::fs::read(&abs_path) {
                    let current_checksum = compute_sha256(&content);
                    if current_checksum == asset.checksum_sha256 {
                        asset.status = AssetStatus::Present;
                        asset.last_verified_at = Utc::now();
                        report.present.push(id);
                    } else {
                        asset.status = AssetStatus::Modified;
                        report.modified.push(id);
                    }
                }
            } else {
                // Intentar encontrar por checksum en el árbol del proyecto
                let found = find_by_checksum_in_tree(project_root, &asset.checksum_sha256);
                if let Some(new_path) = found {
                    let rel_path = new_path
                        .strip_prefix(project_root)
                        .map(|p| p.to_path_buf())
                        .unwrap_or(new_path.clone());
                    asset.status = AssetStatus::Moved {
                        new_path: rel_path.clone(),
                    };
                    report.moved.push((id, rel_path));
                } else {
                    asset.status = AssetStatus::Missing;
                    report.missing.push(id);
                }
            }
        }

        report
    }
}

// ── Normalización de nombre canónico ─────────────────────────────────────────

/// Normaliza el nombre de un asset a un formato seguro para LaTeX y filesystems.
pub fn normalize_asset_name(original: &str, extension: &str) -> String {
    let stem = std::path::Path::new(original)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(original);

    let normalized: String = stem
        .chars()
        .map(|c| transliterate_char(c).unwrap_or('_'))
        .collect::<String>()
        .to_lowercase();

    // Colapsar guiones y underscores consecutivos
    let re = regex::Regex::new(r"[_\-]{2,}").unwrap();
    let collapsed = re.replace_all(&normalized, "_");

    // Eliminar guiones al inicio/fin
    let trimmed = collapsed.trim_matches(|c| c == '_' || c == '-').to_string();

    if trimmed.is_empty() {
        format!("asset.{}", extension)
    } else {
        format!("{}.{}", trimmed, extension)
    }
}

fn transliterate_char(c: char) -> Option<char> {
    match c {
        'a'..='z' | '0'..='9' => Some(c),
        'A'..='Z' => Some(c.to_ascii_lowercase()),
        ' ' | '\t' => Some('_'),
        '-' => Some('-'),
        'á' | 'à' | 'â' | 'ã' | 'ä' | 'å' | 'Á' | 'À' | 'Â' | 'Ã' | 'Ä' | 'Å' => {
            Some('a')
        }
        'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => Some('e'),
        'í' | 'ì' | 'î' | 'ï' | 'Í' | 'Ì' | 'Î' | 'Ï' => Some('i'),
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' | 'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ö' => Some('o'),
        'ú' | 'ù' | 'û' | 'ü' | 'Ú' | 'Ù' | 'Û' | 'Ü' => Some('u'),
        'ñ' | 'Ñ' => Some('n'),
        'ç' | 'Ç' => Some('c'),
        _ => None,
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn compute_sha256(data: &[u8]) -> String {
    format!("{:x}", Sha256::digest(data))
}

fn infer_asset_type(path: &Path) -> AssetType {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase());

    match ext.as_deref() {
        Some("png") => AssetType::RasterImage {
            format: RasterFormat::Png,
        },
        Some("jpg") | Some("jpeg") => AssetType::RasterImage {
            format: RasterFormat::Jpg,
        },
        Some("bmp") => AssetType::RasterImage {
            format: RasterFormat::Bmp,
        },
        Some("tiff") | Some("tif") => AssetType::RasterImage {
            format: RasterFormat::Tiff,
        },
        Some("webp") => AssetType::RasterImage {
            format: RasterFormat::WebP,
        },
        Some("svg") => AssetType::VectorImage {
            format: VectorFormat::Svg,
        },
        Some("eps") => AssetType::VectorImage {
            format: VectorFormat::Eps,
        },
        Some("pdf") => AssetType::Pdf,
        Some("tex") => AssetType::ExternalTex,
        _ => AssetType::Other,
    }
}

fn find_by_checksum_in_tree(root: &Path, checksum: &str) -> Option<PathBuf> {
    for entry in walkdir::WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        if let Ok(content) = std::fs::read(entry.path()) {
            if compute_sha256(&content) == checksum {
                return Some(entry.path().to_path_buf());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn make_temp_png(dir: &TempDir, name: &str) -> PathBuf {
        let path = dir.path().join(name);
        std::fs::write(&path, b"\x89PNG\r\n\x1a\n").unwrap(); // PNG header
        path
    }

    #[test]
    fn insert_and_find_by_name() {
        let dir = tempfile::tempdir().unwrap();
        let png = make_temp_png(&dir, "test.png");
        let asset = Asset::from_file(
            &png,
            PathBuf::from("assets/images/test.png"),
            "test.png".to_string(),
        )
        .unwrap();
        let mut reg = AssetRegistry::new();
        reg.insert(asset).unwrap();
        assert!(reg.find_by_canonical_name("test.png").is_some());
    }

    #[test]
    fn insert_rejects_duplicate_canonical_name() {
        let dir = tempfile::tempdir().unwrap();
        let png = make_temp_png(&dir, "a.png");
        let a1 =
            Asset::from_file(&png, PathBuf::from("assets/a.png"), "a.png".to_string()).unwrap();
        let a2 =
            Asset::from_file(&png, PathBuf::from("assets/b.png"), "a.png".to_string()).unwrap();
        let mut reg = AssetRegistry::new();
        reg.insert(a1).unwrap();
        assert!(matches!(
            reg.insert(a2),
            Err(AssetError::DuplicateCanonicalName(_))
        ));
    }

    #[test]
    fn verify_all_detects_missing() {
        let dir = tempfile::tempdir().unwrap();
        let png_path = dir.path().join("test.png");
        std::fs::write(&png_path, b"data").unwrap();
        let asset =
            Asset::from_file(&png_path, PathBuf::from("test.png"), "test.png".to_string()).unwrap();
        std::fs::remove_file(&png_path).unwrap();

        let mut reg = AssetRegistry::new();
        reg.insert(asset).unwrap();
        let report = reg.verify_all(dir.path());
        assert!(!report.missing.is_empty());
    }

    #[test]
    fn normalize_asset_name_strips_spaces_and_accents() {
        let result = normalize_asset_name("Mi Imagen (final) — versión 2", "png");
        assert!(!result.contains(' '));
        assert!(!result.contains('á'));
        assert!(result.ends_with(".png"));
    }

    #[test]
    fn normalize_asset_name_collapses_underscores() {
        let result = normalize_asset_name("a___b", "jpg");
        assert!(!result.contains("__"));
    }
}
