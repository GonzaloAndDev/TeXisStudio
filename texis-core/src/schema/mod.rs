pub mod migrator;
pub mod versions;

pub use versions::{
    is_acceptable, is_migratable, is_supported, CURRENT_SCHEMA_VERSION, SUPPORTED_SCHEMA_VERSIONS,
};
