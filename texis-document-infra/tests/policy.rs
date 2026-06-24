//! Etapa H — Perfiles 2.x: evaluación de políticas institucionales contra el IR
//! y coherencia interna del perfil (gate `verified`).

use texis_document_contracts::profile::*;
use texis_document_contracts::version::ContractVersion;
use texis_document_domain::policy;
use texis_document_infra::fixtures::sample_thesis;
use texis_document_infra::import_project;

fn ir() -> texis_document_domain::ir::DocumentIR {
    import_project(&sample_thesis()).value.unwrap()
}

#[test]
fn satisfied_policy_has_no_blocking() {
    // El fixture: tiene logo, resumen, keywords, ToC, estilo apa7.
    let pol = ProfilePolicy {
        required_preliminaries: vec![RequiredPreliminary::Abstract],
        require_keywords: true,
        cover: CoverPolicy {
            require_logo: true,
            require_signatures: true,
            require_orcid: true,
            max_title_chars: Some(200),
        },
        bibliography: BibliographyPolicy {
            allowed_styles: vec!["apa7".into()],
            required_backend: Some("biber".into()),
        },
        indexes: IndexesPolicy {
            require_toc: true,
            max_toc_depth: Some(3),
        },
        delivery: DeliveryPolicy {
            require_pdf_metadata: true,
            require_pdfa: false,
            pdfa_level: None,
            required_abstract_languages: vec!["es".into()],
        },
        ..Default::default()
    };
    let d = policy::evaluate(&pol, &ir());
    assert!(
        !d.has_blocking(),
        "política satisfecha no debe bloquear: {d:?}"
    );
}

#[test]
fn unmet_requirements_block() {
    let pol = ProfilePolicy {
        required_preliminaries: vec![RequiredPreliminary::OriginalityStatement],
        bibliography: BibliographyPolicy {
            allowed_styles: vec!["ieee".into()], // fixture es apa7
            ..Default::default()
        },
        ..Default::default()
    };
    let d = policy::evaluate(&pol, &ir());
    assert!(d.iter().any(|x| x.code.as_str() == "POLICY-001")); // falta declaración
    assert!(d.iter().any(|x| x.code.as_str() == "POLICY-020")); // estilo no permitido
    assert!(d.has_blocking());
}

#[test]
fn long_title_violates_max_chars() {
    let pol = ProfilePolicy {
        cover: CoverPolicy {
            max_title_chars: Some(10),
            ..Default::default()
        },
        ..Default::default()
    };
    let d = policy::evaluate(&pol, &ir());
    assert!(d.iter().any(|x| x.code.as_str() == "POLICY-013"));
}

#[test]
fn verified_profile_requires_evidence_and_date() {
    let p = Profile2 {
        contract_version: ContractVersion::new(2, 0),
        identity: ProfileIdentity {
            id: "x".into(),
            name: "X".into(),
            institution: None,
            country: None,
            trust: TrustLevel::Verified,
            revised_at: None,
            evidence: vec![],
        },
        policy: ProfilePolicy::default(),
    };
    let errs = p.self_consistency_errors();
    assert!(errs.contains(&"verified_profile_missing_revised_at"));
    assert!(errs.contains(&"verified_profile_missing_evidence"));
}
