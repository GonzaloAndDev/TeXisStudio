//! Serialización del `DocumentIR` a JSON para depuración y CI (§5.1).

use texis_document_application::ports::{IrSerializeError, IrSerializer};
use texis_document_domain::ir::DocumentIR;

/// Serializador JSON (pretty) del IR. Determinista: el IR usa colecciones
/// ordenadas donde el orden importa para snapshots.
#[derive(Default)]
pub struct JsonIrSerializer {
    pretty: bool,
}

impl JsonIrSerializer {
    pub fn pretty() -> Self {
        Self { pretty: true }
    }

    pub fn compact() -> Self {
        Self { pretty: false }
    }
}

impl IrSerializer for JsonIrSerializer {
    fn serialize(&self, ir: &DocumentIR) -> Result<String, IrSerializeError> {
        let result = if self.pretty {
            serde_json::to_string_pretty(ir)
        } else {
            serde_json::to_string(ir)
        };
        result.map_err(|e| IrSerializeError(e.to_string()))
    }
}
