//! Idioma documental. El vocabulario en sí vive en los packs de idioma
//! (TeXisStudio-Languages, contrato `document.json`); aquí solo el identificador
//! y la política de fallback (§9.2).

use serde::{Deserialize, Serialize};
use std::fmt;

/// Etiqueta de idioma estilo BCP-47 simplificada ("es", "en", "pt-BR", "zh").
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct LanguageTag(String);

impl LanguageTag {
    pub fn new(tag: impl Into<String>) -> Self {
        Self(tag.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for LanguageTag {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

/// Idioma documental resuelto. El fallback es explícito y visible (§9.2): una
/// lengua nativa sin terminología verificada declara su lengua de respaldo.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DocumentLocale {
    /// Idioma en el que el usuario escribe y espera el documento.
    pub primary: LanguageTag,
    /// Lengua de respaldo para vocabulario generado sin terminología verificada.
    /// `None` cuando el idioma primario tiene cobertura completa.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_fallback: Option<LanguageTag>,
}

impl DocumentLocale {
    pub fn new(primary: LanguageTag) -> Self {
        Self {
            primary,
            document_fallback: None,
        }
    }

    pub fn with_fallback(mut self, fallback: LanguageTag) -> Self {
        self.document_fallback = Some(fallback);
        self
    }
}
