use super::action::{AiActionMode, AiProposedAction};
use serde::{Deserialize, Serialize};

// ── Niveles de riesgo ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiRiskLevel {
    /// Solo respuesta en el chat. El documento nunca se toca.
    Low,

    /// Se aplica automáticamente. La app notifica qué cambió y ofrece deshacer.
    /// Criterio: texto que el autor ya escribió y la IA solo edita.
    /// El error es trivialmente reversible con Ctrl+Z.
    AutoWithNotification,

    /// Preview explícito + confirmación del usuario antes de aplicar.
    /// Criterio: insertar algo que no existía (cita, tabla, figura, entrada de .bib).
    /// El autor debe verificar el contenido antes de que entre al documento.
    Medium,

    /// Solo se muestra como recomendación. Nunca se aplica.
    High,

    /// El sistema rechaza. No se ejecuta bajo ninguna circunstancia.
    Forbidden,
}

// ── Decisión de seguridad ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSafetyDecision {
    pub risk_level: AiRiskLevel,
    pub can_show_as_answer: bool,
    pub requires_preview: bool,
    pub requires_user_confirmation: bool,
    pub can_apply_automatically: bool,
    /// Descripción visible en la UI del motivo de la clasificación.
    pub reason: String,
}

impl AiSafetyDecision {
    pub fn low(reason: impl Into<String>) -> Self {
        Self {
            risk_level: AiRiskLevel::Low,
            can_show_as_answer: true,
            requires_preview: false,
            requires_user_confirmation: false,
            can_apply_automatically: false,
            reason: reason.into(),
        }
    }

    pub fn auto_notify(reason: impl Into<String>) -> Self {
        Self {
            risk_level: AiRiskLevel::AutoWithNotification,
            can_show_as_answer: true,
            requires_preview: false,
            requires_user_confirmation: false,
            can_apply_automatically: true,
            reason: reason.into(),
        }
    }

    pub fn medium(reason: impl Into<String>) -> Self {
        Self {
            risk_level: AiRiskLevel::Medium,
            can_show_as_answer: true,
            requires_preview: true,
            requires_user_confirmation: true,
            can_apply_automatically: false,
            reason: reason.into(),
        }
    }

    pub fn high(reason: impl Into<String>) -> Self {
        Self {
            risk_level: AiRiskLevel::High,
            can_show_as_answer: true,
            requires_preview: false,
            requires_user_confirmation: false,
            can_apply_automatically: false,
            reason: reason.into(),
        }
    }

    pub fn forbidden(reason: impl Into<String>) -> Self {
        Self {
            risk_level: AiRiskLevel::Forbidden,
            can_show_as_answer: false,
            requires_preview: false,
            requires_user_confirmation: false,
            can_apply_automatically: false,
            reason: reason.into(),
        }
    }
}

// ── Política central ──────────────────────────────────────────────────────────
//
// Toda clasificación pasa por AiSafetyPolicy.
// No hay lógica de seguridad dispersa en providers ni en el engine.

pub struct AiSafetyPolicy;

impl AiSafetyPolicy {
    /// Clasifica el nivel de riesgo de un modo de acción.
    pub fn classify_mode(mode: &AiActionMode) -> AiSafetyDecision {
        match mode {

            // ── Low: solo chat, cero contacto con el documento ────────────────
            AiActionMode::Ask =>
                AiSafetyDecision::low("Pregunta libre — sin cambios"),
            AiActionMode::ExplainLatexError =>
                AiSafetyDecision::low("Explicación informativa — sin cambios"),
            AiActionMode::ReviewContent =>
                AiSafetyDecision::low("Revisión de contenido — la IA comenta, el autor decide"),
            AiActionMode::SuggestSources =>
                AiSafetyDecision::low("Sugiere fuentes — no inserta nada"),
            AiActionMode::AnalyzeArgument =>
                AiSafetyDecision::low("Análisis de argumento — solo opinión"),
            AiActionMode::CheckConsistency =>
                AiSafetyDecision::low("Verificación de consistencia — solo informe"),
            AiActionMode::SuggestStructure =>
                AiSafetyDecision::low("Sugerencia de estructura — solo recomendación"),
            AiActionMode::SimulateExaminer =>
                AiSafetyDecision::low("Sinodal simulado — preguntas, sin cambios"),
            AiActionMode::AppHelp =>
                AiSafetyDecision::low("Ayuda de la app — sin cambios"),
            AiActionMode::LearnLatex =>
                AiSafetyDecision::low("Explicación de LaTeX — sin cambios"),

            // ── AutoWithNotification: aplica + notifica + undo disponible ─────
            // Razón: el texto es del autor, la IA solo lo edita.
            // Error trivialmente reversible.
            AiActionMode::ImproveWriting =>
                AiSafetyDecision::auto_notify("Edita texto existente — se notifica y se puede deshacer"),
            AiActionMode::ShortenText =>
                AiSafetyDecision::auto_notify("Edita texto existente — se notifica y se puede deshacer"),
            AiActionMode::ExpandText =>
                AiSafetyDecision::auto_notify("Edita texto existente — se notifica y se puede deshacer"),
            AiActionMode::RewriteText =>
                AiSafetyDecision::auto_notify("Edita texto existente — se notifica y se puede deshacer"),
            AiActionMode::ConvertToLatex =>
                AiSafetyDecision::auto_notify("Convierte selección a LaTeX — se notifica y se puede deshacer"),
            AiActionMode::AddParagraph =>
                AiSafetyDecision::medium("Añade párrafo nuevo — requiere preview y confirmación antes de insertarse"),

            // ── Medium: preview + confirmación explícita ──────────────────────
            // Razón: inserta contenido nuevo que no existía, o que tiene
            // consecuencias en registros del proyecto (bibliografía, glosario).
            // El autor debe verificar antes de que entre al documento.
            AiActionMode::InsertCitation =>
                AiSafetyDecision::medium("Inserta \\cite{} — requiere confirmar la cita"),
            AiActionMode::AddBibliographyEntry =>
                AiSafetyDecision::medium("Añade entrada al .bib — requiere confirmar la referencia"),
            AiActionMode::InsertCrossReference =>
                AiSafetyDecision::medium("Inserta \\cref{} — requiere confirmar el label destino"),
            AiActionMode::InsertTable =>
                AiSafetyDecision::medium("Inserta tabla nueva — requiere revisar estructura y datos"),
            AiActionMode::InsertFigurePlaceholder =>
                AiSafetyDecision::medium("Inserta figura placeholder — requiere confirmar caption y label"),
            AiActionMode::InsertEquation =>
                AiSafetyDecision::medium("Inserta ecuación — requiere verificar la expresión matemática"),
            AiActionMode::AddGlossaryEntry =>
                AiSafetyDecision::medium("Añade término al glosario — requiere confirmar definición"),
            AiActionMode::AddAcronym =>
                AiSafetyDecision::medium("Añade acrónimo — requiere confirmar forma corta y larga"),
            AiActionMode::InsertCodeBlock =>
                AiSafetyDecision::medium("Inserta bloque de código — requiere verificar el contenido"),
            AiActionMode::GenerateAbstract =>
                AiSafetyDecision::medium("Propone abstract — el autor debe revisar antes de insertar"),
            AiActionMode::GenerateCaption =>
                AiSafetyDecision::medium("Propone caption — el autor debe verificar antes de insertar"),
        }
    }

    /// Clasifica una acción propuesta concreta.
    pub fn classify_action(action: &AiProposedAction, mode: &AiActionMode) -> AiSafetyDecision {
        match action {
            AiProposedAction::ShowInChat { .. } =>
                AiSafetyDecision::low("Solo muestra en chat"),

            AiProposedAction::ReplaceSelection { original, replacement, .. } => {
                if original.is_empty() {
                    return AiSafetyDecision::forbidden(
                        "No hay selección activa — no se puede reemplazar nada",
                    );
                }
                if replacement.trim().is_empty() {
                    return AiSafetyDecision::forbidden(
                        "Reemplazo vacío equivale a borrar contenido — prohibido",
                    );
                }
                // El riesgo de ReplaceSelection depende del modo que lo originó
                Self::classify_mode(mode)
            }

            AiProposedAction::InsertAtCursor { content, .. } => {
                if content.trim().is_empty() {
                    return AiSafetyDecision::forbidden("Inserción vacía — rechazada");
                }
                Self::classify_mode(mode)
            }
        }
    }

    /// Valida que el texto de respuesta de la IA no contenga instrucciones peligrosas.
    pub fn validate_response_text(text: &str) -> Result<(), String> {
        let forbidden = [
            "rm -rf", "sudo ", "shell-escape", "--shell-escape",
            "\\write18", "\\immediate\\write18",
            "\\documentclass", "\\usepackage", "\\begin{document}", "\\end{document}",
            "\\input{", "\\include{", "\\includeonly", "\\chapter{", "\\part{",
            "\\appendix", "\\tableofcontents", "\\listoffigures", "\\listoftables",
            "\\bibliography{", "\\addbibresource{",
        ];
        let lower = text.to_lowercase();
        for pattern in &forbidden {
            if lower.contains(pattern) {
                return Err(format!(
                    "Respuesta bloqueada: contiene patrón peligroso '{}'", pattern
                ));
            }
        }
        Ok(())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::action::{AiActionMode, AiProposedAction};

    // Chat / Low
    #[test] fn ask_is_low() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::Ask).risk_level, AiRiskLevel::Low);
    }
    #[test] fn explain_error_is_low() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::ExplainLatexError).risk_level, AiRiskLevel::Low);
    }
    #[test] fn simulate_examiner_is_low() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::SimulateExaminer).risk_level, AiRiskLevel::Low);
    }
    #[test] fn review_content_is_low() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::ReviewContent).risk_level, AiRiskLevel::Low);
    }
    #[test] fn suggest_sources_is_low() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::SuggestSources).risk_level, AiRiskLevel::Low);
    }

    // AutoWithNotification
    #[test] fn improve_writing_is_auto_notify() {
        let d = AiSafetyPolicy::classify_mode(&AiActionMode::ImproveWriting);
        assert_eq!(d.risk_level, AiRiskLevel::AutoWithNotification);
        assert!(d.can_apply_automatically);
        assert!(!d.requires_user_confirmation);
    }
    #[test] fn shorten_is_auto_notify() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::ShortenText).risk_level, AiRiskLevel::AutoWithNotification);
    }
    #[test] fn expand_is_auto_notify() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::ExpandText).risk_level, AiRiskLevel::AutoWithNotification);
    }
    #[test] fn add_paragraph_requires_confirmation() {
        let d = AiSafetyPolicy::classify_mode(&AiActionMode::AddParagraph);
        assert_eq!(d.risk_level, AiRiskLevel::Medium);
        assert!(d.requires_user_confirmation);
        assert!(!d.can_apply_automatically);
    }

    // Medium / confirmation required
    #[test] fn insert_citation_requires_confirmation() {
        let d = AiSafetyPolicy::classify_mode(&AiActionMode::InsertCitation);
        assert_eq!(d.risk_level, AiRiskLevel::Medium);
        assert!(d.requires_user_confirmation);
        assert!(!d.can_apply_automatically);
    }
    #[test] fn add_bibliography_entry_requires_confirmation() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::AddBibliographyEntry).risk_level, AiRiskLevel::Medium);
    }
    #[test] fn insert_table_requires_confirmation() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::InsertTable).risk_level, AiRiskLevel::Medium);
    }
    #[test] fn insert_figure_requires_confirmation() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::InsertFigurePlaceholder).risk_level, AiRiskLevel::Medium);
    }
    #[test] fn generate_abstract_requires_confirmation() {
        assert_eq!(AiSafetyPolicy::classify_mode(&AiActionMode::GenerateAbstract).risk_level, AiRiskLevel::Medium);
    }

    // Forbidden
    #[test] fn empty_replacement_is_forbidden() {
        let action = AiProposedAction::ReplaceSelection {
            original: "texto".to_string(),
            replacement: "   ".to_string(),
            block_id: None, start: None, end: None,
        };
        let d = AiSafetyPolicy::classify_action(&action, &AiActionMode::ImproveWriting);
        assert_eq!(d.risk_level, AiRiskLevel::Forbidden);
    }
    #[test] fn empty_selection_is_forbidden() {
        let action = AiProposedAction::ReplaceSelection {
            original: String::new(),
            replacement: "algo".to_string(),
            block_id: None, start: None, end: None,
        };
        let d = AiSafetyPolicy::classify_action(&action, &AiActionMode::ImproveWriting);
        assert_eq!(d.risk_level, AiRiskLevel::Forbidden);
    }
    #[test] fn empty_insert_is_forbidden() {
        let action = AiProposedAction::InsertAtCursor {
            content: "  ".to_string(),
            description: "vacío".to_string(),
        };
        let d = AiSafetyPolicy::classify_action(&action, &AiActionMode::AddParagraph);
        assert_eq!(d.risk_level, AiRiskLevel::Forbidden);
    }

    // validate_response_text
    #[test] fn blocks_shell_escape() {
        assert!(AiSafetyPolicy::validate_response_text("usa --shell-escape").is_err());
    }
    #[test] fn blocks_rm_rf() {
        assert!(AiSafetyPolicy::validate_response_text("rm -rf /").is_err());
    }
    #[test] fn blocks_structural_latex_commands() {
        assert!(AiSafetyPolicy::validate_response_text("\\chapter{Nuevo capítulo}").is_err());
        assert!(AiSafetyPolicy::validate_response_text("\\usepackage{minted}").is_err());
        assert!(AiSafetyPolicy::validate_response_text("\\input{main.tex}").is_err());
    }
    #[test] fn allows_normal_text() {
        assert!(AiSafetyPolicy::validate_response_text("Mejora la redacción del párrafo.").is_ok());
    }
}
