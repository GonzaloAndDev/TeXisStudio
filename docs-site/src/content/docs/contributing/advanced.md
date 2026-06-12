---
title: Avanzado
description: Contratos, compatibilidad, seguridad, catálogos y releases coordinados.
sidebar:
  order: 3
---

## Cambios entre repositorios

Un cambio de contrato puede requerir una secuencia coordinada:

1. Añadir contrato y compatibilidad en Plugins o Profiles.
2. Consumirlo desde la app manteniendo fallback para versiones anteriores.
3. Actualizar catálogos, checksums y versión mínima sólo cuando el instalador los use.
4. Publicar documentación y pruebas de recorrido.

## Gates

- App: TypeScript, Vitest, build, i18n y pruebas Rust aplicables.
- Plugins: manifest, registry, serializers y compilación real.
- Languages: JSON/YAML, paridad, placeholders, capacidades y licencias de diccionarios.
- Profiles: esquema, fixtures institucionales, catálogo y empaquetado.

## Seguridad y compatibilidad

No habilites shell escape por defecto. Trata opciones LaTeX, URLs y archivos descargados como entrada no confiable. Las migraciones deben ser explícitas, deterministas y probadas con proyectos de versiones anteriores.

## Publicación

Mantén una matriz de compatibilidad entre app, plugins, idiomas y perfiles. Un release no está cerrado hasta que los catálogos remotos y la documentación describen la misma versión que consume la app.
