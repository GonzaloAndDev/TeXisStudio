//! # texis-document-infra
//!
//! Infraestructura del núcleo documental: adaptadores que implementan los
//! puertos de la aplicación (§4.1). Aquí vive el acoplamiento con el modelo
//! legacy (`texis-core`) y con formatos concretos (JSON).
//!
//! Convive con `texis-core` (congelado) hasta la Etapa I, donde se retira la
//! dependencia legacy.

pub mod fixtures;
pub mod hasher;
pub mod json_serializer;
pub mod latex_backend;
pub mod legacy_importer;

pub use hasher::Sha256Hasher;
pub use json_serializer::JsonIrSerializer;
pub use latex_backend::LatexRenderBackend;
pub use legacy_importer::{import_project, LegacyProjectImporter};
