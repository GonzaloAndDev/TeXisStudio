//! Texto localizable. El dominio emite claves/parámetros; la experiencia los
//! traduce (§10). `LocalizedText` cubre cadenas que pueden venir ya en varios
//! idiomas desde el contenido del usuario (p. ej. resúmenes multilingües).

use crate::locale::LanguageTag;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Texto con una o más variantes por idioma. `BTreeMap` para serialización
/// determinista (importante para snapshots y builds reproducibles).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct LocalizedText {
    by_language: BTreeMap<String, String>,
}

impl LocalizedText {
    pub fn new() -> Self {
        Self::default()
    }

    /// Crea un texto con una única variante.
    pub fn single(lang: &LanguageTag, value: impl Into<String>) -> Self {
        let mut by_language = BTreeMap::new();
        by_language.insert(lang.as_str().to_string(), value.into());
        Self { by_language }
    }

    pub fn insert(&mut self, lang: &LanguageTag, value: impl Into<String>) {
        self.by_language
            .insert(lang.as_str().to_string(), value.into());
    }

    pub fn get(&self, lang: &LanguageTag) -> Option<&str> {
        self.by_language.get(lang.as_str()).map(String::as_str)
    }

    pub fn is_empty(&self) -> bool {
        self.by_language.is_empty()
    }

    pub fn languages(&self) -> impl Iterator<Item = &str> {
        self.by_language.keys().map(String::as_str)
    }
}
