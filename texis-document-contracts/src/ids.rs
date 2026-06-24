//! Identificadores del dominio documental.
//!
//! Newtypes sobre `String` para evitar mezclar IDs de distinta naturaleza.
//! Son `serde(transparent)` para serializarse como cadenas planas.

use serde::{Deserialize, Serialize};
use std::fmt;

/// Genera un newtype de identificador con las implementaciones comunes.
macro_rules! id_newtype {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(String);

        impl $name {
            pub fn new(value: impl Into<String>) -> Self {
                Self(value.into())
            }

            pub fn as_str(&self) -> &str {
                &self.0
            }

            pub fn into_inner(self) -> String {
                self.0
            }
        }

        impl From<String> for $name {
            fn from(value: String) -> Self {
                Self(value)
            }
        }

        impl From<&str> for $name {
            fn from(value: &str) -> Self {
                Self(value.to_string())
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str(&self.0)
            }
        }
    };
}

id_newtype!(
    /// Identidad estable de un documento (proyecto) completo.
    DocumentId
);
id_newtype!(
    /// Identidad de una sección lógica importada o resuelta.
    SectionId
);
id_newtype!(
    /// Identidad de un bloque/nodo de contenido.
    NodeId
);
id_newtype!(
    /// Identidad de un asset (logo, imagen, PDF externo).
    AssetId
);
id_newtype!(
    /// Identidad de un perfil institucional.
    ProfileId
);

/// Módulos canónicos del dominio. Estable: usado como dimensión de diagnósticos.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleId {
    Cover,
    Preliminaries,
    Indexes,
    Body,
    Bibliography,
    Appendices,
    /// Coordinación/ensamblado, no pertenece a un módulo de dominio concreto.
    Assembler,
    /// Resolución de configuración / importación.
    Resolver,
}

impl fmt::Display for ModuleId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            ModuleId::Cover => "cover",
            ModuleId::Preliminaries => "preliminaries",
            ModuleId::Indexes => "indexes",
            ModuleId::Body => "body",
            ModuleId::Bibliography => "bibliography",
            ModuleId::Appendices => "appendices",
            ModuleId::Assembler => "assembler",
            ModuleId::Resolver => "resolver",
        };
        f.write_str(s)
    }
}
