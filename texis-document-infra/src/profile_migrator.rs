//! Migrador de perfiles 1.x → Perfil 2.x (§9.1, Etapa H repo-side).
//!
//! Adaptador de entrada: traduce el `Profile` legacy de `texis-core` al contrato
//! `Profile2` declarativo y verificable. La confianza, evidencia y políticas
//! auto-comprobables se derivan de los campos legacy sin pérdida silenciosa.

use texis_core::profile::model as legacy;
use texis_document_contracts::profile::*;
use texis_document_contracts::version::ContractVersion;

/// Migra un perfil legacy a Perfil 2.x.
pub fn migrate(p: &legacy::Profile) -> Profile2 {
    let trust = match p.status {
        legacy::ProfileStatus::Verified => TrustLevel::Verified,
        legacy::ProfileStatus::Reviewed => TrustLevel::Community,
        _ => TrustLevel::Draft,
    };

    let (revised_at, evidence) = p
        .verification
        .as_ref()
        .map(|v| {
            let date = v.reviewed_at.clone().or_else(|| v.verified_at.clone());
            let mut ev = v.source_urls.clone();
            if let Some(ci) = &v.ci_evidence {
                ev.push(ci.clone());
            }
            (date, ev)
        })
        .unwrap_or((None, Vec::new()));

    let identity = ProfileIdentity {
        id: p.id.clone(),
        name: p.name.clone(),
        institution: None,
        country: None,
        trust,
        revised_at,
        evidence,
    };

    // Preliminares requeridos y keywords desde las secciones marcadas required.
    let mut required_preliminaries = Vec::new();
    let mut require_keywords = false;
    let mut has_toc = false;
    for s in &p.sections {
        let e = s.element_id.to_lowercase();
        if e.contains("toc") || e.contains("indice") || e.contains("contents") {
            has_toc = true;
        }
        if !s.required {
            continue;
        }
        if e.contains("keyword") || e.contains("palabras_clave") || e.contains("palabras-clave") {
            require_keywords = true;
        } else if let Some(rp) = map_element(&e) {
            if !required_preliminaries.contains(&rp) {
                required_preliminaries.push(rp);
            }
        }
    }

    let policy = ProfilePolicy {
        required_preliminaries,
        recommended_preliminaries: Vec::new(),
        require_keywords,
        cover: CoverPolicy {
            // Si el perfil trae plantilla de portada institucional, suele exigir logo.
            require_logo: p.title_page_template.is_some(),
            require_signatures: false,
            require_orcid: false,
            max_title_chars: None,
        },
        bibliography: BibliographyPolicy {
            allowed_styles: if p.bibliography_style.is_empty() {
                Vec::new()
            } else {
                vec![normalize_style(&p.bibliography_style)]
            },
            required_backend: if p.bibliography_backend.is_empty() {
                None
            } else {
                Some(p.bibliography_backend.to_lowercase())
            },
        },
        indexes: IndexesPolicy {
            require_toc: has_toc,
            max_toc_depth: None,
        },
        delivery: DeliveryPolicy {
            require_pdf_metadata: p.pdf_requirements.is_some(),
            require_pdfa: p
                .pdf_requirements
                .as_ref()
                .and_then(|req| req.pdfa.as_ref())
                .map(|pdfa| pdfa.required)
                .unwrap_or(false),
            pdfa_level: p
                .pdf_requirements
                .as_ref()
                .and_then(|req| req.pdfa.as_ref())
                .and_then(|pdfa| pdfa.level.clone()),
            required_abstract_languages: Vec::new(),
        },
    };

    Profile2 {
        contract_version: ContractVersion::new(2, 0),
        identity,
        policy,
    }
}

fn map_element(e: &str) -> Option<RequiredPreliminary> {
    if e.contains("dedicat") {
        Some(RequiredPreliminary::Dedication)
    } else if e.contains("agradec") || e.contains("acknowledg") {
        Some(RequiredPreliminary::Acknowledgements)
    } else if e.contains("original") || e.contains("declarac") {
        Some(RequiredPreliminary::OriginalityStatement)
    } else if e.contains("autoriz") {
        Some(RequiredPreliminary::Authorization)
    } else if e.contains("resumen") || e.contains("abstract") {
        Some(RequiredPreliminary::Abstract)
    } else if e.contains("epigraf") || e.contains("epigraph") {
        Some(RequiredPreliminary::Epigraph)
    } else if e.contains("nomenclat") {
        Some(RequiredPreliminary::Nomenclature)
    } else if e.contains("glosar") || e.contains("glossary") {
        Some(RequiredPreliminary::Glossary)
    } else {
        None
    }
}

fn normalize_style(s: &str) -> String {
    let s = s.to_lowercase();
    if s == "apa" {
        "apa7".to_string()
    } else {
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn legacy_profile() -> legacy::Profile {
        legacy::Profile {
            schema_version: "1.0.0".into(),
            id: "uni-x".into(),
            name: "Universidad X".into(),
            description: None,
            tags: vec![],
            author: None,
            version: None,
            license: None,
            status: legacy::ProfileStatus::Verified,
            verification: Some(legacy::ProfileVerification {
                verified_at: Some("2026-01-01".into()),
                verified_by: Some("ci".into()),
                reviewed_at: Some("2026-02-01".into()),
                reviewed_by: Some("humano".into()),
                source_urls: vec!["https://uni.x/reglamento".into()],
                review_interval_days: Some(365),
                ci_evidence: Some("https://ci/run/1".into()),
            }),
            document_class: legacy::ProfileDocumentClass {
                name: "book".into(),
                options: vec!["12pt".into()],
            },
            latex_engine: "xelatex".into(),
            compiler: "latexmk".into(),
            bibliography_backend: "Biber".into(),
            bibliography_style: "APA".into(),
            packages: vec![],
            page_layout: None,
            element_aliases: None,
            max_words: None,
            max_abstract_words: None,
            sections: vec![
                legacy::ProfileSectionDef {
                    id: "s1".into(),
                    element_id: "resumen".into(),
                    placement: "front_matter".into(),
                    required: true,
                    title: None,
                    label: None,
                    guidance: None,
                },
                legacy::ProfileSectionDef {
                    id: "s2".into(),
                    element_id: "indice_general".into(),
                    placement: "front_matter".into(),
                    required: true,
                    title: None,
                    label: None,
                    guidance: None,
                },
            ],
            pdf_requirements: None,
            title_page_template: None,
        }
    }

    #[test]
    fn migrates_trust_and_evidence() {
        let p2 = migrate(&legacy_profile());
        assert_eq!(p2.identity.trust, TrustLevel::Verified);
        assert_eq!(p2.identity.revised_at.as_deref(), Some("2026-02-01"));
        assert!(p2
            .identity
            .evidence
            .iter()
            .any(|e| e.contains("reglamento")));
        assert!(p2.identity.evidence.iter().any(|e| e.contains("ci/run")));
        // Verified migrado tiene fecha + evidencia ⇒ coherente.
        assert!(p2.self_consistency_errors().is_empty());
    }

    #[test]
    fn derives_policy_from_sections() {
        let p2 = migrate(&legacy_profile());
        assert!(p2
            .policy
            .required_preliminaries
            .contains(&RequiredPreliminary::Abstract));
        assert!(p2.policy.indexes.require_toc);
        assert_eq!(p2.policy.bibliography.allowed_styles, vec!["apa7"]);
        assert_eq!(
            p2.policy.bibliography.required_backend.as_deref(),
            Some("biber")
        );
    }
}
