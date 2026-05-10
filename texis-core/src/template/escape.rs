// POLÍTICA DE ESCAPING LATEX
// ===========================
// Todo contenido del usuario DEBE pasar por latex_escape.
// Las excepciones (ecuaciones, raw_latex, plantillas) usan | raw.
// NUNCA concatenar valores de usuario en strings LaTeX directamente.

pub fn latex_escape(input: &str) -> String {
    let mut output = String::with_capacity(input.len() * 2);
    for ch in input.chars() {
        match ch {
            '&'  => output.push_str(r"\&"),
            '%'  => output.push_str(r"\%"),
            '$'  => output.push_str(r"\$"),
            '#'  => output.push_str(r"\#"),
            '_'  => output.push_str(r"\_"),
            '{'  => output.push_str(r"\{"),
            '}'  => output.push_str(r"\}"),
            '~'  => output.push_str(r"\textasciitilde{}"),
            '^'  => output.push_str(r"\textasciicircum{}"),
            '\\' => output.push_str(r"\textbackslash{}"),
            c    => output.push(c),
        }
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapa_ampersand() {
        assert_eq!(latex_escape("A & B"), r"A \& B");
    }

    #[test]
    fn escapa_guion_bajo() {
        assert_eq!(latex_escape("var_x"), r"var\_x");
    }

    #[test]
    fn escapa_porcentaje() {
        assert_eq!(latex_escape("100%"), r"100\%");
    }

    #[test]
    fn escapa_dolar() {
        assert_eq!(latex_escape("$10"), r"\$10");
    }

    #[test]
    fn escapa_hash() {
        assert_eq!(latex_escape("#1"), r"\#1");
    }

    #[test]
    fn escapa_llaves() {
        assert_eq!(latex_escape("{x}"), r"\{x\}");
    }

    #[test]
    fn escapa_backslash() {
        assert_eq!(latex_escape(r"a\b"), r"a\textbackslash{}b");
    }

    #[test]
    fn escapa_tilde() {
        assert_eq!(latex_escape("~x"), r"\textasciitilde{}x");
    }

    #[test]
    fn escapa_circunflejo() {
        assert_eq!(latex_escape("x^2"), r"x\textasciicircum{}2");
    }

    #[test]
    fn no_modifica_texto_simple() {
        assert_eq!(latex_escape("Hola mundo"), "Hola mundo");
    }

    #[test]
    fn cadena_vacia() {
        assert_eq!(latex_escape(""), "");
    }

    #[test]
    fn solo_especiales() {
        assert_eq!(latex_escape("&%$#_{}"), r"\&\%\$\#\_\{\}");
    }

    #[test]
    fn titulo_con_multiples_signos() {
        assert_eq!(
            latex_escape("Análisis del 100% en A&B con var_x"),
            r"Análisis del 100\% en A\&B con var\_x"
        );
    }
}
