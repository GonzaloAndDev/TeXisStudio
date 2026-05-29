// Snapshot tests — requieren `cargo insta review` en primer run.
// Nota: no se nombra ninguna variable 'gen' (reservado en edition 2024).

mod fixtures;

use std::fs;
use texis_core::project::model::CommitteeMember;
use texis_core::LaTeXGenerator;

#[test]
fn snapshot_generic_thesis_main_tex() {
    let model = fixtures::generic_thesis_model();
    let latex_gen = LaTeXGenerator::new().unwrap();
    let output = latex_gen.generate_main_tex_string(&model).unwrap();
    insta::assert_snapshot!(output);
}

#[test]
fn snapshot_generic_thesis_introduccion() {
    let model = fixtures::generic_thesis_model();
    let latex_gen = LaTeXGenerator::new().unwrap();
    let output = latex_gen
        .generate_section_string(&model, "introduction")
        .unwrap();
    insta::assert_snapshot!(output);
}

#[test]
fn committee_commands_use_csname_for_indexed_members() {
    let mut model = fixtures::generic_thesis_model();
    model.student.committee = vec![
        CommitteeMember {
            full_name: "Prof. Alice Johnson".to_string(),
            role: Some("Committee Chair".to_string()),
            institution: None,
        },
        CommitteeMember {
            full_name: "Prof. Bob Williams".to_string(),
            role: Some("Committee Member".to_string()),
            institution: None,
        },
    ];

    let latex_gen = LaTeXGenerator::new().unwrap();
    let temp_dir = tempfile::tempdir().unwrap();
    latex_gen.generate(&model, temp_dir.path()).unwrap();
    let output = fs::read_to_string(temp_dir.path().join("configuracion/datos_tesis.tex")).unwrap();

    assert!(output.contains("\\newcommand{\\tesisComite}{"));
    assert!(output.contains("Prof. Alice Johnson"));
    assert!(output.contains("Committee Chair"));
    assert!(output.contains("Prof. Bob Williams"));
    assert!(output.contains("Committee Member"));
    assert!(
        output.contains("\\expandafter\\def\\csname tesisComite1\\endcsname{Prof. Alice Johnson}")
    );
    assert!(
        output.contains("\\expandafter\\def\\csname tesisComite1Rol\\endcsname{Committee Chair}")
    );
    assert!(
        output.contains("\\expandafter\\def\\csname tesisComite2\\endcsname{Prof. Bob Williams}")
    );
    assert!(
        output.contains("\\expandafter\\def\\csname tesisComite2Rol\\endcsname{Committee Member}")
    );
    assert!(!output.contains("\\newcommand{\\tesisComite1}"));
    assert!(!output.contains("\\newcommand{\\tesisComite1Rol}"));
}
