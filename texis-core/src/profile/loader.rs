// ÚNICO módulo en texis-core que importa serde_yaml para perfiles.

use super::model::{Profile, ProfileStatus};
use crate::error::{CoreError, CoreResult};
use crate::schema::versions;
use std::path::Path;

/// Aliases built-in que se aplican a TODOS los perfiles.
/// Permiten que los repositorios externos usen nombres alternativos de element_id
/// sin romper el generador ni los validadores del core.
///
/// NOTA: "abstract" → "abstract_en" fue eliminado (P1.3) porque causaba colisión
/// silenciosa entre el resumen genérico y el abstract en inglés.
/// IDs oficiales: abstract (genérico), abstract_es, abstract_en, abstract_fr, abstract_pt.
const BUILTIN_ALIASES: &[(&str, &str)] = &[
    ("cover", "title_page"),
    ("toc", "table_of_contents"),
    ("bibliography", "references"),
    ("appendix", "appendices"),
    ("experimentation", "results"),
];

/// IDs de sección con semántica conocida por el generador y los validadores (P1.4).
/// Un element_id fuera de esta lista dispara un warning en stderr — no un error.
const KNOWN_ELEMENT_IDS: &[&str] = &[
    "cover",
    "title_page",
    "toc",
    "table_of_contents",
    "abstract",
    "abstract_es",
    "abstract_en",
    "abstract_fr",
    "abstract_pt",
    "acknowledgements",
    "list_of_figures",
    "list_of_tables",
    "list_of_algorithms",
    "list_of_listings",
    "list_of_abbreviations",
    "list_of_acronyms",
    "glossary",
    "nomenclature",
    "introduction",
    "literature_review",
    "theoretical_framework",
    "methodology",
    "results",
    "experimentation",
    "discussion",
    "conclusions",
    "bibliography",
    "references",
    "appendix",
    "appendices",
];

pub struct ProfileLoader;

impl ProfileLoader {
    pub fn load_from_file(&self, path: &Path) -> CoreResult<Profile> {
        let content = std::fs::read_to_string(path).map_err(CoreError::Io)?;
        self.load_from_str(&content, &path.to_string_lossy())
    }

    pub fn load_from_str(&self, content: &str, source: &str) -> CoreResult<Profile> {
        let mut profile: Profile =
            serde_yaml::from_str(content).map_err(|e| CoreError::YamlParse {
                path: source.to_string(),
                message: e.to_string(),
            })?;

        // Validar y migrar schema_version.
        // Perfiles sin schema_version (externos/legacy) quedan como Experimental.
        if profile.schema_version.is_empty() {
            if profile.status == ProfileStatus::Experimental {
                // Mantener Experimental — sin fuente oficial trazada.
            }
        } else if !versions::is_acceptable(&profile.schema_version) {
            return Err(CoreError::UnsupportedSchemaVersion {
                version: profile.schema_version.clone(),
                current: versions::CURRENT_SCHEMA_VERSION.to_string(),
            });
        } else if versions::is_migratable(&profile.schema_version) {
            profile.schema_version = versions::CURRENT_SCHEMA_VERSION.to_string();
        }

        // Compilar tabla de aliases: built-in + los del perfil.
        let mut aliases: std::collections::HashMap<String, String> = BUILTIN_ALIASES
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        if let Some(profile_aliases) = &profile.element_aliases {
            for (k, v) in profile_aliases {
                aliases.insert(k.clone(), v.clone());
            }
        }

        // Resolver element_id de cada sección usando la tabla de aliases.
        for section in &mut profile.sections {
            if let Some(canonical) = aliases.get(&section.element_id) {
                section.element_id = canonical.clone();
            }
        }

        // P1.4: warn on unknown element_id — non-blocking, profile loads normally.
        for section in &profile.sections {
            if !KNOWN_ELEMENT_IDS.contains(&section.element_id.as_str()) {
                eprintln!(
                    "[TeXisStudio] W_UNKNOWN_ELEMENT_ID: perfil '{}', sección '{}' usa \
                     element_id '{}' desconocido. El perfil carga normalmente.",
                    profile.id, section.id, section.element_id
                );
            }
        }

        Ok(profile)
    }

    /// Serializa un perfil a YAML y lo escribe en `path`.
    pub fn save_to_file(&self, profile: &Profile, path: &Path) -> CoreResult<()> {
        let yaml = serde_yaml::to_string(profile).map_err(|e| CoreError::YamlParse {
            path: path.to_string_lossy().to_string(),
            message: e.to_string(),
        })?;
        std::fs::write(path, yaml).map_err(CoreError::Io)?;
        Ok(())
    }
}
