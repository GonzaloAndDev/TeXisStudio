/// Señales del contenido que deciden si una lista generada debe emitirse.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct GeneratedListState {
    pub figures: bool,
    pub tables: bool,
    pub algorithms: bool,
    pub listings: bool,
}

/// Emite una sección generada de frontmatter. Devuelve `true` si escribió algo.
pub(crate) fn emit_generated_frontmatter(
    element_id: &str,
    lists: GeneratedListState,
    out: &mut String,
) -> bool {
    match element_id {
        "table_of_contents" => {
            out.push_str("\n\\tableofcontents\n");
            true
        }
        "list_of_figures" if lists.figures => {
            out.push_str("\\listoffigures\n");
            true
        }
        "list_of_tables" if lists.tables => {
            out.push_str("\\listoftables\n");
            true
        }
        "list_of_algorithms" if lists.algorithms => {
            out.push_str("\\listofalgorithms\n");
            true
        }
        "list_of_listings" if lists.listings => {
            out.push_str("\\lstlistoflistings\n");
            true
        }
        "list_of_figures" | "list_of_tables" | "list_of_algorithms" | "list_of_listings" => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skips_empty_generated_lists() {
        let mut out = String::new();
        assert!(emit_generated_frontmatter(
            "list_of_figures",
            GeneratedListState::default(),
            &mut out,
        ));
        assert!(out.is_empty());
    }

    #[test]
    fn emits_only_lists_with_content() {
        let mut out = String::new();
        assert!(emit_generated_frontmatter(
            "list_of_tables",
            GeneratedListState {
                tables: true,
                ..GeneratedListState::default()
            },
            &mut out,
        ));
        assert_eq!(out, "\\listoftables\n");
    }
}
