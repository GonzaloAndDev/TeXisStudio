pub mod detector;
pub mod model;

pub use detector::PackageDetector;
pub use model::{
    ConflictResolution, PackageAnalysis, PackageConflict, PackagePriority, PackageRequirement,
    RequirementReason,
};
