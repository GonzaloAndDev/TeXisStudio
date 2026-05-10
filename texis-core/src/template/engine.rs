use super::escape::latex_escape;
use crate::error::{CoreError, CoreResult};
use minijinja::{Environment, Value};
use std::collections::HashMap;

pub struct TemplateEngine {
    env: Environment<'static>,
}

impl TemplateEngine {
    pub fn new() -> CoreResult<Self> {
        let mut env = Environment::new();

        // Registrar latex_escape como filtro MiniJinja.
        // IMPORTANTE: extraer el string con as_str() para evitar que
        // Value::to_string() agregue comillas en representaciones debug.
        env.add_filter("latex_escape", |value: Value| -> Value {
            let s = value.as_str().unwrap_or("").to_string();
            Value::from(latex_escape(&s))
        });

        // Filtro identity para contenido LaTeX intencional (ecuaciones, raw).
        env.add_filter("raw", |value: Value| -> Value { value });

        Ok(Self { env })
    }

    pub fn render(
        &self,
        template_str: &str,
        context: &HashMap<String, Value>,
    ) -> CoreResult<String> {
        let template = self
            .env
            .template_from_str(template_str)
            .map_err(|e| CoreError::Template {
                template: template_str.chars().take(60).collect(),
                message: e.to_string(),
            })?;

        template.render(context).map_err(|e| CoreError::Template {
            template: template_str.chars().take(60).collect(),
            message: e.to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Prueba crítica: el filtro latex_escape en MiniJinja no debe
    /// introducir comillas ni representación inesperada en los strings.
    #[test]
    fn filtro_minijinja_no_introduce_comillas() {
        let engine = TemplateEngine::new().unwrap();
        let mut ctx = HashMap::new();
        ctx.insert("title".to_string(), Value::from("Análisis A&B"));

        let result = engine
            .render("{{ title | latex_escape }}", &ctx)
            .unwrap();

        assert_eq!(result, r"Análisis A\&B");
        assert!(!result.starts_with('"'));
        assert!(!result.ends_with('"'));
    }

    #[test]
    fn filtro_minijinja_escapa_guion_bajo() {
        let engine = TemplateEngine::new().unwrap();
        let mut ctx = HashMap::new();
        ctx.insert("name".to_string(), Value::from("var_nombre"));

        let result = engine
            .render("{{ name | latex_escape }}", &ctx)
            .unwrap();

        assert_eq!(result, r"var\_nombre");
    }

    #[test]
    fn raw_no_escapa() {
        let engine = TemplateEngine::new().unwrap();
        let mut ctx = HashMap::new();
        ctx.insert("cmd".to_string(), Value::from(r"\textbf{hola}"));

        let result = engine.render("{{ cmd | raw }}", &ctx).unwrap();

        assert_eq!(result, r"\textbf{hola}");
    }
}
