//! Validación del módulo de portada (§7.1, Etapa C).
//!
//! Reglas de dominio puras: emiten diagnósticos estructurados con códigos
//! estables `COVER-NNN`. No deciden render ni tocan otros módulos.

use crate::ir::modules::{CoverDocument, CoverOverflowPolicy};
use texis_document_contracts::diagnostics::{
    Diagnostic, DiagnosticStage, Diagnostics, DocumentLocation,
};
use texis_document_contracts::ids::ModuleId;

/// Umbral de longitud de título a partir del cual hay riesgo de desbordamiento.
const TITLE_OVERFLOW_CHARS: usize = 220;
/// Número de autoridades a partir del cual la portada de una página peligra.
const AUTHORITIES_OVERFLOW: usize = 8;

pub fn validate(cover: &CoverDocument) -> Diagnostics {
    let mut d = Diagnostics::new();
    let loc = || DocumentLocation::module(ModuleId::Cover);

    // Campos obligatorios.
    if cover.title.trim().is_empty() {
        d.push(
            Diagnostic::error(
                "COVER-001",
                ModuleId::Cover,
                DiagnosticStage::Validation,
                "cover.title_missing",
            )
            .with_location(loc()),
        );
    }
    if cover.institution.name.trim().is_empty() {
        d.push(
            Diagnostic::error(
                "COVER-002",
                ModuleId::Cover,
                DiagnosticStage::Validation,
                "cover.institution_missing",
            )
            .with_location(loc()),
        );
    }
    if cover.authors.is_empty() {
        d.push(
            Diagnostic::error(
                "COVER-003",
                ModuleId::Cover,
                DiagnosticStage::Validation,
                "cover.authors_missing",
            )
            .with_location(loc()),
        );
    }
    for (i, a) in cover.authors.iter().enumerate() {
        if a.full_name.trim().is_empty() {
            d.push(
                Diagnostic::error(
                    "COVER-004",
                    ModuleId::Cover,
                    DiagnosticStage::Validation,
                    "cover.author_name_empty",
                )
                .with_param("index", i.to_string()),
            );
        }
        if let Some(orcid) = &a.orcid {
            if !is_valid_orcid(orcid) {
                d.push(
                    Diagnostic::warning(
                        "COVER-005",
                        ModuleId::Cover,
                        DiagnosticStage::Validation,
                        "cover.orcid_malformed",
                    )
                    .with_param("orcid", orcid),
                );
            }
        }
    }

    // Año plausible.
    if cover.year < 1900 || cover.year > 2100 {
        d.push(
            Diagnostic::warning(
                "COVER-006",
                ModuleId::Cover,
                DiagnosticStage::Validation,
                "cover.year_implausible",
            )
            .with_param("year", cover.year.to_string()),
        );
    }

    // Riesgo de desbordamiento según política.
    let title_len = cover.title.chars().count();
    let crowded =
        title_len > TITLE_OVERFLOW_CHARS || cover.authorities.len() > AUTHORITIES_OVERFLOW;
    if crowded {
        let sev = match cover.overflow_policy {
            // Con FailLoud, el exceso es bloqueante (no se esconde nada).
            CoverOverflowPolicy::FailLoud => Diagnostic::error(
                "COVER-010",
                ModuleId::Cover,
                DiagnosticStage::Validation,
                "cover.overflow_risk",
            ),
            _ => Diagnostic::warning(
                "COVER-010",
                ModuleId::Cover,
                DiagnosticStage::Validation,
                "cover.overflow_risk",
            ),
        };
        d.push(
            sev.with_param("title_len", title_len.to_string())
                .with_param("authorities", cover.authorities.len().to_string())
                .with_param("policy", format!("{:?}", cover.overflow_policy)),
        );
    }

    d
}

/// Valida el formato ORCID `XXXX-XXXX-XXXX-XXXX` (último dígito puede ser X).
fn is_valid_orcid(s: &str) -> bool {
    let groups: Vec<&str> = s.split('-').collect();
    if groups.len() != 4 {
        return false;
    }
    for (gi, g) in groups.iter().enumerate() {
        if g.len() != 4 {
            return false;
        }
        for (ci, c) in g.chars().enumerate() {
            let last = gi == 3 && ci == 3;
            if !(c.is_ascii_digit() || (last && (c == 'X' || c == 'x'))) {
                return false;
            }
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ir::modules::{Author, InstitutionIdentity};

    fn base_cover() -> CoverDocument {
        CoverDocument {
            institution: InstitutionIdentity {
                name: "Uni".into(),
                faculty: None,
                department: None,
                country: "MX".into(),
                logo: None,
            },
            title: "Título".into(),
            subtitle: None,
            authors: vec![Author {
                full_name: "Ada".into(),
                student_id: None,
                email: None,
                orcid: Some("0000-0002-1825-0097".into()),
            }],
            authorities: vec![],
            city: "CDMX".into(),
            year: 2026,
            signatures: vec![],
            overflow_policy: CoverOverflowPolicy::ShrinkWithinLimits,
        }
    }

    #[test]
    fn valid_cover_has_no_diagnostics() {
        assert!(validate(&base_cover()).is_empty());
    }

    #[test]
    fn missing_title_is_error() {
        let mut c = base_cover();
        c.title = "  ".into();
        let d = validate(&c);
        assert!(d.errors().any(|x| x.code.as_str() == "COVER-001"));
    }

    #[test]
    fn bad_orcid_warns() {
        let mut c = base_cover();
        c.authors[0].orcid = Some("123".into());
        assert!(validate(&c).iter().any(|x| x.code.as_str() == "COVER-005"));
    }

    #[test]
    fn fail_loud_makes_overflow_blocking() {
        let mut c = base_cover();
        c.overflow_policy = CoverOverflowPolicy::FailLoud;
        c.title = "x".repeat(300);
        let d = validate(&c);
        assert!(d.has_blocking());
        assert!(d.iter().any(|x| x.code.as_str() == "COVER-010"));
    }
}
