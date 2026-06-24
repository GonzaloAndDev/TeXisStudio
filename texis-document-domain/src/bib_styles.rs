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
}

const APA7: BibStyleSpec = BibStyleSpec {
    key: "apa7",
    backends: &[BibliographyBackend::Biber],
};
const IEEE: BibStyleSpec = BibStyleSpec {
    key: "ieee",
    backends: &[BibliographyBackend::Biber, BibliographyBackend::Bibtex],
};
const VANCOUVER: BibStyleSpec = BibStyleSpec {
    key: "vancouver",
    backends: &[BibliographyBackend::Biber],
};
const CHICAGO: BibStyleSpec = BibStyleSpec {
    key: "chicago",
    backends: &[BibliographyBackend::Biber],
};
const MHRA: BibStyleSpec = BibStyleSpec {
    key: "mhra",
    backends: &[BibliographyBackend::Biber],
};
const ABNT: BibStyleSpec = BibStyleSpec {
    key: "abnt",
    backends: &[BibliographyBackend::Biber, BibliographyBackend::Bibtex],
};
const GBT7714: BibStyleSpec = BibStyleSpec {
    key: "gbt7714",
    backends: &[BibliographyBackend::Biber],
};

/// Todos los estilos soportados.
pub const STYLES: &[&BibStyleSpec] = &[&APA7, &IEEE, &VANCOUVER, &CHICAGO, &MHRA, &ABNT, &GBT7714];

/// Busca un estilo por su clave canónica y aliases comunes de perfiles.
pub fn lookup(style: &str) -> Option<&'static BibStyleSpec> {
    let key = match style {
        "apa" => "apa7",
        "chicago17_notes" | "chicago-notes" | "verbose-note" => "chicago",
        "gb7714" | "gb7714-2015" => "gbt7714",
        other => other,
    };
    STYLES.iter().copied().find(|s| s.key == key)
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
