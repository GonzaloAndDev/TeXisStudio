# Changelog — TeXisStudio

Historial de versiones del proyecto. Sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

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
