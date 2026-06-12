---
title: Basic
description: Math mode, groups, exponents, fractions, and special characters.
sidebar:
  order: 1
---

## Math mode

Inside a paragraph use `$x^2$` or `\(x^2\)`. For centered display math use `\[x^2\]`. In a TeXisStudio **Equation** block, enter only the mathematical content; the block supplies the surrounding environment.

Do not use `$$...$$`: it is legacy TeX syntax and can produce inconsistent spacing in LaTeX documents.

## Group with braces

```latex
\frac{a}{b}
x^{n+1}
x_{i,j}
\sqrt{x+1}
```

## Common symbols

```latex
\alpha \beta \gamma
\leq \geq \neq \approx
\infty \pm \times
```

Write reserved characters literally as `\%`, `\$`, `\&`, `\_`, `\{`, and `\}`.
