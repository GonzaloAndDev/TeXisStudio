use super::action::{AiActionMode, AiProposedAction, ProtectedProjectElement};
use serde::{Deserialize, Serialize};

/// Nivel de riesgo de una acción de IA.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiRiskLevel {
    /// Solo muestra respuesta en el chat. Nunca modifica el documento.
    Low,
    /// Requiere preview y confirmación del usuario antes de aplicar.
    Medium,
    /// Solo se muestra como recomendación. Nunca se aplica automáticamente.
    High,
    /// Rechazada. No se ejecuta bajo ninguna circunstancia.
    Forbidden,
}

/// Decisión de seguridad para una acción propuesta por la IA.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSafetyDecision {
    pub risk_level: AiRiskLevel,
    pub can_show_as_answer: bool,
    pub requires_preview: bool,
    pub requires_user_confirmation: bool,
    pub can_apply_automatically: bool,
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

/// Política de seguridad central del AIEngine.
/// Toda clasificación pasa por aquí — no hay lógica dispersa.
pub struct AiSafetyPolicy;

impl AiSafetyPolicy {
    /// Clasifica el riesgo de un modo de acción.
    pub fn classify_mode(mode: &AiActionMode) -> AiSafetyDecision {
        match mode {
            // Bajo riesgo: solo respuesta en chat
            AiActionMode::Ask => AiSafetyDecision::low("Pregunta libre, sin modificación de documento"),
            AiActionMode::ExplainLatexError => AiSafetyDecision::low("Explicación informativa, sin cambios"),
            AiActionMode::SimulateExaminer => AiSafetyDecision::low("Preguntas de sinodal, sin cambios"),
            AiActionMode::AppHelp => AiSafetyDecision::low("Ayuda de la app, sin cambios"),

            // Riesgo medio: preview + confirmación requeridos
            AiActionMode::ImproveWriting => {
                AiSafetyDecision::medium("Modifica selección — requiere preview y confirmación")
            }
            AiActionMode::ShortenText => {
                AiSafetyDecision::medium("Modifica selección — requiere preview y confirmación")
            }
            AiActionMode::ExpandText => {
                AiSafetyDecision::medium("Modifica selección — requiere preview y confirmación")
            }
            AiActionMode::ConvertToLatex => {
                AiSafetyDecision::medium("Modifica selección — requiere preview y confirmación")
            }
            AiActionMode::GenerateTableSnippet => {
                AiSafetyDecision::medium("Inserta en cursor — requiere preview y confirmación")
            }
            AiActionMode::GenerateCaption => {
                AiSafetyDecision::medium("Inserta en cursor — requiere preview y confirmación")
            }
            AiActionMode::GenerateAbstract => {
                AiSafetyDecision::medium("Inserta en cursor — requiere preview y confirmación")
            }
        }
    }

    /// Clasifica el riesgo de una acción propuesta concreta.
    pub fn classify_action(action: &AiProposedAction) -> AiSafetyDecision {
        match action {
            AiProposedAction::ShowInChat { .. } => {
                AiSafetyDecision::low("Solo muestra en chat")
            }
            AiProposedAction::ReplaceSelection { original, replacement } => {
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
                AiSafetyDecision::medium("Reemplaza selección — requiere confirmación")
            }
            AiProposedAction::InsertAtCursor { content } => {
                if content.trim().is_empty() {
                    return AiSafetyDecision::forbidden("Inserción vacía — sin efecto, rechazada");
                }
                AiSafetyDecision::medium("Inserta en cursor — requiere confirmación")
            }
        }
    }

    /// Verifica si una acción toca un elemento protegido.
    /// La IA puede ANALIZAR elementos protegidos pero nunca MODIFICARLOS.
    pub fn touches_protected_element(
        _action: &AiProposedAction,
        _element: &ProtectedProjectElement,
    ) -> bool {
        // En v1, cualquier ReplaceSelection o InsertAtCursor sobre un
        // elemento protegido se rechaza. La UI es responsable de no
        // enviar acciones sobre contextos protegidos.
        // Este método se reserva para validación adicional futura.
        false
    }

    /// Valida que la respuesta de la IA no contiene instrucciones peligrosas.
    /// Heurística básica para v1.
    pub fn validate_response_text(text: &str) -> Result<(), String> {
        let forbidden_patterns = [
            "rm -rf",
            "sudo ",
            "shell-escape",
            "--shell-escape",
            "\\write18",
            "\\immediate\\write18",
        ];
        for pattern in &forbidden_patterns {
            if text.to_lowercase().contains(pattern) {
                return Err(format!(
                    "Respuesta de IA contiene patrón potencialmente peligroso: '{}'",
                    pattern
                ));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn improve_writing_is_medium_risk() {
        let d = AiSafetyPolicy::classify_mode(&AiActionMode::ImproveWriting);
        assert_eq!(d.risk_level, AiRiskLevel::Medium);
        assert!(d.requires_user_confirmation);
        assert!(!d.can_apply_automatically);
    }

    #[test]
    fn explain_latex_error_is_low_risk() {
        let d = AiSafetyPolicy::classify_mode(&AiActionMode::ExplainLatexError);
        assert_eq!(d.risk_level, AiRiskLevel::Low);
        assert!(!d.requires_user_confirmation);
    }

    #[test]
    fn replace_selection_requires_confirmation() {
        let action = AiProposedAction::ReplaceSelection {
            original: "texto original".to_string(),
            replacement: "texto mejorado".to_string(),
        };
        let d = AiSafetyPolicy::classify_action(&action);
        assert_eq!(d.risk_level, AiRiskLevel::Medium);
        assert!(d.requires_user_confirmation);
        assert!(!d.can_apply_automatically);
    }

    #[test]
    fn empty_replacement_is_forbidden() {
        let action = AiProposedAction::ReplaceSelection {
            original: "texto".to_string(),
            replacement: "   ".to_string(),
        };
        let d = AiSafetyPolicy::classify_action(&action);
        assert_eq!(d.risk_level, AiRiskLevel::Forbidden);
    }

    #[test]
    fn empty_selection_replace_is_forbidden() {
        let action = AiProposedAction::ReplaceSelection {
            original: String::new(),
            replacement: "algo".to_string(),
        };
        let d = AiSafetyPolicy::classify_action(&action);
        assert_eq!(d.risk_level, AiRiskLevel::Forbidden);
    }

    #[test]
    fn insert_at_cursor_requires_confirmation() {
        let action = AiProposedAction::InsertAtCursor {
            content: "\\begin{table}...\\end{table}".to_string(),
        };
        let d = AiSafetyPolicy::classify_action(&action);
        assert_eq!(d.risk_level, AiRiskLevel::Medium);
        assert!(d.requires_user_confirmation);
    }

    #[test]
    fn show_in_chat_is_low_risk() {
        let action = AiProposedAction::ShowInChat {
            response: "Aquí está la explicación.".to_string(),
        };
        let d = AiSafetyPolicy::classify_action(&action);
        assert_eq!(d.risk_level, AiRiskLevel::Low);
    }

    #[test]
    fn dangerous_patterns_rejected() {
        assert!(AiSafetyPolicy::validate_response_text("rm -rf /").is_err());
        assert!(AiSafetyPolicy::validate_response_text("usa --shell-escape").is_err());
        assert!(AiSafetyPolicy::validate_response_text("texto normal sin problemas").is_ok());
    }
}
