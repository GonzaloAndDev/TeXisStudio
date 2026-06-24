//! # texis-document-domain
//!
//! Dominio documental: el significado del documento y sus invariantes (§4.1).
//!
//! **No depende** de React, Tauri, filesystem, YAML, GitHub ni procesos de
//! compilación. Su única dependencia interna es `texis-document-contracts`.
//!
//! Contiene: el `DocumentIR` (§5), las fases canónicas (§5.2), la política de
//! precedencia (§5.3), el `DocumentPlan` inmutable (§8.1) y el contrato
//! `DocumentResolver`.

pub mod backend;
pub mod bib_styles;
pub mod ir;
pub mod labels;
pub mod phase;
pub mod plan;
pub mod plan_builder;
pub mod precedence;
pub mod resolver;
pub mod validation;

pub use backend::{BackendCapabilities, RenderBackend, RenderedDocument, RenderedFile};
pub use ir::DocumentIR;
pub use phase::DocumentPhase;
pub use plan::DocumentPlan;
pub use plan_builder::PlanBuilder;
pub use resolver::{DocumentResolver, Resolution};
pub use validation::validate_document;
