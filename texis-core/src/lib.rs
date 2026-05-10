pub mod bibliography;
pub mod compiler;
pub mod element;
pub mod error;
pub mod generator;
pub mod profile;
pub mod project;
pub mod schema;
pub mod template;
pub mod validator;

pub use compiler::{CompilationBackend, CompilationOptions, CompilationResult};
pub use error::{CoreError, CoreResult};
pub use generator::LaTeXGenerator;
pub use profile::model::Profile;
pub use element::model::Element;
pub use project::model::{ProjectModel, ProjectSection, ContentBlock};
pub use validator::report::ValidationReport;
