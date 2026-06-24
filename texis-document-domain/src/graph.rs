//! Grafo semántico de dependencias (§ plan 2 "Grafo Incremental", paso 12).
//!
//! Derivado del `DocumentIR`, sustituye el escaneo tardío de LaTeX por un grafo
//! explícito que gobierna invalidación, previews por módulo y recompilación
//! parcial. Una arista `a → b` significa "a depende de b": si `b` cambia, `a`
//! debe reconstruirse.

use crate::ir::DocumentIR;
use crate::phase::DocumentPhase;
use std::collections::BTreeSet;

/// Nodo del grafo de build.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum BuildNode {
    Preamble,
    Phase(DocumentPhase),
    Bibliography,
    /// Documento final ensamblado (main.tex/PDF).
    Document,
}

/// Grafo de dependencias dirigido. `edges[i] = (dependiente, dependencia)`.
#[derive(Debug, Default)]
pub struct DependencyGraph {
    edges: Vec<(BuildNode, BuildNode)>,
    nodes: BTreeSet<BuildNode>,
}

impl DependencyGraph {
    fn add(&mut self, dependent: BuildNode, dependency: BuildNode) {
        self.nodes.insert(dependent.clone());
        self.nodes.insert(dependency.clone());
        self.edges.push((dependent, dependency));
    }

    /// Construye el grafo a partir del IR.
    pub fn build(ir: &DocumentIR) -> Self {
        let mut g = DependencyGraph::default();
        g.nodes.insert(BuildNode::Document);

        let active: Vec<DocumentPhase> = DocumentPhase::ORDER
            .iter()
            .copied()
            .filter(|p| phase_active(ir, *p))
            .collect();

        for phase in &active {
            // Toda fase depende del preámbulo (paquetes/fuentes).
            g.add(BuildNode::Phase(*phase), BuildNode::Preamble);
            // El documento depende de cada fase.
            g.add(BuildNode::Document, BuildNode::Phase(*phase));
        }

        // La bibliografía (citas) depende del cuerpo y los anexos.
        if !ir.bibliography.style.is_empty() {
            if active.contains(&DocumentPhase::MainMatter) {
                g.add(BuildNode::Bibliography, BuildNode::Phase(DocumentPhase::MainMatter));
            }
            if active.contains(&DocumentPhase::Appendices) {
                g.add(BuildNode::Bibliography, BuildNode::Phase(DocumentPhase::Appendices));
            }
            g.add(BuildNode::Phase(DocumentPhase::BackMatter), BuildNode::Bibliography);
        }

        // Los índices/listas dependen del cuerpo y los anexos (entradas y páginas).
        if active.contains(&DocumentPhase::Indexes) {
            for src in [DocumentPhase::MainMatter, DocumentPhase::Appendices] {
                if active.contains(&src) {
                    g.add(BuildNode::Phase(DocumentPhase::Indexes), BuildNode::Phase(src));
                }
            }
        }

        g
    }

    /// Nodos que dependen directamente de `target` (aristas inversas).
    fn direct_dependents(&self, target: &BuildNode) -> Vec<&BuildNode> {
        self.edges
            .iter()
            .filter(|(_, dep)| dep == target)
            .map(|(dependent, _)| dependent)
            .collect()
    }

    /// Conjunto de nodos que deben reconstruirse si `changed` cambia
    /// (clausura transitiva de dependientes, incluido `changed`).
    pub fn invalidation_set(&self, changed: &BuildNode) -> BTreeSet<BuildNode> {
        let mut out = BTreeSet::new();
        let mut stack = vec![changed.clone()];
        while let Some(node) = stack.pop() {
            if out.insert(node.clone()) {
                for dep in self.direct_dependents(&node) {
                    stack.push(dep.clone());
                }
            }
        }
        out
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len()
    }
}

fn phase_active(ir: &DocumentIR, p: DocumentPhase) -> bool {
    match p {
        DocumentPhase::Cover => true,
        DocumentPhase::Preliminaries => !ir.preliminaries.items.is_empty(),
        DocumentPhase::Indexes => ir.indexes.lists.iter().any(|l| l.enabled),
        DocumentPhase::MainMatter => !ir.body.sections.is_empty(),
        DocumentPhase::Appendices => !ir.appendices.appendices.is_empty(),
        DocumentPhase::BackMatter => !ir.bibliography.style.is_empty(),
    }
}
