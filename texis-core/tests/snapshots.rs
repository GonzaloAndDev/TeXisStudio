// Snapshot tests — requieren `cargo insta review` en primer run.
// Nota: no se nombra ninguna variable 'gen' (reservado en edition 2024).

mod fixtures;

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
    let output = latex_gen.generate_section_string(&model, "introduction").unwrap();
    insta::assert_snapshot!(output);
}
