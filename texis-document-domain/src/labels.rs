//! Registro centralizado de labels y referencias (§7.4, Etapa E).
//!
//! Recolecta todos los labels declarados en el documento (secciones, figuras,
//! tablas, ecuaciones, código, algoritmos, anexos) y todas las referencias
//! cruzadas, para detectar duplicados y referencias rotas sin inspeccionar LaTeX.

use crate::ir::body_node::BodyNode;
use crate::ir::modules::{Appendix, BodySection};
use crate::ir::DocumentIR;
use std::collections::BTreeMap;

/// Origen de un label, para diagnósticos legibles.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LabelOrigin {
    /// Tipo de elemento ("section", "figure", "table", "equation", ...).
    pub kind: &'static str,
    /// Id del nodo/sección que lo declara.
    pub owner: String,
}

/// Registro de labels y referencias del documento.
#[derive(Debug, Default)]
pub struct LabelRegistry {
    /// label → orígenes que lo declaran (>1 = duplicado).
    pub labels: BTreeMap<String, Vec<LabelOrigin>>,
    /// Referencias cruzadas: (target_label, nodo que refiere).
    pub references: Vec<(String, String)>,
    /// Claves de cita usadas: (citation_key, nodo).
    pub citations: Vec<(String, String)>,
}

impl LabelRegistry {
    pub fn build(ir: &DocumentIR) -> Self {
        let mut reg = LabelRegistry::default();
        for item in &ir.preliminaries.items {
            reg.scan_nodes(&item.nodes);
        }
        for section in &ir.body.sections {
            reg.scan_section(section);
        }
        for appendix in &ir.appendices.appendices {
            reg.scan_appendix(appendix);
        }
        reg
    }

    fn declare(&mut self, label: &str, kind: &'static str, owner: impl Into<String>) {
        if label.is_empty() {
            return;
        }
        self.labels
            .entry(label.to_string())
            .or_default()
            .push(LabelOrigin {
                kind,
                owner: owner.into(),
            });
    }

    fn scan_section(&mut self, s: &BodySection) {
        if let Some(l) = &s.label {
            self.declare(l, "section", s.id.as_str());
        }
        self.scan_nodes(&s.nodes);
        for c in &s.children {
            self.scan_section(c);
        }
    }

    fn scan_appendix(&mut self, a: &Appendix) {
        if let Some(l) = &a.label {
            self.declare(l, "appendix", a.id.as_str());
        }
        self.scan_nodes(&a.nodes);
        for c in &a.children {
            self.scan_section(c);
        }
    }

    fn scan_nodes(&mut self, nodes: &[BodyNode]) {
        for n in nodes {
            let owner = n.node_id().as_str().to_string();
            match n {
                BodyNode::Figure(f) => self.declare(&f.label, "figure", owner),
                BodyNode::Table(t) => self.declare(&t.label, "table", owner),
                BodyNode::Equation(e) => {
                    if let Some(l) = &e.label {
                        self.declare(l, "equation", owner);
                    }
                }
                BodyNode::CodeListing(c) => {
                    if let Some(l) = &c.label {
                        self.declare(l, "code", owner);
                    }
                }
                BodyNode::Algorithm(a) => {
                    if let Some(l) = &a.label {
                        self.declare(l, "algorithm", owner);
                    }
                }
                BodyNode::PluginContribution(p) => self.declare(&p.label, "plugin", owner),
                BodyNode::Visual(v) => self.declare(&v.label, "visual", owner),
                BodyNode::CrossReference(r) => {
                    self.references.push((r.target_label.clone(), owner));
                }
                BodyNode::Citation(c) => {
                    self.citations.push((c.citation_key.clone(), owner));
                }
                _ => {}
            }
        }
    }

    /// Labels declarados más de una vez.
    pub fn duplicates(&self) -> impl Iterator<Item = (&String, &Vec<LabelOrigin>)> {
        self.labels.iter().filter(|(_, v)| v.len() > 1)
    }

    /// Referencias cuyo target no existe.
    pub fn dangling_references(&self) -> impl Iterator<Item = &(String, String)> {
        self.references
            .iter()
            .filter(|(target, _)| !self.labels.contains_key(target))
    }
}
