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

pub mod ir;
pub mod phase;
pub mod plan;
pub mod precedence;
pub mod resolver;

pub use ir::DocumentIR;
pub use phase::DocumentPhase;
pub use plan::DocumentPlan;
pub use resolver::{DocumentResolver, Resolution};
