//! Medidas tipográficas independientes del backend. El dominio razona en
//! `Length` con unidad explícita; el backend LaTeX las formatea.

use serde::{Deserialize, Serialize};
use std::fmt;

/// Unidad de longitud soportada por el modelo documental.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LengthUnit {
    Mm,
    Cm,
    In,
    Pt,
}

impl LengthUnit {
    pub fn suffix(self) -> &'static str {
        match self {
            LengthUnit::Mm => "mm",
            LengthUnit::Cm => "cm",
            LengthUnit::In => "in",
            LengthUnit::Pt => "pt",
        }
    }

    fn parse_suffix(s: &str) -> Option<LengthUnit> {
        match s {
            "mm" => Some(LengthUnit::Mm),
            "cm" => Some(LengthUnit::Cm),
            "in" => Some(LengthUnit::In),
            "pt" => Some(LengthUnit::Pt),
            _ => None,
        }
    }
}

/// Longitud tipográfica: valor + unidad. No interpreta cadenas LaTeX crudas.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Length {
    pub value: f32,
    pub unit: LengthUnit,
}

impl Length {
    pub const fn new(value: f32, unit: LengthUnit) -> Self {
        Self { value, unit }
    }

    pub const fn cm(value: f32) -> Self {
        Self::new(value, LengthUnit::Cm)
    }

    /// Parsea una medida tipo "38.1mm", "2.54cm", "1in", "12pt".
    /// Devuelve `None` si el formato no es reconocible (el llamador decide el
    /// diagnóstico — el dominio no entierra errores en silencio).
    pub fn parse(raw: &str) -> Option<Length> {
        let raw = raw.trim();
        let split_at = raw
            .char_indices()
            .find(|(_, c)| c.is_ascii_alphabetic())
            .map(|(i, _)| i)?;
        let (num, suffix) = raw.split_at(split_at);
        let value: f32 = num.trim().parse().ok()?;
        let unit = LengthUnit::parse_suffix(suffix.trim())?;
        Some(Length::new(value, unit))
    }
}

impl fmt::Display for Length {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{}", self.value, self.unit.suffix())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_units() {
        assert_eq!(Length::parse("38.1mm"), Some(Length::new(38.1, LengthUnit::Mm)));
        assert_eq!(Length::parse(" 2.54 cm "), Some(Length::new(2.54, LengthUnit::Cm)));
        assert_eq!(Length::parse("1in"), Some(Length::new(1.0, LengthUnit::In)));
        assert_eq!(Length::parse("12pt"), Some(Length::new(12.0, LengthUnit::Pt)));
    }

    #[test]
    fn rejects_garbage() {
        assert_eq!(Length::parse("wide"), None);
        assert_eq!(Length::parse("10"), None);
        assert_eq!(Length::parse("10km"), None);
    }
}
