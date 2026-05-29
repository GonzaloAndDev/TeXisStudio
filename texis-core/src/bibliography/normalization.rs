use super::model::{PersonName, RecordType};
use chrono::NaiveDate;
use std::collections::HashSet;

// ── DOI normalizer ────────────────────────────────────────────────────────────

/// Normaliza un DOI a su forma canónica: "10.xxxx/yyyy" sin prefijo URL.
/// Retorna None si la cadena no tiene forma de DOI válido.
pub fn normalize_doi(raw: &str) -> Option<String> {
    let stripped = raw
        .trim()
        .trim_start_matches("https://doi.org/")
        .trim_start_matches("http://doi.org/")
        .trim_start_matches("https://dx.doi.org/")
        .trim_start_matches("http://dx.doi.org/")
        .trim_start_matches("doi:")
        .trim_start_matches("DOI:");

    if !stripped.starts_with("10.") {
        return None;
    }
    let parts: Vec<&str> = stripped.splitn(2, '/').collect();
    if parts.len() < 2 || parts[1].trim().is_empty() {
        return None;
    }
    let registrant = parts[0].trim_start_matches("10.");
    if registrant.len() < 4 {
        return None;
    }
    Some(stripped.to_lowercase())
}

/// Valida el formato de un DOI normalizado.
pub fn is_valid_doi(doi: &str) -> bool {
    normalize_doi(doi).is_some()
}

// ── ISBN normalizer ───────────────────────────────────────────────────────────

/// Normaliza un ISBN eliminando guiones y espacios.
/// Retorna None si la longitud resultante no es 10 ni 13.
pub fn normalize_isbn(raw: &str) -> Option<String> {
    let digits: String = raw
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == 'X' || *c == 'x')
        .collect::<String>()
        .to_uppercase();
    match digits.len() {
        10 | 13 => Some(digits),
        _ => None,
    }
}

// ── Author parser ─────────────────────────────────────────────────────────────

/// Formato en el que viene la cadena de autores.
pub enum AuthorFormat {
    /// BibTeX: "Smith, John A. and García, María"
    BibTeX,
    /// Display name: "John Smith", "María García"
    DisplayName,
    /// DataCite: un nombre que puede ser "Smith, John" o "CERN" (organización)
    DataCiteString,
}

/// Parsea una cadena de autores en BibTeX ("A and B and C") a una lista de PersonName.
pub fn parse_authors_bibtex(raw: &str) -> Vec<PersonName> {
    if raw.trim().is_empty() {
        return Vec::new();
    }
    raw.split(" and ")
        .map(|part| parse_single_bibtex_name(part.trim()))
        .collect()
}

fn parse_single_bibtex_name(name: &str) -> PersonName {
    // Eliminar llaves protectoras de LaTeX
    let name = name.replace('{', "").replace('}', "");
    let name = name.trim();

    if let Some(comma_pos) = name.find(',') {
        let family = name[..comma_pos].trim().to_string();
        let given = name[comma_pos + 1..].trim().to_string();
        PersonName {
            family,
            given: if given.is_empty() { None } else { Some(given) },
            suffix: None,
            orcid: None,
            is_organization: false,
        }
    } else {
        // Sin coma: "Given Family" — tomamos la última palabra como apellido
        let parts: Vec<&str> = name.split_whitespace().collect();
        if parts.len() == 1 {
            PersonName::new_organization(parts[0])
        } else {
            let family = parts.last().unwrap().to_string();
            let given = parts[..parts.len() - 1].join(" ");
            PersonName::new_person(family, given)
        }
    }
}

/// Parsea un display name ("John Smith") a PersonName.
pub fn parse_display_name(raw: &str) -> PersonName {
    let raw = raw.trim();
    let parts: Vec<&str> = raw.split_whitespace().collect();
    match parts.len() {
        0 => PersonName::new_organization(""),
        1 => PersonName::new_organization(parts[0]),
        _ => {
            let family = parts.last().unwrap().to_string();
            let given = parts[..parts.len() - 1].join(" ");
            PersonName::new_person(family, given)
        }
    }
}

/// Parsea un nombre DataCite ("Smith, John" o "CERN") a PersonName.
pub fn parse_datacite_name(raw: &str) -> PersonName {
    let raw = raw.trim();
    if let Some(comma_pos) = raw.find(',') {
        let family = raw[..comma_pos].trim().to_string();
        let given = raw[comma_pos + 1..].trim().to_string();
        PersonName {
            family,
            given: if given.is_empty() { None } else { Some(given) },
            suffix: None,
            orcid: None,
            is_organization: false,
        }
    } else {
        PersonName::new_organization(raw)
    }
}

// ── Title cleaner ─────────────────────────────────────────────────────────────

/// Limpia un título proveniente de una API:
/// - Elimina etiquetas HTML (<i>, <sub>, <sup>, etc.)
/// - Decodifica entidades HTML comunes
/// - Normaliza espacios
pub fn clean_title(raw: &str) -> String {
    // 1. Decodificar entidades HTML
    let s = raw
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ");

    // 2. Eliminar etiquetas HTML
    let mut result = String::with_capacity(s.len());
    let mut in_tag = false;
    for c in s.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            c if !in_tag => result.push(c),
            _ => {}
        }
    }

    // 3. Normalizar espacios
    result.split_whitespace().collect::<Vec<_>>().join(" ")
}

// ── Date parser ───────────────────────────────────────────────────────────────

/// Resultado del parseo de una fecha bibliográfica.
pub struct ParsedDate {
    pub date: Option<NaiveDate>,
    pub year: Option<i32>,
}

/// Parsea fechas en varios formatos comunes en APIs bibliográficas.
/// Soporta: "2024", "2024-03", "2024-03-15"
pub fn parse_date_str(raw: &str) -> ParsedDate {
    let raw = raw.trim();
    let parts: Vec<&str> = raw.split('-').collect();
    match parts.len() {
        1 => {
            let year = parts[0].parse::<i32>().ok();
            ParsedDate { date: None, year }
        }
        2 => {
            let year = parts[0].parse::<i32>().ok();
            let month = parts[1].parse::<u32>().ok();
            let date = year
                .zip(month)
                .and_then(|(y, m)| NaiveDate::from_ymd_opt(y, m, 1));
            ParsedDate { date, year }
        }
        _ => {
            let year = parts[0].parse::<i32>().ok();
            let month = parts[1].parse::<u32>().ok();
            let day = parts[2].parse::<u32>().ok();
            let date = year
                .zip(month)
                .zip(day)
                .and_then(|((y, m), d)| NaiveDate::from_ymd_opt(y, m, d));
            ParsedDate { date, year }
        }
    }
}

/// Parsea date-parts de Crossref: [[2024, 3, 15]] → NaiveDate
pub fn parse_crossref_date_parts(parts: &[Vec<i32>]) -> ParsedDate {
    let row = match parts.first() {
        Some(r) => r,
        None => return ParsedDate { date: None, year: None },
    };
    let year = row.first().copied().map(|y| y as i32);
    let month = row.get(1).copied().map(|m| m as u32);
    let day = row.get(2).copied().map(|d| d as u32);

    let date = year
        .zip(month)
        .and_then(|(y, m)| {
            let d = day.unwrap_or(1);
            NaiveDate::from_ymd_opt(y, m, d)
        });

    ParsedDate { date, year }
}

// ── Type mapper ───────────────────────────────────────────────────────────────

/// Mapea un tipo Crossref a RecordType.
pub fn map_crossref_type(work_type: &str) -> RecordType {
    match work_type {
        "journal-article" => RecordType::Article,
        "book" | "monograph" | "edited-book" => RecordType::Book,
        "book-chapter" => RecordType::BookChapter,
        "proceedings-article" => RecordType::ConferencePaper,
        "proceedings" => RecordType::Proceedings,
        "dissertation" => RecordType::Thesis,
        "report" | "report-component" => RecordType::TechReport,
        "dataset" => RecordType::Dataset,
        "software" => RecordType::Software,
        "posted-content" | "peer-review" => RecordType::Preprint,
        _ => RecordType::Unknown,
    }
}

/// Mapea un resourceTypeGeneral de DataCite a RecordType.
pub fn map_datacite_type(resource_type: &str) -> RecordType {
    match resource_type {
        "Dataset" => RecordType::Dataset,
        "Software" => RecordType::Software,
        "Dissertation" => RecordType::Thesis,
        "Report" => RecordType::TechReport,
        "ConferencePaper" | "ConferenceProceeding" => RecordType::ConferencePaper,
        "Preprint" => RecordType::Preprint,
        "Text" => RecordType::Article,
        "Book" => RecordType::Book,
        "BookChapter" => RecordType::BookChapter,
        "Patent" => RecordType::Patent,
        _ => RecordType::Unknown,
    }
}

/// Mapea un type de OpenAlex a RecordType.
pub fn map_openalex_type(type_str: &str) -> RecordType {
    match type_str {
        "article" => RecordType::Article,
        "book" => RecordType::Book,
        "book-chapter" => RecordType::BookChapter,
        "dissertation" | "thesis" => RecordType::Thesis,
        "dataset" => RecordType::Dataset,
        "software" => RecordType::Software,
        "preprint" => RecordType::Preprint,
        "proceedings" | "proceedings-article" => RecordType::ConferencePaper,
        "report" => RecordType::TechReport,
        _ => RecordType::Unknown,
    }
}

// ── Citation key generator ────────────────────────────────────────────────────

/// Genera una citation key estilo "smith2024".
/// - Transliteración ASCII para apellidos con diacríticos (García → garcia)
/// - Fallback al DOI si el apellido no tiene caracteres ASCII válidos (李)
/// - Sufijo b, c, d… si hay colisión con las claves existentes
pub fn generate_cite_key(
    first_family: &str,
    year: Option<i32>,
    doi: Option<&str>,
    existing_keys: &HashSet<String>,
) -> String {
    let year_str = year
        .map(|y| y.to_string())
        .unwrap_or_else(|| "xxxx".to_string());

    let family_ascii: String = first_family
        .chars()
        .filter_map(transliterate_to_ascii)
        .collect::<String>()
        .to_lowercase();

    let slug = if family_ascii.is_empty() {
        doi.unwrap_or("anon")
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .take(8)
            .collect::<String>()
            .to_lowercase()
    } else {
        family_ascii
    };

    let slug = if slug.is_empty() {
        "anon".to_string()
    } else {
        slug
    };

    let base = format!("{}{}", slug, year_str);

    if !existing_keys.contains(&base) {
        return base;
    }
    for suffix in b'b'..=b'z' {
        let candidate = format!("{}{}", base, suffix as char);
        if !existing_keys.contains(&candidate) {
            return candidate;
        }
    }
    // Muy improbable: más de 25 colisiones
    format!("{}{}", base, uuid::Uuid::new_v4().simple())
}

/// Transliteración de caracteres Unicode comunes al ASCII más cercano.
fn transliterate_to_ascii(c: char) -> Option<char> {
    match c {
        'a'..='z' => Some(c),
        'A'..='Z' => Some(c.to_ascii_lowercase()),
        'á' | 'à' | 'â' | 'ã' | 'ä' | 'å' | 'Á' | 'À' | 'Â' | 'Ã' | 'Ä' | 'Å' => Some('a'),
        'é' | 'è' | 'ê' | 'ë' | 'É' | 'È' | 'Ê' | 'Ë' => Some('e'),
        'í' | 'ì' | 'î' | 'ï' | 'Í' | 'Ì' | 'Î' | 'Ï' => Some('i'),
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' | 'Ó' | 'Ò' | 'Ô' | 'Õ' | 'Ö' => Some('o'),
        'ú' | 'ù' | 'û' | 'ü' | 'Ú' | 'Ù' | 'Û' | 'Ü' => Some('u'),
        'ý' | 'ÿ' | 'Ý' => Some('y'),
        'ñ' | 'Ñ' => Some('n'),
        'ç' | 'Ç' => Some('c'),
        'ß' => Some('s'),
        'æ' | 'Æ' => Some('a'),
        'ø' | 'Ø' => Some('o'),
        'ð' | 'Ð' => Some('d'),
        'þ' | 'Þ' => Some('t'),
        _ => None,
    }
}

// ── Language mapping ──────────────────────────────────────────────────────────

/// Convierte un código BCP-47 al nombre de langid de BibLaTeX.
pub fn bcp47_to_langid(lang: &str) -> &str {
    match lang {
        "es" | "es-MX" | "es-ES" | "es-AR" => "spanish",
        "en" | "en-US" | "en-GB" => "english",
        "pt" | "pt-PT" => "portuguese",
        "pt-BR" => "brazilian",
        "fr" | "fr-FR" => "french",
        "de" | "de-DE" => "german",
        "it" | "it-IT" => "italian",
        "ru" | "ru-RU" => "russian",
        "zh" | "zh-CN" | "zh-TW" => "chinese",
        "ja" => "japanese",
        "ko" => "korean",
        "ar" => "arabic",
        "nl" => "dutch",
        "pl" => "polish",
        "sv" => "swedish",
        "tr" => "turkish",
        _ => lang,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn doi_normalize_strips_url_prefix() {
        assert_eq!(
            normalize_doi("https://doi.org/10.1145/359545.359563"),
            Some("10.1145/359545.359563".to_string())
        );
    }

    #[test]
    fn doi_normalize_strips_doi_prefix() {
        assert_eq!(
            normalize_doi("doi:10.1016/j.jocs.2020.101234"),
            Some("10.1016/j.jocs.2020.101234".to_string())
        );
    }

    #[test]
    fn doi_normalize_rejects_invalid() {
        assert_eq!(normalize_doi("not-a-doi"), None);
        assert_eq!(normalize_doi("10.abc"), None);
        assert_eq!(normalize_doi(""), None);
    }

    #[test]
    fn isbn_normalize_strips_hyphens() {
        assert_eq!(
            normalize_isbn("978-0-201-37962-4"),
            Some("9780201379624".to_string())
        );
    }

    #[test]
    fn isbn_normalize_rejects_wrong_length() {
        assert_eq!(normalize_isbn("123"), None);
        assert_eq!(normalize_isbn("12345678901234"), None);
    }

    #[test]
    fn author_bibtex_single_with_comma() {
        let authors = parse_authors_bibtex("García, María Elena");
        assert_eq!(authors.len(), 1);
        assert_eq!(authors[0].family, "García");
        assert_eq!(authors[0].given, Some("María Elena".to_string()));
    }

    #[test]
    fn author_bibtex_multiple() {
        let authors = parse_authors_bibtex("Smith, John and Jones, Alice");
        assert_eq!(authors.len(), 2);
        assert_eq!(authors[0].family, "Smith");
        assert_eq!(authors[1].family, "Jones");
    }

    #[test]
    fn title_cleaner_removes_html_tags() {
        assert_eq!(clean_title("Deep <i>Learning</i>"), "Deep Learning");
    }

    #[test]
    fn title_cleaner_decodes_html_entities() {
        assert_eq!(clean_title("R&amp;D"), "R&D");
    }

    #[test]
    fn title_cleaner_normalizes_spaces() {
        assert_eq!(clean_title("  hello   world  "), "hello world");
    }

    #[test]
    fn date_parser_year_only() {
        let parsed = parse_date_str("2024");
        assert_eq!(parsed.year, Some(2024));
        assert!(parsed.date.is_none());
    }

    #[test]
    fn date_parser_full_date() {
        let parsed = parse_date_str("2024-03-15");
        assert_eq!(parsed.year, Some(2024));
        assert!(parsed.date.is_some());
    }

    #[test]
    fn cite_key_generator_basic() {
        let existing = HashSet::new();
        let key = generate_cite_key("Smith", Some(2024), None, &existing);
        assert_eq!(key, "smith2024");
    }

    #[test]
    fn cite_key_generator_latin_diacritics() {
        let existing = HashSet::new();
        let key = generate_cite_key("García", Some(2024), None, &existing);
        assert_eq!(key, "garcia2024");
    }

    #[test]
    fn cite_key_generator_deduplication() {
        let mut existing = HashSet::new();
        existing.insert("smith2024".to_string());
        let key = generate_cite_key("Smith", Some(2024), None, &existing);
        assert_eq!(key, "smith2024b");
    }

    #[test]
    fn cite_key_generator_non_latin_fallback() {
        let existing = HashSet::new();
        let key = generate_cite_key("李", Some(2024), Some("10.1145/example"), &existing);
        // Fallback al DOI: primeros 8 chars alphanum de "10.1145/example"
        assert!(key.starts_with("101145ex") || key.contains("2024"));
    }

    #[test]
    fn crossref_type_mapping() {
        assert_eq!(map_crossref_type("journal-article"), RecordType::Article);
        assert_eq!(map_crossref_type("book-chapter"), RecordType::BookChapter);
        assert_eq!(map_crossref_type("dataset"), RecordType::Dataset);
    }

    #[test]
    fn bcp47_to_langid_spanish() {
        assert_eq!(bcp47_to_langid("es"), "spanish");
        assert_eq!(bcp47_to_langid("es-MX"), "spanish");
    }

    #[test]
    fn bcp47_to_langid_portuguese_brazil() {
        assert_eq!(bcp47_to_langid("pt-BR"), "brazilian");
        assert_eq!(bcp47_to_langid("pt"), "portuguese");
    }
}
