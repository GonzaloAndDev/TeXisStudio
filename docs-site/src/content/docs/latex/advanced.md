---
title: Avanzado
description: Preámbulo, paquetes, macros, TikZ, pgfplots y compatibilidad de motores.
sidebar:
  order: 3
---

## Responsabilidad del preámbulo

El perfil controla clase, paquetes, tipografía, idioma y bibliografía. Añade configuración manual sólo cuando el perfil o un plugin no cubran el requisito. Una definición duplicada puede cambiar el formato institucional o romper la compilación.

## Macros pequeñas

```latex
\newcommand{\vect}[1]{\boldsymbol{#1}}
```

Usa nombres específicos y documenta los argumentos. Para lógica compleja, crea o extiende un plugin en lugar de ocultarla dentro del documento.

## TikZ y pgfplots

TikZ describe nodos, formas y conexiones; pgfplots añade ejes y series. TeXisStudio guarda un documento estructurado y el serializer genera LaTeX. El panel técnico es una salida de escape, no la interfaz principal.

## Compatibilidad

- `fontspec` requiere XeLaTeX o LuaLaTeX dentro de una suite compatible.
- `biblatex` suele trabajar con Biber.
- `amsmath`, `xcolor`, `tikz`, `pgfplots`, `circuitikz` y `mhchem` son nombres técnicos y no deben traducirse.

Antes de depender de un paquete especializado, prueba el proyecto con el backend que usarás para entregar.
