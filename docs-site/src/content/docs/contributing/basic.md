---
title: Básico
description: Reportar problemas, mejorar documentación y corregir traducciones con cambios pequeños.
sidebar:
  order: 1
---

## Elegir el repositorio

- **TeXisStudio**: app, núcleo Rust, CLI y documentación.
- **TeXisStudio-Plugins**: motores, serializers y catálogo de figuras.
- **TeXisStudio-Languages**: interfaz, configuración LaTeX y herramientas lingüísticas.
- **TeXisStudio-Profiles**: formatos institucionales y estilos académicos.

## Una buena primera contribución

1. Busca un issue existente o abre uno con pasos reproducibles.
2. Limita el cambio a un problema concreto.
3. Actualiza pruebas o documentación cuando cambie el comportamiento.
4. Ejecuta las verificaciones indicadas por el repositorio.
5. Explica qué cambió y cómo lo comprobaste.

## Traducciones

`en.json` define el esquema de interfaz y `es.json` es la segunda referencia editorial. Conserva claves, variables `{{...}}`, HTML y comandos LaTeX. No sustituyas una traducción existente mediante generación masiva.

## Documentación

Edita el archivo equivalente en `es` y `en`. Una página sólo se considera lista cuando ambas versiones describen el mismo comportamiento verificable.
