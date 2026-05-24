# TeXisStudio

Editor profesional de tesis con LaTeX — sin necesitar aprender LaTeX directamente.

**Autor:** Gonzalo Andrade Estrella · [@GonzaloAndDev](https://github.com/GonzaloAndDev)  
**Licencia:** AGPL v3 + Commons Clause  
**Estado:** v1.0.0 — Release oficial  

---

## Qué es

TeXisStudio permite a estudiantes elaborar tesis y tesinas de alta calidad tipográfica usando LaTeX como motor, sin exponer la complejidad de LaTeX al usuario. El usuario edita un modelo estructurado; el sistema genera LaTeX limpio; el PDF es portable y compilable sin la app.

```
El usuario edita en content/
El sistema genera LaTeX en build/
El PDF es portable — compilable sin la app
```

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Core | Rust (Edition 2021) · `texis-core 1.0.0` |
| CLI | Rust · `texis-cli` · clap v4 |
| Desktop | Tauri v2 · WebView2 (Windows) |
| Frontend | React 18 · TypeScript 5 · Vite 5 |
| Templates | MiniJinja v2 |
| LaTeX | XeLaTeX · latexmk · tectonic · biber · biblatex |
| Serialización | serde_yaml (aislado en `loader.rs`) |
| Red | reqwest 0.12 · rustls-tls · zip 2 |
| Estado UI | Zustand 5 |
| Fuentes | Newsreader · Geist · JetBrains Mono |

---

## Estructura del workspace

```
TeXisStudio/
├── texis-core/          # Librería Rust — lógica de negocio completa
├── texis-cli/           # Binario `texis` — interfaz de terminal
├── texis-app/
│   ├── src/             # Frontend TypeScript (React + Vite)
│   ├── src-tauri/       # Backend Tauri (Rust) — comandos delgados
│   └── design/          # Mockups JSX de referencia (no van a producción)
├── profiles/            # Perfiles YAML (generic.thesis, generic.tesina, y otros)
├── schemas/             # JSON Schema (project, profile, element, block, manifest)
├── CHANGELOG.md         # Historial completo de versiones
└── docs/
```

---

## Lo que está implementado — v1.0.0

### Core Rust (`texis-core`)
- **`ProjectModel`** — modelo de datos completo con round-trip serde YAML verificado
- **`latex_escape`** — escaping explícito de contenido de usuario (13 unit tests)
- **`TemplateEngine`** — MiniJinja v2 con filtros `latex_escape` y `raw`
- **`CompilationBackend`** — trait con `LatexmkBackend` y `TectonicBackend`; modo `auto`
- **`Validator`** — validaciones académicas y técnicas (imágenes, bib, labels duplicados)
- **`BibParser`** — parser BibTeX con extracción balanceada de llaves/comillas
- **`ProfileLoader` / `ProfileSaver`** — perfiles YAML con serialización completa
- **`schema/versions`** — schema 1.0.0 congelado; política de breaking changes documentada
- **`schema/migrator`** — migración automática `0.1.0 → 1.0.0` al cargar proyectos legacy
- **30 tests verdes** · snapshot tests con `insta` (main.tex + secciones)

### CLI (`texis-cli`)
- Subcomandos: `new`, `compile`, `validate`, `export`, `import`, `list-profiles`

### App de escritorio (`texis-app`)
- **HomeView** — proyectos recientes, sidebar, banner de advertencia si no hay LaTeX
- **EditorView** — 8 tipos de bloque, drag & drop, autoguardado, `Ctrl+S`
- **CommandPalette** (`Ctrl+K`) — insertar bloques y saltar secciones con búsqueda fuzzy
- **CitationPicker** (`Ctrl+[`) — insertar citas desde `.bib` con toggle parenthetical/narrative
- **WizardView** — asistente de 4 pasos para crear proyecto con selección de perfil
- **LibraryView** — editor de perfiles (CRUD), catálogo de elementos, instalación remota desde URL/ZIP
- **SetupLatexView** — detección automática de backends y guía de instalación
- **AboutView** — autoría, licencia, stack, roadmap completo

---

## Distribución — instaladores y portable

Los instaladores se generan con un solo comando desde la plataforma correspondiente.
En CI/CD (GitHub Actions) se construyen automáticamente al publicar un tag `v*`.

| Plataforma | Formato | Cómo instalar |
|---|---|---|
| Windows | `.msi` | doble clic — instalador nativo Windows |
| Windows | `-setup.exe` | doble clic — alternativo (NSIS) |
| Windows | `_portable.zip` | extraer y ejecutar `TeXisStudio.exe` directamente |
| Debian / Ubuntu | `.deb` | `sudo dpkg -i TeXisStudio.deb` |
| Fedora / RHEL | `.rpm` | `sudo rpm -i TeXisStudio.rpm` |
| Linux (cualquier) | `.AppImage` | `chmod +x TeXisStudio.AppImage && ./TeXisStudio.AppImage` |
| macOS | `.dmg` | arrastrar a Aplicaciones — universal Intel + Apple Silicon |

### Prerrequisitos por sistema

| Sistema | Requisito | Cómo obtenerlo |
|---|---|---|
| **Todos** | Rust stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **Todos** | Node.js 18+ | [nodejs.org](https://nodejs.org) |
| Windows | WiX Toolset (MSI) | Tauri lo instala automáticamente si falta |
| Windows | Strawberry Perl (latexmk) | [strawberryperl.com](https://strawberryperl.com) |
| Debian/Ubuntu | `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `patchelf` | El script los instala con `apt-get` |
| Fedora/RHEL | `webkit2gtk4.1-devel`, `gtk3-devel`, `libappindicator-gtk3-devel`, `patchelf` | El script los instala con `dnf` |
| macOS | Xcode Command Line Tools | `xcode-select --install` |
| macOS | Targets Rust universales | El script los añade con `rustup target add` |

### Build local

### Uso desde VS Code

El repositorio incluye tareas en `.vscode/tasks.json` para trabajar sin salir de VS Code.
Abre la carpeta **TeXisStudio** como raíz del workspace para que `Ctrl+Shift+B`
use estas tareas y no las tareas sugeridas por extensiones externas.

| Acción | VS Code | Comando equivalente |
|---|---|---|
| Ejecutar la app en modo desarrollo | `Terminal → Run Task → TeXisStudio: Run app` | `cd texis-app && npm run tauri dev` |
| Compilar para el sistema operativo actual | `Terminal → Run Task → TeXisStudio: Build current OS` | `node scripts/texis.mjs build` |
| Validar solo el frontend | `Terminal → Run Task → TeXisStudio: Build frontend only` | `cd texis-app && npm run build` |

El comando `build` detecta el sistema operativo automáticamente:

- Windows → `scripts/build-windows.ps1`
- Linux → `scripts/build-linux.sh`
- macOS → `scripts/build-mac.sh`

El helper imprime en terminal el contexto de compilación, la hora de inicio,
la hora de finalización y la duración total del build.

> Para abrir rápido la tarea por defecto en VS Code usa `Ctrl+Shift+B`.
> Si VS Code pide instalar OpenJDK/Red Hat, cancela: TeXisStudio no usa Java.
> Ese aviso viene de una extensión Java, no del build de la app.

```powershell
# Windows → genera MSI + NSIS + portable ZIP en target\release\bundle\
.\scripts\build-windows.ps1
```

```bash
# Linux → genera .deb + .rpm + .AppImage en target/release/bundle/
# Detecta automáticamente apt (Debian/Ubuntu), dnf (Fedora), pacman (Arch)
bash scripts/build-linux.sh

# macOS → genera DMG universal (Intel + Apple Silicon) en
# target/universal-apple-darwin/release/bundle/dmg/
bash scripts/build-mac.sh
```

### Release automática (GitHub Actions)

Al hacer `git push origin main --tags`, el workflow `.github/workflows/release.yml`
construye en paralelo para Windows, Linux y macOS y publica todos los artefactos
en la release de GitHub sin intervención manual.

> **Nota sobre firma de código:** sin certificado de firma, Windows SmartScreen
> y macOS Gatekeeper muestran una advertencia al ejecutar por primera vez.
> En Windows: *Más información → Ejecutar de todas formas*.
> En macOS: *clic derecho → Abrir → Abrir de todas formas*.

---

## Requisitos del sistema

| Componente | Versión mínima |
|---|---|
| Rust | 1.75+ |
| Node.js | 18+ |
| MiKTeX o TeX Live | 2024+ (opcional — Tectonic es alternativa sin instalación) |
| Strawberry Perl | Cualquiera (necesario para latexmk en Windows) |
| WebView2 | Incluido en Windows 10/11 |

---

## Correr en desarrollo

```bash
# Tests y lint del workspace Rust
cargo test --workspace
cargo clippy --workspace -- -D warnings

# App de escritorio (primera vez ~10 min de compilación)
cd texis-app
npm install
npm run tauri dev

# Solo frontend en browser (sin Tauri)
npm run dev   # → http://localhost:1420
# Navegar a /demo para ver el editor con datos de prueba
```

---

## Principios de arquitectura (no negociables)

1. `content/` es la fuente de verdad. `build/` es output regenerable.
2. `texis-core` no depende de UI, Tauri ni APIs no portables.
3. Todo contenido de usuario pasa por `latex_escape` antes de tocar una plantilla.
4. `serde_yaml` solo aparece en archivos `loader.rs`.
5. `CompilationBackend` es un trait — agregar backend no modifica código existente.
6. Variables no se llaman `gen` (reservado en Rust Edition 2024).
7. Tauri commands son thin wrappers — toda la lógica vive en `texis-core`.
8. Un cambio al generador que altera el output LaTeX falla en snapshot tests.
9. Schema congelado en 1.0.0 — cambios breaking requieren versión Major + migrador explícito.

---

*TeXisStudio — desarrollado originalmente por Gonzalo Andrade Estrella*
