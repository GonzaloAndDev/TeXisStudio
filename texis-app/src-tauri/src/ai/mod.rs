pub mod action;
pub mod context;
pub mod conversation;
pub mod engine;
pub mod providers;
pub mod request;
pub mod response;
pub mod safety;

// AIEngine v1 — Safe Writing, Review and LaTeX Assistance Layer
//
// Philosophy:
//   AI may suggest.
//   The application may guide.
//   The user decides.
//   The system protects.
//
// AIEngine is optional. The app opens, edits, compiles and exports
// without any AI provider configured.
