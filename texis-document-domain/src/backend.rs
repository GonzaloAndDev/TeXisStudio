//! Puerto de backend de render (§8.2).
//!
//! El primer backend será LaTeX, pero el dominio se diseña contra este puerto
//! para no acoplarse a comandos LaTeX concretos. Un backend declara capacidades;
//! si una solicitud no puede resolverse fielmente, lo expresa como diagnóstico
//! en vez de simular que puede hacerlo (§8.3).

use crate::ir::DocumentIR;
use crate::plan::DocumentPlan;
use texis_document_contracts::capabilities::CapabilitySet;
use texis_document_contracts::diagnostics::Diagnostic;

/// Capacidades declaradas por un backend de render.
#[derive(Debug, Clone, Default)]
pub struct BackendCapabilities {
    pub capabilities: CapabilitySet,
    /// Identificador del backend ("latex").
    pub backend_id: String,
}

/// Un archivo renderizado en memoria. La escritura a disco (atómica) pertenece
/// a infraestructura; el backend solo produce contenido.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RenderedFile {
    /// Ruta relativa a la raíz del build (p. ej. "main.tex", "sections/body.tex").
    pub relative_path: String,
    pub content: String,
}

/// Documento renderizado: conjunto ordenado de archivos + diagnósticos.
#[derive(Debug, Clone, Default)]
pub struct RenderedDocument {
    pub files: Vec<RenderedFile>,
    pub diagnostics: Vec<Diagnostic>,
}

impl RenderedDocument {
    /// Devuelve el contenido de `main.tex` si existe.
    pub fn main_tex(&self) -> Option<&str> {
        self.files
            .iter()
            .find(|f| f.relative_path == "main.tex")
            .map(|f| f.content.as_str())
    }
}

/// Backend de render. Transforma un `DocumentIR` + `DocumentPlan` en archivos.
pub trait RenderBackend {
    fn capabilities(&self) -> BackendCapabilities;

    /// Renderiza el documento completo según el plan inmutable.
    fn render_document(&self, ir: &DocumentIR, plan: &DocumentPlan) -> RenderedDocument;
}
