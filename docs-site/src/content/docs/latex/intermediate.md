---
title: Intermedio
description: Ecuaciones alineadas, referencias, tablas, figuras y bibliografía.
sidebar:
  order: 2
---

## Ecuaciones numeradas

```latex
\begin{equation}
  E = mc^2
  \label{eq:energia}
\end{equation}
```

Usa `\ref{eq:energia}` o `\cref{eq:energia}` según los paquetes del perfil.

## Alinear ecuaciones

El entorno `align` pertenece a `amsmath`. `&` marca el punto de alineación y `\\` termina una línea.

```latex
\begin{align}
  y &= mx + b \\
  z &= ax^2 + c
\end{align}
```

## Figuras y tablas

Prefiere los formularios de TeXisStudio para el contenido normal. Al editar LaTeX directamente, mantén `\caption` antes de `\label` para que la referencia capture el número correcto.

## Bibliografía

Los perfiles definen el estilo y las herramientas bibliográficas. Biber y documentos con varias pasadas suelen requerir una suite completa mediante latexmk.
