//! # texis-document-application
//!
//! Casos de uso y puertos del núcleo documental (§4.1). Orquesta el dominio;
//! no contiene reglas tipográficas, académicas ni infraestructura.

pub mod import_project;
pub mod ports;

pub use import_project::ImportProjectUseCase;
pub use ports::{IrSerializeError, IrSerializer};
