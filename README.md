# TeXisStudio

> **ES** — Escribe tu tesis con calidad de publicación. Sin aprender LaTeX.  
> **EN** — Write your thesis at publication quality. Without learning LaTeX.

**Author / Autor:** Gonzalo Andrade Estrella · [@GonzaloAndDev](https://github.com/GonzaloAndDev)  
**License / Licencia:** AGPL v3 + Commons Clause  
**Status / Estado:** v1.0 — active development / desarrollo activo

---

## Uso diario / Daily use

Ejecuta estos comandos desde la raiz del repo `TeXisStudio`.

Requisitos base:

- Node.js 20+
- Rust stable (`cargo` y `rustc`)

Preparacion automatica:

| Sistema | Comando |
|---|---|
| Linux/macOS | `bash scripts/bootstrap.sh` |
| Windows | `powershell -ExecutionPolicy Bypass -File scripts\bootstrap-windows.ps1` |

Tambien puedes preparar y ejecutar en un solo paso:

```bash
bash scripts/bootstrap.sh run
bash scripts/bootstrap.sh installer
```

En Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\bootstrap-windows.ps1 -Run
powershell -ExecutionPolicy Bypass -File scripts\bootstrap-windows.ps1 -Installer
```

| Quiero... | Comando | Resultado |
|---|---|---|
| Correr la app | `node scripts/texis.mjs run` | Abre TeXisStudio en modo desarrollo con hot reload. No genera instalador. |
| Generar instalador/paquete | `node scripts/texis.mjs installer` | Genera los artefactos del sistema operativo actual. |
| Verificar solo frontend | `node scripts/texis.mjs frontend-build` | Ejecuta TypeScript + Vite sin compilar app nativa. |

Alias utiles:

- Para correr la app: `dev`, `start`, `app`.
- Para generar instalador/paquete: `build`, `compiler`, `package`, `dist`.

VS Code:

- `Ctrl+Shift+B` debe usarse para **correr la app**.
- Para instalador: `Terminal > Run Task... > TeXisStudio: Build current OS`.

---

## ES — ¿Qué es?

TeXisStudio es una aplicación de escritorio que genera tesis y tesinas académicas de calidad tipográfica institucional (MIT, Oxford, ETH Zürich) usando LaTeX como motor de renderizado. El usuario trabaja con formularios, editores visuales y asistentes — nunca escribe LaTeX directamente.

```
El usuario describe su contenido
        ↓
TeXisStudio genera LaTeX correcto
        ↓
PDF portable y compilable sin la app
```

## EN — What is it?

TeXisStudio is a desktop application that produces academic theses at institutional typographic quality (MIT, Oxford, ETH Zürich) using LaTeX as the rendering engine. The user works with forms, visual editors, and assistants — never writing LaTeX directly.

```
User describes their content
        ↓
TeXisStudio generates correct LaTeX
        ↓
Portable PDF — compilable without the app
```

---

## Ecosystem / Ecosistema de repositorios

| Repo | Description / Descripción |
|---|---|
| **TeXisStudio** ← *this repo* | Tauri app (Rust + React) |
| **[TeXisStudio-Plugins](../TeXisStudio-Plugins/README.md)** | 69 figure plugins — publication-quality LaTeX without writing code · 69 plugins de figuras sin código |
| **[TeXisStudio-Languages](../TeXisStudio-Languages/README.md)** | Downloadable language packs (spelling, grammar, vocabulary) · Paquetes de idioma descargables |
| **[TeXisStudio-Profiles](../TeXisStudio-Profiles/README.md)** | Institutional and discipline profiles · Perfiles institucionales y de disciplina |

---

## Features / Funcionalidades

### Thesis editor / Editor de tesis
- **Block editor** — paragraphs, headings, lists, tables, equations, code, algorithms, theorems  
  **Editor de bloques** — párrafos, títulos, listas, tablas, ecuaciones, código, algoritmos, teoremas
- 14 block types including graduate-level elements (glossary, acronyms, pseudocode)  
  14 tipos de bloque incluyendo elementos de posgrado
- Drag & drop to reorder content / Drag & drop para reordenar contenido
- Auto-save with unsaved-change detection / Guardado automático

### Plugin figures / Figuras generadas por plugins
Integration with **[TeXisStudio-Plugins](../TeXisStudio-Plugins/README.md)**:

- **69 plugins** organised by discipline and quality level (Core / Extended / Experimental)  
  **69 plugins** organizados por disciplina y nivel de calidad
- Insert gallery with full-text search and category / quality filters  
  Galería de inserción con búsqueda y filtros por categoría y calidad
- Edit modal: change title/label or regenerate from saved source  
  Modal de edición: cambiar título/etiqueta o regenerar desde datos guardados
- Required LaTeX packages injected automatically into the preamble  
  Paquetes LaTeX requeridos inyectados automáticamente en el preámbulo
- Figures stored as `source.json` + `output.tex` — re-editable in future sessions  
  Figuras almacenadas como `source.json` + `output.tex` — re-editables

### Bibliography / Bibliografía
- Import by **DOI** (CrossRef + DataCite) · Importación por DOI
- Search in **CrossRef, OpenAlex, Semantic Scholar** · Búsqueda integrada
- **Zotero** integration (local library) · Integración con Zotero
- Export to **BibTeX, CSL-JSON, RIS** · Exportación a múltiples formatos
- Citation types: `\parencite`, `\textcite`, `\footcite` · Tipos de cita

### Compilation / Compilación
- Engines: **latexmk** and **Tectonic** · Motores: latexmk y Tectonic
- Quick compile (active chapter) and full compile (entire thesis)  
  Compilación rápida (capítulo) y completa (tesis entera)
- Diagnostics panel with parsed errors and warnings  
  Panel de diagnósticos con errores parseados
- Automatic toolchain detection (MiKTeX / TeX Live)  
  Detección automática del toolchain instalado

### Spelling & grammar / Ortografía y gramática
- Real-time spell-check (ES / EN / FR / DE) · Ortografía en tiempo real
- **LanguageTool** integration for grammar · Gramática avanzada vía LanguageTool
- Downloadable vocabulary packs from [TeXisStudio-Languages](../TeXisStudio-Languages/README.md)  
  Paquetes de vocabulario especializado descargables

### Other / Otras
- **Institutional profiles** via wizard · Perfiles institucionales via wizard
- **Snapshots** — restore points with labels · Puntos de restauración
- Integrated **AI assistant** (multi-provider) · Asistente de IA integrado
- Final **PDF export** with postflight validation · Exportación final con validación
- **System Doctor** — diagnoses the installed LaTeX environment · Diagnóstico del entorno

---

## Tech stack / Stack técnico

| Layer / Capa | Technology / Tecnología |
|---|---|
| Core | Rust 2021 · `texis-core` |
| Desktop | Tauri v2 · WebView2 |
| Frontend | React 18 · TypeScript 5 · Vite 5 · Zustand 5 |
| Plugins | TypeScript · [TeXisStudio-Plugins](../TeXisStudio-Plugins/README.md) |
| LaTeX | XeLaTeX / pdfLaTeX · latexmk · Tectonic · biber / biblatex |
| Serialisation | serde_yaml |
| Network | reqwest 0.12 · rustls-tls |
| Math preview | KaTeX |
| Templates | MiniJinja v2 |

---

## Code structure / Estructura del código

```
texis-core/                  Rust library — all business logic
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
    visual/                  Legacy native visual blocks

texis-app/                   Tauri app
  src-tauri/src/
    commands/                project, compiler, figure_plugin, bibliography_unified,
                             build, system, ai, template, glossary, package…
    lib.rs                   Handler registration + global state
  src/                       React frontend
    views/                   Editor, Compile, Library, Settings, Home…
    components/              FigurePickerModal, FigureEditModal, Chrome, SpellPanel…
    services/                figure-plugin-service, grammar, spellcheck, AI
    stores/                  Zustand: project, settings, ai, vocabularyPacks
    types.ts                 TypeScript types mirroring Rust structs
```

---

## Block types / Tipos de bloque

| Type / Tipo | Description / Descripción |
|---|---|
| `paragraph` | Text with inline formulas and references / Texto con fórmulas y referencias |
| `heading` | Section / subsection / subsubsection |
| `equation` | Numbered or display equation / Ecuación numerada |
| `figure` | Imported image (PNG, JPG, SVG, PDF) / Imagen importada |
| `plugin_figure` | **Auto-generated figure** from plugin catalog / **Figura generada** por plugin |
| `table` | Table with booktabs styling / Tabla con estilo booktabs |
| `list` | Itemize / enumerate / description |
| `citation` | Parenthetical, narrative, or footnote citation / Cita bibliográfica |
| `raw_latex` | Manual LaTeX (requires explicit user confirmation) / LaTeX manual |
| `code` | Source code with syntax highlighting / Código con resaltado |
| `algorithm` | Pseudocode (`algpseudocode`) / Pseudocódigo |
| `theorem` | amsthm — theorem, lemma, corollary, definition, proof, remark |
| `glossary_entry` | Term + definition / Término + definición |
| `acronym_entry` | Acronym + full form / Acrónimo + forma completa |

---

## Development / Desarrollo

### Comandos definitivos

La tabla de uso diario esta al inicio del README. Resumen tecnico:

| Necesidad | Comando | Resultado |
|---|---|---|
| Correr la app para desarrollar | `node scripts/texis.mjs run` | Abre TeXisStudio en modo Tauri dev con hot reload. No genera instalador. |
| Verificar solo frontend | `node scripts/texis.mjs frontend-build` | Ejecuta TypeScript + Vite. Rapido; sirve para revisar UI. No genera app nativa ni instalador. |
| Generar build/instalador del SO actual | `node scripts/texis.mjs installer` | Detecta Windows/macOS/Linux y ejecuta el script nativo correspondiente. Genera instaladores/paquetes. |
| Probar core Rust | `cargo test -p texis-core` | Ejecuta tests de generacion LaTeX, compilacion, bibliografia, snapshots y modelos. |

Alias utiles: `dev`, `start` y `app` hacen lo mismo que `run`; `build`, `compiler`, `package` y `dist` hacen lo mismo que `installer`.

### VS Code

`Ctrl+Shift+B` ejecuta la tarea default **TeXisStudio: Run app**. Es equivalente a:

```bash
node scripts/texis.mjs run
```

Por tanto, `Ctrl+Shift+B` es para correr y probar la app, no para generar instalador.

Para generar instalador desde VS Code usa:

1. `Terminal > Run Task...`
2. `TeXisStudio: Build current OS`

### Salidas por sistema operativo

`node scripts/texis.mjs build` genera artefactos segun el equipo donde se ejecute:

| Sistema | Script usado | Salida esperada |
|---|---|---|
| Windows | `scripts/build-windows.ps1` | MSI, NSIS `.exe` y ZIP portable en `target/release/bundle/` |
| macOS | `scripts/build-mac.sh` | DMG/app universal en `target/universal-apple-darwin/release/bundle/` |
| Linux | `scripts/build-linux.sh` | `.deb`, `.rpm` y AppImage en `target/release/bundle/` |

Requisitos generales: Rust stable, Node.js 20+, MiKTeX o TeX Live para compilar documentos LaTeX. En Windows se requiere WebView2; el instalador lo maneja via Tauri. En macOS se requieren Xcode Command Line Tools. En Linux el script intenta instalar dependencias WebKit/GTK con el gestor de paquetes disponible.

En Linux/macOS, si el comando falla con `node: command not found`, `cargo: command not found` o dependencias WebKit/GTK faltantes, prepara el sistema con:

```bash
bash scripts/bootstrap.sh
```

En Windows usa:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\bootstrap-windows.ps1
```

### Distribucion para usuarios finales

Para un usuario no tecnico, la distribucion recomendada es entregar un instalador por sistema operativo y pedir solo una suite LaTeX aparte:

| Usuario final | Artefacto recomendado | Nota |
|---|---|---|
| Windows | NSIS `.exe` | Opcion mas familiar: descargar, doble clic, instalar. |
| Windows avanzado/portable | ZIP portable | Util para pruebas o equipos sin instalacion formal. |
| macOS | `.dmg` | Instalacion tipo arrastrar a Applications. Sin firma Apple puede mostrar advertencia. |
| Debian/Ubuntu | `.deb` | Instalacion nativa con el gestor del sistema. |
| Fedora/RHEL | `.rpm` | Instalacion nativa con el gestor del sistema. |
| Linux general | AppImage | Opcion portable cuando no se quiere paquete por distro. |

No se espera que una sola maquina local genere profesionalmente todos los instaladores. La regla operativa es:

- En local: `node scripts/texis.mjs build` genera el instalador del SO actual.
- Para publicar todos los SO soportados: usar GitHub Actions con `.github/workflows/release.yml`.

Publicacion completa desde GitHub:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Al subir un tag `v*`, GitHub Actions compila en runners Windows, Linux y macOS, y publica una GitHub Release con MSI, NSIS `.exe`, ZIP portable, `.deb`, `.rpm`, AppImage y DMG.

Para probar el pipeline sin publicar release, ejecuta manualmente el workflow **Build & Release** desde la pestaña **Actions** de GitHub. Eso genera artefactos descargables del workflow, pero no crea release publica si no hay tag.

---

## How the repos fit together / Cómo encajan los repos

```
TeXisStudio (this repo / este repo)
├── texis-core  ← generates LaTeX / genera el LaTeX
├── texis-app   ← Tauri UI + plugin integration / integración con plugins
│
└── imports at runtime ←──────────────────────────────────────────┐
                                                                    │
TeXisStudio-Plugins                                                 │
├── 35 official-core plugins (math, physics, chemistry…)           │
├── 25 official-extended plugins                                    │
├── 10 experimental plugins                                         │
└── 12 rendering engines (TikZ, PGFPlots, CircuiTikZ, ChemFig…)  │
    ↑ loaded via Vite alias @texisstudio/plugins ──────────────────┘

TeXisStudio-Languages
└── dictionaries + grammar packs ← downloaded on demand

TeXisStudio-Profiles
└── institutional templates ← downloaded when creating a project
```
