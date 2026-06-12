---
title: Intermedio
description: Trabajar en la app, crear plugins, completar idiomas y añadir perfiles.
sidebar:
  order: 2
---

## App

El frontend vive en `texis-app/src`; los comandos Tauri, núcleo y generación viven en Rust. Antes de editar, localiza la prueba y el contrato que definen el comportamiento. Para frontend ejecuta:

```bash
cd texis-app
npm run check:i18n
npm test -- --run
npm run build
```

## Plugins

Un plugin registra metadata, usa un `engineId` y delega la salida a un serializer. Añade el engine o reutiliza uno compatible, registra el plugin y cubre al menos transformación estructurada y compilación.

```bash
cd TeXisStudio-Plugins
npm test
npm run build
```

## Idiomas

Cada pack usa `language.yaml`, `ui.json` y `latex.json`; puede añadir autocorrección y diccionarios. Declara sólo capacidades reales. El script incremental añade claves faltantes sin sobrescribir traducciones existentes.

## Perfiles

La estructura actual combina `_institution.yaml`, `profile.yaml` y `manifest.yaml`. Parte de una institución comparable y documenta la fuente normativa del formato.
