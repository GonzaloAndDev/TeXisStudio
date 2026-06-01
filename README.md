# TeXisStudio

Write your thesis at publication quality without learning LaTeX.

Author: Gonzalo Andrade Estrella, [@GonzaloAndDev](https://github.com/GonzaloAndDev)
License: AGPL v3 + Commons Clause
Status: v1.0, active development

---

## English

### Definitive Build Flow

Run commands from the repository root, `TeXisStudio`.

First time on a machine, or after missing dependency errors:

| System | Run app | Build installer | Check frontend |
|---|---|---|---|
| Linux/macOS | `./run` | `./build` | `./check` |
| Windows | `.\run.ps1` | `.\build.ps1` | `.\check.ps1` |

After the machine is prepared:

| Need | Command | Result |
|---|---|---|
| Run the app | `./run` or `.\run.ps1` | Opens TeXisStudio in Tauri dev mode with hot reload. It does not create an installer. |
| Build installer/package | `./build` or `.\build.ps1` | Builds artifacts for the current operating system. |
| Check frontend only | `./check` or `.\check.ps1` | Runs TypeScript and Vite without compiling the native app. |
| Test Rust core | `cargo test -p texis-core` | Runs core tests for LaTeX generation, compilation, bibliography, snapshots, and models. |

Aliases:

- Run app: `dev`, `start`, `app`.
- Build installer/package: `build`, `compiler`, `package`, `dist`.
- Frontend check: `check`, `frontend`.

VS Code:

- Recommended: open `TeXisStudio.code-workspace`, not a parent folder. The workspace pins the TeXisStudio tasks and disables unrelated auto-detected build tasks.
- `Ctrl+Shift+B` runs **TeXisStudio: Run app**. It uses the bootstrap task, so the first run can install or verify dependencies; later runs skip work that is already done.
- To build an installer, use `Terminal > Run Task... > TeXisStudio: Build current OS`.

Local build outputs:

| System | Script | Expected output |
|---|---|---|
| Windows | `scripts/build-windows.ps1` | MSI, NSIS `.exe`, and portable ZIP in `target/release/bundle/`. |
| macOS | `scripts/build-mac.sh` | Universal DMG/app in `target/universal-apple-darwin/release/bundle/`. |
| Linux | `scripts/build-linux.sh` | `.deb`, `.rpm`, and AppImage in `target/release/bundle/`. |

The bootstrap scripts are idempotent: Node, Rust, native packages, and npm dependencies are installed only when missing or stale. Normal development runs should not reinstall everything.

One local machine is not expected to build every professional installer. For all supported systems, use GitHub Actions:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Pushing a `v*` tag runs `.github/workflows/release.yml` on Windows, Linux, and macOS runners, then publishes a GitHub Release with MSI, NSIS `.exe`, portable ZIP, `.deb`, `.rpm`, AppImage, and DMG.

To test the pipeline without publishing a release, run **Build & Release** manually from the GitHub Actions tab.

### What TeXisStudio Is

TeXisStudio is a desktop application for producing academic theses and dissertations with institutional typographic quality using LaTeX as the rendering engine. Users work with forms, visual editors, and assistants instead of writing LaTeX directly.

```text
User describes the content
        ↓
TeXisStudio generates correct LaTeX
        ↓
Portable PDF, compilable without the app
```

### Repository Ecosystem

| Repository | Purpose |
|---|---|
| **TeXisStudio** | This repository. Tauri desktop app, Rust core, React frontend, and packaging scripts. |
| **[TeXisStudio-Plugins](../TeXisStudio-Plugins/README.md)** | Figure plugins for publication-quality LaTeX output without writing figure code. |
| **[TeXisStudio-Languages](../TeXisStudio-Languages/README.md)** | Downloadable spelling, grammar, and specialized vocabulary packs. |
| **[TeXisStudio-Profiles](../TeXisStudio-Profiles/README.md)** | Institutional and discipline profiles, templates, and project samples. |

### Main Features

- Thesis block editor for paragraphs, headings, lists, tables, equations, code, algorithms, theorems, glossary entries, and acronyms.
- Plugin-generated figures with search, filters, editable source data, and automatic LaTeX package injection.
- Bibliography tools for DOI import, CrossRef, DataCite, OpenAlex, Semantic Scholar, Zotero, BibTeX, CSL-JSON, and RIS.
- Compilation through `latexmk` and Tectonic, with diagnostics and toolchain detection.
- Spell-checking and grammar integrations for ES, EN, FR, and DE.
- Institutional profile wizard, snapshots, AI assistant, final PDF export, and system doctor.

### Tech Stack

| Layer | Technology |
|---|---|
| Core | Rust 2021, `texis-core` |
| Desktop | Tauri v2, WebView2 on Windows |
| Frontend | React 18, TypeScript 5, Vite 5, Zustand 5 |
| Plugins | TypeScript, `TeXisStudio-Plugins` |
| LaTeX | XeLaTeX, pdfLaTeX, latexmk, Tectonic, biber, biblatex |
| Serialization | serde_yaml |
| Network | reqwest 0.12, rustls-tls |
| Math preview | KaTeX |
| Templates | MiniJinja v2 |

### Code Structure

```text
texis-core/
  src/
    project/
    generator/
    compiler/
    bibliography/
    build_engine/
    template_engine/
    validator/
    asset/
    plugin/
    postflight/
    visual/

texis-app/
  src-tauri/src/
    commands/
    lib.rs
  src/
    views/
    components/
    services/
    stores/
    types.ts
```

---

## Español

Escribe tu tesis con calidad de publicación sin aprender LaTeX.

Autor: Gonzalo Andrade Estrella, [@GonzaloAndDev](https://github.com/GonzaloAndDev)
Licencia: AGPL v3 + Commons Clause
Estado: v1.0, desarrollo activo

### Flujo Definitivo De Compilación

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
| Generar instalador/paquete | `./build` o `.\build.ps1` | Genera artefactos para el sistema operativo actual. |
| Revisar solo frontend | `./check` o `.\check.ps1` | Ejecuta TypeScript y Vite sin compilar la app nativa. |
| Probar core Rust | `cargo test -p texis-core` | Ejecuta pruebas del core de generación LaTeX, compilación, bibliografía, snapshots y modelos. |

Alias:

- Correr app: `dev`, `start`, `app`.
- Generar instalador/paquete: `build`, `compiler`, `package`, `dist`.
- Revisar frontend: `check`, `frontend`.

VS Code:

- Recomendado: abre `TeXisStudio.code-workspace`, no una carpeta padre. El workspace fija las tareas de TeXisStudio y desactiva tareas detectadas automáticamente que no corresponden.
- `Ctrl+Shift+B` ejecuta **TeXisStudio: Run app**. Usa bootstrap, así que la primera ejecución puede instalar o verificar dependencias; las siguientes omiten lo que ya esté listo.
- Para generar instalador usa `Terminal > Run Task... > TeXisStudio: Build current OS`.

Salidas locales:

| Sistema | Script | Salida esperada |
|---|---|---|
| Windows | `scripts/build-windows.ps1` | MSI, `.exe` NSIS y ZIP portable en `target/release/bundle/`. |
| macOS | `scripts/build-mac.sh` | DMG/app universal en `target/universal-apple-darwin/release/bundle/`. |
| Linux | `scripts/build-linux.sh` | `.deb`, `.rpm` y AppImage en `target/release/bundle/`. |

Los scripts bootstrap son idempotentes: Node, Rust, paquetes nativos y dependencias npm se instalan solo cuando faltan o están desactualizados. Las ejecuciones normales de desarrollo no deberían reinstalar todo.

No se espera que una sola máquina local genere todos los instaladores profesionales. Para todos los sistemas soportados, usa GitHub Actions:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Al subir un tag `v*`, `.github/workflows/release.yml` compila en runners Windows, Linux y macOS, y publica una GitHub Release con MSI, `.exe` NSIS, ZIP portable, `.deb`, `.rpm`, AppImage y DMG.

Para probar el pipeline sin publicar release, ejecuta manualmente **Build & Release** desde la pestaña Actions de GitHub.

### Qué Es TeXisStudio

TeXisStudio es una aplicación de escritorio para producir tesis y tesinas académicas con calidad tipográfica institucional usando LaTeX como motor. El usuario trabaja con formularios, editores visuales y asistentes en lugar de escribir LaTeX directamente.

```text
El usuario describe el contenido
        ↓
TeXisStudio genera LaTeX correcto
        ↓
PDF portable, compilable sin la app
```

### Ecosistema De Repositorios

| Repositorio | Propósito |
|---|---|
| **TeXisStudio** | Este repositorio. App de escritorio Tauri, core Rust, frontend React y scripts de empaquetado. |
| **[TeXisStudio-Plugins](../TeXisStudio-Plugins/README.md)** | Plugins de figuras para generar LaTeX de calidad editorial sin escribir código de figuras. |
| **[TeXisStudio-Languages](../TeXisStudio-Languages/README.md)** | Paquetes descargables de ortografía, gramática y vocabulario especializado. |
| **[TeXisStudio-Profiles](../TeXisStudio-Profiles/README.md)** | Perfiles institucionales y disciplinares, plantillas y proyectos de ejemplo. |

### Funcionalidades Principales

- Editor de bloques para párrafos, títulos, listas, tablas, ecuaciones, código, algoritmos, teoremas, glosario y acrónimos.
- Figuras generadas por plugins con búsqueda, filtros, datos fuente editables e inyección automática de paquetes LaTeX.
- Bibliografía con DOI, CrossRef, DataCite, OpenAlex, Semantic Scholar, Zotero, BibTeX, CSL-JSON y RIS.
- Compilación con `latexmk` y Tectonic, diagnósticos y detección del toolchain.
- Ortografía y gramática para ES, EN, FR y DE.
- Wizard de perfiles institucionales, snapshots, asistente de IA, exportación final a PDF y diagnóstico del sistema.

### Stack Técnico

| Capa | Tecnología |
|---|---|
| Core | Rust 2021, `texis-core` |
| Escritorio | Tauri v2, WebView2 en Windows |
| Frontend | React 18, TypeScript 5, Vite 5, Zustand 5 |
| Plugins | TypeScript, `TeXisStudio-Plugins` |
| LaTeX | XeLaTeX, pdfLaTeX, latexmk, Tectonic, biber, biblatex |
| Serialización | serde_yaml |
| Red | reqwest 0.12, rustls-tls |
| Vista previa matemática | KaTeX |
| Plantillas | MiniJinja v2 |
