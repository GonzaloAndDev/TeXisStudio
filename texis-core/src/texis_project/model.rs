use crate::asset::registry::AssetRegistry;
use crate::bibliography::registry::BibliographyRegistry;
use crate::events::DocumentProfileRef;
use crate::reference::registry::LabelRegistry;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

pub type ProjectId = Uuid;

// ── SchemaVersion ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SchemaVersion {
    pub major: u16,
    pub minor: u16,
    pub patch: u16,
}

impl SchemaVersion {
    pub const CURRENT: Self = Self {
        major: 1,
        minor: 0,
        patch: 0,
    };

    pub fn is_backward_compatible(&self, other: &SchemaVersion) -> bool {
        self.major == other.major && self.minor >= other.minor
    }

    pub fn is_newer_than(&self, other: &SchemaVersion) -> bool {
        (self.major, self.minor, self.patch) > (other.major, other.minor, other.patch)
    }
}

impl std::fmt::Display for SchemaVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

impl Default for SchemaVersion {
    fn default() -> Self {
        Self::CURRENT
    }
}

// ── Metadatos del proyecto ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectMetadata {
    pub title: String,
    pub subtitle: Option<String>,
    pub authors: Vec<ProjectAuthor>,
    pub institution: Option<String>,
    pub department: Option<String>,
    pub date: Option<ProjectDate>,
    pub language: String,
    pub additional_languages: Vec<String>,
    pub abstract_text: Option<MultilingualText>,
    pub keywords: Vec<String>,
    pub document_type: DocumentTypeHint,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectAuthor {
    pub name: String,
    pub email: Option<String>,
    pub orcid: Option<String>,
    pub affiliation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProjectDate {
    Fixed(chrono::NaiveDate),
    Dynamic, // \today en LaTeX
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MultilingualText {
    pub entries: HashMap<String, String>, // BCP-47 → texto
}

impl MultilingualText {
    pub fn get(&self, lang: &str) -> Option<&str> {
        self.entries.get(lang).map(|s| s.as_str())
    }

    pub fn set(&mut self, lang: impl Into<String>, text: impl Into<String>) {
        self.entries.insert(lang.into(), text.into());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub enum DocumentTypeHint {
    Thesis,
    Article,
    Book,
    TechnicalManual,
    Report,
    Cv,
    Letter,
    #[default]
    Other,
}

// ── Configuración de compilación ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildConfig {
    pub engine: LatexEngine,
    pub bibliography_tool: BibliographyTool,
    pub glossary_tool: Option<GlossaryTool>,
    pub index_tool: Option<IndexTool>,
    pub output_dir: PathBuf,
    pub clean_on_build: bool,
    pub draft_mode: bool,
    pub shell_escape: bool, // desactivado por defecto — NUNCA activar sin confirmación
    pub synctex: bool,
}

impl Default for BuildConfig {
    fn default() -> Self {
        Self {
            engine: LatexEngine::XeLatex,
            bibliography_tool: BibliographyTool::Biber,
            glossary_tool: None,
            index_tool: None,
            output_dir: PathBuf::from("build"),
            clean_on_build: false,
            draft_mode: false,
            shell_escape: false,
            synctex: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LatexEngine {
    PdfLatex,
    XeLatex,
    LuaLatex,
}

impl std::fmt::Display for LatexEngine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LatexEngine::PdfLatex => write!(f, "pdflatex"),
            LatexEngine::XeLatex => write!(f, "xelatex"),
            LatexEngine::LuaLatex => write!(f, "lualatex"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum BibliographyTool {
    Biber,
    BibTeX,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum GlossaryTool {
    MakeGlossaries,
    Bib2Gls,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum IndexTool {
    MakeIndex,
    Xindy,
}

// ── Estado del workspace ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WorkspaceState {
    pub open_files: Vec<PathBuf>,
    pub active_file: Option<PathBuf>,
    pub zoom_level: f32,
    pub last_build_summary: Option<BuildSummary>,
    pub editor_cursor_positions: HashMap<String, CursorPosition>, // path → posición
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildSummary {
    pub success: bool,
    pub pdf_path: Option<PathBuf>,
    pub duration_ms: u64,
    pub diagnostic_count: usize,
    pub built_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
}

// ── Registries del proyecto ───────────────────────────────────────────────────

/// Todos los registros vivos del proyecto.
/// Algunos son regenerables (labels, assets, packages), otros no (bibliography con provenance).
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct ProjectRegistries {
    pub assets: AssetRegistry,
    pub bibliography: BibliographyRegistry,
    pub labels: LabelRegistry,
    // GlossaryRegistry y PackageRegistry se añadirán en sus propios módulos
}

// ── TexisProject — modelo canónico ────────────────────────────────────────────

#[derive(Debug)]
pub struct TexisProject {
    pub id: ProjectId,
    pub schema_version: SchemaVersion,
    /// Directorio raíz del proyecto (ruta absoluta en disco).
    pub root_path: PathBuf,
    /// Archivo LaTeX raíz, relativo a root_path.
    pub root_file: PathBuf,
    /// Archivo de proyecto: root_path/.texisstudio/project.json
    pub project_file: PathBuf,
    pub profile: Option<DocumentProfileRef>,
    pub metadata: ProjectMetadata,
    pub build_config: BuildConfig,
    pub registries: ProjectRegistries,
    pub workspace_state: WorkspaceState,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
}

impl TexisProject {
    pub fn new(root_path: PathBuf, root_file: PathBuf) -> Self {
        let project_file = root_path.join(".texisstudio").join("project.json");
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            schema_version: SchemaVersion::CURRENT,
            root_path,
            root_file,
            project_file,
            profile: None,
            metadata: ProjectMetadata {
                language: "es".to_string(),
                ..Default::default()
            },
            build_config: BuildConfig::default(),
            registries: ProjectRegistries::default(),
            workspace_state: WorkspaceState::default(),
            created_at: now,
            modified_at: now,
        }
    }

    /// Ruta absoluta al directorio .texisstudio/
    pub fn texisstudio_dir(&self) -> PathBuf {
        self.root_path.join(".texisstudio")
    }

    /// Ruta absoluta al directorio de build
    pub fn build_dir(&self) -> PathBuf {
        self.root_path.join(&self.build_config.output_dir)
    }

    /// Ruta absoluta al archivo raíz
    pub fn root_file_abs(&self) -> PathBuf {
        self.root_path.join(&self.root_file)
    }

    /// Marca el proyecto como modificado
    pub fn touch(&mut self) {
        self.modified_at = Utc::now();
    }
}

/// Versión serializable de TexisProject (para project.json).
/// No incluye registries (se guardan en archivos separados) ni workspace_state.
#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub id: ProjectId,
    pub schema_version: SchemaVersion,
    pub root_file: PathBuf,
    pub profile: Option<DocumentProfileRef>,
    pub metadata: ProjectMetadata,
    pub build_config: BuildConfig,
    pub created_at: DateTime<Utc>,
    pub modified_at: DateTime<Utc>,
}

impl ProjectConfig {
    pub fn from_project(project: &TexisProject) -> Self {
        Self {
            id: project.id,
            schema_version: project.schema_version.clone(),
            root_file: project.root_file.clone(),
            profile: project.profile.clone(),
            metadata: project.metadata.clone(),
            build_config: project.build_config.clone(),
            created_at: project.created_at,
            modified_at: project.modified_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_version_current_is_1_0_0() {
        assert_eq!(SchemaVersion::CURRENT.major, 1);
        assert_eq!(SchemaVersion::CURRENT.minor, 0);
        assert_eq!(SchemaVersion::CURRENT.patch, 0);
    }

    #[test]
    fn schema_version_backward_compatible_same_major() {
        let current = SchemaVersion {
            major: 1,
            minor: 2,
            patch: 0,
        };
        let older = SchemaVersion {
            major: 1,
            minor: 0,
            patch: 0,
        };
        assert!(current.is_backward_compatible(&older));
        assert!(!older.is_backward_compatible(&current));
    }

    #[test]
    fn schema_version_incompatible_different_major() {
        let v1 = SchemaVersion {
            major: 1,
            minor: 0,
            patch: 0,
        };
        let v2 = SchemaVersion {
            major: 2,
            minor: 0,
            patch: 0,
        };
        assert!(!v1.is_backward_compatible(&v2));
        assert!(!v2.is_backward_compatible(&v1));
    }

    #[test]
    fn build_config_default_shell_escape_is_false() {
        let cfg = BuildConfig::default();
        assert!(
            !cfg.shell_escape,
            "shell_escape NUNCA debe estar activo por defecto"
        );
    }

    #[test]
    fn project_new_sets_texisstudio_dir() {
        let root = PathBuf::from("/tmp/myproject");
        let p = TexisProject::new(root.clone(), PathBuf::from("main.tex"));
        assert_eq!(p.texisstudio_dir(), root.join(".texisstudio"));
    }

    #[test]
    fn multilingual_text_set_and_get() {
        let mut t = MultilingualText::default();
        t.set("es", "Resumen de la tesis");
        t.set("en", "Thesis abstract");
        assert_eq!(t.get("es"), Some("Resumen de la tesis"));
        assert_eq!(t.get("fr"), None);
    }
}
