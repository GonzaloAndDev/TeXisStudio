//! `LegacyProjectInput`: la política del perfil 2.x tiene precedencia sobre la
//! derivada del modelo legacy, y el fallback de idioma se aplica.

use texis_document_contracts::locale::LanguageTag;
use texis_document_contracts::profile::*;
use texis_document_contracts::version::ContractVersion;
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::{import_project_input, LegacyProjectInput};

fn profile_with_strict_policy() -> Profile2 {
    Profile2 {
        contract_version: ContractVersion::new(2, 0),
        identity: ProfileIdentity {
            id: "inst-x".into(),
            name: "Institución X".into(),
            institution: None,
            country: None,
            trust: TrustLevel::Community,
            revised_at: None,
            evidence: vec![],
        },
        policy: ProfilePolicy {
            required_preliminaries: vec![RequiredPreliminary::OriginalityStatement],
            require_keywords: true,
            ..Default::default()
        },
    }
}

#[test]
fn profile_policy_overrides_derived() {
    let model = sample_thesis();
    let profile = profile_with_strict_policy();

    let ir = import_project_input(LegacyProjectInput::new(&model).with_profile(&profile))
        .value
        .unwrap();

    // La política institucional inyectada está presente (no la derivada).
    assert!(ir
        .profile
        .policy
        .required_preliminaries
        .contains(&RequiredPreliminary::OriginalityStatement));
    assert!(ir.profile.policy.require_keywords);
}

#[test]
fn document_fallback_is_applied() {
    let model = sample_thesis();
    let ir = import_project_input(
        LegacyProjectInput::new(&model).with_document_fallback(LanguageTag::new("es")),
    )
    .value
    .unwrap();
    assert_eq!(
        ir.locale.document_fallback.as_ref().map(|t| t.as_str()),
        Some("es")
    );
}
