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

Run the complete local quality gate before merging or releasing with
`./check-all` on Linux/macOS or `.\check-all.ps1` on Windows. It verifies
versions, translations, Rust formatting and Clippy, all Rust/frontend tests,
the frontend build, generated schema drift, and diff whitespace.

After the machine is prepared:

| Need | Command | Result |
|---|---|---|
| Run the app | `./run` or `.\run.ps1` | Opens TeXisStudio in Tauri dev mode with hot reload. Does not create an installer. |
| Build installer/package | `./build` or `.\build.ps1` | Builds artifacts for the current OS. |
| Check frontend only | `./check` or `.\check.ps1` | Runs TypeScript check and Vite build without compiling the native app. |
| Test Rust core | `cargo test -p texis-core` | 305+ unit and integration tests for LaTeX generation, compilation, bibliography, snapshots, profiles, and migrations. |
| Test frontend | `npm test` (in `texis-app/`) | 358 tests for stores, services, i18n coverage (all 7 bundled locales), UI helpers, document history, visual-editor transforms, metadata round-trips, and serializer round-trips. |

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

Local installer builds clean Rust/Tauri intermediate files after a successful
build and keep only the final artifacts in `target/**/bundle/`. To keep the
full `target` cache for debugging or repeated release builds, run with
`TEXIS_KEEP_TARGET=1`.

Bootstrap scripts are idempotent: Node, Rust, native packages, and npm dependencies are installed only when missing or stale.

To build all platform installers, push a version tag — GitHub Actions handles the rest:

```bash
git tag v1.1.0
git push origin v1.1.0
```

Pushing a `v*` tag runs `.github/workflows/release.yml` on Windows, Linux, and macOS runners and publishes a GitHub Release with all artifacts. To test the pipeline without publishing, trigger **Build & Release** manually from the Actions tab.

> **Note on signing:** Installer signing and notarization are not yet configured. See `CHANGELOG.md [1.1.0]` for the requirements per platform.

### User documentation

The bilingual web documentation lives in [`docs-site/`](docs-site/) and is
published with Astro Starlight on GitHub Pages. The compact files in
[`docs/user-guide/`](docs/user-guide/) remain the source for the built-in Help
Center.

The migration from the draft GitHub Wiki is tracked in the
[documentation professionalization plan](docs/documentation-professionalization-plan.md).

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

The side math-symbol panel always lands content in a dedicated equation block: with no equation focused, clicking a symbol spawns a new equation block right after the current cursor position (live KaTeX preview). With an equation focused, clicks splice the snippet into it at the caret. Numbered equations expose a `label` field directly in the block toolbar so they can be cross-referenced with `\eqref{…}` without hand-editing LaTeX. Empty equations are skipped from the generated PDF, the validator flags numbered equations without a label, and the KaTeX preview surfaces the parser's actual error so the writer knows what to fix.

Inside the equation block the rendered KaTeX preview is the dominant visual; the LaTeX source line sits underneath in a compact monospace strip and can be hidden entirely with a per-session toggle. Pressing Escape while inside the source field only steps out of the source — it does not exit the block — so reflexive Esc presses don't lose the user's place.

Math-panel insertions land Wolfram-style: snippets like `\frac{}{}`, `\sqrt{}`, `\sum_{}^{}` or `\sqrt[]{}` place the cursor directly inside the first empty `{}` or `[]` placeholder, and Tab / Shift+Tab jump between unfilled slots so the user fills in the boxes instead of hand-positioning the caret.

#### Plugin visual editors

9 GUI editors for plugin-backed figures — no LaTeX required:

| Editor | Plugin types covered |
|---|---|
| `GraphNodeEditor` | Graph nodes, edges, shapes, arc styles |
| `PGFPlotsEditor` | function2d, scatter, bar, histogram, boxplot, errorbar, heatmap |
| `MatrixEditor` | Matrices with bracket selector and cell-by-cell editing |
| `GanttEditor` | Groups, tasks, dependencies; ISO / year / numeric positions |
| `TableDataEditor` | Dynamic rows and columns with collision-safe IDs |
| `TreeForestEditor` | Hierarchical trees with growth-direction control |
| `ChemistryEditor` | Chemical formulas (charge/state) and reactions (arrow, conditions) |
| `CircuitEditor` | Electronic circuits: components, nodes, direct wire connections |
| `TikzShapeEditor` | 13 shape types (point/line/arrow/rect/circle/polygon/…), per-shape coordinates, line style, color, and TikZ library management |

Every visual editor includes **undo/redo** (up to 50 steps) and a **restore example** button via `VisualEditorShell`. The `FigureEditModal` opens three tabs: **Visual Editor** (for supported figures), **Caption & Label**, and **Preview** — the Preview tab compiles the figure's saved `output.tex` as a standalone document with Tectonic and renders the PDF inline. `FigurePickerModal` (accessible via the **Figura+** toolbar button) browses all 61 plugin types by category and difficulty.

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

#### Delivery quality gate

A single source of truth — `DeliveryQualityReport` in `texis-core::quality` — combines every quality signal (model/profile validation, PDF postflight, LaTeX log diagnosis and profile trust) into one classified report with **per-mode gates**: `draft` (informational, never blocks), `review` (blocks content/compilation errors) and `final` (blocks any error, including postflight). `export_delivery` no longer reimplements its own gate — it asks the report, so the **Delivery quality** panel in the Compile view shows exactly what the export will require, with each blocking item explained and a suggested fix. Exposed to the UI via the `delivery_quality_report` command.

The report also carries a narrative **document state** — `writing` → `ready_for_review` → `ready_for_delivery`, derived from the same gates — which powers the **Thesis status** view (`/project/:id/status`, reachable from the editor toolbar). That view is the product's centre of gravity: it answers "how is my thesis and what's next?" in one screen, with a delivery score (0–100), the five-step journey (create → write → review → compile → deliver), the single most important next action, and what's left to fix. All the engineering (validation, compilation, postflight, profile) collapses into one obvious narrative.

An automated QA harness (`tests/qa_delivery_harness.rs`) closes the loop: it generates a rich ~10-page thesis fixture through the real editor pipeline, compiles it with `latexmk -xelatex`, and asserts — using the quality report as oracle — that there are no LaTeX errors, no undefined references/citations, no overfull boxes, all fonts embedded, no near-empty pages, and that the `review`/`final` gates pass. It skips cleanly when no LaTeX toolchain is present, so it runs for real in CI with TeX Live and never breaks toolchain-less environments.

#### Recovery Center and transactional saves

Every save now goes through the `texis-platform` transactional pipeline: it acquires an **atomic** project lock (`O_EXCL`, so two windows can never both think they hold it), journals the operation, snapshots the previous state, writes atomically, regenerates `build/` **inside the same transaction and lock**, updates a SHA-256 integrity manifest, and **rolls back to the previous state if any write or regeneration fails** — so an interrupted save can never leave the project broken or the YAML out of sync with `build/`. Restoring a snapshot is itself transactional and reversible: it locks the project, snapshots the *current* state first (so the most recent work is never lost), restores, and recomputes integrity (so a restored project is not flagged as modified). The Recovery Center view (`/project/:id/recovery`, reachable from the editor toolbar) surfaces all of this: project health, the active lock holder, automatic snapshots with confirmed one-click restore, and an on-demand integrity check.

#### Snapshots and delivery export

Manual snapshots with labels and timestamps. One-click restore. Delivery export (`export_delivery`) packages project, bibliography, and assets for final submission.

Per-project platform export is reachable two ways: a small download button on every project card on the Home view, and the matching button inside the Compile view. Targets: Overleaf, TeXstudio, VS Code (LaTeX Workshop), or a plain local folder. The Home-view affordance lets you hand off a project to another editor without opening it first.

The reverse direction — importing an external `.tex` file — recognises `\chapter` boundaries, section headings, `equation` / `equation*` environments (with their `\label{…}` extracted into the block's label field), and `itemize` / `enumerate` lists. Anything else (tables, citations inline, custom macros, broken or nested constructs) is preserved verbatim in a confirmed `raw_latex` block so the import never loses content. A `\begin` without a matching `\end` always falls back to raw_latex.

#### Settings and accessibility

UI scale: normal, large, x-large. Startup window behavior: laptop default (1280 × 760), remember the last size, or maximize. The editor keeps both side panels usable at common 1280 × 720 laptop viewports, with independently scrollable tool and status bars. 7 UI languages: ES, EN, FR, DE, PT-BR, ZH, JA. Spell-check for ES and EN bundled; FR and DE available via downloadable packs. Grammar check integration. Custom dictionary. Per-user profile (name, institution, e-mail). LaTeX engine preferences can prioritize Tectonic or a complete TeX suite and optionally use the other backend as a fallback.

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

La documentación web bilingüe vive en [`docs-site/`](docs-site/) y se publica
con Astro Starlight en GitHub Pages. Los archivos compactos de
[`docs/user-guide/`](docs/user-guide/) siguen siendo la fuente del Centro de
ayuda integrado.

La migración desde el borrador de GitHub Wiki se controla en el
[plan de profesionalización de la documentación](docs/documentation-professionalization-plan.md).

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

El panel lateral de símbolos matemáticos siempre coloca el contenido en un bloque de ecuación dedicado: sin ecuación enfocada, hacer clic en un símbolo crea un nuevo bloque de ecuación justo después de la posición actual del cursor (vista previa KaTeX en vivo). Con una ecuación enfocada, el clic inserta el fragmento en la posición del cursor. Las ecuaciones numeradas exponen un campo `etiqueta` directamente en la barra del bloque para poder referenciarlas con `\eqref{…}` sin editar LaTeX a mano. Las ecuaciones vacías se omiten del PDF generado, el validador avisa cuando hay ecuaciones numeradas sin etiqueta, y la vista previa KaTeX muestra el error real del parser para que el autor sepa qué corregir.

Dentro del bloque de ecuación, la vista previa KaTeX renderizada es el elemento dominante; el código LaTeX queda debajo en una franja monoespaciada compacta y puede ocultarse por completo con un interruptor por sesión. Pulsar Escape dentro del campo de código solo sale del campo —no cierra el bloque—, así los Esc por reflejo no pierden el lugar del autor.

Las inserciones del panel matemático funcionan al estilo Wolfram: los fragmentos como `\frac{}{}`, `\sqrt{}`, `\sum_{}^{}` o `\sqrt[]{}` posicionan el cursor directamente dentro del primer hueco `{}` o `[]`, y Tab / Shift+Tab saltan entre los huecos vacíos para que el autor rellene los cuadritos en vez de mover el cursor a mano.

#### Editores visuales de plugins

8 editores GUI para figuras de plugin — sin LaTeX:

| Editor | Tipos cubiertos |
|---|---|
| `GraphNodeEditor` | Nodos, aristas, formas, estilos de arco |
| `PGFPlotsEditor` | function2d, scatter, bar, histogram, boxplot, errorbar, heatmap |
| `MatrixEditor` | Matrices con selector de delimitadores y edición celda a celda |
| `GanttEditor` | Grupos, tareas, dependencias; posiciones ISO / año / numérico |
| `TableDataEditor` | Filas y columnas dinámicas con IDs collision-safe |
| `TreeForestEditor` | Árboles jerárquicos con control de dirección de crecimiento |
| `ChemistryEditor` | Fórmulas químicas (carga/estado) y reacciones (flecha, condiciones) |
| `CircuitEditor` | Circuitos electrónicos: componentes, nodos, conexiones directas |
| `TikzShapeEditor` | 13 tipos de forma (punto/línea/flecha/rect/círculo/polígono/…), coordenadas por forma, estilo de línea, color y gestión de bibliotecas TikZ |

Todos los editores visuales incluyen **deshacer/rehacer** (hasta 50 pasos) y botón de **restaurar ejemplo** (`VisualEditorShell`). El `FigureEditModal` incluye tres pestañas: **Editor visual** (para figuras compatibles), **Título y etiqueta** y **Vista previa** — la pestaña de vista previa compila el `output.tex` guardado de la figura como documento standalone con Tectonic y muestra el PDF inline. El botón **Figura+** de la barra de herramientas abre el `FigurePickerModal` para explorar los 61 tipos de plugin por categoría y dificultad.

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

#### Compuerta única de calidad de entrega

Una sola fuente de verdad —`DeliveryQualityReport` en `texis-core::quality`— combina todas las señales de calidad (validación del modelo/perfil, postflight del PDF, diagnóstico del log de LaTeX y confianza del perfil) en un reporte clasificado con **compuertas por modo**: `draft` (informativa, nunca bloquea), `review` (bloquea errores de contenido/compilación) y `final` (bloquea cualquier error, incluido el postflight). `export_delivery` ya no reimplementa su propio gate — consulta el reporte, de modo que el panel **Compuerta de calidad** en la vista de compilación muestra exactamente lo que la exportación va a exigir, con cada bloqueo explicado y su acción sugerida. Expuesto a la UI con el comando `delivery_quality_report`.

El reporte incluye además un **estado narrativo del documento** —`writing` → `ready_for_review` → `ready_for_delivery`, derivado de las mismas compuertas— que alimenta la vista **Estado de la tesis** (`/project/:id/status`, accesible desde la barra del editor). Esa vista es el centro de gravedad del producto: responde "¿cómo va mi tesis y qué sigue?" en una sola pantalla, con un puntaje de entrega (0–100), el recorrido de cinco pasos (crear → escribir → revisar → compilar → entregar), la única acción más importante a continuación, y qué falta por corregir. Toda la ingeniería (validación, compilación, postflight, perfil) se colapsa en una narrativa obvia.

Un harness de QA automatizado (`tests/qa_delivery_harness.rs`) cierra el círculo: genera una tesis rica de ~10 páginas por el pipeline real del editor, la compila con `latexmk -xelatex` y verifica —usando el reporte de calidad como oráculo— que no hay errores LaTeX, ni referencias/citas indefinidas, ni overfull boxes, que todas las fuentes están incrustadas, que no hay páginas casi vacías y que las compuertas `review`/`final` pasan. Se omite limpiamente sin toolchain LaTeX, así corre de verdad en CI con TeX Live sin romper entornos sin LaTeX.

El Centro de recuperación además se **auto-ofrece**: al abrir un proyecto se escanea su estado y, si hay operaciones interrumpidas, temporales sobrantes o problemas de integridad, aparece un aviso en el editor con acceso directo a la recuperación.

#### Centro de recuperación y guardado transaccional

Cada guardado pasa ahora por el pipeline transaccional de `texis-platform`: toma un lock **atómico** del proyecto (`O_EXCL`, así dos ventanas nunca creen ambas que lo tienen), registra la operación en el journal, hace un snapshot del estado previo, escribe de forma atómica, regenera `build/` **dentro de la misma transacción y bajo el mismo lock**, actualiza un manifiesto de integridad SHA-256 y **hace rollback al estado previo si cualquier escritura o regeneración falla** — de modo que un guardado interrumpido nunca deja el proyecto roto ni el YAML desincronizado de `build/`. Restaurar un snapshot es también transaccional y reversible: bloquea el proyecto, hace un snapshot del estado *actual* antes de sobrescribir (el trabajo más reciente no se pierde), restaura y recalcula la integridad (un proyecto restaurado no aparece como modificado). El Centro de recuperación (`/project/:id/recovery`, accesible desde la barra del editor) lo expone todo: salud del proyecto, el titular del lock activo, snapshots automáticos con restauración confirmada en un clic, y una verificación de integridad bajo demanda.

#### Progreso y entrega

Vista de progreso sección por sección con estado editorial, conteo de palabras y notas. Indicador de preparación (`readiness`) para entrega. Exportación de reporte de revisión para asesor. Snapshots con etiquetas y restauración con un clic. Exportación de entrega final con todos los archivos necesarios.

La exportación a plataformas (Overleaf, TeXstudio, VS Code con LaTeX Workshop, o carpeta local) está disponible por proyecto desde dos sitios: un botón de descarga discreto en cada tarjeta de proyecto en la vista de Inicio, y su equivalente dentro de la vista de Compilación. La opción de Inicio permite traspasar un proyecto a otro editor sin tener que abrirlo primero.

El camino inverso —importar un `.tex` externo— reconoce los límites de `\chapter`, encabezados de sección, entornos `equation` / `equation*` (con su `\label{…}` extraído al campo `label` del bloque) y listas `itemize` / `enumerate`. Lo demás (tablas, citas inline, macros personalizadas, construcciones rotas o anidadas) se preserva verbatim como bloque `raw_latex` confirmado, así la importación nunca pierde contenido. Un `\begin` sin su `\end` correspondiente siempre cae a raw_latex.

#### Configuración y accesibilidad

Escala de UI: normal, grande, extra grande. Comportamiento de ventana al iniciar: tamaño para laptop (1280 × 760), recordar el último tamaño o maximizar. El editor conserva ambos paneles laterales en resoluciones habituales de laptop de 1280 × 720, con barras de herramientas y estado claramente separadas. 7 idiomas de interfaz: ES, EN, FR, DE, PT-BR, ZH, JA. Ortografía para ES y EN incluida; FR y DE como paquetes descargables. Revisión gramatical. Diccionario personalizado. Las preferencias del motor LaTeX permiten priorizar Tectonic o una suite TeX completa y usar el otro backend como respaldo opcional.

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
