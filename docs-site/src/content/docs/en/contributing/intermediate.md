---
title: Intermediate
description: Work on the app, create plugins, complete languages, and add profiles.
sidebar:
  order: 2
---

## App

The frontend lives in `texis-app/src`; Tauri commands, core logic, and generation live in Rust.

```bash
cd texis-app
npm run check:i18n
npm test -- --run
npm run build
```

## Plugins

A plugin registers metadata, uses an `engineId`, and delegates output to a serializer. Register the plugin and cover both structured transformation and compilation.

## Languages

Each pack uses `language.yaml`, `ui.json`, and `latex.json`, with optional autocorrect and dictionaries. Declare only real capabilities and never overwrite reviewed translations during synchronization.

## Profiles

The current structure combines `_institution.yaml`, `profile.yaml`, and `manifest.yaml`. Start from a comparable institution and cite the official formatting source.
