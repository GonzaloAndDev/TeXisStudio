use crate::project::model::{ProjectSection, SectionPlacement};

/// Devuelve la ruta relativa del archivo .tex para una sección dentro de build/.
/// None para secciones que se renderizan inline en main.tex (TOC, bibliography).
pub fn section_output_path(section: &ProjectSection, body_index: usize) -> Option<String> {
    match section.placement {
        SectionPlacement::FrontMatter => {
            match section.element_id.as_str() {
                "table_of_contents" | "list_of_figures" | "list_of_tables" => None,
                _ => Some(format!("preliminares/{}.tex", section.id)),
            }
        }
        SectionPlacement::Body => {
            Some(format!("capitulos/{:02}_{}.tex", body_index + 1, section.id))
        }
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

/// Construye el label LaTeX canónico para una sección.
pub fn section_label(section: &ProjectSection) -> String {
    if let Some(label) = &section.label {
        return label.clone();
    }
    match section.placement {
        SectionPlacement::FrontMatter => format!("front:{}", section.id),
        SectionPlacement::Body => format!("sec:{}", section.id),
        SectionPlacement::BackMatter => format!("back:{}", section.id),
        SectionPlacement::Appendix => format!("apx:{}", section.id),
    }
}
