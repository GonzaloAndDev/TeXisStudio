// ProfilePolicyValidator — valida políticas institucionales de un perfil.
//
// Separación de responsabilidades (D1):
//   ProfilePolicyValidator → ¿Es este perfil institucional confiable?
//   ProjectValidator       → ¿Esta tesis cumple las reglas del perfil activo?
//   System Doctor          → ¿El entorno LaTeX puede ejecutar la compilación?
//
// El validator valida SIGNIFICADO institucional.
// El schema valida FORMA (estructura de datos).
// Ambos son obligatorios.

use serde::{Deserialize, Serialize};

use super::model::{Profile, ProfileStatus};

// ── PolicyReport ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyReport {
    pub profile_id: String,
    pub profile_status: ProfileStatus,
    pub issues: Vec<PolicyIssue>,
}

impl PolicyReport {
    pub fn has_errors(&self) -> bool {
        self.issues.iter().any(|i| i.severity == PolicySeverity::Error)
    }

    pub fn has_warnings(&self) -> bool {
        self.issues.iter().any(|i| i.severity == PolicySeverity::Warning)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyIssue {
    pub severity: PolicySeverity,
    /// Código único, ej. "POL_REVIEWED_NO_SOURCE_URLS".
    pub code: String,
    pub message: String,
    /// Campo del modelo que origina el issue.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PolicySeverity {
    Error,
    Warning,
    Info,
}

// ── ProfilePolicyValidator ───────────────────────────────────────────────────

pub struct ProfilePolicyValidator;

impl ProfilePolicyValidator {
    /// Validación básica — no requiere catálogo.
    ///
    /// Valida que las políticas institucionales del perfil sean coherentes
    /// con su `status`. Un perfil `reviewed` debe tener URLs de fuente; un
    /// perfil `verified` debe tener evidencia completa de CI.
    pub fn validate(profile: &Profile) -> PolicyReport {
        let mut issues = Vec::new();

        match &profile.status {
            ProfileStatus::Reviewed => {
                check_reviewed(profile, &mut issues);
            }
            ProfileStatus::Verified => {
                check_reviewed(profile, &mut issues);
                check_verified(profile, &mut issues);
            }
            _ => {
                // Experimental, Draft, Stale, Deprecated → sin requisitos de política
            }
        }

        PolicyReport {
            profile_id: profile.id.clone(),
            profile_status: profile.status.clone(),
            issues,
        }
    }

    /// Validación con contexto de catálogo.
    ///
    /// Además de las reglas básicas, verifica que el `profile.id` coincide
    /// con una entrada en el catálogo. Usado en CI de TeXisStudio-Profiles.
    pub fn validate_with_catalog(
        profile: &Profile,
        catalog_ids: &[String],
    ) -> PolicyReport {
        let mut report = Self::validate(profile);

        if !catalog_ids.contains(&profile.id) {
            report.issues.push(PolicyIssue {
                severity: PolicySeverity::Error,
                code: "POL_ID_NOT_IN_CATALOG".to_string(),
                message: format!(
                    "El perfil '{}' no tiene entrada en catalog.json.",
                    profile.id
                ),
                field: Some("id".to_string()),
            });
        }

        report
    }
}

// ── Reglas para `reviewed` ───────────────────────────────────────────────────

fn check_reviewed(profile: &Profile, issues: &mut Vec<PolicyIssue>) {
    let ver = profile.verification.as_ref();

    // POL_REVIEWED_NO_SOURCE_URLS — fuentes oficiales obligatorias
    let source_urls_ok = ver
        .map(|v| !v.source_urls.is_empty())
        .unwrap_or(false);
    if !source_urls_ok {
        issues.push(PolicyIssue {
            severity: PolicySeverity::Error,
            code: "POL_REVIEWED_NO_SOURCE_URLS".to_string(),
            message: format!(
                "El perfil '{}' tiene status 'reviewed' pero no declara \
                 verification.source_urls. Se requiere al menos una URL oficial.",
                profile.id
            ),
            field: Some("verification.source_urls".to_string()),
        });
    }

    // POL_REVIEWED_NO_DATE — fecha de revisión obligatoria
    // Acepta reviewed_at (semánticamente correcto) o verified_at (legacy compatible, D9)
    let has_date = ver.map(|v| {
        v.reviewed_at.as_deref().map(|s| !s.is_empty()).unwrap_or(false)
            || v.verified_at.as_deref().map(|s| !s.is_empty()).unwrap_or(false)
    }).unwrap_or(false);
    if !has_date {
        issues.push(PolicyIssue {
            severity: PolicySeverity::Error,
            code: "POL_REVIEWED_NO_DATE".to_string(),
            message: format!(
                "El perfil '{}' tiene status 'reviewed' pero no declara \
                 verification.reviewed_at (ni el campo legacy verified_at).",
                profile.id
            ),
            field: Some("verification.reviewed_at".to_string()),
        });
    }

    // POL_REVIEWED_NO_INTERVAL — intervalo de re-revisión recomendado
    let has_interval = ver
        .and_then(|v| v.review_interval_days)
        .is_some();
    if !has_interval {
        issues.push(PolicyIssue {
            severity: PolicySeverity::Warning,
            code: "POL_REVIEWED_NO_INTERVAL".to_string(),
            message: format!(
                "El perfil '{}' no declara verification.review_interval_days. \
                 Se recomienda establecer un intervalo de re-revisión (ej. 365 días).",
                profile.id
            ),
            field: Some("verification.review_interval_days".to_string()),
        });
    }

    // POL_SCHEMA_VERSION — schema_version debe estar presente y ser compatible
    if profile.schema_version.is_empty() {
        issues.push(PolicyIssue {
            severity: PolicySeverity::Error,
            code: "POL_MISSING_SCHEMA_VERSION".to_string(),
            message: format!(
                "El perfil '{}' no declara schema_version. \
                 Los perfiles 'reviewed' deben declarar la versión del schema.",
                profile.id
            ),
            field: Some("schema_version".to_string()),
        });
    }
}

// ── Reglas adicionales para `verified` ──────────────────────────────────────

fn check_verified(profile: &Profile, issues: &mut Vec<PolicyIssue>) {
    let ver = profile.verification.as_ref();

    // POL_VERIFIED_NO_VERIFIED_AT — fecha de verificación automatizada obligatoria
    let has_verified_at = ver
        .and_then(|v| v.verified_at.as_deref())
        .map(|s| !s.is_empty())
        .unwrap_or(false);
    if !has_verified_at {
        issues.push(PolicyIssue {
            severity: PolicySeverity::Error,
            code: "POL_VERIFIED_NO_VERIFIED_AT".to_string(),
            message: format!(
                "El perfil '{}' tiene status 'verified' pero no declara \
                 verification.verified_at.",
                profile.id
            ),
            field: Some("verification.verified_at".to_string()),
        });
    }

    // POL_VERIFIED_NO_VERIFIED_BY
    let has_verified_by = ver
        .and_then(|v| v.verified_by.as_deref())
        .map(|s| !s.is_empty())
        .unwrap_or(false);
    if !has_verified_by {
        issues.push(PolicyIssue {
            severity: PolicySeverity::Error,
            code: "POL_VERIFIED_NO_VERIFIED_BY".to_string(),
            message: format!(
                "El perfil '{}' tiene status 'verified' pero no declara \
                 verification.verified_by.",
                profile.id
            ),
            field: Some("verification.verified_by".to_string()),
        });
    }

    // POL_VERIFIED_NO_CI_EVIDENCE — evidencia de CI obligatoria (P1.8/P3)
    //
    // Un perfil 'verified' debe respaldar su afirmación con una URL a la ejecución
    // de CI que lo verificó. Sin este campo, 'verified' es solo una etiqueta editorial,
    // no una afirmación técnica verificable.
    let has_ci_evidence = ver
        .and_then(|v| v.ci_evidence.as_deref())
        .map(|s| !s.is_empty())
        .unwrap_or(false);
    if !has_ci_evidence {
        issues.push(PolicyIssue {
            severity: PolicySeverity::Error,
            code: "POL_VERIFIED_NO_CI_EVIDENCE".to_string(),
            message: format!(
                "El perfil '{}' tiene status 'verified' pero no declara \
                 verification.ci_evidence. Se requiere una URL a la ejecución \
                 de CI que generó el PDF y ejecutó el postflight completo.",
                profile.id
            ),
            field: Some("verification.ci_evidence".to_string()),
        });
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::profile::model::{
        Profile, ProfileDocumentClass, ProfileStatus, ProfileVerification,
    };

    fn draft_profile(id: &str) -> Profile {
        Profile::new_draft(
            id.to_string(),
            "Test Profile".to_string(),
            ProfileDocumentClass { name: "book".to_string(), options: vec![] },
            "xelatex".to_string(),
            "biber".to_string(),
            "apa".to_string(),
        )
    }

    fn reviewed_profile_complete(id: &str) -> Profile {
        let mut p = draft_profile(id);
        p.status = ProfileStatus::Reviewed;
        p.schema_version = "1.0.0".to_string();
        p.verification = Some(ProfileVerification {
            verified_at: None,
            verified_by: None,
            reviewed_at: Some("2026-01-15".to_string()),
            reviewed_by: Some("reviewer".to_string()),
            source_urls: vec!["https://example.edu/thesis-guide".to_string()],
            review_interval_days: Some(365),
            ci_evidence: None,
        });
        p
    }

    #[test]
    fn draft_no_produce_issues() {
        let p = draft_profile("test.draft");
        let report = ProfilePolicyValidator::validate(&p);
        assert!(report.issues.is_empty(), "Draft no debe producir issues de política");
    }

    #[test]
    fn reviewed_sin_source_urls_produce_error() {
        let mut p = reviewed_profile_complete("test.reviewed");
        if let Some(v) = &mut p.verification {
            v.source_urls.clear();
        }
        let report = ProfilePolicyValidator::validate(&p);
        assert!(
            report.issues.iter().any(|i| i.code == "POL_REVIEWED_NO_SOURCE_URLS"),
            "reviewed sin source_urls debe producir POL_REVIEWED_NO_SOURCE_URLS"
        );
        assert!(report.has_errors());
    }

    #[test]
    fn reviewed_sin_fecha_produce_error() {
        let mut p = reviewed_profile_complete("test.reviewed");
        if let Some(v) = &mut p.verification {
            v.reviewed_at = None;
            v.verified_at = None;
        }
        let report = ProfilePolicyValidator::validate(&p);
        assert!(
            report.issues.iter().any(|i| i.code == "POL_REVIEWED_NO_DATE"),
            "reviewed sin fecha debe producir POL_REVIEWED_NO_DATE"
        );
    }

    #[test]
    fn reviewed_con_legacy_verified_at_es_valido_para_fecha() {
        let mut p = reviewed_profile_complete("test.reviewed.legacy");
        if let Some(v) = &mut p.verification {
            v.reviewed_at = None;
            v.verified_at = Some("2025-12-01".to_string());
        }
        let report = ProfilePolicyValidator::validate(&p);
        assert!(
            !report.issues.iter().any(|i| i.code == "POL_REVIEWED_NO_DATE"),
            "reviewed con legacy verified_at no debe producir error de fecha"
        );
    }

    #[test]
    fn reviewed_sin_intervalo_produce_warning_no_error() {
        let mut p = reviewed_profile_complete("test.reviewed");
        if let Some(v) = &mut p.verification {
            v.review_interval_days = None;
        }
        let report = ProfilePolicyValidator::validate(&p);
        let interval_issue = report.issues.iter().find(|i| i.code == "POL_REVIEWED_NO_INTERVAL");
        assert!(interval_issue.is_some(), "debe producir POL_REVIEWED_NO_INTERVAL");
        assert_eq!(interval_issue.unwrap().severity, PolicySeverity::Warning);
        // Sin errores adicionales (solo el warning de intervalo)
        assert!(!report.has_errors(), "falta de intervalo es warning, no error");
    }

    #[test]
    fn reviewed_completo_sin_issues_de_error() {
        let p = reviewed_profile_complete("test.reviewed.ok");
        let report = ProfilePolicyValidator::validate(&p);
        assert!(!report.has_errors(), "perfil reviewed completo no debe tener errores");
    }

    fn verified_profile_complete(id: &str) -> Profile {
        let mut p = reviewed_profile_complete(id);
        p.status = ProfileStatus::Verified;
        if let Some(v) = &mut p.verification {
            v.verified_at = Some("2026-05-27".to_string());
            v.verified_by = Some("TeXisStudio CI — automated LaTeX compilation + postflight".to_string());
            v.ci_evidence = Some("https://github.com/GonzaloAndDev/TeXisStudio-Profiles/actions/runs/1".to_string());
        }
        p
    }

    #[test]
    fn verified_completo_sin_errores() {
        let p = verified_profile_complete("test.verified.ok");
        let report = ProfilePolicyValidator::validate(&p);
        assert!(!report.has_errors(), "perfil verified completo no debe tener errores: {:?}", report.issues);
    }

    #[test]
    fn verified_sin_ci_evidence_produce_error() {
        let mut p = verified_profile_complete("test.verified.no-ci");
        if let Some(v) = &mut p.verification {
            v.ci_evidence = None;
        }
        let report = ProfilePolicyValidator::validate(&p);
        assert!(
            report.issues.iter().any(|i| i.code == "POL_VERIFIED_NO_CI_EVIDENCE"),
            "verified sin ci_evidence debe producir POL_VERIFIED_NO_CI_EVIDENCE"
        );
        assert!(report.has_errors());
    }

    #[test]
    fn verified_sin_verified_at_produce_error() {
        let mut p = verified_profile_complete("test.verified.no-at");
        if let Some(v) = &mut p.verification {
            v.verified_at = None;
        }
        let report = ProfilePolicyValidator::validate(&p);
        assert!(
            report.issues.iter().any(|i| i.code == "POL_VERIFIED_NO_VERIFIED_AT"),
            "verified sin verified_at debe producir POL_VERIFIED_NO_VERIFIED_AT"
        );
    }

    #[test]
    fn validate_with_catalog_falla_si_id_no_esta() {
        let p = reviewed_profile_complete("test.not.in.catalog");
        let catalog = vec!["other.profile".to_string()];
        let report = ProfilePolicyValidator::validate_with_catalog(&p, &catalog);
        assert!(
            report.issues.iter().any(|i| i.code == "POL_ID_NOT_IN_CATALOG"),
            "id no en catálogo debe producir POL_ID_NOT_IN_CATALOG"
        );
    }

    #[test]
    fn validate_with_catalog_ok_si_id_esta() {
        let p = reviewed_profile_complete("test.in.catalog");
        let catalog = vec!["test.in.catalog".to_string()];
        let report = ProfilePolicyValidator::validate_with_catalog(&p, &catalog);
        assert!(
            !report.issues.iter().any(|i| i.code == "POL_ID_NOT_IN_CATALOG"),
            "id en catálogo no debe producir error de catálogo"
        );
    }
}
