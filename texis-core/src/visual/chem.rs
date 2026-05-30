// Renderers para bloques de química:
//   - ChemReaction → mhchem \ce{}
//   - Molecule     → chemfig (presets o fórmula libre)

use crate::project::model::{ChemReactionConfig, MoleculeConfig, MOLECULE_PRESETS};

pub fn render_reaction(c: &ChemReactionConfig) -> String {
    let arrow = match c.reaction_type.as_str() {
        "equilibrium" => "<=>",
        "resonance"   => "<->",
        "backward"    => "<-",
        _             => "->",
    };

    // Construir condiciones de flecha
    let conditions = build_conditions(&c.catalyst, &c.conditions, arrow);
    // Reemplazar -> en la ecuación por las condiciones
    let eq = c.equation
        .replace("<=>", &conditions)
        .replace("<->", &conditions)
        .replace("->",  &conditions)
        .replace("<-",  &conditions);

    if c.display_mode {
        format!("\\begin{{equation*}}\n  \\ce{{{}}}\n\\end{{equation*}}", eq)
    } else {
        format!("\\ce{{{}}}", eq)
    }
}

fn build_conditions(catalyst: &Option<String>, conditions: &Option<String>, arrow: &str) -> String {
    let above = catalyst.as_deref().unwrap_or("").trim();
    let below  = conditions.as_deref().unwrap_or("").trim();

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
        None    => return String::new(),
    };
    MOLECULE_PRESETS
        .iter()
        .find(|(pid, _, _)| *pid == id)
        .map(|(_, _, formula)| formula.to_string())
        .unwrap_or_default()
}
