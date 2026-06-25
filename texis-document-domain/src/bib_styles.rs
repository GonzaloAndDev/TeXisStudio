//! Registro de estilos bibliográficos profesionales (§7.5, Etapa F).
//!
//! Define los siete estilos objetivo, su backend compatible y los campos
//! mínimos requeridos por tipo de entrada. Es la base de la validación
//! profesional (no basta con que compile).

use crate::ir::modules::BibliographyBackend;

/// Descriptor de un estilo bibliográfico.
pub struct BibStyleSpec {
    /// Clave canónica ("apa7", "ieee", ...).
    pub key: &'static str,
    /// Backends compatibles. El primero es el recomendado.
    pub backends: &'static [BibliographyBackend],
    /// Nombre del estilo en biblatex (lo que va en `style=` del paquete).
    /// Única fuente de verdad: el backend de render lo lee de aquí (sin mapeos
    /// ad-hoc duplicados).
    pub biblatex_style: &'static str,
}

const APA7: BibStyleSpec = BibStyleSpec {
    key: "apa7",
    backends: &[BibliographyBackend::Biber],
    biblatex_style: "apa",
};
const IEEE: BibStyleSpec = BibStyleSpec {
    key: "ieee",
    backends: &[BibliographyBackend::Biber, BibliographyBackend::Bibtex],
    biblatex_style: "ieee",
};
const VANCOUVER: BibStyleSpec = BibStyleSpec {
    key: "vancouver",
    backends: &[BibliographyBackend::Biber],
    biblatex_style: "vancouver",
};
const CHICAGO: BibStyleSpec = BibStyleSpec {
    key: "chicago",
    backends: &[BibliographyBackend::Biber],
    biblatex_style: "chicago-notes",
};
const MHRA: BibStyleSpec = BibStyleSpec {
    key: "mhra",
    backends: &[BibliographyBackend::Biber],
    // MHRA no tiene paquete biblatex oficial; `verbose-trad2` es un estilo
    // INTEGRADO de biblatex (notas al pie) que aproxima MHRA. `mla` sería
    // incorrecto y `mhra` no existe como paquete.
    biblatex_style: "verbose-trad2",
};
const CHICAGO_AUTHORDATE: BibStyleSpec = BibStyleSpec {
    key: "chicago-authordate",
    backends: &[BibliographyBackend::Biber],
    biblatex_style: "chicago-authordate",
};
const ABNT: BibStyleSpec = BibStyleSpec {
    key: "abnt",
    backends: &[BibliographyBackend::Biber, BibliographyBackend::Bibtex],
    biblatex_style: "abnt",
};
const GBT7714: BibStyleSpec = BibStyleSpec {
    key: "gbt7714",
    backends: &[BibliographyBackend::Biber],
    biblatex_style: "gb7714-2015",
};

/// Todos los estilos soportados.
pub const STYLES: &[&BibStyleSpec] = &[
    &APA7,
    &IEEE,
    &VANCOUVER,
    &CHICAGO,
    &CHICAGO_AUTHORDATE,
    &MHRA,
    &ABNT,
    &GBT7714,
];

/// Busca un estilo por su clave canónica y aliases comunes de perfiles.
pub fn lookup(style: &str) -> Option<&'static BibStyleSpec> {
    let key = match style {
        "apa" => "apa7",
        "chicago17_notes" | "chicago-notes" | "verbose-note" => "chicago",
        "chicago17_authordate" => "chicago-authordate",
        "gb7714" | "gb7714-2015" => "gbt7714",
        other => other,
    };
    STYLES.iter().copied().find(|s| s.key == key)
}

/// Nombre del estilo en biblatex para un estilo canónico (o alias). Es la
/// ÚNICA fuente de verdad para el render: si el estilo no está en el registro,
/// se devuelve tal cual (passthrough) para no romper estilos externos.
pub fn biblatex_style(style: &str) -> String {
    lookup(style)
        .map(|s| s.biblatex_style.to_string())
        .unwrap_or_else(|| style.to_string())
}

/// Campos requeridos mínimos por tipo de entrada (independiente del estilo).
/// Devuelve un slice de nombres de campo que toda entrada de ese tipo debe tener.
pub fn required_fields(entry_type: &str) -> &'static [&'static str] {
    match entry_type {
        "article" => &["author", "title", "journal", "year"],
        "book" => &["author", "title", "publisher", "year"],
        "inproceedings" | "conference" => &["author", "title", "booktitle", "year"],
        "incollection" => &["author", "title", "booktitle", "publisher", "year"],
        "phdthesis" | "mastersthesis" => &["author", "title", "school", "year"],
        "techreport" => &["author", "title", "institution", "year"],
        "misc" => &["title"],
        _ => &["author", "title", "year"],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn biblatex_style_is_single_source_of_truth() {
        assert_eq!(biblatex_style("apa7"), "apa");
        assert_eq!(biblatex_style("apa"), "apa"); // alias
        assert_eq!(biblatex_style("gbt7714"), "gb7714-2015");
        assert_eq!(biblatex_style("gb7714"), "gb7714-2015"); // alias
        assert_eq!(biblatex_style("chicago"), "chicago-notes");
        assert_eq!(biblatex_style("chicago17_authordate"), "chicago-authordate");
        // MHRA NO se mapea a `mla` (era incorrecto): estilo integrado verbose.
        assert_eq!(biblatex_style("mhra"), "verbose-trad2");
        // Estilo desconocido: passthrough.
        assert_eq!(biblatex_style("estilo-externo"), "estilo-externo");
    }

    #[test]
    fn all_seven_targets_resolve() {
        for key in ["apa7", "ieee", "vancouver", "chicago", "mhra", "abnt", "gbt7714"] {
            assert!(lookup(key).is_some(), "falta el estilo objetivo {key}");
        }
    }
}
