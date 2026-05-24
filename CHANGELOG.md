# Changelog — TeXisStudio

Historial de versiones del proyecto. Sigue [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

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
