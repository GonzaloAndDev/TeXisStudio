//! Compuerta única de calidad de entrega (Plan Integral §1).
//!
//! Una sola fuente de verdad que **reúne** las señales que antes vivían
//! dispersas —validación del modelo/perfil, postflight del PDF, diagnóstico del
//! log de LaTeX y confianza del perfil— en un solo [`DeliveryQualityReport`] con
//! hallazgos clasificados y **compuertas por modo de entrega** (draft/review/
//! final). `export_delivery`, la UI de compilación y el indicador de preparación
//! deben consumir este reporte para que el usuario vea siempre el mismo
//! diagnóstico, con qué falta, por qué y cómo corregirlo.
//!
//! Este módulo NO recalcula nada: agrega resultados ya producidos por
//! [`crate::validator`], [`crate::postflight`] y [`crate::compiler::error_translator`].

use serde::{Deserialize, Serialize};

use crate::compiler::error_translator;
use crate::postflight::model::{PdfIssueSeverity, PdfPostflightResult};
use crate::profile::model::{Profile, ProfileStatus};
use crate::validator::report::{IssueSeverity, ValidationReport};

/// Severidad unificada de un hallazgo de calidad.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QualitySeverity {
    Error,
    Warning,
    Info,
}

/// Dimensión de calidad de la que proviene un hallazgo.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QualityDimension {
    /// Completitud del proyecto: metadatos predeterminados, secciones vacías.
    Completeness,
    /// Reglas de validación del modelo y del perfil institucional.
    Validation,
    /// Estado de la bibliografía (referencias sin citar, citas sin definir, …).
    Bibliography,
    /// Diagnóstico del log de compilación de LaTeX.
    LatexLog,
    /// Postflight del PDF generado (fuentes, metadatos, estructura).
    Postflight,
    /// Confianza del perfil usado para la entrega.
    ProfileTrust,
}

/// Un hallazgo individual, ya normalizado a la compuerta de calidad.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityFinding {
    pub dimension: QualityDimension,
    pub severity: QualitySeverity,
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suggestion: Option<String>,
    /// Ubicación legible: id de sección, "PDF", "references.bib", etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
}

/// Estado de una compuerta para un modo de entrega concreto.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateStatus {
    pub passed: bool,
    /// Códigos de los hallazgos que bloquean este modo (vacío si pasa).
    pub blocking_codes: Vec<String>,
}

/// Resumen de la confianza del perfil para entrega final.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileTrustSummary {
    /// "verified" | "reviewed" | "draft" | "experimental" | "stale" | "deprecated" | "unknown".
    pub status: String,
    /// `true` si el perfil es apto/recomendado para una entrega final.
    pub recommended_for_final: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

/// Reporte unificado de calidad de entrega: fuente de verdad de la compuerta.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryQualityReport {
    pub findings: Vec<QualityFinding>,
    pub error_count: usize,
    pub warning_count: usize,
    pub info_count: usize,
    /// Compuerta `draft`: informativa, nunca bloquea.
    pub draft_gate: GateStatus,
    /// Compuerta `review`: bloquea errores de contenido (validación/completitud/
    /// bibliografía) y de compilación, pero no exige PDF/A ni postflight limpio.
    pub review_gate: GateStatus,
    /// Compuerta `final`: bloquea **cualquier** error, incluido el postflight.
    pub final_gate: GateStatus,
    pub profile_trust: ProfileTrustSummary,
}

/// Entradas para construir el reporte. Todas opcionales salvo la validación, de
/// modo que se pueda evaluar antes de compilar (sin PDF ni log todavía).
pub struct QualityInputs<'a> {
    pub validation: &'a ValidationReport,
    pub postflight: Option<&'a PdfPostflightResult>,
    pub log: Option<&'a str>,
    pub profile: Option<&'a Profile>,
}

fn classify_validation_code(code: &str) -> QualityDimension {
    let c = code.to_ascii_uppercase();
    if c.contains("PLACEHOLDER") {
        QualityDimension::Completeness
    } else if c.contains("BIB") || c.contains("REFERENCE") || c.contains("CITATION") || c.contains("CITED") {
        QualityDimension::Bibliography
    } else {
        QualityDimension::Validation
    }
}

fn map_validation_severity(s: &IssueSeverity) -> QualitySeverity {
    match s {
        IssueSeverity::Error => QualitySeverity::Error,
        IssueSeverity::Warning => QualitySeverity::Warning,
        IssueSeverity::Suggestion => QualitySeverity::Info,
    }
}

fn map_postflight_severity(s: &PdfIssueSeverity) -> QualitySeverity {
    match s {
        PdfIssueSeverity::Error => QualitySeverity::Error,
        PdfIssueSeverity::Warning => QualitySeverity::Warning,
        PdfIssueSeverity::Info => QualitySeverity::Info,
    }
}

fn profile_trust_summary(profile: Option<&Profile>) -> ProfileTrustSummary {
    match profile.map(|p| &p.status) {
        Some(ProfileStatus::Verified) => ProfileTrustSummary {
            status: "verified".into(),
            recommended_for_final: true,
            note: None,
        },
        Some(ProfileStatus::Reviewed) => ProfileTrustSummary {
            status: "reviewed".into(),
            recommended_for_final: true,
            note: Some("Perfil revisado por humanos; apto para entrega.".into()),
        },
        Some(ProfileStatus::Draft) => ProfileTrustSummary {
            status: "draft".into(),
            recommended_for_final: false,
            note: Some("Perfil en borrador: usable, pero no recomendado para la entrega final.".into()),
        },
        Some(ProfileStatus::Stale) => ProfileTrustSummary {
            status: "stale".into(),
            recommended_for_final: false,
            note: Some("Perfil vencido: las reglas pueden estar desactualizadas. Verifica antes de entregar.".into()),
        },
        Some(ProfileStatus::Deprecated) => ProfileTrustSummary {
            status: "deprecated".into(),
            recommended_for_final: false,
            note: Some("Perfil obsoleto: migra a uno vigente antes de entregar.".into()),
        },
        Some(ProfileStatus::Experimental) => ProfileTrustSummary {
            status: "experimental".into(),
            recommended_for_final: false,
            note: Some("Perfil experimental: sin garantías para entrega formal.".into()),
        },
        None => ProfileTrustSummary {
            status: "unknown".into(),
            recommended_for_final: false,
            note: Some("Sin perfil institucional asociado.".into()),
        },
    }
}

/// Construye el [`DeliveryQualityReport`] a partir de las señales ya calculadas.
pub fn assess(inputs: QualityInputs) -> DeliveryQualityReport {
    let mut findings: Vec<QualityFinding> = Vec::new();

    // ── Validación del modelo / perfil ───────────────────────────────────────
    for issue in &inputs.validation.issues {
        findings.push(QualityFinding {
            dimension: classify_validation_code(&issue.code),
            severity: map_validation_severity(&issue.severity),
            code: issue.code.clone(),
            message: issue.message.clone(),
            suggestion: issue.suggestion.clone(),
            location: issue.section_id.clone(),
        });
    }

    // ── Diagnóstico del log de LaTeX (errores fatales de compilación) ────────
    if let Some(log) = inputs.log {
        for ue in error_translator::translate_log(log) {
            findings.push(QualityFinding {
                dimension: QualityDimension::LatexLog,
                severity: QualitySeverity::Error,
                code: "LATEX_COMPILE_ERROR".into(),
                message: ue.message,
                suggestion: ue.suggestion,
                location: Some("compilación".into()),
            });
        }
    }

    // ── Postflight del PDF ───────────────────────────────────────────────────
    if let Some(pf) = inputs.postflight {
        for issue in &pf.issues {
            findings.push(QualityFinding {
                dimension: QualityDimension::Postflight,
                severity: map_postflight_severity(&issue.severity),
                code: issue.code.clone(),
                message: issue.message.clone(),
                suggestion: issue.suggestion.clone(),
                location: Some("PDF".into()),
            });
        }
    }

    // ── Confianza del perfil ─────────────────────────────────────────────────
    let profile_trust = profile_trust_summary(inputs.profile);
    if !profile_trust.recommended_for_final {
        findings.push(QualityFinding {
            dimension: QualityDimension::ProfileTrust,
            severity: QualitySeverity::Warning,
            code: "PROFILE_NOT_VERIFIED_FOR_FINAL".into(),
            message: format!(
                "El perfil ({}) no está verificado/revisado para una entrega final.",
                profile_trust.status
            ),
            suggestion: profile_trust.note.clone(),
            location: None,
        });
    }

    // ── Conteos ──────────────────────────────────────────────────────────────
    let error_count = findings.iter().filter(|f| f.severity == QualitySeverity::Error).count();
    let warning_count = findings.iter().filter(|f| f.severity == QualitySeverity::Warning).count();
    let info_count = findings.iter().filter(|f| f.severity == QualitySeverity::Info).count();

    // ── Compuertas por modo ──────────────────────────────────────────────────
    // draft: informativa, nunca bloquea.
    let draft_gate = GateStatus { passed: true, blocking_codes: vec![] };

    // review: bloquea errores de contenido y de compilación (no postflight).
    let review_blocking: Vec<String> = findings
        .iter()
        .filter(|f| {
            f.severity == QualitySeverity::Error
                && !matches!(f.dimension, QualityDimension::Postflight | QualityDimension::ProfileTrust)
        })
        .map(|f| f.code.clone())
        .collect();
    let review_gate = GateStatus {
        passed: review_blocking.is_empty(),
        blocking_codes: review_blocking,
    };

    // final: bloquea cualquier error (validación + compilación + postflight).
    let final_blocking: Vec<String> = findings
        .iter()
        .filter(|f| f.severity == QualitySeverity::Error)
        .map(|f| f.code.clone())
        .collect();
    let final_gate = GateStatus {
        passed: final_blocking.is_empty(),
        blocking_codes: final_blocking,
    };

    DeliveryQualityReport {
        findings,
        error_count,
        warning_count,
        info_count,
        draft_gate,
        review_gate,
        final_gate,
        profile_trust,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::validator::report::ValidationIssue;

    fn report_with(issues: Vec<ValidationIssue>) -> ValidationReport {
        ValidationReport::new(issues)
    }

    #[test]
    fn clasifica_dimensiones_por_codigo() {
        assert_eq!(classify_validation_code("E_PLACEHOLDER_STUDENT_NAME"), QualityDimension::Completeness);
        assert_eq!(classify_validation_code("W_UNUSED_REFERENCE"), QualityDimension::Bibliography);
        assert_eq!(classify_validation_code("W_BIB_ARTICLE_NO_DOI"), QualityDimension::Bibliography);
        assert_eq!(classify_validation_code("E_WORD_LIMIT_EXCEEDED"), QualityDimension::Validation);
    }

    #[test]
    fn draft_pasa_review_bloquea_con_error_de_contenido() {
        let validation = report_with(vec![ValidationIssue::simple(
            IssueSeverity::Error,
            "E_PLACEHOLDER_STUDENT_NAME",
            "Autor predeterminado",
        )]);
        let r = assess(QualityInputs {
            validation: &validation,
            postflight: None,
            log: None,
            profile: None,
        });
        assert!(r.draft_gate.passed, "draft nunca bloquea");
        assert!(!r.review_gate.passed, "review bloquea error de contenido");
        assert!(!r.final_gate.passed, "final bloquea error de contenido");
        assert!(r.review_gate.blocking_codes.contains(&"E_PLACEHOLDER_STUDENT_NAME".to_string()));
        assert_eq!(r.error_count, 1);
    }

    #[test]
    fn solo_final_bloquea_por_postflight() {
        use crate::postflight::model::{PdfIssue, PdfPostflightResult};
        let validation = report_with(vec![]);
        let mut pf = PdfPostflightResult::pdf_not_found();
        pf.issues = vec![PdfIssue {
            severity: PdfIssueSeverity::Error,
            code: "PF_FONT_NOT_EMBEDDED".into(),
            message: "Fuente no incrustada".into(),
            suggestion: None,
        }];
        let r = assess(QualityInputs {
            validation: &validation,
            postflight: Some(&pf),
            log: None,
            profile: None,
        });
        assert!(r.review_gate.passed, "review no se bloquea por postflight");
        assert!(!r.final_gate.passed, "final sí se bloquea por postflight");
        assert!(r.final_gate.blocking_codes.contains(&"PF_FONT_NOT_EMBEDDED".to_string()));
    }

    #[test]
    fn log_con_error_bloquea_review_y_final() {
        let validation = report_with(vec![]);
        let log = "./main.tex:3: Undefined control sequence.";
        let r = assess(QualityInputs {
            validation: &validation,
            postflight: None,
            log: Some(log),
            profile: None,
        });
        assert!(!r.review_gate.passed);
        assert!(!r.final_gate.passed);
        assert!(r.findings.iter().any(|f| f.dimension == QualityDimension::LatexLog));
    }

    #[test]
    fn perfil_ausente_genera_advertencia_no_bloqueante() {
        let validation = report_with(vec![]);
        let r = assess(QualityInputs {
            validation: &validation,
            postflight: None,
            log: None,
            profile: None,
        });
        // Sin perfil: advertencia de confianza, pero ninguna compuerta se bloquea.
        assert!(r.review_gate.passed);
        assert!(r.final_gate.passed);
        assert!(!r.profile_trust.recommended_for_final);
        assert!(r.findings.iter().any(|f| f.code == "PROFILE_NOT_VERIFIED_FOR_FINAL"));
    }
}
