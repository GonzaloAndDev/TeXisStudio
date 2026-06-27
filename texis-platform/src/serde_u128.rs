//! Serialización de `u128` como **string** JSON.
//!
//! Los nanosegundos desde epoch (`unix_nanos`, `seq`, `created_unix_nanos`) son
//! del orden de `1.7e18`, muy por encima del entero seguro de JavaScript
//! (`Number.MAX_SAFE_INTEGER == 2^53-1 ≈ 9.0e15`). Si se serializan como número
//! JSON, el frontend (TS) los recibe con **pérdida de precisión**. Emitirlos como
//! string los preserva exactos.
//!
//! Al deserializar aceptamos tanto string como número, de modo que los journals
//! ya escritos con el formato numérico antiguo siguen leyéndose sin romperse.

use serde::de::{self, Deserializer, Visitor};
use serde::Serializer;
use std::fmt;

pub fn serialize<S>(value: &u128, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

pub fn deserialize<'de, D>(deserializer: D) -> Result<u128, D::Error>
where
    D: Deserializer<'de>,
{
    struct U128Visitor;

    impl Visitor<'_> for U128Visitor {
        type Value = u128;

        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("un u128 como string o número")
        }

        fn visit_str<E: de::Error>(self, v: &str) -> Result<u128, E> {
            v.parse::<u128>().map_err(de::Error::custom)
        }

        fn visit_u64<E: de::Error>(self, v: u64) -> Result<u128, E> {
            Ok(v as u128)
        }

        fn visit_u128<E: de::Error>(self, v: u128) -> Result<u128, E> {
            Ok(v)
        }

        fn visit_i64<E: de::Error>(self, v: i64) -> Result<u128, E> {
            u128::try_from(v).map_err(de::Error::custom)
        }
    }

    deserializer.deserialize_any(U128Visitor)
}

#[cfg(test)]
mod tests {
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize, PartialEq, Debug)]
    struct Wrap {
        #[serde(with = "super")]
        n: u128,
    }

    #[test]
    fn serializes_as_string() {
        let json = serde_json::to_string(&Wrap { n: 1_750_000_000_000_000_123 }).unwrap();
        assert_eq!(json, r#"{"n":"1750000000000000123"}"#);
    }

    #[test]
    fn roundtrips_through_string() {
        let original = Wrap { n: u128::MAX };
        let json = serde_json::to_string(&original).unwrap();
        let back: Wrap = serde_json::from_str(&json).unwrap();
        assert_eq!(original, back);
    }

    #[test]
    fn reads_legacy_numeric_format() {
        // Journals antiguos escribieron el valor como número JSON.
        let back: Wrap = serde_json::from_str(r#"{"n":123456789}"#).unwrap();
        assert_eq!(back.n, 123_456_789);
    }
}
