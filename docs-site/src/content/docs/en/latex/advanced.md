---
title: Advanced
description: Preamble, packages, macros, TikZ, pgfplots, and engine compatibility.
sidebar:
  order: 3
---

## Preamble ownership

The profile controls class, packages, typography, language, and bibliography. Add manual configuration only when the profile or a plugin cannot express the requirement.

```latex
\newcommand{\vect}[1]{\boldsymbol{#1}}
```

Use specific macro names and document their arguments. For complex behavior, extend a plugin instead of hiding logic in the document.

## TikZ and pgfplots

TikZ describes nodes, shapes, and connections; pgfplots adds axes and series. TeXisStudio stores a structured document and its serializer generates LaTeX. Technical fields are an escape hatch, not the primary interface.

## Compatibility

- `fontspec` requires XeLaTeX or LuaLaTeX in a compatible suite.
- `biblatex` commonly works with Biber.
- `amsmath`, `xcolor`, `tikz`, `pgfplots`, `circuitikz`, and `mhchem` are technical identifiers and must not be translated.
