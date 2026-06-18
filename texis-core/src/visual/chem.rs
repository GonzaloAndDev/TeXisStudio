// Renderers para bloques de química:
//   - ChemReaction → mhchem \ce{}
//   - Molecule     → chemfig (presets o fórmula libre)

use crate::project::model::{ChemReactionConfig, MoleculeConfig, MOLECULE_PRESETS};

// Los corchetes [ ] son los delimitadores de condiciones de flecha en mhchem
// (->[\text{arriba}][\text{abajo}]). Un ] prematuro cierra el campo y rompe
// el parseo. Las llaves { } también tienen significado estructural en mhchem.
// Esta función los elimina y trunca al límite razonable para una etiqueta.
fn sanitize_mhchem_text(s: &str) -> String {
    s.chars()
        .filter(|c| !matches!(c, '[' | ']' | '{' | '}' | '\n' | '\r'))
        .take(120)
        .collect()
}

pub fn render_reaction(c: &ChemReactionConfig) -> String {
    let arrow = match c.reaction_type.as_str() {
        "equilibrium" => "<=>",
        "resonance" => "<->",
        "backward" => "<-",
        _ => "->",
    };

    // Construir condiciones de flecha
    let conditions = build_conditions(&c.catalyst, &c.conditions, arrow);
    // Reemplazar -> en la ecuación por las condiciones
    let eq = c
        .equation
        .replace("<=>", &conditions)
        .replace("<->", &conditions)
        .replace("->", &conditions)
        .replace("<-", &conditions);

    if c.display_mode {
        format!("\\begin{{equation*}}\n  \\ce{{{}}}\n\\end{{equation*}}", eq)
    } else {
        format!("\\ce{{{}}}", eq)
    }
}

fn build_conditions(catalyst: &Option<String>, conditions: &Option<String>, arrow: &str) -> String {
    let above = sanitize_mhchem_text(catalyst.as_deref().unwrap_or("").trim());
    let below = sanitize_mhchem_text(conditions.as_deref().unwrap_or("").trim());

    if above.is_empty() && below.is_empty() {
        arrow.to_string()
    } else if below.is_empty() {
        format!("->[{}]", above)
    } else if above.is_empty() {
        format!("->[][{}]", below)
    } else {
        format!("->[{}][{}]", above, below)
    }
}

pub fn render_molecule(c: &MoleculeConfig) -> String {
    // Prioridad: chemfig_formula > preset > error
    let formula = if let Some(f) = &c.chemfig_formula {
        if !f.trim().is_empty() {
            f.trim().to_string()
        } else {
            preset_formula(&c.preset)
        }
    } else {
        preset_formula(&c.preset)
    };

    if formula.is_empty() {
        return "% Molécula no especificada\n".to_string();
    }

    if (c.scale - 1.0).abs() > 0.05 {
        format!(
            "\\setchemfig{{atom sep={:.1}em}}\n\\chemfig{{{}}}",
            c.scale * 2.0,
            formula
        )
    } else {
        format!("\\chemfig{{{}}}", formula)
    }
}

fn preset_formula(preset: &Option<String>) -> String {
    let id = match preset {
        Some(s) => s.as_str(),
        None => return String::new(),
    };
    MOLECULE_PRESETS
        .iter()
        .find(|(pid, _, _)| *pid == id)
        .map(|(_, _, formula)| formula.to_string())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_mhchem_strips_brackets_and_braces() {
        assert_eq!(sanitize_mhchem_text("[cat]"), "cat");
        assert_eq!(sanitize_mhchem_text("{H2SO4}"), "H2SO4");
        assert_eq!(sanitize_mhchem_text("H2SO4 conc."), "H2SO4 conc.");
    }

    #[test]
    fn sanitize_mhchem_strips_newlines() {
        assert_eq!(sanitize_mhchem_text("cat\ncondition"), "catcondition");
    }

    #[test]
    fn sanitize_mhchem_truncates_long_input() {
        let long = "A".repeat(200);
        assert_eq!(sanitize_mhchem_text(&long).len(), 120);
    }

    #[test]
    fn build_conditions_bracket_injection_sanitized() {
        // Un ] dentro del catalizador ya no puede cerrar prematuramente el campo mhchem.
        // Resultado esperado: "->[catevil]" — los corchetes del usuario se eliminan,
        // pero el ] de cierre del formato mhchem es parte de la sintaxis y permanece.
        let result = build_conditions(&Some("cat][evil".to_string()), &None, "->");
        assert_eq!(
            result, "->[catevil]",
            "los [] del catalizador deben eliminarse, el ] final es de la sintaxis mhchem"
        );
        assert!(
            !result.contains("]["),
            "no debe quedar secuencia ][ del usuario dentro del campo"
        );
    }

    #[test]
    fn build_conditions_empty_uses_bare_arrow() {
        let result = build_conditions(&None, &None, "->");
        assert_eq!(result, "->");
    }

    #[test]
    fn build_conditions_only_below() {
        let result = build_conditions(&None, &Some("Δ".to_string()), "->");
        assert_eq!(result, "->[][Δ]");
    }

    #[test]
    fn render_reaction_forward_with_catalyst() {
        use crate::project::model::ChemReactionConfig;
        let c = ChemReactionConfig {
            equation: "H2 + Cl2 -> 2HCl".to_string(),
            catalyst: Some("hv".to_string()),
            conditions: None,
            reaction_type: "forward".to_string(),
            display_mode: false,
        };
        let out = render_reaction(&c);
        assert!(out.contains("\\ce{"), "debe usar \\ce");
        assert!(out.contains("hv"), "debe incluir catalizador");
    }
}
