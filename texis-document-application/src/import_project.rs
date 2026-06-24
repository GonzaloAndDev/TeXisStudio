//! Caso de uso: importar un proyecto a `DocumentIR` (§11.1, Etapa A).
//!
//! Orquesta la resolución (mediante un `DocumentResolver` concreto) y la
//! comprobación de invariantes del IR, fusionando los diagnósticos. No contiene
//! reglas de dominio: delega en el resolutor y en el propio IR.

use texis_document_domain::ir::DocumentIR;
use texis_document_domain::resolver::{DocumentResolver, Resolution};

/// Ejecuta el caso de uso de importación con un resolutor dado.
pub struct ImportProjectUseCase<R: DocumentResolver> {
    resolver: R,
}

impl<R: DocumentResolver> ImportProjectUseCase<R> {
    pub fn new(resolver: R) -> Self {
        Self { resolver }
    }

    /// Resuelve la entrada a un `DocumentIR` y verifica sus invariantes (§5.1).
    /// Los diagnósticos de invariantes se añaden a los de la resolución.
    pub fn execute(&self, input: R::Input) -> Resolution<DocumentIR> {
        let mut resolution = self.resolver.resolve(input);

        if let Some(ir) = &resolution.value {
            // Validación completa de dominio (invariantes + validadores por módulo).
            let diags = texis_document_domain::validation::validate_document(ir);
            resolution.diagnostics.extend(diags);
        }

        resolution
    }
}
