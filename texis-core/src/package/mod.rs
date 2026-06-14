pub mod detector;
pub mod engine;
pub mod model;
pub mod registry;

pub use detector::PackageDetector;
pub use engine::PackageEngine;
pub use model::{
    ConflictResolution, PackageAnalysis, PackageConflict, PackagePriority, PackageRequirement,
    RequirementReason,
};
pub use registry::{EntrySource, KnownConflict, PackageRegistry, RegistryEntry};
