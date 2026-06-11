# LaTeX mínimo para TeXisStudio

Solo necesitas saber esto para escribir ecuaciones en TeXisStudio. Si no escribes ecuaciones, puedes ignorar esta guía.

---

## Modo matemático

LaTeX diferencia entre texto normal y modo matemático. Usa `$…$` para fórmulas en línea y `$$…$$` (o el bloque de ecuación de TeXisStudio) para fórmulas centradas.

En el bloque **Ecuación** de TeXisStudio, escribes directamente en modo matemático — no necesitas los `$`.

---

## Llaves `{}`

Las llaves agrupan los argumentos de un comando. Sin llaves, solo el primer carácter siguiente es el argumento.

| LaTeX | Resultado | Nota |
|---|---|---|
| `\frac{a}{b}` | a ÷ b | Fracción numerador/denominador |
| `\sqrt{x+1}` | √(x+1) | Raíz cuadrada |
| `e^{2x}` | e²ˣ | Exponente de más de un carácter: necesita `{}` |
| `x_{n+1}` | xₙ₊₁ | Subíndice de más de un carácter: necesita `{}` |

---

## Superíndices y subíndices

| LaTeX | Resultado |
|---|---|
| `x^2` | x² |
| `x_i` | xᵢ |
| `x^{n-1}` | xⁿ⁻¹ (las llaves son obligatorias si hay más de un carácter) |
| `x_{ij}` | x con subíndice ij |

---

## Fracciones

| LaTeX | Resultado |
|---|---|
| `\frac{1}{2}` | ½ |
| `\frac{dy}{dx}` | dy/dx |
| `\frac{\partial f}{\partial x}` | ∂f/∂x |

---

## Letras griegas y símbolos comunes

| LaTeX | Resultado |
|---|---|
| `\alpha, \beta, \gamma` | α, β, γ |
| `\pi, \theta, \lambda` | π, θ, λ |
| `\infty` | ∞ |
| `\pm, \times, \div` | ±, ×, ÷ |
| `\leq, \geq, \neq` | ≤, ≥, ≠ |
| `\approx, \equiv` | ≈, ≡ |

---

## Expresiones para gráficas (PGFPlots)

En el editor de PGFPlots, las expresiones de función usan la sintaxis de `gnuplot`/`pgfplots`, no LaTeX:

| Expresión | Resultado |
|---|---|
| `sin(x)` | seno de x |
| `x^2 - 3*x + 2` | parábola (usa `*` para multiplicación) |
| `exp(-x^2)` | gaussiana |
| `ln(x)` | logaritmo natural |
| `sqrt(x)` | raíz cuadrada |

---

## Caracteres especiales

Algunos caracteres tienen significado especial en LaTeX. Para escribirlos literalmente:

| LaTeX | Carácter | Nota |
|---|---|---|
| `\%` | % | El símbolo `%` inicia un comentario en LaTeX |
| `\$` | $ | El símbolo `$` inicia el modo matemático |
| `\&` | & | El símbolo `&` separa columnas en tablas |
| `\_` | _ | El guion bajo indica subíndice en modo math |
| `\{  \}` | `{ }` | Las llaves delimitan argumentos de comandos |

---

## Errores comunes

| Mensaje de error | Causa probable | Solución |
|---|---|---|
| `! Missing $ inserted` | Símbolo matemático fuera de modo math | Envuelve la expresión en `$…$` |
| `! Undefined control sequence` | Comando mal escrito | Revisa la ortografía: `\alpha` no `\Alpha` |
| `! Missing } inserted` | Llave de cierre faltante | Asegúrate de que cada `{` tiene su `}` |
| `! Extra }, or forgotten $` | Llave de más | Busca un `}` sin su `{` correspondiente |

---

## Temas relacionados

- [Primeros pasos](getting-started.md)
- [Figuras y editores visuales](figures.md)
- [Errores frecuentes](errors.md)
