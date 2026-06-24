//! Etapa E — Cuerpo y plugins: labels centralizados, referencias, seguridad de
//! LaTeX crudo y contrato de contribuciones de plugin.

use texis_document_domain::ir::body_node::{
    BodyNode, CrossReference, PluginContribution, TrustedRawLatex,
};
use texis_document_domain::labels::LabelRegistry;
use texis_document_domain::validation::body;
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::import_project;

fn ir() -> texis_document_domain::ir::DocumentIR {
    import_project(&sample_thesis()).value.unwrap()
}

#[test]
fn sample_body_validates_clean() {
    let d = body::validate(&ir());
    assert!(!d.has_blocking(), "cuerpo base con bloqueantes: {d:?}");
}

#[test]
fn label_registry_collects_declared_labels() {
    let reg = LabelRegistry::build(&ir());
    assert!(reg.labels.contains_key("fig:arch"));
    assert!(reg.labels.contains_key("eq:emc2"));
    assert!(reg.labels.contains_key("tab:res"));
    assert!(reg.labels.contains_key("cap:intro"));
    assert!(reg.labels.contains_key("anx:code"));
}

#[test]
fn duplicate_label_is_blocking() {
    let mut ir = ir();
    // Forzar un segundo nodo con el mismo label de figura.
    let section = ir.body.sections.first_mut().unwrap();
    let fig = section
        .nodes
        .iter()
        .find_map(|n| match n {
            BodyNode::Figure(f) => Some(f.clone()),
            _ => None,
        })
        .expect("el fixture tiene una figura");
    let mut dup = fig;
    dup.id = "fig-dup".into();
    section.nodes.push(BodyNode::Figure(dup));
    let d = body::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "BODY-001"));
    assert!(d.has_blocking());
}

#[test]
fn dangling_cross_reference_is_error() {
    let mut ir = ir();
    ir.body.sections[0].nodes.push(BodyNode::CrossReference(CrossReference {
        id: "xref-1".into(),
        target_label: "no-existe".into(),
    }));
    let d = body::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "BODY-002"));
}

#[test]
fn valid_cross_reference_passes() {
    let mut ir = ir();
    ir.body.sections[0].nodes.push(BodyNode::CrossReference(CrossReference {
        id: "xref-1".into(),
        target_label: "fig:arch".into(),
    }));
    let d = body::validate(&ir);
    assert!(!d.iter().any(|x| x.code.as_str() == "BODY-002"));
}

#[test]
fn unconfirmed_raw_latex_warns() {
    let mut ir = ir();
    ir.body.sections[0].nodes.push(BodyNode::TrustedRawLatex(TrustedRawLatex {
        id: "raw-1".into(),
        content: "\\dangerous".into(),
        user_confirmed: false,
    }));
    let d = body::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "BODY-010"));
}

#[test]
fn plugin_without_editable_source_warns() {
    let mut ir = ir();
    ir.body.sections[0].nodes.push(BodyNode::PluginContribution(PluginContribution {
        id: "plug-1".into(),
        plugin_id: "demo".into(),
        figure_id: "f".into(),
        caption: "c".into(),
        label: "fig:plug".into(),
        artifact_latex: "\\begin{figure}\\end{figure}".into(),
        required_packages: vec![],
        editable_source: String::new(),
        warnings: vec![],
    }));
    let d = body::validate(&ir);
    assert!(d.iter().any(|x| x.code.as_str() == "PLUGIN-002"));
}
