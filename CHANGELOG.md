# Changelog — TeXisStudio

Historial de versiones del proyecto. Sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

### Editor visual de química (`ChemistryEditor`)

- `ChemistryEditor.tsx`: editor de fórmulas (texto, carga, estado físico) y reacciones (reactivos + productos múltiples, tipo de flecha `->` / `<->` / `<=>`, condiciones encima/debajo) usando mhchem.
- Integrado en `VisualEditorRouter` bajo `"chemistry-engine"`.
- `ChemicalFormulasPlugin`, `ChemicalReactionsPlugin`, `ReactionEquilibriaPlugin` reclasificados de `"advanced"` → `"visual-assisted"` en el registry.
- `VisualEditorEngineId` extendido con `"chemistry-engine"`.
- i18n: namespace `chem.*` (17 claves) añadido a EN y ES.
- `types-engines.ts`: exporta tipos `ChemEngineDocument`, `CircuiTikZDocument`, `TikzShapeDocument`.

### Metadata + serializer de engines

**Metadata 9 engines registrados** (TeXisStudio-Plugins)
- `math-engine/metadata.ts`: ecuación cuadrática, `helpTopic: "latex"`, `technicalField: label`.
- `chemistry-engine/metadata.ts`: reacción H₂+O₂→H₂O (mhchem).
- `circuitikz-engine/metadata.ts`: divisor de voltaje V-R-R.
- `tikz-shape-engine/metadata.ts`: rectángulo + flecha + etiqueta.
- `metadata-init.ts` actualizado con los 9 engines.
- `ENGINE_HELP_TOPIC` hardcoded eliminado del router — `meta?.helpTopic` es fuente única.

**Serializer `table-data-engine`**
- `serializer.ts`: booktabs, longtable, pgfplots; escape completo de caracteres especiales.

**Tests — frontend (358 total, 348 passing)**
- `metadata-roundtrip.test.ts`: 86 casos, 9 engines.
- 10 fallos pre-existentes en `i18n-coverage` (de/fr/ja/pt-BR/zh con claves `settings.*` pendientes de traducción por chat).

### Ayuda contextual + VisualEditorShell

**Ayuda contextual enrutada**
- `stores/help.ts` (`useHelpStore`): estado global para abrir `HelpCenter` en cualquier sección desde cualquier componente, sin prop drilling.
- `components/help/HelpLink.tsx`: botón "?" reutilizable que abre `HelpCenter` en el tema indicado.
- `HelpCenter` ya reacciona a cambios en `initialSection` (puede cambiarse con el modal abierto).
- Puntos de entrada: bloque ecuación → sección "latex"; bloque raw_latex → "latex"; `FigureEditModal` pestaña visual → "figures"; `VisualEditorRouter` sin editor → "figures"; `DeliveryCheckModal` → "errors".

**`VisualEditorShell`** — envoltorio común para todos los editores visuales
- Barra de herramientas con botones de deshacer/rehacer, separador, botón "Restaurar ejemplo" (condicional) y `HelpLink`.
- `useDocumentHistory<T>`: hook genérico con pila de hasta 50 estados; `undo()`/`redo()` devuelven el documento restaurado de forma síncrona para poder llamar `onSourceChange` en el mismo ciclo.
- `VisualEditorRouter`: integra historial por engine; sincroniza con cambios externos via `lastEmittedRef`; documentos de ejemplo por defecto para los 5 engines con datos.

**i18n — cobertura completa en 7 idiomas**
- Claves nuevas en `visual_editor.*`: `undo`, `redo`, `restore_btn`, `restore_title` — traducidas en EN, ES, DE, FR, JA, PT-BR, ZH.
- Extracción de strings hardcoded restantes: `AppErrorBoundary`, `GrammarPanel`, `LanguagePicker`, `SettingsView`, `CompileSupport`, `BlockItem`, `WizardView`.

**Tests — frontend (355/355)**
- `document-history.test.ts`: 18 casos — push, undo, redo, cap MAX_HISTORY, objetos por referencia.
- `metadata-roundtrip.test.ts`: 86 casos — metadata registrada, defaultDoc→serializer→LaTeX válido, JSON round-trip, todos los 9 engines: pgfplots/gantt/graph-node/tree-forest/table-data/math/chemistry/circuitikz/tikz-shape.

**TechnicalFields en VisualEditorShell**
- `VisualEditorShell` acepta `technicalFields`, `technicalValues`, `onTechnicalFieldChange`.
- Panel colapsable «Opciones avanzadas» con inputs text/number/textarea/boolean por campo.
- `VisualEditorRouter` lee `meta.technicalFields` y `technicalValues` del doc; `handleTechnicalFieldChange` actualiza el doc con `{ ...doc, [key]: value }`.
- `shellProps` centraliza las props del shell para eliminar repetición en el switch.
- i18n: `visual_editor.advanced_section` en 7 idiomas.

**Documentación versionada**
- `docs/user-guide/`: fuente canónica de la documentación de usuario.
  - `getting-started.md` — Crear proyecto, editor de bloques, compilar.
  - `figures.md` — Tipos de figura, editores visuales, título/etiqueta.
  - `minimal-latex.md` — Llaves, comandos, subíndices, fracciones, símbolos, expresiones para gráficas, caracteres especiales.
  - `errors.md` — Diagnósticos y soluciones para los errores más comunes.
  - `index.md` — Índice, convenciones y relación con el Centro de ayuda.
- README actualizado con tabla de documentos y sección «User documentation» / «Documentación de usuario».

**Contrato público `PluginEditingMetadata`** (TeXisStudio-Plugins)
- `EditorCapabilities`, `TechnicalField`, `PluginEditingMetadata` en `common/contracts/types.ts`.
- `registerEditorMetadata` / `getEditorMetadata` / `getAllEditorMetadata` con registro module-level.
- `metadata.ts` en pgfplots-engine, graph-node-engine, timeline-gantt-engine, table-data-engine, tree-forest-engine.
- `engines/metadata-init.ts`: barrel de side-effect imports.
- `VisualEditorRouter` consume `getEditorMetadata(engineId)` para `defaultDoc` y `helpTopic`; elimina `DEFAULT_DOCS` hardcoded.

**Metadata `chemistry-engine`, `circuitikz-engine`, `tikz-shape-engine`** (TeXisStudio-Plugins)
- `chemistry-engine/metadata.ts`: `helpTopic: "latex"`, defaultDoc con reacción H2 + O2 → H2O (mhchem), technicalField `preferredOutput`.
- `circuitikz-engine/metadata.ts`: `helpTopic: "figures"`, defaultDoc con circuito divisor de voltaje (V-R-R), technicalField `americanStyle`.
- `tikz-shape-engine/metadata.ts`: `helpTopic: "figures"`, defaultDoc con rectángulo + flecha + etiqueta, technicalField `tikzLibraries`.
- Todos registrados en `metadata-init.ts`; registry completeness test actualizado a 9 engines.

**Metadata `math-engine`** (TeXisStudio-Plugins)
- `math-engine/metadata.ts`: registra el engine con `helpTopic: "latex"`, `defaultDoc()` con ecuación cuadrática en modo `equation` numerado, y `technicalFields: [{ key: "label" }]` para referencias cruzadas.
- Añadido a `metadata-init.ts`; incluido en el comprobador de completitud del registry.

**Serializer `table-data-engine`**
- `table-data-engine/serializer.ts`: genera LaTeX para `booktabs` (`\begin{tabular}` con `\toprule/\midrule/\bottomrule` o `\hline`), `longtable` (con `\endfirsthead`/`\endhead` y header repetido) y `pgfplots` (`\pgfplotstableread` CSV).
- Escape automático de caracteres especiales LaTeX (`\`, `%`, `$`, `&`, `#`, `_`, `^`, `{`, `}`, `~`) en celdas de texto; celdas numéricas sin escape.
- Soporte para `col.latexHeader` (override manual) y `col.unit` (añadido entre paréntesis al encabezado).
- Exportado desde `table-data-engine/index.ts` y desde `@texisstudio/plugins`.

---

## [1.2.0] — 2026-06-11

### Editores visuales para plugins — "TeXisStudio sin LaTeX obligatorio"

**Visual editors — 6 nuevos editores integrados**
- `GraphNodeEditor`: editor de nodos/aristas con formas, estilos de arco y etiquetas.
- `PGFPlotsEditor`: editor de series de datos con soporte para function2d, scatter, bar, histogram, boxplot, errorbar, heatmap; columna extra configurable por tipo (±y error, ½ IQR, meta/color).
- `MatrixEditor`: editor de matrices con selector de delimitadores y edición celda a celda.
- `GanttEditor`: editor de diagrama de Gantt con grupos, tareas, dependencias, y posiciones ISO/año/numérico.
- `TableDataEditor`: editor de tablas con columnas de ID collision-safe y filas dinámicas.
- `TreeForestEditor`: editor de árboles con nodos jerárquicos y dirección de crecimiento.

**FigureEditModal y FigurePickerModal**
- `FigureEditModal`: nuevo tab «Visual Editor» / «Caption & Label»; tab visual se omite automáticamente para engines sin editor.
- `FigurePickerModal`: filtro de dificultad (Fácil / Intermediario / Avanzado) basado en `userLevel`.

**Plugin registry — clasificación correcta**
- 70 plugins clasificados con `userLevel` + `editorType` consistentes.
- ErrorBars y HeatMaps reclasificados como `visual-assisted` tras añadir soporte de editor.
- Plugins sin editor visual declarados como `advanced` (VennDiagram, PlaneGeometry, Vectors, BasicCircuits, ChemicalFormulas, etc.).

**Serializer PGFPlots — semántica correcta de barras**
- `bar` y `histogram`: `ybar`/`ybar interval` emitidos dentro del `\addplot` de cada serie (no global).
- Documentos con `pgfplotsOptions: "xbar"` (ej. PopulationPyramid): detección automática; emite `xbar`/`xbar interval` y transpone coordenadas `(y, x)` para respetar la semántica horizontal de PGFPlots.
- Colores compuestos xcolor (`blue!60`, `orange!70`): reemplazado `fill=color!40` por `fill=color, fill opacity=0.4` para evitar doble mezcla inválida (`blue!60!40`).
- Fallback de color: `s.color?.trim() || "blue"` en bar, histogram y boxplot.

**Helpers puros y tests**
- `transforms.ts`: `applyPlotTypeChange`, `deleteGanttGroup`, `deleteGanttTask`, `parseFiniteNumberDraft`, `nextColId`, `EXTRA_COL_FOR_TYPE` con `defaultValue` por tipo.
- `round-trip.test.ts`: 26 tests — scatter, errorbar, heatmap, bar, histogram, type switches, empty color, compound xcolor, mixed series, xbar transposition, Gantt group/task deletion.
- `visual-editor-transforms.test.ts`: 210+ tests para todos los helpers puros.

**i18n — cobertura completa en 7 idiomas**
- Claves nuevas: `figure_picker.*`, `figure_edit.*`, `visual_editor.*` (95 claves), `help.*` (44 claves).
- Traducidas en: EN, ES, DE, FR, JA, PT-BR, ZH.

**Tests — frontend (249/249)**

---

## [1.1.0] — 2026-06-08

### Release hardening — preparación para distribución pública

**Rust / texis-core**
- `generator/main_tex.rs`: corregido aviso `clippy::op_ref` (`&p.name == pkg.as_str()` → `p.name == pkg.as_str()`). CI Clippy con `-D warnings` ahora pasa limpio en todos los crates.

**Rust / texis-app**
- `commands/figure_plugin.rs`: `#[allow(clippy::too_many_arguments)]` en `save_plugin_figure` (handler Tauri con 9 parámetros — reestructura aplazada).
- `tauri-plugin-updater` eliminado: dependencia de Cargo, plugin de lib.rs, entrada en `tauri.conf.json` y permiso `updater:default` en `capabilities/default.json`.

**Frontend**
- `src/version.ts`: fuente única para `APP_VERSION = "1.1.0"`. Los 8 sitios hardcoded en UI (AboutView, HomeView, SettingsView, ProgressView, LibraryView) importan esta constante. Se elimina la bifurcación entre `"1.0.0"` UI y `"1.1.0"` Tauri/Rust.
- `package.json` y `package-lock.json`: sincronizados a `1.1.0`.
- `@tauri-apps/plugin-updater` eliminado de dependencias npm.
- UI de actualizaciones en SettingsView: estado inicial `"disabled"` cuando `UPDATER_ENABLED = false`. Botón deshabilitado con mensaje honesto en los 7 idiomas (`update_disabled`).

**Tests — frontend (173/173)**
- `version.test.ts`: verifica consistencia entre `version.ts`, `package.json` y `tauri.conf.json`.
- `project-store.test.ts`: cubre `openProject`, `closeProject`, `updateSectionBlocks`, `updateSectionMeta`, `updateProject` y `setLatexInfo`.
- `updater.test.ts`: contrato de no-crash y `available: false` con plugin deshabilitado.
- `tauri-mocks.test.ts`: formas de BROWSER_MOCKS para los 5 comandos más críticos.
- `citation-search.test.ts`: 12 casos sobre `matchesCitationQuery` — flujo buscar/insertar cita, incluyendo case-insensitivity, campos indexados y no-indexados.
- `wizard-helpers.test.ts`: 6 casos sobre `defaultAcademicLevelForDocType` — nivel por defecto correcto para cada tipo de documento y guardia contra tipos futuros.
- `i18n-settings-keys.test.ts`: 22 casos — `update_disabled`, `update_check_btn` y `update_error` presentes como strings no vacíos en los 7 idiomas; `update_disabled` ≠ `update_up_to_date`.

**Notas de seguridad**
- `assetProtocol.scope`: se mantiene `["**"]` — necesario porque `convertFileSrc` sirve PDFs y assets desde directorios de proyecto elegidos por el usuario (pueden estar en `/Volumes/...`, rutas de red, etc.). El CSP existente (`script-src 'self'`) mitiga el vector de ejecución. Deuda técnica: reemplazar con protocolo propio de scope dinámico por proyecto en una versión futura.
- **Firma e instaladores no incluidos en este release.** Requerimientos para releases públicos firmados:
  - macOS: certificado *Developer ID Application* de Apple, habilitado en `tauri.conf.json` → `bundle.macOS.signingIdentity`. Notarización automática vía `bundle.macOS.notarize` (requiere App Store Connect API key).
  - Windows: certificado code-signing EV (OV recomendado), configurado en `bundle.windows.certificateThumbprint` o via `TAURI_SIGNING_PRIVATE_KEY` en CI.
  - Linux: paquetes `.deb`/`.rpm`/AppImage no requieren firma para distribución directa, pero sí para Snap Store.
  - El workflow de release CI (`.github/workflows/release.yml`) está listo para agregar estos pasos cuando se provean los certificados.

---

## [1.0.0] — 2026-05-24

### ¡Release oficial! Schema 1.0.0 congelado.

**Rust / texis-core**
- `schema/versions.rs`: `CURRENT_SCHEMA_VERSION` → `"1.0.0"`. Schema congelado — cambios breaking requerirán versión Major + migrador.
- `schema/migrator.rs`: Implementado `migrate()`. Migración automática `0.1.0 → 1.0.0` al cargar proyectos legacy (sin pérdida de datos).
- `project/loader.rs`: `load_from_str` ahora usa `is_acceptable()` — acepta `0.1.0` y `1.0.0`. Invoca el migrador automáticamente antes de devolver el modelo.
- Todos los crates bumpeados a `1.0.0` (`texis-core`, `texis-cli`, `texis-app`).

**Frontend**
- `AboutView`: Reescrito para v1.0.0 — roadmap completo (todos ✅), notas del release, stack técnico actualizado.
- `HomeView`: Chip de versión actualizado a `v1.0.0`. StatusBar actualizado.
- `tauri.conf.json` / `package.json`: `version` → `"1.0.0"`.

---

## [0.8.0] — 2026-05-24

### Perfiles comunitarios — instalación remota

**Rust / Tauri**
- `commands/remote.rs`: Comando `fetch_remote_profile` — descarga un repositorio ZIP desde URL, localiza `profile.yaml` al nivel más superficial, extrae e instala el perfil automáticamente.
- `Cargo.toml`: Dependencias `reqwest 0.12` (rustls-tls) y `zip 2`.

**Frontend**
- `LibraryView`: Pestaña "Comunidad" con lista curada de 4 perfiles, botones de instalación, feedback de estado y campo para URL personalizada.
- `lib/tauri.ts`: Función `fetchRemoteProfile(url)`.
- `types.ts`: Interfaz `ProfileUpdatePayload` extendida.

---

## [0.7.0] — 2026-05-23

### CommandPalette y CitationPicker

**Rust / Tauri**
- `commands/project.rs`: Comando `list_references` — lee `references.bib`, parsea con `BibParser`, devuelve array JSON.
- `bibliography/parser.rs`: `BibEntry` con helpers `title()`, `author()`, `year()`. Parser con extracción balanceada de llaves/comillas.

**Frontend**
- `EditorView`: `CommandPalette` (Ctrl+K) con búsqueda fuzzy, navegación por teclado, inserción de bloques y salto a secciones.
- `EditorView`: `CitationPickerModal` (Ctrl+[) con búsqueda en referencias, toggle de tipo de cita, inserción directa.
- StatusBar del editor muestra conteo de referencias `.bib`.
- `types.ts`: Interfaz `BibReference`.

---

## [0.6.0] — 2026-05-23

### Drag & drop y toolbar académico

**Frontend**
- `EditorView`: Drag & drop nativo HTML5 para reordenar bloques dentro de una sección. Feedback visual: opacidad 35% en bloque arrastrado, borde azul en destino.
- Toolbar: separador visual, botón Cita, botón Comandos ⌘K.
- MetaPanel: atajos de teclado documentados (Ctrl+K, Ctrl+[).

---

## [0.5.0] — 2026-05-22

### Biblioteca de perfiles — editor y persistencia

**Rust / Tauri**
- `profile/loader.rs`: `save_to_file()` — serialización YAML de vuelta a disco.
- `commands/system.rs`: Comandos `update_profile` y `delete_profile`.

**Frontend**
- `LibraryView`: `ProfileEditorPanel` con editor completo de metadata y secciones. Modal de confirmación de eliminación. Pestaña "Comunidad" (icono descarga).
- `Icons.tsx`: `IconEdit` añadido.
- `lib/tauri.ts`: Funciones `updateProfile()` y `deleteProfile()`.

---

## [0.4.0] — 2026-05-22

### Asistente LaTeX — detección de backends

**Rust / Tauri**
- Detección automática de backends: `latexmk`, `tectonic`, `xelatex`, `pdflatex`, `lualatex`.
- Comando `detect_latex` — devuelve `LatexInfo` con `is_usable`, `available_backends`, `texlive_year`.
- `CompilationBackend::Auto` — elige latexmk si disponible, fallback a tectonic.

**Frontend**
- `SetupLatexView`: Guía de instalación paso a paso para cada backend.
- `HomeView`: Banner `LatexSetupBanner` visible cuando no hay compilador instalado.
- StatusBar: indicador de estado LaTeX (punto verde/rojo).

---

## [0.3.0] — 2026-05-21

### Perfiles personalizados desde la UI

**Rust / Tauri**
- `ProfileRegistry` / `ProfileLoader` / `ProfileSaver` en texis-core.
- Comandos: `list_profiles`, `get_profile`, `create_profile`, `install_profile`.
- Soporte YAML para perfiles con secciones, elementos, configuración LaTeX.

**Frontend**
- `LibraryView`: Lista de perfiles instalados, detalle, creación desde plantilla.
- `NewProjectView`: Selector de perfil con vista previa.

---

## [0.2.0] — 2026-05-20

### App de escritorio — editor visual

**Frontend (Tauri v2 + React)**
- `HomeView`: Pantalla de inicio con proyectos recientes, navegación lateral.
- `EditorView`: Editor de bloques por sección (párrafo, encabezado, figura, tabla, ecuación, lista, cita, LaTeX raw). Panel de metadatos. StatusBar.
- `NewProjectView`: Asistente de 4 pasos para crear proyecto.
- `AboutView`: Información del proyecto.
- Sistema de navegación con React Router.
- Design system: variables CSS, tipografía Newsreader/Geist/JetBrains Mono.

---

## [0.1.0] — 2026-05-19

### CLI técnico

**Rust / texis-core**
- `ProjectModel` — modelo de datos completo del proyecto (tesis.project.yaml).
- `ProjectLoader` / `ProjectSaver` — serialización/deserialización YAML.
- `ProfileLoader` — carga de perfiles desde directorio `profiles/`.
- `LatexGenerator` — generación de `.tex` desde MiniJinja templates.
- `CompilationBackend` trait con implementaciones latexmk y tectonic.
- Schema versioning en `schema/versions.rs`.
- CLI con subcomandos: `new`, `compile`, `validate`, `list-profiles`.
