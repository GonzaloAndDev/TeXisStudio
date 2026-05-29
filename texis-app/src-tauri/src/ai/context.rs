use serde::{Deserialize, Serialize};

/// Alcance del contexto que el usuario decide compartir con la IA.
/// El usuario siempre elige explícitamente — nunca se envía contexto automáticamente.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiContextScope {
    /// Sin contexto del documento. Solo la pregunta del usuario.
    None,
    /// Solo el texto seleccionado por el usuario en el editor.
    CurrentSelection,
    /// El archivo .tex activo completo.
    CurrentFile,
    /// Los diagnósticos actuales (errores/warnings).
    Diagnostics,
    /// El log del último build.
    BuildLog,
}

impl AiContextScope {
    pub fn display_name(&self) -> &'static str {
        match self {
            AiContextScope::None => "Sin contexto",
            AiContextScope::CurrentSelection => "Selección actual",
            AiContextScope::CurrentFile => "Archivo actual",
            AiContextScope::Diagnostics => "Diagnósticos",
            AiContextScope::BuildLog => "Log de compilación",
        }
    }
}

/// Paquete de contexto que se incluye en la petición a la IA.
/// Se construye de forma explícita — no hay inferencia automática.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AiContextPackage {
    pub scope: Option<AiContextScope>,
    /// Texto seleccionado (si scope == CurrentSelection).
    pub selection: Option<String>,
    /// Contenido del archivo activo (si scope == CurrentFile).
    pub current_file_content: Option<String>,
    /// Nombre del archivo activo.
    pub current_file_name: Option<String>,
    /// Diagnósticos en formato texto (si scope == Diagnostics).
    pub diagnostics_summary: Option<String>,
    /// Log del build (si scope == BuildLog).
    pub build_log: Option<String>,
}

impl AiContextPackage {
    pub fn none() -> Self {
        Self { scope: Some(AiContextScope::None), ..Default::default() }
    }

    pub fn with_selection(selection: String) -> Self {
        Self {
            scope: Some(AiContextScope::CurrentSelection),
            selection: Some(selection),
            ..Default::default()
        }
    }

    pub fn with_file(file_name: String, content: String) -> Self {
        Self {
            scope: Some(AiContextScope::CurrentFile),
            current_file_name: Some(file_name),
            current_file_content: Some(content),
            ..Default::default()
        }
    }

    pub fn with_diagnostics(summary: String) -> Self {
        Self {
            scope: Some(AiContextScope::Diagnostics),
            diagnostics_summary: Some(summary),
            ..Default::default()
        }
    }

    pub fn with_build_log(log: String) -> Self {
        Self {
            scope: Some(AiContextScope::BuildLog),
            build_log: Some(log),
            ..Default::default()
        }
    }

    /// Construye el bloque de contexto para inyectar en el prompt del sistema.
    /// Limita el tamaño para no exceder el contexto del modelo.
    pub fn to_prompt_block(&self) -> String {
        const MAX_CHARS: usize = 8_000;

        let mut parts: Vec<String> = Vec::new();

        if let Some(sel) = &self.selection {
            let truncated = truncate(sel, MAX_CHARS);
            parts.push(format!("## Selección actual del usuario\n```\n{}\n```", truncated));
        }
        if let Some(content) = &self.current_file_content {
            let name = self.current_file_name.as_deref().unwrap_or("archivo.tex");
            let truncated = truncate(content, MAX_CHARS);
            parts.push(format!("## Archivo activo: {}\n```latex\n{}\n```", name, truncated));
        }
        if let Some(diag) = &self.diagnostics_summary {
            let truncated = truncate(diag, 2_000);
            parts.push(format!("## Diagnósticos actuales\n```\n{}\n```", truncated));
        }
        if let Some(log) = &self.build_log {
            let truncated = truncate(log, 3_000);
            parts.push(format!("## Log de compilación\n```\n{}\n```", truncated));
        }

        if parts.is_empty() {
            String::new()
        } else {
            format!("\n\n---\n{}", parts.join("\n\n"))
        }
    }

    /// Verifica que el paquete no contiene datos de credenciales.
    pub fn contains_credentials(&self) -> bool {
        let all_text = [
            self.selection.as_deref(),
            self.current_file_content.as_deref(),
            self.diagnostics_summary.as_deref(),
            self.build_log.as_deref(),
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join(" ");

        text_contains_credentials(&all_text)
    }
}

pub fn text_contains_credentials(text: &str) -> bool {
    // Heurística conservadora: patrones típicos de API keys o tokens.
    text.contains("sk-") || text.contains("Bearer ") || text.contains("api_key")
}

fn truncate(s: &str, max: usize) -> &str {
    if s.len() <= max {
        s
    } else {
        &s[..max]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn none_context_produces_empty_block() {
        let ctx = AiContextPackage::none();
        assert!(ctx.to_prompt_block().is_empty());
    }

    #[test]
    fn selection_context_includes_selection() {
        let ctx = AiContextPackage::with_selection("mi texto seleccionado".to_string());
        let block = ctx.to_prompt_block();
        assert!(block.contains("mi texto seleccionado"));
        assert!(block.contains("Selección actual"));
    }

    #[test]
    fn file_context_includes_name_and_content() {
        let ctx = AiContextPackage::with_file("main.tex".to_string(), "\\begin{document}".to_string());
        let block = ctx.to_prompt_block();
        assert!(block.contains("main.tex"));
        assert!(block.contains("\\begin{document}"));
    }

    #[test]
    fn does_not_flag_normal_text_as_credentials() {
        let ctx = AiContextPackage::with_selection("texto académico normal".to_string());
        assert!(!ctx.contains_credentials());
    }

    #[test]
    fn flags_api_key_pattern() {
        let ctx = AiContextPackage::with_selection("key: sk-abc123".to_string());
        assert!(ctx.contains_credentials());
    }

    #[test]
    fn text_helper_flags_bearer_tokens() {
        assert!(text_contains_credentials("Authorization: Bearer super-secret-token"));
    }
}
