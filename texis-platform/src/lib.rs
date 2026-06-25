//! # texis-platform
//!
//! Plataforma de producto/operación de TeXisStudio (Programa de Profesionalización
//! Industrial, Etapa 2). Protección de datos a nivel de filesystem, independiente
//! del modelo documental y del legado:
//!
//! - [`atomic`] escritura atómica (validar → temp → fsync → rename → verificar);
//! - [`lock`] bloqueo de proyecto (edición concurrente / dos ventanas);
//! - [`journal`] registro de operaciones estructurales (detecta interrupciones);
//! - [`integrity`] checksums sha256 (corrupción / modificación externa);
//! - [`snapshot`] snapshots verificables con retención y restauración;
//! - [`recovery`] backend del Recovery Center (reporta, nunca sobrescribe).

pub mod atomic;
pub mod integrity;
pub mod journal;
pub mod lifecycle;
pub mod lock;
pub mod paths;
pub mod recovery;
pub mod snapshot;

pub use integrity::{IntegrityIssue, IntegrityIssueKind, IntegrityManifest};
pub use lifecycle::{transactional_save, SaveOutcome};
pub use journal::{Journal, JournalEntry, OpStatus};
pub use lock::{LockError, LockInfo, ProjectLock};
pub use recovery::{scan as scan_recovery, RecoveryReport};
pub use snapshot::SnapshotMeta;
