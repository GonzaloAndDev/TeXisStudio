---
title: Intermediate
description: Aligned equations, references, tables, figures, and bibliography.
sidebar:
  order: 2
---

## Numbered equations

```latex
\begin{equation}
  E = mc^2
  \label{eq:energy}
\end{equation}
```

Use `\ref{eq:energy}` or `\cref{eq:energy}` depending on the profile packages.

## Align equations

The `align` environment comes from `amsmath`. `&` marks the alignment point and `\\` ends a row.

```latex
\begin{align}
  y &= mx + b \\
  z &= ax^2 + c
\end{align}
```

Prefer TeXisStudio forms for regular figures and tables. When writing LaTeX directly, place `\caption` before `\label` so references capture the correct number.

Profiles define bibliography style and tooling. Biber and multi-pass documents usually need a complete suite through latexmk.
