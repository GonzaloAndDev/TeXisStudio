//! Contrato de resolución documental (§2.2, §5).
//!
//! Un `DocumentResolver` transforma una entrada de resolución en un
//! `DocumentIR` validado, acompañado de diagnósticos. La implementación concreta
//! para el modelo legacy vive en infraestructura (el importador), de modo que el
//! dominio nunca interpreta aliases ni perfiles crudos.

use crate::ir::DocumentIR;
use texis_document_contracts::diagnostics::Diagnostics;

/// Resultado de una resolución: un valor más los diagnósticos acumulados.
///
/// El valor puede existir aunque haya diagnósticos no bloqueantes; es `None`
/// solo cuando la resolución no pudo producir un IR utilizable.
#[derive(Debug, Clone)]
pub struct Resolution<T> {
    pub value: Option<T>,
    pub diagnostics: Diagnostics,
}

impl<T> Resolution<T> {
    pub fn ok(value: T) -> Self {
        Self {
            value: Some(value),
            diagnostics: Diagnostics::new(),
        }
    }

    pub fn with_diagnostics(value: Option<T>, diagnostics: Diagnostics) -> Self {
        Self { value, diagnostics }
    }

    /// `true` si hay un valor y ningún diagnóstico bloqueante.
    pub fn is_usable(&self) -> bool {
        self.value.is_some() && !self.diagnostics.has_blocking()
    }
}

/// Productor de `DocumentIR` a partir de una entrada de resolución.
pub trait DocumentResolver {
    /// Entrada neutral de la que se resuelve el documento.
    type Input;

    fn resolve(&self, input: Self::Input) -> Resolution<DocumentIR>;
}
