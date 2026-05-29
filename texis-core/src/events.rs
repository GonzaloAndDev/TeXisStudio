use crate::bibliography::model::BibliographicRecordId;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

pub type BuildId = Uuid;
pub type AssetId = Uuid;
pub type ProjectId = Uuid;
pub type DiagnosticId = Uuid;

/// Tipos de documentos — hint para sugerencias de perfil.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DocumentTypeHint {
    Thesis,
    Article,
    Book,
    TechnicalManual,
    Report,
    Other,
}

/// Modos de compilación.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BuildMode {
    Full,
    Quick,
    Draft,
    Clean,
}

/// Resumen de resultado de compilación (sin logs completos).
#[derive(Debug, Clone)]
pub struct BuildResultSummary {
    pub success: bool,
    pub pdf_path: Option<PathBuf>,
    pub duration_ms: u64,
    pub diagnostic_count: usize,
}

/// Tipo de label en una referencia cruzada.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum LabelKind {
    Chapter,
    Section,
    Subsection,
    Subsubsection,
    Figure,
    Table,
    Equation,
    Algorithm,
    Listing,
    Appendix,
    Theorem,
    Definition,
    Unknown,
}

/// Tipo de modificación de proyecto.
#[derive(Debug, Clone)]
pub enum ProjectModificationKind {
    MetadataChanged,
    StructureChanged,
    BuildConfigChanged,
    ProfileChanged,
}

/// Referencia a un perfil documental.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentProfileRef {
    pub id: String,
    pub version: Option<String>,
}

// ── ProjectEvent ──────────────────────────────────────────────────────────────

/// Todos los eventos que puede emitir el sistema.
/// Los engines se suscriben a los tipos que les interesan.
#[derive(Debug, Clone)]
pub enum ProjectEvent {
    // Ciclo de vida del proyecto
    ProjectOpened { id: ProjectId, root_path: PathBuf },
    ProjectClosed { id: ProjectId },
    ProjectModified { id: ProjectId, what: ProjectModificationKind },

    // Archivos .tex
    TexFileSaved { path: PathBuf },
    TexFileCreated { path: PathBuf },
    TexFileDeleted { path: PathBuf },
    TexFileRenamed { old_path: PathBuf, new_path: PathBuf },

    // Assets
    AssetImported { id: AssetId, path: PathBuf },
    AssetMissing { id: AssetId, last_known_path: PathBuf },
    AssetMoved { id: AssetId, old_path: PathBuf, new_path: PathBuf },
    AssetModified { id: AssetId },

    // Labels / referencias cruzadas
    LabelCreated { key: String, kind: LabelKind, file: PathBuf },
    LabelRenamed { old_key: String, new_key: String },
    LabelDeleted { key: String },
    BrokenReferenceDetected { ref_key: String, file: PathBuf, line: u32 },

    // Bibliografía
    BibliographyRecordAdded { id: BibliographicRecordId, cite_key: String },
    BibliographyRecordUpdated { id: BibliographicRecordId },
    BibliographyRecordRemoved { cite_key: String },
    BibFileChangedExternally { path: PathBuf },

    // Diccionarios
    DictionaryChanged { lang: String },
    CustomWordAdded { word: String },

    // Compilación
    BuildStarted { build_id: BuildId, mode: BuildMode },
    BuildStepStarted { build_id: BuildId, step: String },
    BuildStepFinished { build_id: BuildId, step: String, success: bool },
    BuildFinished { build_id: BuildId, result: BuildResultSummary },
    BuildFailed { build_id: BuildId, reason: String },

    // Diagnósticos
    DiagnosticsUpdated { source: String, count: usize },

    // Perfil
    ProfileChanged { old: DocumentProfileRef, new: DocumentProfileRef },

    // Paquetes LaTeX
    PackageAdded { name: String, reason: String },
    PackageConflictDetected { package_a: String, package_b: String },
}

// ── EventBus ──────────────────────────────────────────────────────────────────

/// Bus de eventos en memoria. Los handlers se registran por tipo de evento.
/// Todos los handlers se ejecutan en el hilo que llama a `emit`.
pub struct EventBus {
    handlers: Vec<Box<dyn Fn(&ProjectEvent) + Send + Sync>>,
}

impl EventBus {
    pub fn new() -> Self {
        Self { handlers: Vec::new() }
    }

    /// Registra un handler que recibe todos los eventos.
    /// Usar con filtro interno si solo se quiere un subconjunto.
    pub fn subscribe<F>(&mut self, handler: F)
    where
        F: Fn(&ProjectEvent) + Send + Sync + 'static,
    {
        self.handlers.push(Box::new(handler));
    }

    /// Emite un evento a todos los handlers registrados.
    /// Regla: el emisor no debe suscribirse al mismo tipo que emite.
    pub fn emit(&self, event: &ProjectEvent) {
        for handler in &self.handlers {
            handler(event);
        }
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}

// ── Macros de ayuda ───────────────────────────────────────────────────────────

/// Suscribe a un subconjunto de eventos usando pattern matching.
/// Uso:
/// ```rust
/// subscribe_to!(bus, |event| {
///     ProjectEvent::AssetImported { id, path } => { ... }
/// });
/// ```
#[macro_export]
macro_rules! subscribe_to {
    ($bus:expr, |$event:ident| { $($pattern:pat => $body:expr),* $(,)? }) => {
        $bus.subscribe(move |$event| {
            #[allow(unused_variables)]
            match $event {
                $($pattern => { $body }),*
                _ => {}
            }
        });
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[test]
    fn event_bus_delivers_event_to_handler() {
        let mut bus = EventBus::new();
        let received = Arc::new(Mutex::new(false));
        let received_clone = received.clone();

        bus.subscribe(move |event| {
            if let ProjectEvent::TexFileSaved { .. } = event {
                *received_clone.lock().unwrap() = true;
            }
        });

        bus.emit(&ProjectEvent::TexFileSaved {
            path: PathBuf::from("main.tex"),
        });

        assert!(*received.lock().unwrap());
    }

    #[test]
    fn event_bus_multiple_handlers() {
        let mut bus = EventBus::new();
        let count = Arc::new(Mutex::new(0u32));

        for _ in 0..3 {
            let count_clone = count.clone();
            bus.subscribe(move |_| {
                *count_clone.lock().unwrap() += 1;
            });
        }

        bus.emit(&ProjectEvent::ProjectClosed {
            id: Uuid::new_v4(),
        });

        assert_eq!(*count.lock().unwrap(), 3);
    }

    #[test]
    fn event_bus_no_handlers_does_not_panic() {
        let bus = EventBus::new();
        bus.emit(&ProjectEvent::DictionaryChanged {
            lang: "es".to_string(),
        });
    }
}
