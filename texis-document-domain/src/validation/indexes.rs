//! Validación del módulo de índices y listas (§7.3, Etapa D).
//!
//! Verifica la política de listas vacías (una lista habilitada debe tener
//! contenido real), la presencia del índice general y los límites de profundidad.
//! Consume el índice semántico derivado del IR; no inspecciona LaTeX.

use crate::ir::body_node::BodyNode;
use crate::ir::modules::IndexKind;
use crate::ir::DocumentIR;
use texis_document_contracts::diagnostics::{Diagnostic, DiagnosticStage, Diagnostics};
use texis_document_contracts::ids::ModuleId;

/// Conteo semántico de elementos listables.
#[derive(Default)]
struct Counts {
    figures: usize,
    tables: usize,
    code: usize,
    algorithms: usize,
}

fn count(ir: &DocumentIR) -> Counts {
    let mut c = Counts::default();
    for n in ir.all_body_nodes() {
        match n {
            BodyNode::Figure(_) | BodyNode::Visual(_) | BodyNode::PluginContribution(_) => {
                c.figures += 1
            }
            BodyNode::Table(_) => c.tables += 1,
            BodyNode::CodeListing(_) => c.code += 1,
            BodyNode::Algorithm(_) => c.algorithms += 1,
            _ => {}
        }
    }
    c
}

pub fn validate(ir: &DocumentIR) -> Diagnostics {
    let mut d = Diagnostics::new();
    let counts = count(ir);

    let has_toc = ir
        .indexes
        .lists
        .iter()
        .any(|l| l.kind == IndexKind::TableOfContents && l.enabled);
    if !has_toc {
        d.push(Diagnostic::warning(
            "IDX-002",
            ModuleId::Indexes,
            DiagnosticStage::Validation,
            "indexes.toc_missing",
        ));
    }

    for list in &ir.indexes.lists {
        if !list.enabled {
            continue;
        }

        // Política de listas vacías: no habilitar una lista sin su contenido.
        let available = match list.kind {
            IndexKind::TableOfContents => usize::MAX, // siempre tiene sentido
            IndexKind::ListOfFigures => counts.figures,
            IndexKind::ListOfTables => counts.tables,
            IndexKind::ListOfCode => counts.code,
            IndexKind::ListOfAlgorithms => counts.algorithms,
        };
        if available == 0 {
            d.push(
                Diagnostic::warning(
                    "IDX-001",
                    ModuleId::Indexes,
                    DiagnosticStage::Validation,
                    "indexes.empty_list_enabled",
                )
                .with_param("list", format!("{:?}", list.kind)),
            );
        }

        // Profundidad del índice general dentro de límites razonables.
        if list.kind == IndexKind::TableOfContents {
            if let Some(depth) = list.depth {
                if depth == 0 || depth > 5 {
                    d.push(
                        Diagnostic::warning(
                            "IDX-003",
                            ModuleId::Indexes,
                            DiagnosticStage::Validation,
                            "indexes.depth_out_of_range",
                        )
                        .with_param("depth", depth.to_string()),
                    );
                }
            }
        }
    }

    d
}
