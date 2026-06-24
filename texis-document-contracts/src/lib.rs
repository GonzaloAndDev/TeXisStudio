//! # texis-document-contracts
//!
//! Shared Kernel (§16.2) y contratos versionados (§16.3) del núcleo documental.
//!
//! Base del grafo de dependencias: **no depende de ningún otro crate del
//! workspace**. Solo conceptos universales: IDs, diagnósticos, idioma,
//! provenance, assets, medidas, capacidades y versiones de contrato.
//!
//! No contiene lógica de módulos (Regla §16.2: no usar el kernel como escondite
//! de lógica de dominio).

pub mod assets;
pub mod capabilities;
pub mod diagnostics;
pub mod ids;
pub mod locale;
pub mod manifest;
pub mod measures;
pub mod profile;
pub mod provenance;
pub mod text;
pub mod version;

// Re-exports de conveniencia para los consumidores del kernel.
pub use assets::{AssetRef, AssetRole};
pub use capabilities::{Capability, CapabilitySet};
pub use diagnostics::{
    Diagnostic, DiagnosticCode, DiagnosticStage, Diagnostics, DocumentLocation, Evidence,
    Remediation, Severity,
};
pub use ids::{AssetId, DocumentId, ModuleId, NodeId, ProfileId, SectionId};
pub use locale::{DocumentLocale, LanguageTag};
pub use manifest::{BuildManifest, ResourceHash, ToolchainStamp};
pub use measures::{Length, LengthUnit};
pub use profile::{Profile2, ProfilePolicy, ProfileIdentity, TrustLevel};
pub use provenance::{ProvenanceEntry, Resolved, ResolutionProvenance, ValueSource};
pub use text::LocalizedText;
pub use version::{ContractVersion, DocumentSchemaVersion};
