//! Diagnósticos estructurados del dominio (§10).
//!
//! El dominio emite **códigos y parámetros**, nunca texto traducido. La
//! experiencia localiza los mensajes a partir de `message_key` + `params`.
//! Un diagnóstico se rastrea hasta módulo, etapa, ubicación, evidencia y acción.

use crate::ids::ModuleId;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Severidad del diagnóstico.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Error,
    Warning,
    Info,
    Hint,
}

/// Etapa del pipeline donde se origina el diagnóstico (§10).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticStage {
    Import,
    Resolution,
    Editing,
    Validation,
    Planning,
    Render,
    Compilation,
    Postflight,
    Delivery,
}

/// Código estable de diagnóstico. Formato recomendado: `MODULE-NNN`
/// (p. ej. `COVER-001`). Estable entre versiones (Regla del agente §18.9).
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(transparent)]
pub struct DiagnosticCode(String);

impl DiagnosticCode {
    pub fn new(code: impl Into<String>) -> Self {
        Self(code.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Ubicación dentro del documento (independiente de archivos LaTeX).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DocumentLocation {
    pub module: ModuleId,
    /// Ruta lógica: "body.chapter[2].figure[0]", "cover.signatures".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    /// Id del nodo afectado, si aplica.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
}

impl DocumentLocation {
    pub fn module(module: ModuleId) -> Self {
        Self {
            module,
            path: None,
            node_id: None,
        }
    }

    pub fn with_path(mut self, path: impl Into<String>) -> Self {
        self.path = Some(path.into());
        self
    }
}

/// Evidencia de respaldo (clave de perfil, fragmento de log, regla institucional).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Evidence {
    /// Tipo de evidencia: "profile_rule", "latex_log", "document_pack", etc.
    pub kind: String,
    /// Referencia o extracto. No se traduce.
    pub detail: String,
}

/// Acción correctiva sugerida. La descripción se localiza vía `message_key`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Remediation {
    pub message_key: String,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub params: BTreeMap<String, String>,
}

impl Remediation {
    pub fn new(message_key: impl Into<String>) -> Self {
        Self {
            message_key: message_key.into(),
            params: BTreeMap::new(),
        }
    }
}

/// Diagnóstico estructurado (§10).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Diagnostic {
    pub code: DiagnosticCode,
    pub module: ModuleId,
    pub severity: Severity,
    pub stage: DiagnosticStage,
    /// Clave de mensaje para la capa de experiencia (no texto traducido).
    pub message_key: String,
    /// Parámetros para interpolar en el mensaje localizado.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub params: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<DocumentLocation>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub evidence: Vec<Evidence>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub remediation: Vec<Remediation>,
    /// Si bloquea el avance del pipeline / release (§13.2).
    pub blocking: bool,
}

impl Diagnostic {
    pub fn new(
        code: impl Into<String>,
        module: ModuleId,
        severity: Severity,
        stage: DiagnosticStage,
        message_key: impl Into<String>,
    ) -> Self {
        let blocking = severity == Severity::Error;
        Self {
            code: DiagnosticCode::new(code),
            module,
            severity,
            stage,
            message_key: message_key.into(),
            params: BTreeMap::new(),
            location: None,
            evidence: Vec::new(),
            remediation: Vec::new(),
            blocking,
        }
    }

    pub fn error(
        code: impl Into<String>,
        module: ModuleId,
        stage: DiagnosticStage,
        message_key: impl Into<String>,
    ) -> Self {
        Self::new(code, module, Severity::Error, stage, message_key)
    }

    pub fn warning(
        code: impl Into<String>,
        module: ModuleId,
        stage: DiagnosticStage,
        message_key: impl Into<String>,
    ) -> Self {
        Self::new(code, module, Severity::Warning, stage, message_key)
    }

    pub fn with_param(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.params.insert(key.into(), value.into());
        self
    }

    pub fn with_location(mut self, location: DocumentLocation) -> Self {
        self.location = Some(location);
        self
    }

    pub fn with_evidence(mut self, evidence: Evidence) -> Self {
        self.evidence.push(evidence);
        self
    }

    pub fn with_remediation(mut self, remediation: Remediation) -> Self {
        self.remediation.push(remediation);
        self
    }

    pub fn blocking(mut self, blocking: bool) -> Self {
        self.blocking = blocking;
        self
    }
}

/// Colección de diagnósticos con utilidades de agregación.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Diagnostics {
    pub items: Vec<Diagnostic>,
}

impl Diagnostics {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, d: Diagnostic) {
        self.items.push(d);
    }

    pub fn extend(&mut self, other: impl IntoIterator<Item = Diagnostic>) {
        self.items.extend(other);
    }

    pub fn is_empty(&self) -> bool {
        self.items.is_empty()
    }

    pub fn len(&self) -> usize {
        self.items.len()
    }

    /// `true` si hay algún diagnóstico bloqueante.
    pub fn has_blocking(&self) -> bool {
        self.items.iter().any(|d| d.blocking)
    }

    pub fn errors(&self) -> impl Iterator<Item = &Diagnostic> {
        self.items.iter().filter(|d| d.severity == Severity::Error)
    }

    pub fn iter(&self) -> impl Iterator<Item = &Diagnostic> {
        self.items.iter()
    }
}

impl IntoIterator for Diagnostics {
    type Item = Diagnostic;
    type IntoIter = std::vec::IntoIter<Diagnostic>;
    fn into_iter(self) -> Self::IntoIter {
        self.items.into_iter()
    }
}
