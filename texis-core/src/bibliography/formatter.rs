// Formateador de entradas BibTeX para previsualización en estilos bibliográficos.
// Produce texto con marcadores *cursiva* y **negrita** para renderizado en UI.
// No es compilación LaTeX — es aproximación suficiente para preview informativo.
//
// Estilos soportados (valor biblatex_style en CitationStyle del frontend):
//   apa              → APA 7ª ed.
//   ieee             → IEEE
//   vancouver        → Vancouver / ICMJE
//   verbose-note     → Chicago Notes-Bibliography 17 / MHRA
//   chicago-authordate → Chicago Author-Date 17
//   mla              → MLA 9ª ed.
//   abnt             → ABNT NBR 6023:2018
//   gb7714-2015      → GB/T 7714-2015

use super::parser::BibEntry;

// ── Punto de entrada ─────────────────────────────────────────────────────────

/// Formatea una entrada BibTeX en el estilo indicado.
/// Retorna texto con marcadores *cursiva* para rendering en UI.
pub fn format_entry(entry: &BibEntry, style: &str) -> String {
    match style {
        "apa"                => format_apa7(entry),
        "ieee"               => format_ieee(entry),
        "vancouver"          => format_vancouver(entry),
        "verbose-note"       => format_chicago_notes(entry),
        "chicago-authordate" => format_chicago_authordate(entry),
        "mla"                => format_mla9(entry),
        "abnt"               => format_abnt(entry),
        "gb7714-2015"        => format_gb7714(entry),
        "mhra"               => format_mhra(entry),
        _                    => format_generic(entry),
    }
}

// ── Estructura de autor analizado ────────────────────────────────────────────

#[derive(Debug, Clone)]
struct Author {
    last:  String,
    first: String,
}

impl Author {
    /// "Smith, J. A." — APA, Harvard, Vancouver
    fn apa_form(&self) -> String {
        if self.first.is_empty() {
            return self.last.clone();
        }
        format!("{}, {}", self.last, initials(&self.first))
    }

    /// "J. A. Smith" — IEEE
    fn ieee_form(&self) -> String {
        if self.first.is_empty() {
            return self.last.clone();
        }
        format!("{} {}", initials(&self.first), self.last)
    }

    /// "Smith, John A." — primer autor Chicago/MLA
    fn last_first(&self) -> String {
        if self.first.is_empty() {
            return self.last.clone();
        }
        format!("{}, {}", self.last, self.first)
    }

    /// "John A. Smith" — autores subsiguientes Chicago
    fn first_last(&self) -> String {
        if self.first.is_empty() {
            return self.last.clone();
        }
        format!("{} {}", self.first, self.last)
    }

    /// "SMITH, John A." — ABNT (primer apellido en versalitas/mayúsculas)
    fn abnt_form(&self) -> String {
        if self.first.is_empty() {
            return self.last.to_uppercase();
        }
        format!("{}, {}", self.last.to_uppercase(), self.first)
    }

    /// "SMITH J A" — GB/T 7714
    fn gb_form(&self) -> String {
        if self.first.is_empty() {
            return self.last.to_uppercase();
        }
        let inits: String = self.first
            .split_whitespace()
            .filter_map(|w| w.chars().next())
            .map(|c| c.to_uppercase().to_string())
            .collect::<Vec<_>>()
            .join(" ");
        format!("{} {}", self.last.to_uppercase(), inits)
    }
}

// ── Parser de autores ────────────────────────────────────────────────────────

fn parse_author_name(raw: &str) -> Author {
    let s = raw.trim();
    if s.starts_with('{') && s.ends_with('}') {
        return Author { last: s[1..s.len() - 1].to_string(), first: String::new() };
    }
    if let Some(comma) = s.find(',') {
        return Author {
            last:  s[..comma].trim().to_string(),
            first: s[comma + 1..].trim().to_string(),
        };
    }
    let parts: Vec<&str> = s.split_whitespace().collect();
    match parts.len() {
        0 => Author { last: String::new(), first: String::new() },
        1 => Author { last: parts[0].to_string(), first: String::new() },
        _ => Author {
            last:  parts.last().unwrap().to_string(),
            first: parts[..parts.len() - 1].join(" "),
        },
    }
}

fn parse_authors(author_str: &str) -> Vec<Author> {
    author_str
        .split(" and ")
        .map(|a| parse_author_name(a.trim()))
        .filter(|a| !a.last.is_empty())
        .collect()
}

fn initials(name: &str) -> String {
    name.split_whitespace()
        .filter_map(|w| w.chars().next())
        .map(|c| format!("{}.", c.to_uppercase().next().unwrap_or(c)))
        .collect::<Vec<_>>()
        .join(" ")
}

// ── Helpers de campo ─────────────────────────────────────────────────────────

fn field<'a>(entry: &'a BibEntry, key: &str) -> &'a str {
    entry.fields.get(key).map(|s| s.as_str()).unwrap_or("")
}

fn field_nonempty(entry: &BibEntry, key: &str) -> Option<&str> {
    entry.fields.get(key).map(|s| s.as_str()).filter(|s| !s.is_empty())
}

fn doi_url(entry: &BibEntry) -> Option<String> {
    if let Some(doi) = field_nonempty(entry, "doi") {
        let normalized = doi
            .trim()
            .trim_start_matches("https://doi.org/")
            .trim_start_matches("http://doi.org/")
            .trim_start_matches("doi:");
        return Some(format!("https://doi.org/{}", normalized));
    }
    field_nonempty(entry, "url").map(|u| u.to_string())
}

fn pages_range(pages: &str) -> String {
    pages.replace("--", "–")
}

// ── APA 7 ────────────────────────────────────────────────────────────────────
// Artículo: Apellido, I. I., & Apellido, I. I. (Año). Título. *Revista*, *vol*(n), pp–pp. URL

fn format_apa7(entry: &BibEntry) -> String {
    let authors = parse_authors(entry.author());

    let author_str = format_authors_apa(&authors);
    let year  = entry.year();
    let title = entry.title();
    let doi   = doi_url(entry);

    match entry.entry_type.as_str() {
        "article" => {
            let journal = field(entry, "journal");
            let vol     = field(entry, "volume");
            let num     = field(entry, "number");
            let pages   = field(entry, "pages");

            let mut vol_part = String::new();
            if !vol.is_empty() {
                vol_part = format!("*{}*", vol);
                if !num.is_empty() { vol_part.push_str(&format!("({})", num)); }
            }
            let pages_str = if !pages.is_empty() { format!(", {}", pages_range(pages)) } else { String::new() };
            let url_str = doi.as_deref().map(|u| format!(" {}", u)).unwrap_or_default();

            format!(
                "{} ({year}). {title}. *{journal}*{vol_sep}{vol_part}{pages_str}.{url_str}",
                author_str, year = year, title = title, journal = journal,
                vol_sep = if vol_part.is_empty() { "" } else { ", " },
                vol_part = vol_part,
            )
        }
        "book" => {
            let publisher = field(entry, "publisher");
            let url_str = doi.as_deref().map(|u| format!(" {}", u)).unwrap_or_default();
            format!("{} ({year}). *{title}*. {publisher}.{url_str}",
                author_str, year = year, title = title, publisher = publisher)
        }
        "inproceedings" | "conference" => {
            let booktitle = field(entry, "booktitle");
            let pages     = field(entry, "pages");
            let pages_str = if !pages.is_empty() { format!(", pp. {}", pages_range(pages)) } else { String::new() };
            let url_str = doi.as_deref().map(|u| format!(" {}", u)).unwrap_or_default();
            format!("{} ({year}). {title}. En *{booktitle}*{pages_str}.{url_str}",
                author_str, year = year, title = title, booktitle = booktitle,
                pages_str = pages_str)
        }
        "phdthesis" | "mastersthesis" => {
            let kind = if entry.entry_type == "phdthesis" { "Tesis doctoral" } else { "Tesis de maestría" };
            let school = field(entry, "school");
            let url_str = doi.as_deref().map(|u| format!(" {}", u)).unwrap_or_default();
            format!("{} ({year}). *{title}* [{kind}]. {school}.{url_str}",
                author_str, year = year, title = title, kind = kind, school = school)
        }
        _ => {
            let url_str = doi.as_deref().map(|u| format!(" {}", u)).unwrap_or_default();
            format!("{} ({year}). *{title}*.{url_str}",
                author_str, year = year, title = title)
        }
    }
}

fn format_authors_apa(authors: &[Author]) -> String {
    match authors.len() {
        0 => String::new(),
        1 => authors[0].apa_form(),
        2 => format!("{} & {}", authors[0].apa_form(), authors[1].apa_form()),
        n if n <= 20 => {
            let mut parts: Vec<String> = authors.iter().map(|a| a.apa_form()).collect();
            let last = parts.pop().unwrap();
            format!("{}, & {}", parts.join(", "), last)
        }
        _ => {
            let first19: Vec<String> = authors[..19].iter().map(|a| a.apa_form()).collect();
            let last_author = authors.last().unwrap().apa_form();
            format!("{}, … {}", first19.join(", "), last_author)
        }
    }
}

// ── IEEE ─────────────────────────────────────────────────────────────────────
// [1] I. A. Smith, "Título," *Journal*, vol. X, no. Y, pp. Z–Z, Año, doi: 10.xxx/xxx.

fn format_ieee(entry: &BibEntry) -> String {
    let authors  = parse_authors(entry.author());
    let title    = entry.title();
    let year     = entry.year();
    let doi_part = doi_url(entry)
        .map(|u| {
            let doi = u.trim_start_matches("https://doi.org/");
            format!(", doi: {}", doi)
        })
        .unwrap_or_default();

    let author_str = format_authors_ieee(&authors);

    match entry.entry_type.as_str() {
        "article" => {
            let journal = field(entry, "journal");
            let vol     = field(entry, "volume");
            let num     = field(entry, "number");
            let pages   = field(entry, "pages");
            let vol_str = if !vol.is_empty() { format!(", vol. {}", vol) } else { String::new() };
            let num_str = if !num.is_empty() { format!(", no. {}", num) } else { String::new() };
            let pp_str  = if !pages.is_empty() { format!(", pp. {}", pages_range(pages)) } else { String::new() };
            format!("[1] {}, \"{}\", *{}*{}{}{}, {}{}.",
                author_str, title, journal, vol_str, num_str, pp_str, year, doi_part)
        }
        "inproceedings" | "conference" => {
            let booktitle = field(entry, "booktitle");
            let pages     = field(entry, "pages");
            let pp_str    = if !pages.is_empty() { format!(", pp. {}", pages_range(pages)) } else { String::new() };
            format!("[1] {}, \"{},\" in *Proc. {}*{}, {}{}.",
                author_str, title, booktitle, pp_str, year, doi_part)
        }
        "book" => {
            let publisher = field(entry, "publisher");
            format!("[1] {}, *{}*. {}, {}{}.",
                author_str, title, publisher, year, doi_part)
        }
        "phdthesis" | "mastersthesis" => {
            let school = field(entry, "school");
            let kind   = if entry.entry_type == "phdthesis" { "Ph.D. dissertation" } else { "M.S. thesis" };
            format!("[1] {}, \"{},\" {}, {}, {}{}.",
                author_str, title, kind, school, year, doi_part)
        }
        _ => {
            format!("[1] {}, \"{}\", {}{}.",
                author_str, title, year, doi_part)
        }
    }
}

fn format_authors_ieee(authors: &[Author]) -> String {
    match authors.len() {
        0 => String::new(),
        1 => authors[0].ieee_form(),
        2 => format!("{} and {}", authors[0].ieee_form(), authors[1].ieee_form()),
        3 => format!("{}, {}, and {}", authors[0].ieee_form(), authors[1].ieee_form(), authors[2].ieee_form()),
        _ => format!("{} et al.", authors[0].ieee_form()),
    }
}

// ── Vancouver ────────────────────────────────────────────────────────────────
// 1. Smith JA, Jones MB. Título. *J Abrev*. Año;vol(n):pp–pp. doi:10.xxx/xxx

fn format_vancouver(entry: &BibEntry) -> String {
    let authors  = parse_authors(entry.author());
    let title    = entry.title();
    let year     = entry.year();
    let doi_part = doi_url(entry)
        .map(|u| {
            let d = u.trim_start_matches("https://doi.org/");
            format!(" doi:{}", d)
        })
        .unwrap_or_default();

    let author_str = format_authors_vancouver(&authors);

    match entry.entry_type.as_str() {
        "article" => {
            let journal = field(entry, "journal");
            let vol     = field(entry, "volume");
            let num     = field(entry, "number");
            let pages   = field(entry, "pages");
            let vol_num = match (vol.is_empty(), num.is_empty()) {
                (false, false) => format!(";{}({})", vol, num),
                (false, true)  => format!(";{}", vol),
                _              => String::new(),
            };
            let pp_str = if !pages.is_empty() { format!(":{}", pages_range(pages)) } else { String::new() };
            format!("1. {}{}. *{}*. {}{}{}.{}",
                author_str, if !title.is_empty() { format!(" {}", title) } else { String::new() },
                journal, year, vol_num, pp_str, doi_part)
        }
        "book" => {
            let publisher = field(entry, "publisher");
            let edition   = field(entry, "edition");
            let ed_str    = if !edition.is_empty() { format!(" {}a ed.", edition) } else { String::new() };
            format!("1. {}*{}*.{} {}.{}", author_str, title, ed_str, publisher, doi_part)
        }
        "inproceedings" | "conference" => {
            let booktitle = field(entry, "booktitle");
            let pages     = field(entry, "pages");
            let pp_str    = if !pages.is_empty() { format!("; p. {}", pages_range(pages)) } else { String::new() };
            format!("1. {}{}. En: *{}*. {}{}.{}", author_str, title, booktitle, year, pp_str, doi_part)
        }
        _ => {
            format!("1. {}{}. {}.{}", author_str, title, year, doi_part)
        }
    }
}

fn format_authors_vancouver(authors: &[Author]) -> String {
    let fmt = |a: &Author| -> String {
        if a.first.is_empty() { return a.last.clone(); }
        let inits: String = a.first.split_whitespace()
            .filter_map(|w| w.chars().next())
            .map(|c| c.to_uppercase().to_string())
            .collect::<Vec<_>>()
            .join("");
        format!("{} {}", a.last, inits)
    };
    match authors.len() {
        0 => String::new(),
        n if n <= 6 => {
            let mut parts: Vec<String> = authors.iter().map(fmt).collect();
            let last = parts.pop().unwrap();
            if parts.is_empty() { format!("{}. ", last) }
            else { format!("{}, {}. ", parts.join(", "), last) }
        }
        _ => {
            let six: Vec<String> = authors[..6].iter().map(fmt).collect();
            format!("{}, et al. ", six.join(", "))
        }
    }
}

// ── Chicago Notes-Bibliography 17 ────────────────────────────────────────────
// Firstname Last and Firstname Last, "Título," *Revista* vol, no. n (Año): pp–pp.

fn format_chicago_notes(entry: &BibEntry) -> String {
    let authors = parse_authors(entry.author());
    let title   = entry.title();
    let year    = entry.year();
    let doi_str = doi_url(entry).map(|u| format!(" {}", u)).unwrap_or_default();

    let author_str = format_authors_chicago(&authors, true);

    match entry.entry_type.as_str() {
        "article" => {
            let journal = field(entry, "journal");
            let vol     = field(entry, "volume");
            let num     = field(entry, "number");
            let pages   = field(entry, "pages");
            let vol_str = if !vol.is_empty() { vol.to_string() } else { String::new() };
            let num_str = if !num.is_empty() { format!(", no. {}", num) } else { String::new() };
            let pp_str  = if !pages.is_empty() { format!(": {}", pages_range(pages)) } else { String::new() };
            let year_pp = if !vol_str.is_empty() {
                format!(" {} ({}){}.", vol_str, year, pp_str)
            } else {
                format!(" ({}){}.", year, pp_str)
            };
            format!("{}, \"{},\" *{}*{}{}{}", author_str, title, journal, num_str, year_pp, doi_str)
        }
        "book" => {
            let publisher = field(entry, "publisher");
            format!("{}, *{}* ({}, {}).{}", author_str, title, publisher, year, doi_str)
        }
        "inproceedings" | "conference" => {
            let booktitle = field(entry, "booktitle");
            let pages     = field(entry, "pages");
            let pp_str    = if !pages.is_empty() { format!(", {}", pages_range(pages)) } else { String::new() };
            format!("{}, \"{},\" in *{}* ({}{}).{}", author_str, title, booktitle, year, pp_str, doi_str)
        }
        "phdthesis" | "mastersthesis" => {
            let school = field(entry, "school");
            let kind   = if entry.entry_type == "phdthesis" { "PhD diss." } else { "master's thesis" };
            format!("{}, \"{},\" {} {}, {}.{}", author_str, title, kind, school, year, doi_str)
        }
        _ => {
            format!("{}, *{}*, {}.{}", author_str, title, year, doi_str)
        }
    }
}

fn format_authors_chicago(authors: &[Author], notes_style: bool) -> String {
    // notes_style=true  → "Firstname Last and Firstname Last"  (para Chicago Notes)
    // notes_style=false → "Last, Firstname, and Firstname Last" (para Chicago Author-Date)
    match authors.len() {
        0 => String::new(),
        1 => if notes_style { authors[0].first_last() } else { authors[0].last_first() },
        2 => {
            if notes_style {
                format!("{} and {}", authors[0].first_last(), authors[1].first_last())
            } else {
                format!("{} and {}", authors[0].last_first(), authors[1].first_last())
            }
        }
        _ => {
            if notes_style {
                let first = authors[0].first_last();
                format!("{} et al.", first)
            } else {
                let first = authors[0].last_first();
                format!("{} et al.", first)
            }
        }
    }
}

// ── Chicago Author-Date 17 ───────────────────────────────────────────────────
// Last, Firstname, and Firstname Last. Year. "Título." *Revista* vol (n): pp–pp. URL.

fn format_chicago_authordate(entry: &BibEntry) -> String {
    let authors = parse_authors(entry.author());
    let title   = entry.title();
    let year    = entry.year();
    let doi_str = doi_url(entry).map(|u| format!(" {}", u)).unwrap_or_default();

    let author_str = format_authors_chicago(&authors, false);

    match entry.entry_type.as_str() {
        "article" => {
            let journal = field(entry, "journal");
            let vol     = field(entry, "volume");
            let num     = field(entry, "number");
            let pages   = field(entry, "pages");
            let vol_num = match (vol.is_empty(), num.is_empty()) {
                (false, false) => format!(" {} ({})", vol, num),
                (false, true)  => format!(" {}", vol),
                _              => String::new(),
            };
            let pp_str = if !pages.is_empty() { format!(": {}", pages_range(pages)) } else { String::new() };
            format!("{}. {}. \"{}\" *{}*{}{}.{}", author_str, year, title, journal, vol_num, pp_str, doi_str)
        }
        "book" => {
            let publisher = field(entry, "publisher");
            format!("{}. {}. *{}*. {}.{}", author_str, year, title, publisher, doi_str)
        }
        "inproceedings" | "conference" => {
            let booktitle = field(entry, "booktitle");
            let pages     = field(entry, "pages");
            let pp_str    = if !pages.is_empty() { format!(", {}", pages_range(pages)) } else { String::new() };
            format!("{}. {}. \"{}\" In *{}*{}.{}", author_str, year, title, booktitle, pp_str, doi_str)
        }
        "phdthesis" | "mastersthesis" => {
            let school = field(entry, "school");
            let kind   = if entry.entry_type == "phdthesis" { "PhD diss." } else { "Master's thesis" };
            format!("{}. {}. \"{}\" {}, {}.{}", author_str, year, title, kind, school, doi_str)
        }
        _ => {
            format!("{}. {}. *{}*.{}", author_str, year, title, doi_str)
        }
    }
}

// ── MLA 9 ────────────────────────────────────────────────────────────────────
// Last, Firstname, and Firstname Last. "Título." *Revista*, vol. X, no. Y, Año, pp. Z–Z.

fn format_mla9(entry: &BibEntry) -> String {
    let authors = parse_authors(entry.author());
    let title   = entry.title();
    let year    = entry.year();

    let author_str = match authors.len() {
        0 => String::new(),
        1 => format!("{}.", authors[0].last_first()),
        2 => format!("{} and {}.", authors[0].last_first(), authors[1].first_last()),
        _ => format!("{} et al.", authors[0].last_first()),
    };

    let doi_str = doi_url(entry)
        .map(|u| format!(" {}.", u))
        .unwrap_or_default();

    match entry.entry_type.as_str() {
        "article" => {
            let journal = field(entry, "journal");
            let vol     = field(entry, "volume");
            let num     = field(entry, "number");
            let pages   = field(entry, "pages");
            let vol_str = if !vol.is_empty() { format!(", vol. {}", vol) } else { String::new() };
            let num_str = if !num.is_empty() { format!(", no. {}", num) } else { String::new() };
            let pp_str  = if !pages.is_empty() { format!(", pp. {}", pages_range(pages)) } else { String::new() };
            format!("{} \"{}.\" *{}*{}{}, {}{}.{}", author_str, title, journal, vol_str, num_str, year, pp_str, doi_str)
        }
        "book" => {
            let publisher = field(entry, "publisher");
            format!("{} *{}*. {}, {}.{}", author_str, title, publisher, year, doi_str)
        }
        "inproceedings" | "conference" => {
            let booktitle = field(entry, "booktitle");
            let pages     = field(entry, "pages");
            let pp_str    = if !pages.is_empty() { format!(", pp. {}", pages_range(pages)) } else { String::new() };
            format!("{} \"{}.\" *{}*, {}{}.{}", author_str, title, booktitle, year, pp_str, doi_str)
        }
        "phdthesis" | "mastersthesis" => {
            let school = field(entry, "school");
            let kind   = if entry.entry_type == "phdthesis" { "PhD Dissertation" } else { "Master's Thesis" };
            format!("{} *{}*. {}, {}, {}.{}", author_str, title, kind, school, year, doi_str)
        }
        _ => {
            format!("{} *{}*. {}.{}", author_str, title, year, doi_str)
        }
    }
}

// ── ABNT NBR 6023:2018 ───────────────────────────────────────────────────────
// APELLIDO, Nombre; APELLIDO, Nombre. Título. **Revista**, v. X, n. Y, p. Z-Z, Año.

fn format_abnt(entry: &BibEntry) -> String {
    let authors = parse_authors(entry.author());
    let title   = entry.title();
    let year    = entry.year();
    let doi_str = doi_url(entry).map(|u| format!(" Disponible en: {}.", u)).unwrap_or_default();

    let author_str = match authors.len() {
        0 => String::new(),
        _ => {
            let parts: Vec<String> = authors.iter().map(|a| a.abnt_form()).collect();
            format!("{}. ", parts.join("; "))
        }
    };

    match entry.entry_type.as_str() {
        "article" => {
            let journal = field(entry, "journal");
            let vol     = field(entry, "volume");
            let num     = field(entry, "number");
            let pages   = field(entry, "pages");
            let vol_str = if !vol.is_empty() { format!(", v. {}", vol) } else { String::new() };
            let num_str = if !num.is_empty() { format!(", n. {}", num) } else { String::new() };
            let pp_str  = if !pages.is_empty() { format!(", p. {}", pages.replace("--", "-")) } else { String::new() };
            format!("{}{}. **{}**{}{}{}, {}.{}", author_str, title, journal, vol_str, num_str, pp_str, year, doi_str)
        }
        "book" => {
            let publisher = field(entry, "publisher");
            let edition   = field(entry, "edition");
            let ed_str    = if !edition.is_empty() { format!("{}. ed. ", edition) } else { String::new() };
            format!("{}{}{} {}. {}.{}", author_str, title, ". ", ed_str, publisher, doi_str)
        }
        _ => {
            format!("{}{}. {}.{}", author_str, title, year, doi_str)
        }
    }
}

// ── GB/T 7714-2015 ───────────────────────────────────────────────────────────
// SMITH J A, JONES M B. Título[J]. Revista, Año, vol(n): pp–pp.

fn format_gb7714(entry: &BibEntry) -> String {
    let authors = parse_authors(entry.author());
    let title   = entry.title();
    let year    = entry.year();
    let doi_str = doi_url(entry).map(|u| format!(" DOI: {}", u.trim_start_matches("https://doi.org/"))).unwrap_or_default();

    let author_str = if authors.is_empty() {
        String::new()
    } else {
        let parts: Vec<String> = authors.iter().take(3).map(|a| a.gb_form()).collect();
        if authors.len() > 3 {
            format!("{}, 等", parts.join(", "))
        } else {
            parts.join(", ")
        }
    };

    let type_tag = match entry.entry_type.as_str() {
        "article"                    => "[J]",
        "book"                       => "[M]",
        "inproceedings" | "conference" => "[C]",
        "phdthesis"                  => "[D]",
        "techreport"                 => "[R]",
        _                            => "[G]",
    };

    match entry.entry_type.as_str() {
        "article" => {
            let journal = field(entry, "journal");
            let vol     = field(entry, "volume");
            let num     = field(entry, "number");
            let pages   = field(entry, "pages");
            let vol_num = match (vol.is_empty(), num.is_empty()) {
                (false, false) => format!("{vol}({num})"),
                (false, true)  => vol.to_string(),
                _              => String::new(),
            };
            let pp_str = if !pages.is_empty() { format!(": {}", pages_range(pages)) } else { String::new() };
            let vol_sep = if !vol_num.is_empty() { format!(", {}", vol_num) } else { String::new() };
            format!("{}. {}{}. {}, {}{}{}.{}", author_str, title, type_tag, journal, year, vol_sep, pp_str, doi_str)
        }
        "book" => {
            let publisher = field(entry, "publisher");
            format!("{}. {}{}. {}, {}.{}", author_str, title, type_tag, publisher, year, doi_str)
        }
        _ => {
            format!("{}. {}{}.{}", author_str, title, type_tag, doi_str)
        }
    }
}

// ── MHRA ─────────────────────────────────────────────────────────────────────
// Similar a Chicago Notes pero con comillas simples y diferencias de puntuación.

fn format_mhra(entry: &BibEntry) -> String {
    let authors = parse_authors(entry.author());
    let title   = entry.title();
    let year    = entry.year();
    let doi_str = doi_url(entry).map(|u| format!(" <{}>", u)).unwrap_or_default();

    let author_str = match authors.len() {
        0 => String::new(),
        1 => authors[0].first_last(),
        2 => format!("{} and {}", authors[0].first_last(), authors[1].first_last()),
        _ => format!("{} and others", authors[0].first_last()),
    };

    match entry.entry_type.as_str() {
        "article" => {
            let journal = field(entry, "journal");
            let vol     = field(entry, "volume");
            let pages   = field(entry, "pages");
            let vol_str = if !vol.is_empty() { format!(", {} ({})", vol, year) } else { format!(" ({})", year) };
            let pp_str  = if !pages.is_empty() { format!(", {}", pages_range(pages)) } else { String::new() };
            format!("{}, '{}', *{}*{}{}{}", author_str, title, journal, vol_str, pp_str, doi_str)
        }
        "book" => {
            let publisher = field(entry, "publisher");
            format!("{}, *{}* ({}: {}).{}", author_str, title, publisher, year, doi_str)
        }
        _ => {
            format!("{}, *{}*, {}.{}", author_str, title, year, doi_str)
        }
    }
}

// ── Genérico ─────────────────────────────────────────────────────────────────

fn format_generic(entry: &BibEntry) -> String {
    let author = entry.author();
    let year   = entry.year();
    let title  = entry.title();
    let doi_str = doi_url(entry).map(|u| format!(" {}", u)).unwrap_or_default();
    if author.is_empty() {
        format!("*{}* ({}).{}", title, year, doi_str)
    } else {
        format!("{} ({year}). *{title}*.{doi}", author = author, year = year, title = title, doi = doi_str)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn sample_article() -> BibEntry {
        let mut fields = HashMap::new();
        fields.insert("author".to_string(),  "Smith, John A. and Jones, Mary B.".to_string());
        fields.insert("title".to_string(),   "Machine Learning in Academic Writing".to_string());
        fields.insert("journal".to_string(), "Journal of Educational Technology".to_string());
        fields.insert("year".to_string(),    "2024".to_string());
        fields.insert("volume".to_string(),  "15".to_string());
        fields.insert("number".to_string(),  "3".to_string());
        fields.insert("pages".to_string(),   "234--256".to_string());
        fields.insert("doi".to_string(),     "10.1000/xyz123".to_string());
        BibEntry { key: "smith2024".to_string(), entry_type: "article".to_string(), fields }
    }

    fn sample_book() -> BibEntry {
        let mut fields = HashMap::new();
        fields.insert("author".to_string(),    "García, Ana M.".to_string());
        fields.insert("title".to_string(),     "Metodología de la Investigación".to_string());
        fields.insert("publisher".to_string(), "Editorial Académica".to_string());
        fields.insert("year".to_string(),      "2021".to_string());
        BibEntry { key: "garcia2021".to_string(), entry_type: "book".to_string(), fields }
    }

    #[test]
    fn apa7_article_contains_key_elements() {
        let result = format_entry(&sample_article(), "apa");
        assert!(result.contains("Smith"), "debe contener apellido");
        assert!(result.contains("2024"), "debe contener año");
        assert!(result.contains("doi.org"), "debe contener DOI");
        assert!(result.contains("*"), "debe tener cursiva para revista");
    }

    #[test]
    fn ieee_article_has_bracket_number() {
        let result = format_entry(&sample_article(), "ieee");
        assert!(result.starts_with("[1]"), "IEEE empieza con número entre corchetes");
        assert!(result.contains("vol."), "debe contener vol.");
    }

    #[test]
    fn vancouver_article_starts_with_number() {
        let result = format_entry(&sample_article(), "vancouver");
        assert!(result.starts_with("1."), "Vancouver empieza con número");
    }

    #[test]
    fn chicago_notes_has_quoted_title() {
        let result = format_entry(&sample_article(), "verbose-note");
        assert!(result.contains('"'), "Chicago Notes usa comillas para título de artículo");
    }

    #[test]
    fn chicago_authordate_year_after_author() {
        let result = format_entry(&sample_article(), "chicago-authordate");
        assert!(result.contains("2024"), "debe contener año");
    }

    #[test]
    fn mla9_article_format() {
        let result = format_entry(&sample_article(), "mla");
        assert!(result.contains("Smith"), "debe contener apellido");
        assert!(result.contains("vol."), "MLA incluye vol.");
    }

    #[test]
    fn abnt_uppercase_author() {
        let result = format_entry(&sample_article(), "abnt");
        assert!(result.contains("SMITH"), "ABNT pone apellido en mayúsculas");
    }

    #[test]
    fn gb7714_type_tag() {
        let result = format_entry(&sample_article(), "gb7714-2015");
        assert!(result.contains("[J]"), "GB/T marca artículos con [J]");
    }

    #[test]
    fn apa7_book() {
        let result = format_entry(&sample_book(), "apa");
        assert!(result.contains("García"), "debe contener apellido con tilde");
        assert!(result.contains("2021"), "debe contener año");
    }

    #[test]
    fn initials_multi_word() {
        assert_eq!(initials("John Andrew"), "J. A.");
    }

    #[test]
    fn parse_comma_format() {
        let a = parse_author_name("Smith, John A.");
        assert_eq!(a.last, "Smith");
        assert_eq!(a.first, "John A.");
    }

    #[test]
    fn parse_natural_format() {
        let a = parse_author_name("John A. Smith");
        assert_eq!(a.last, "Smith");
        assert_eq!(a.first, "John A.");
    }
}
