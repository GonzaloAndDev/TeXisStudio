// BibManager — DEPRECATED.
// Usar BibliographyRegistry (registry.rs) en su lugar.
// Este módulo se conserva solo para no romper código existente que lo importa.
// Será eliminado en la próxima limpieza de API.

#[allow(deprecated)]
#[deprecated(
    since = "1.1.0",
    note = "Usa BibliographyRegistry en lugar de BibManager"
)]
pub use legacy::BibManager;

#[allow(deprecated)]
mod legacy {
    use super::super::parser::{BibEntry, BibParser};
    use crate::error::CoreResult;
    use std::path::Path;

    #[deprecated(since = "1.1.0", note = "Usa BibliographyRegistry")]
    pub struct BibManager {
        entries: Vec<BibEntry>,
    }

    #[allow(deprecated)]
    impl BibManager {
        pub fn new() -> Self {
            Self {
                entries: Vec::new(),
            }
        }

        pub fn load_from_file(&mut self, path: &Path) -> CoreResult<()> {
            let new_entries = BibParser.parse_file(path)?;
            self.entries.extend(new_entries);
            Ok(())
        }

        pub fn entries(&self) -> &[BibEntry] {
            &self.entries
        }

        pub fn find_by_key(&self, key: &str) -> Option<&BibEntry> {
            self.entries.iter().find(|e| e.key == key)
        }
    }

    #[allow(deprecated)]
    impl Default for BibManager {
        fn default() -> Self {
            Self::new()
        }
    }
}
