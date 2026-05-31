# TeXisStudio

> Escribe tu tesis con calidad de publicación — sin aprender LaTeX.

**Autor:** Gonzalo Andrade Estrella · [@GonzaloAndDev](https://github.com/GonzaloAndDev)  
**Licencia:** AGPL v3 + Commons Clause  
**Estado:** v1.0 — en desarrollo activo

---

## ¿Qué es?

TeXisStudio es una aplicación de escritorio que genera tesis y tesinas académicas de calidad tipográfica institucional usando LaTeX como motor de renderizado. El usuario trabaja con formularios, editores visuales y asistentes — nunca escribe LaTeX directamente.

```
El usuario describe su contenido
        ↓
TeXisStudio genera LaTeX correcto
        ↓
PDF portable y compilable sin la app
```

El objetivo central es eliminar la curva de aprendizaje de LaTeX para estudiantes que necesitan resultados de primer nivel pero no son expertos en tipografía ni programación.

---

## Ecosistema de repositorios

| Repo | Descripción |
|---|---|
| **TeXisStudio** ← *este repo* | App Tauri (Rust + React) |
| **[TeXisStudio-Plugins](../TeXisStudio-Plugins/README.md)** | 69 plugins de figuras académicas generadas automáticamente sin código LaTeX |
| **[TeXisStudio-Languages](../TeXisStudio-Languages/README.md)** | Paquetes de idioma descargables: ortografía, gramática, terminología |
| **TeXisStudio-Profiles** | Perfiles institucionales y de disciplina: márgenes, portadas, estilos |

---

## Funcionalidades

### Editor de tesis
- **Editor de bloques** — párrafos, títulos, listas, tablas, ecuaciones, código, algoritmos, teoremas
- **14 tipos de bloque** incluyendo elementos de posgrado (glosario, acrónimos, pseudocódigo)
- **Drag & drop** para reordenar contenido
- Guardado automático con detección de cambios pendientes
- Navegación por secciones agrupadas (frontmatter / cuerpo / backmatter / apéndices)

### Figuras generadas por plugins
Integración directa con **[TeXisStudio-Plugins](../TeXisStudio-Plugins/README.md)**:

- **69 plugins** organizados por disciplina y nivel de calidad (Core / Extended / Experimental)
- Galería de inserción con búsqueda en texto libre y filtros por categoría
- El usuario selecciona el tipo de figura → se genera LaTeX profesional automáticamente
- Modal de edición: cambiar título / etiqueta o regenerar desde datos originales
- Los paquetes LaTeX requeridos (tikz, pgfplots, chemfig, forest…) se inyectan automáticamente
- Figuras almacenadas como `source.json` + `output.tex` — re-editables en futuras sesiones

### Bibliografía
- Importación por **DOI** (CrossRef + DataCite)
- Búsqueda en **CrossRef, OpenAlex, Semantic Scholar**
- Integración con **Zotero** (librería local)
- Exportación a **BibTeX, CSL-JSON, RIS**
- Tipos de cita: parenthetical, narrative, footnote

### Compilación
- Motores soportados: **latexmk** y **Tectonic**
- Compilación rápida (capítulo activo) y completa (tesis entera)
- Panel de diagnósticos con errores y advertencias parseados
- Detección automática del toolchain instalado (MiKTeX / TeX Live)

### Ortografía y gramática
- Corrección ortográfica en tiempo real (ES / EN / FR / DE)
- Integración con **LanguageTool** para gramática
- Paquetes de vocabulario especializado descargables desde [TeXisStudio-Languages](../TeXisStudio-Languages/README.md)

### Otras funcionalidades
- **Perfiles institucionales** — Wizard de creación desde plantilla
- **Snapshots** — Puntos de restauración con etiqueta
- **Asistente de IA** integrado (multi-proveedor)
- **Export final** — PDF de entrega con postflight validation
- **System Doctor** — Diagnóstico del entorno LaTeX instalado

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Core | Rust 2021 · `texis-core` |
| Desktop | Tauri v2 · WebView2 |
| Frontend | React 18 · TypeScript 5 · Vite 5 · Zustand 5 |
| Plugins | TypeScript · [TeXisStudio-Plugins](../TeXisStudio-Plugins) |
| LaTeX | XeLaTeX / pdfLaTeX · latexmk · Tectonic · biber / biblatex |
| Serialización | serde_yaml |
| Red | reqwest 0.12 · rustls-tls |
| Preview math | KaTeX |
| Templates | MiniJinja v2 |

---

## Estructura del código

```
texis-core/                  Biblioteca Rust — toda la lógica de negocio
  src/
    project/                 ProjectModel, ContentBlock, PluginFigureBlock
    generator/               LaTeXGenerator (model → .tex files)
    compiler/                latexmk / tectonic runner
    bibliography/            CrossRef, DataCite, Zotero, exporters
    build_engine/            BuildEngine, toolchain detection
    template_engine/         MiniJinja templates
    validator/               Project structure validation
    asset/                   Image/PDF asset registry
    plugin/                  TexisPlugin trait + PluginRegistry
    postflight/              PDF postflight validation
    visual/                  Legacy native visual blocks (VennEuler, Flow…)

texis-app/                   Tauri app
  src-tauri/src/
    commands/                Tauri commands (project, compiler, figure_plugin,
                             bibliography_unified, build, system, ai, template…)
    lib.rs                   Handler registration + global state
  src/                       React frontend
    views/                   Editor, Compile, Library, Settings, Home…
    components/              FigurePickerModal, FigureEditModal, Chrome…
    services/                figure-plugin-service, grammar, spellcheck, AI
    stores/                  Zustand: project, settings, ai, vocabularyPacks
    types.ts                 TS types mirroring Rust structs
```

---

## Tipos de bloque

| Tipo | Descripción |
|---|---|
| `paragraph` | Texto con fórmulas inline y referencias |
| `heading` | Sección / subsección / subsubsección |
| `equation` | Ecuación LaTeX numerada o inline |
| `figure` | Imagen importada (PNG, JPG, SVG, PDF) |
| `plugin_figure` | **Figura generada automáticamente** por un plugin del catálogo |
| `table` | Tabla con estilos booktabs / wide / long |
| `list` | Itemize / enumerate / description |
| `citation` | Cita (parenthetical `\parencite`, narrative `\textcite`, footnote) |
| `raw_latex` | LaTeX manual (requiere confirmación explícita del usuario) |
| `code` | Código fuente con resaltado (`lstlisting`) |
| `algorithm` | Pseudocódigo (`algpseudocode`) |
| `theorem` | amsthm — teorema, lema, corolario, definición, prueba, observación |
| `glossary_entry` | Término + definición para el glosario |
| `acronym_entry` | Acrónimo + forma completa |

---

## Desarrollo

```bash
# Requisitos: Rust stable, Node.js 20+, MiKTeX o TeX Live
cargo install tauri-cli@^2

cd texis-app && npm install
cargo tauri dev          # modo desarrollo (hot-reload)
cargo tauri build        # build de producción
```

```bash
# Tests Rust (349+ tests de integración)
cargo test -p texis-core

# Incluye: generación LaTeX, compilación real, bibliografía,
# serialización YAML, PluginFigureBlock E2E, snapshots
```

---

## Cómo encajan los repos

```
TeXisStudio (este repo)
├── texis-core  ← genera el LaTeX
├── texis-app   ← UI Tauri + integración con plugins
│
└── importa en tiempo de ejecución ←────────────────────────────┐
                                                                 │
TeXisStudio-Plugins                                              │
├── 35 plugins official-core (matemáticas, física, química…)    │
├── 25 plugins official-extended                                 │
├── 10 plugins experimentales                                    │
└── 12 engines (TikZ, PGFPlots, CircuiTikZ, ChemFig, forest…)  │
    ↑ se carga via alias Vite @texisstudio/plugins ─────────────┘

TeXisStudio-Languages
└── dictionaries + grammar packs ← descargados bajo demanda

TeXisStudio-Profiles
└── plantillas institucionales ← descargadas al crear proyecto
```
