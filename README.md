# TeXisStudio

Write your thesis at publication quality without learning LaTeX.

Author: Gonzalo Andrade Estrella, [@GonzaloAndDev](https://github.com/GonzaloAndDev)
License: AGPL v3 + Commons Clause
Version: 1.2.0

---

## English

### Build & Run

Run all commands from the repository root, `TeXisStudio`.

First time on a machine, or after missing dependency errors:

| System | Run app | Build installer | Check frontend |
|---|---|---|---|
| Linux/macOS | `./run` | `./build` | `./check` |
| Windows | `.\run.ps1` | `.\build.ps1` | `.\check.ps1` |

After the machine is prepared:

| Need | Command | Result |
|---|---|---|
| Run the app | `./run` or `.\run.ps1` | Opens TeXisStudio in Tauri dev mode with hot reload. Does not create an installer. |
| Build installer/package | `./build` or `.\build.ps1` | Builds artifacts for the current OS. |
| Check frontend only | `./check` or `.\check.ps1` | Runs TypeScript check and Vite build without compiling the native app. |
| Test Rust core | `cargo test -p texis-core` | 305+ unit and integration tests for LaTeX generation, compilation, bibliography, snapshots, profiles, and migrations. |
| Test frontend | `npm test` (in `texis-app/`) | 355 tests for stores, services, i18n coverage, UI helpers, document history, visual-editor transforms, metadata round-trips, and serializer round-trips. |

Command aliases:
- Run app: `dev`, `start`, `app`
- Build installer: `build`, `compiler`, `package`, `dist`
- Check frontend: `check`, `frontend`

VS Code: open `TeXisStudio.code-workspace`. `Ctrl+Shift+B` runs **TeXisStudio: Run app**. To build an installer, use `Terminal > Run Task... > TeXisStudio: Build current OS`.

Local build outputs:

| System | Script | Output |
|---|---|---|
| Windows | `scripts/build-windows.ps1` | MSI, NSIS `.exe`, and portable ZIP in `target/release/bundle/` |
| macOS | `scripts/build-mac.sh` | Universal DMG/app in `target/universal-apple-darwin/release/bundle/` |
| Linux | `scripts/build-linux.sh` | `.deb`, `.rpm`, and AppImage in `target/release/bundle/` |

Bootstrap scripts are idempotent: Node, Rust, native packages, and npm dependencies are installed only when missing or stale.

To build all platform installers, push a version tag — GitHub Actions handles the rest:

```bash
git tag v1.1.0
git push origin v1.1.0
```

Pushing a `v*` tag runs `.github/workflows/release.yml` on Windows, Linux, and macOS runners and publishes a GitHub Release with all artifacts. To test the pipeline without publishing, trigger **Build & Release** manually from the Actions tab.

> **Note on signing:** Installer signing and notarization are not yet configured. See `CHANGELOG.md [1.1.0]` for the requirements per platform.

### User documentation

Canonical user-facing docs live in [`docs/user-guide/`](docs/user-guide/). These are the source of truth for the built-in Help Center and any future web documentation.

| File | Help Center section |
|---|---|
| [getting-started.md](docs/user-guide/getting-started.md) | Getting started |
| [figures.md](docs/user-guide/figures.md) | Figures & visual editors |
| [minimal-latex.md](docs/user-guide/minimal-latex.md) | Minimal LaTeX |
| [errors.md](docs/user-guide/errors.md) | Common errors |

---

### What TeXisStudio Is

TeXisStudio is a desktop application for writing academic theses, dissertations, and research reports with institutional typographic quality. LaTeX is the rendering engine; users work through a structured block editor, assistants, and forms — no LaTeX knowledge required.

```
User describes content
       ↓
TeXisStudio generates correct LaTeX
       ↓
Portable PDF — compilable independently, without the app
```

---

### Repository Ecosystem

| Repository | Purpose |
|---|---|
| **TeXisStudio** | This repo. Tauri desktop app, Rust core, React frontend, packaging scripts. |
| **[TeXisStudio-Plugins](../TeXisStudio-Plugins/README.md)** | Figure plugins: publication-quality LaTeX for diagrams, circuits, molecules, and more without writing figure code. |
| **[TeXisStudio-Languages](../TeXisStudio-Languages/README.md)** | Downloadable spell-check, grammar, and discipline vocabulary packs. |
| **[TeXisStudio-Profiles](../TeXisStudio-Profiles/README.md)** | 42+ institutional and discipline profiles, section templates, and sample projects. |

---

### Features

#### Document types and academic levels

Supports: thesis (`tesis`), short thesis (`tesina`), and postgraduate research documents (`especialidad`, `maestría`, `doctorado`, `posdoctorado`). Academic level is auto-suggested from document type and can be overridden.

#### Block editor

15 content block types: paragraph, heading, list, figure, table, equation, code, algorithm, theorem, citation, raw LaTeX, glossary entry, acronym entry, visual figure, and plugin figure.

Drag-and-drop reordering. Inline math preview via KaTeX. Section status tracking (`draft → in_review → revised → approved`). Autosave with debounce.

#### Plugin visual editors

7 GUI editors for plugin-backed figures — no LaTeX required:

| Editor | Plugin types covered |
|---|---|
| `GraphNodeEditor` | Graph nodes, edges, shapes, arc styles |
| `PGFPlotsEditor` | function2d, scatter, bar, histogram, boxplot, errorbar, heatmap |
| `MatrixEditor` | Matrices with bracket selector and cell-by-cell editing |
| `GanttEditor` | Groups, tasks, dependencies; ISO / year / numeric positions |
| `TableDataEditor` | Dynamic rows and columns with collision-safe IDs |
| `TreeForestEditor` | Hierarchical trees with growth-direction control |
| `ChemistryEditor` | Chemical formulas (charge/state) and reactions (arrow, conditions) |

Every visual editor includes **undo/redo** (up to 50 steps) and a **restore example** button via `VisualEditorShell`. The `FigureEditModal` opens a «Visual Editor» tab for supported figures; the `FigurePickerModal` filters by difficulty (Easy / Intermediate / Advanced).

#### Visual figures

9 built-in visual block types rendered directly to LaTeX with no external tools:

| Kind | Description |
|---|---|
| `venn_euler` | Venn and Euler diagrams |
| `flow_diagram` | Flowcharts with shapes, edges, and labels |
| `timeline` | Chronological event timelines |
| `chem_reaction` | Chemical reaction equations (mhchem) |
| `molecule` | Structural formulas (chemfig) |
| `circuit` | Electronic circuits (circuitikz) |
| `feynman` | Feynman diagrams |
| `bio_pathway` | Biological pathways (e.g., Krebs, glycolysis) |
| `music_fragment` | Music notation (ABC / MusiXTeX) |

Additional plugin-backed figures are available from TeXisStudio-Plugins.

#### Bibliography

Sources: DOI import (CrossRef, DataCite, OpenAlex, Semantic Scholar), Zotero desktop (local API), BibTeX paste, CSL-JSON, RIS. Batch DOI import. Rendered citation preview (APA 7 and others). Citation picker with live search (⌘[).

#### Profile system

42+ profiles across 6 countries, 14 disciplines, and all academic levels. Each profile declares required LaTeX packages, section structure, and style configuration. Profiles are tagged `novice_safe` and include target level metadata. The community tab allows installing profiles from a URL. The profile editor supports creating and editing profiles directly in the app.

#### Discipline detection

The wizard detects the user's discipline from a text field and shows relevant hints, recommended packages, and suggested profiles. 35+ package detection rules cover notation for math, physics, chemistry, biology, computer science, engineering, music, and linguistics.

#### LaTeX compilation

Backends: `latexmk`, Tectonic (bundled, no TeX Live required), `xelatex`, `pdflatex`, `lualatex`. Settings include a configurable primary backend and optional fallback when that backend is unavailable. Draft mode. In-app PDF preview. Toolchain diagnostics and system doctor.

#### AI assistant

Available in basic and advanced user modes. Risk-classified actions (5 levels): editing only happens with explicit user confirmation for Medium+ risk. Explicit context scope prevents unintended changes. Supports multiple provider configurations.

#### Readiness and progress

Section-by-section progress view with editorial status, word count, and author notes. Readiness overview tracks setup checks (advisor, abstract, required sections) and delivery checks. Review report export for advisor review.

#### Snapshots and delivery export

Manual snapshots with labels and timestamps. One-click restore. Delivery export (`export_delivery`) packages project, bibliography, and assets for final submission.

#### Settings and accessibility

UI scale: normal, large, x-large. 7 UI languages: ES, EN, FR, DE, PT-BR, ZH, JA. Spell-check for ES and EN bundled; FR and DE available via downloadable packs. Grammar check integration. Custom dictionary. Per-user profile (name, institution, e-mail). LaTeX engine preferences can prioritize Tectonic or a complete TeX suite and optionally use the other backend as a fallback.

---

### Tech Stack

| Layer | Technology |
|---|---|
| Core | Rust 2021 edition, `texis-core` |
| Desktop | Tauri v2, WebView2 on Windows |
| Frontend | React 18, TypeScript 5, Vite 5, Zustand 5 |
| i18n | i18next 26, react-i18next 17 — 7 locales |
| Spell check | nspell, Hunspell dictionaries |
| Math preview | KaTeX |
| Plugins | TypeScript, `TeXisStudio-Plugins` monorepo |
| LaTeX | XeLaTeX, pdfLaTeX, latexmk, Tectonic, biber, biblatex |
| Serialization | serde + serde_yaml |
| Templates | MiniJinja v2 |
| Schema validation | jsonschema + schemars |
| Networking | reqwest 0.12, rustls-tls |
| IDs / timestamps | uuid v4, chrono |
| Build | Vite 5, rollup, tauri-cli |

---

### Code Structure

```
texis-core/src/
  project/          ProjectModel, loader, saver, migrations
  schema/           Schema versioning (frozen at 1.0.0), migrator
  generator/        LaTeX generator — preamble, sections, packages
  compiler/         latexmk and Tectonic backends
  bibliography/     BibTeX parser, DOI import, source adapters
  build_engine/     Multi-step build pipeline
  template_engine/  MiniJinja templates, builtins
  validator/        ProjectModel validation rules
  asset/            Figure and asset management
  plugin/           Plugin figure model
  visual/           Visual block → LaTeX renderer (9 kinds)
  exporter/         Delivery export, PDF postflight
  postflight/       PDF validation checks

texis-app/src-tauri/src/
  commands/         71 Tauri commands (project, compiler, bibliography,
                    AI, figure plugin, remote profiles, system, Zotero…)
  lib.rs            App builder, plugin registration

texis-app/src/
  views/            11 top-level views + editor/compile/library/settings panels
  components/       Shared UI components (Chrome, dialogs, panels, icons)
  stores/           Zustand stores (project, settings, AI, language packs, vocabulary)
  services/         updater, profile catalog, i18n helpers, vocabulary packs
  i18n/locales/     7 locale files (en, es, fr, de, pt-BR, zh, ja)
  types.ts          Shared TypeScript types mirroring Rust structs
  version.ts        Single source of truth for APP_VERSION
```

---

## Español

Escribe tu tesis con calidad de publicación sin aprender LaTeX.

Autor: Gonzalo Andrade Estrella, [@GonzaloAndDev](https://github.com/GonzaloAndDev)
Licencia: AGPL v3 + Commons Clause
Versión: 1.2.0

### Compilar y Ejecutar

Ejecuta los comandos desde la raíz del repositorio, `TeXisStudio`.

Primera vez en una máquina, o después de errores por dependencias faltantes:

| Sistema | Correr app | Generar instalador | Revisar frontend |
|---|---|---|---|
| Linux/macOS | `./run` | `./build` | `./check` |
| Windows | `.\run.ps1` | `.\build.ps1` | `.\check.ps1` |

Después de preparar la máquina:

| Necesidad | Comando | Resultado |
|---|---|---|
| Correr la app | `./run` o `.\run.ps1` | Abre TeXisStudio en modo Tauri dev con hot reload. No crea instalador. |
| Generar instalador | `./build` o `.\build.ps1` | Genera artefactos para el sistema operativo actual. |
| Revisar solo frontend | `./check` o `.\check.ps1` | Ejecuta TypeScript y Vite sin compilar la app nativa. |
| Probar core Rust | `cargo test -p texis-core` | 305+ pruebas unitarias e integración para generador LaTeX, compilador, bibliografía, snapshots, perfiles y migraciones. |
| Probar frontend | `npm test` (en `texis-app/`) | 355 pruebas de stores, servicios, cobertura i18n, historial de documento, transforms, recorridos de metadata y round-trips de serialización. |

Alias:
- Correr app: `dev`, `start`, `app`
- Generar instalador: `build`, `compiler`, `package`, `dist`
- Revisar frontend: `check`, `frontend`

VS Code: abre `TeXisStudio.code-workspace`. `Ctrl+Shift+B` ejecuta **TeXisStudio: Run app**. Para generar instalador: `Terminal > Run Task... > TeXisStudio: Build current OS`.

Salidas locales:

| Sistema | Script | Salida |
|---|---|---|
| Windows | `scripts/build-windows.ps1` | MSI, `.exe` NSIS y ZIP portable en `target/release/bundle/` |
| macOS | `scripts/build-mac.sh` | DMG/app universal en `target/universal-apple-darwin/release/bundle/` |
| Linux | `scripts/build-linux.sh` | `.deb`, `.rpm` y AppImage en `target/release/bundle/` |

Los scripts bootstrap son idempotentes: solo instalan lo que falta o está desactualizado.

Para compilar instaladores de todas las plataformas, sube un tag de versión:

```bash
git tag v1.1.0
git push origin v1.1.0
```

Al subir un tag `v*`, `.github/workflows/release.yml` compila en runners Windows, Linux y macOS y publica una GitHub Release. Para probar el pipeline sin publicar, ejecuta **Build & Release** manualmente desde la pestaña Actions.

> **Nota sobre firma:** La firma y notarización de instaladores aún no están configuradas. Ver `CHANGELOG.md [1.1.0]` para los requisitos por plataforma.

### Documentación de usuario

Los documentos canónicos para usuarios finales están en [`docs/user-guide/`](docs/user-guide/). Son la fuente de verdad del Centro de ayuda integrado y cualquier documentación web futura.

| Archivo | Sección en el Centro de ayuda |
|---|---|
| [getting-started.md](docs/user-guide/getting-started.md) | Primeros pasos |
| [figures.md](docs/user-guide/figures.md) | Figuras y editores visuales |
| [minimal-latex.md](docs/user-guide/minimal-latex.md) | LaTeX mínimo |
| [errors.md](docs/user-guide/errors.md) | Errores frecuentes |

---

### Qué Es TeXisStudio

TeXisStudio es una aplicación de escritorio para escribir tesis, disertaciones e informes de investigación con calidad tipográfica institucional. LaTeX es el motor de renderizado; el usuario trabaja con un editor de bloques estructurado, asistentes y formularios — sin necesidad de saber LaTeX.

```
El usuario describe el contenido
       ↓
TeXisStudio genera LaTeX correcto
       ↓
PDF portable — compilable de forma independiente, sin la app
```

---

### Ecosistema de Repositorios

| Repositorio | Propósito |
|---|---|
| **TeXisStudio** | Este repositorio. App de escritorio Tauri, core Rust, frontend React, scripts de empaquetado. |
| **[TeXisStudio-Plugins](../TeXisStudio-Plugins/README.md)** | Plugins de figuras: LaTeX de calidad editorial para diagramas, circuitos, moléculas y más sin escribir código. |
| **[TeXisStudio-Languages](../TeXisStudio-Languages/README.md)** | Paquetes descargables de ortografía, gramática y vocabulario disciplinar. |
| **[TeXisStudio-Profiles](../TeXisStudio-Profiles/README.md)** | 42+ perfiles institucionales y disciplinares, plantillas de secciones y proyectos de ejemplo. |

---

### Funcionalidades

#### Tipos de documento y niveles académicos

Soporta: tesis, tesina, especialidad, maestría, doctorado y posdoctorado. El nivel académico se sugiere automáticamente según el tipo de documento.

#### Editor de bloques

15 tipos de bloque de contenido: párrafo, título, lista, figura, tabla, ecuación, código, algoritmo, teorema, cita, LaTeX libre, entrada de glosario, entrada de acrónimo, figura visual y figura de plugin.

Reordenamiento con arrastrar y soltar. Vista previa matemática inline con KaTeX. Seguimiento de estado por sección (`borrador → revisión → revisado → aprobado`). Autoguardado con debounce.

#### Editores visuales de plugins

7 editores GUI para figuras de plugin — sin LaTeX:

| Editor | Tipos cubiertos |
|---|---|
| `GraphNodeEditor` | Nodos, aristas, formas, estilos de arco |
| `PGFPlotsEditor` | function2d, scatter, bar, histogram, boxplot, errorbar, heatmap |
| `MatrixEditor` | Matrices con selector de delimitadores y edición celda a celda |
| `GanttEditor` | Grupos, tareas, dependencias; posiciones ISO / año / numérico |
| `TableDataEditor` | Filas y columnas dinámicas con IDs collision-safe |
| `TreeForestEditor` | Árboles jerárquicos con control de dirección de crecimiento |
| `ChemistryEditor` | Fórmulas químicas (carga/estado) y reacciones (flecha, condiciones) |

Todos los editores visuales incluyen **deshacer/rehacer** (hasta 50 pasos) y botón de **restaurar ejemplo** (`VisualEditorShell`).

#### Figuras visuales

9 tipos de bloque visual renderizados directamente a LaTeX sin herramientas externas: diagramas de Venn/Euler, diagramas de flujo, líneas de tiempo, reacciones químicas (mhchem), fórmulas estructurales (chemfig), circuitos electrónicos (circuitikz), diagramas de Feynman, rutas biológicas y fragmentos musicales (ABC / MusiXTeX).

#### Bibliografía

Fuentes: DOI (CrossRef, DataCite, OpenAlex, Semantic Scholar), Zotero (API local), BibTeX, CSL-JSON, RIS. Importación masiva de DOIs. Vista previa de citas renderizadas (APA 7 y otros). Picker de citas con búsqueda en vivo (⌘[).

#### Sistema de perfiles

42+ perfiles para 6 países, 14 disciplinas y todos los niveles académicos. Cada perfil declara paquetes LaTeX requeridos, estructura de secciones y configuración de estilo. Marcados con `novice_safe` y nivel objetivo. Instalación de perfiles remotos desde URL. Editor de perfiles en la app.

#### Detección de disciplina

El wizard detecta la disciplina del usuario y muestra hints relevantes, paquetes recomendados y perfiles sugeridos. 35+ reglas de detección de paquetes para notación matemática, física, química, biología, computación, ingeniería, música y lingüística.

#### Compilación LaTeX

Backends: `latexmk`, Tectonic (sin instalación de TeX Live), `xelatex`, `pdflatex`, `lualatex`. Configuración de motor principal y respaldo opcional cuando el motor elegido no está disponible. Modo borrador. Vista previa de PDF en la app. Diagnósticos del toolchain y doctor del sistema.

#### Asistente de IA

Modos básico y avanzado. Acciones clasificadas por riesgo (5 niveles): las ediciones de riesgo Medio o mayor requieren confirmación explícita del usuario. Contexto explícito para evitar cambios no intencionales.

#### Progreso y entrega

Vista de progreso sección por sección con estado editorial, conteo de palabras y notas. Indicador de preparación (`readiness`) para entrega. Exportación de reporte de revisión para asesor. Snapshots con etiquetas y restauración con un clic. Exportación de entrega final con todos los archivos necesarios.

#### Configuración y accesibilidad

Escala de UI: normal, grande, extra grande. 7 idiomas de interfaz: ES, EN, FR, DE, PT-BR, ZH, JA. Ortografía para ES y EN incluida; FR y DE como paquetes descargables. Revisión gramatical. Diccionario personalizado. Las preferencias del motor LaTeX permiten priorizar Tectonic o una suite TeX completa y usar el otro backend como respaldo opcional.

---

### Stack Técnico

| Capa | Tecnología |
|---|---|
| Core | Rust 2021, `texis-core` |
| Escritorio | Tauri v2, WebView2 en Windows |
| Frontend | React 18, TypeScript 5, Vite 5, Zustand 5 |
| i18n | i18next 26, react-i18next 17 — 7 idiomas |
| Ortografía | nspell, diccionarios Hunspell |
| Vista previa matemática | KaTeX |
| Plugins | TypeScript, monorepo `TeXisStudio-Plugins` |
| LaTeX | XeLaTeX, pdfLaTeX, latexmk, Tectonic, biber, biblatex |
| Serialización | serde + serde_yaml |
| Plantillas | MiniJinja v2 |
| Validación de schema | jsonschema + schemars |
| Red | reqwest 0.12, rustls-tls |
| IDs / fechas | uuid v4, chrono |

---

### Estructura del Código

```
texis-core/src/
  project/          ProjectModel, loader, saver, migraciones
  schema/           Versionado de schema (congelado en 1.0.0), migrador
  generator/        Generador LaTeX — preámbulo, secciones, paquetes
  compiler/         Backends latexmk y Tectonic
  bibliography/     Parser BibTeX, importación DOI, adaptadores de fuente
  build_engine/     Pipeline de compilación por etapas
  template_engine/  Templates MiniJinja, builtins
  validator/        Reglas de validación del ProjectModel
  asset/            Gestión de figuras y assets
  plugin/           Modelo de figura por plugin
  visual/           Visual block → renderizador LaTeX (9 tipos)
  exporter/         Exportación de entrega, postflight PDF
  postflight/       Validaciones del PDF generado

texis-app/src-tauri/src/
  commands/         71 comandos Tauri (proyecto, compilador, bibliografía,
                    IA, plugin de figuras, perfiles remotos, sistema, Zotero…)
  lib.rs            Builder de la app, registro de plugins

texis-app/src/
  views/            11 vistas principales + paneles de editor/compile/library/settings
  components/       Componentes UI compartidos (Chrome, diálogos, paneles, íconos)
  stores/           Stores Zustand (proyecto, configuración, IA, packs de idioma, vocabulario)
  services/         updater, catálogo de perfiles, helpers i18n, packs de vocabulario
  i18n/locales/     7 archivos de locale (en, es, fr, de, pt-BR, zh, ja)
  types.ts          Tipos TypeScript que reflejan los structs Rust
  version.ts        Fuente única para APP_VERSION
```
