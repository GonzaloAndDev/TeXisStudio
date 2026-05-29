use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GlossaryEntryStatus {
    /// Definido y usado en el documento.
    Active,
    /// Definido pero sin ningún \gls{} en el documento.
    DefinedUnused,
    /// Referenciado con \gls{} pero no definido.
    UsedUndefined,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlossaryEntry {
    pub key: String,
    pub name: String,
    pub name_plural: Option<String>,
    pub description: String,
    pub symbol: Option<String>,
    pub category: Option<String>,
    pub status: GlossaryEntryStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcronymEntry {
    pub key: String,
    pub short: String,
    pub long: String,
    pub long_plural: Option<String>,
    pub description: Option<String>,
    pub status: GlossaryEntryStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GlossaryRegistry {
    pub entries: Vec<GlossaryEntry>,
    pub acronyms: Vec<AcronymEntry>,
}

impl GlossaryRegistry {
    pub fn new() -> Self { Self::default() }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty() && self.acronyms.is_empty()
    }

    pub fn has_issues(&self) -> bool {
        self.entries.iter().any(|e| e.status != GlossaryEntryStatus::Active)
            || self.acronyms.iter().any(|a| a.status != GlossaryEntryStatus::Active)
    }

    pub fn unused_entries(&self) -> Vec<&GlossaryEntry> {
        self.entries.iter().filter(|e| e.status == GlossaryEntryStatus::DefinedUnused).collect()
    }

    pub fn undefined_references(&self) -> Vec<String> {
        let mut keys = Vec::new();
        for e in &self.entries {
            if e.status == GlossaryEntryStatus::UsedUndefined { keys.push(e.key.clone()); }
        }
        for a in &self.acronyms {
            if a.status == GlossaryEntryStatus::UsedUndefined { keys.push(a.key.clone()); }
        }
        keys
    }
}
