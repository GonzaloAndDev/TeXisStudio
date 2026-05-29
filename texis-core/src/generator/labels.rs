use crate::project::model::{ProjectSection, SectionPlacement};

/// Devuelve la ruta relativa del archivo .tex para una sección dentro de build/.
/// None para secciones que se renderizan inline en main.tex (TOC, bibliography).
pub fn section_output_path(section: &ProjectSection, body_index: usize) -> Option<String> {
    match section.placement {
        SectionPlacement::FrontMatter => match section.element_id.as_str() {
            "table_of_contents" | "list_of_figures" | "list_of_tables" | "list_of_algorithms"
            | "list_of_listings" => None,
            _ => Some(format!("preliminares/{}.tex", section.id)),
        },
        SectionPlacement::Body => Some(format!(
            "capitulos/{:02}_{}.tex",
            body_index + 1,
            section.id
        )),
        SectionPlacement::BackMatter => {
            if section.element_id == "references" {
                None
            } else {
                Some(format!("backmatter/{}.tex", section.id))
            }
        }
        SectionPlacement::Appendix => Some(format!("anexos/{}.tex", section.id)),
    }
}
