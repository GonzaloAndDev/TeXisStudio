//! Política de reconciliación del backend de bibliografía (biber vs bibtex)
//! según el compilador activo. Núcleo de la estrategia "dos caminos":
//!
//! - **Suite (latexmk)** → respeta el backend declarado (por defecto biber).
//!   latexmk y biber vienen del mismo TeX Live: versiones pareja → estable,
//!   soporta TODOS los estilos.
//! - **Tectonic** → corre el bib-tool internamente. Con `backend=bibtex` no
//!   necesita herramienta externa (estable). Con `backend=biber` invoca un
//!   biber EXTERNO cuya versión el usuario controla → frágil. Por eso, bajo
//!   Tectonic preferimos bibtex SALVO que el estilo lo exija (biblatex-apa,
//!   -ieee, -chicago, etc. requieren biber); en ese caso se mantiene biber y
//!   se señala que conviene la suite (ver `needs_full_suite`).
//!
//! Función pura y testeable; el comando de compilación la aplica antes de
//! regenerar main.tex para que el `\usepackage[backend=…]{biblatex}` case con
//! lo que realmente se va a ejecutar.

use crate::project::model::{BibliographyBackend, CompilerKind};

/// Estilos del CORE de biblatex que funcionan con `backend=bibtex`. Todo lo
/// demás (los estilos "fancy": apa, ieee, vancouver, chicago, abnt, gb7714,
/// mhra, mla…) requiere biber, así que por defecto se asume que SÍ lo requiere.
const BIBTEX_SAFE_STYLES: &[&str] = &[
    "numeric", "numeric-comp", "numeric-verb",
    "alphabetic", "alphabetic-verb",
    "authoryear", "authoryear-comp", "authoryear-ibid", "authoryear-icomp",
    "authortitle", "authortitle-comp", "authortitle-ibid", "authortitle-icomp",
    "authortitle-terse", "authortitle-tcomp", "authortitle-ticomp",
    "draft", "debug", "reading",
];

/// ¿El estilo biblatex exige biber (no funciona con `backend=bibtex`)?
pub fn requires_biber(style: &str) -> bool {
    !BIBTEX_SAFE_STYLES.contains(&style)
}

/// Backend efectivo a escribir en `\usepackage[backend=…]{biblatex}` dado el
/// compilador activo, el backend declarado y el estilo.
pub fn resolve_backend(
    style: &str,
    declared: BibliographyBackend,
    compiler: CompilerKind,
) -> BibliographyBackend {
    match compiler {
        // La suite maneja ambos; respetamos lo declarado (biber por defecto).
        CompilerKind::Latexmk => declared,
        // Tectonic: bibtex interno (estable) salvo que el estilo exija biber.
        CompilerKind::Tectonic => {
            if requires_biber(style) {
                BibliographyBackend::Biber
            } else {
                BibliographyBackend::Bibtex
            }
        }
    }
}

/// True cuando la combinación elegida NO es estable por sí sola y conviene la
/// suite completa: Tectonic + un estilo que exige biber (biber externo de
/// versión arbitraria → posible desajuste con el biblatex del bundle).
pub fn needs_full_suite(style: &str, compiler: CompilerKind) -> bool {
    matches!(compiler, CompilerKind::Tectonic) && requires_biber(style)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn estilos_core_no_requieren_biber() {
        assert!(!requires_biber("numeric"));
        assert!(!requires_biber("authoryear"));
        assert!(!requires_biber("alphabetic"));
    }

    #[test]
    fn estilos_fancy_requieren_biber() {
        for s in ["apa", "ieee", "vancouver", "abnt", "gb7714-2015", "mhra", "chicago-authordate", "chicago-notes", "mla"] {
            assert!(requires_biber(s), "{s} debe requerir biber");
        }
    }

    fn is_biber(b: BibliographyBackend) -> bool { matches!(b, BibliographyBackend::Biber) }
    fn is_bibtex(b: BibliographyBackend) -> bool { matches!(b, BibliographyBackend::Bibtex) }

    #[test]
    fn latexmk_respeta_el_backend_declarado() {
        assert!(is_biber(resolve_backend("apa", BibliographyBackend::Biber, CompilerKind::Latexmk)));
        assert!(is_bibtex(resolve_backend("numeric", BibliographyBackend::Bibtex, CompilerKind::Latexmk)));
    }

    #[test]
    fn tectonic_usa_bibtex_para_estilos_core() {
        // estable: bibtex interno, sin herramienta externa
        assert!(is_bibtex(resolve_backend("numeric", BibliographyBackend::Biber, CompilerKind::Tectonic)));
        assert!(is_bibtex(resolve_backend("authoryear", BibliographyBackend::Biber, CompilerKind::Tectonic)));
    }

    #[test]
    fn tectonic_mantiene_biber_para_estilos_que_lo_exigen() {
        assert!(is_biber(resolve_backend("apa", BibliographyBackend::Biber, CompilerKind::Tectonic)));
        assert!(needs_full_suite("apa", CompilerKind::Tectonic));
        assert!(!needs_full_suite("numeric", CompilerKind::Tectonic));
        assert!(!needs_full_suite("apa", CompilerKind::Latexmk));
    }
}
