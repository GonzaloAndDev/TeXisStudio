---
title: Básico
description: Modo matemático, grupos, exponentes, fracciones y caracteres especiales.
sidebar:
  order: 1
---

## Modo matemático

Dentro de un párrafo usa `$x^2$` o `\(x^2\)`. Para una fórmula centrada usa `\[x^2\]`. En un bloque **Ecuación** de TeXisStudio escribe sólo el contenido matemático: el bloque añade el entorno necesario.

No uses `$$...$$`: es sintaxis heredada de TeX y puede producir espaciado inconsistente en documentos LaTeX.

## Agrupar con llaves

```latex
\frac{a}{b}
x^{n+1}
x_{i,j}
\sqrt{x+1}
```

Las llaves agrupan argumentos. Sin ellas, `x^n+1` eleva únicamente `n`.

## Símbolos frecuentes

```latex
\alpha \beta \gamma
\leq \geq \neq \approx
\infty \pm \times
```

## Caracteres reservados

Para escribir estos símbolos literalmente usa `\%`, `\$`, `\&`, `\_`, `\{` y `\}`.

:::tip
Los editores visuales de figuras y matrices evitan gran parte de esta sintaxis. Aprende LaTeX sólo cuando necesites editar campos técnicos o ecuaciones libres.
:::
