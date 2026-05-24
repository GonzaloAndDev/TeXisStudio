# TeXisStudio

Editor profesional de tesis con LaTeX — sin necesitar aprender LaTeX directamente.

**Autor:** Gonzalo Andrade Estrella · [@GonzaloAndDev](https://github.com/GonzaloAndDev)  
**Licencia:** AGPL v3 + Commons Clause  
**Estado:** v1.0.0 — Release oficial (features de escritorio activas)

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
| Matemáticas | KaTeX (renderizado en tiempo real) |
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

## Lo que está implementado

### Core Rust (`texis-core`) — 56 tests verdes

- **`ProjectModel`** — modelo de datos completo con round-trip serde YAML verificado
- **`SectionStatus`** — estado editorial por sección: `draft | in_review | revised | approved`
- **`LatexTypography`** — ajustes tipográficos opcionales: fuente base, papel, interlineado, márgenes
- **`latex_escape`** — escaping explícito de contenido de usuario (13 unit tests)
- **`TemplateEngine`** — MiniJinja v2 con filtros `latex_escape` y `raw`
- **`CompilationBackend`** — trait con `LatexmkBackend` y `TectonicBackend`; modo `auto`
- **`Validator`** — validaciones académicas, técnicas y bibliográficas cruzadas (E_CITATION_KEY_NOT_IN_BIB, W_UNUSED_REFERENCE)
- **`BibParser`** — parser BibTeX con extracción balanceada de llaves/comillas
- **`ProfileLoader` / `ProfileSaver`** — perfiles YAML con serialización completa
- **`schema/versions`** — schema 1.0.0 congelado; política de breaking changes documentada
- **`schema/migrator`** — migración automática `0.1.0 → 1.0.0` al cargar proyectos legacy
- **Snapshot tests** con `insta` (main.tex + secciones)

### CLI (`texis-cli`)

- Subcomandos: `new`, `compile`, `validate`, `export`, `import`, `list-profiles`

### App de escritorio (`texis-app`)

#### Editor
- **EditorView** — 8 tipos de bloque (párrafo, título, lista, ecuación, figura, tabla, cita, LaTeX directo), drag & drop, autoguardado, `Ctrl+S`
- **KaTeX** — previsualización de ecuaciones LaTeX en tiempo real dentro del editor
- **CommandPalette** (`Ctrl+K`) — insertar bloques y saltar secciones con búsqueda fuzzy
- **CitationPicker** (`Ctrl+[`) — insertar citas desde `.bib` con toggle parenthetical/narrative/footnote
- **Estado editorial por sección** — badge `Borrador → En revisión → Revisado → Aprobado` con punto de color en el árbol y notas internas no incluidas en el PDF
- **Navigation guard** — modal de confirmación al navegar con cambios sin guardar; `beforeunload` protege el cierre accidental
- **Versiones (snapshots)** — panel lateral para crear, restaurar y eliminar snapshots nombrados; backup automático antes de restaurar
- **Opciones tipográficas** — panel ⚙ para fuente base (10/11/12pt), tamaño de papel (A4/Carta), interlineado (1x/1.5x/2x) y márgenes (1.5–4.0 cm slider)

#### Compilación y entrega
- **CompileView** — compilación con streaming de log en tiempo real, cancelación, visor de PDF embebido, selección de backend (latexmk / tectonic / auto)
- **Timeout de 5 min** con `tokio::time::timeout` + `AtomicBool` para cancelación limpia
- **Validación bibliográfica cruzada** — citas contra `.bib` antes de compilar
- **Paquete de entrega final** — genera un ZIP con PDF + fuentes LaTeX + contenido + informe de validación + README

#### Gestión de perfiles y proyectos
- **WizardView** — asistente de 4 pasos para crear proyecto desde un perfil real
- **ProfileWizardView** — asistente para crear perfiles personalizados con catálogo de secciones
- **LibraryView** — editor de perfiles (CRUD), catálogo de elementos, instalación remota desde URL/ZIP
- **HomeView** — proyectos recientes, cloud folders (OneDrive/Google Drive/Dropbox), banner de advertencia si no hay LaTeX
- **SetupLatexView** — detección automática de backends y guía de instalación

---

## Comandos Tauri disponibles

| Comando | Descripción |
|---|---|
| `create_project` | Crea proyecto desde perfil real |
| `get_project` / `save_project` / `save_section` | CRUD de proyectos |
| `list_recent_projects` | Lista proyectos recientes |
| `validate_project` | Validación académica + técnica + bibliográfica |
| `compile_project` / `cancel_compile` | Compilación con streaming y cancelación |
| `create_snapshot` / `list_snapshots` / `restore_snapshot` / `delete_snapshot` | Control de versiones |
| `update_section_meta` | Actualiza estado y notas de una sección |
| `update_typography` | Actualiza ajustes tipográficos del proyecto |
| `export_delivery` | Genera ZIP de entrega final |
| `get_profiles` / `get_profile_detail` / `create_profile` / `update_profile` / `delete_profile` | Gestión de perfiles |
| `import_profile` / `export_profile` / `fetch_remote_profile` | Intercambio de perfiles |
| `list_references` | Extrae referencias del `.bib` del proyecto |
| `detect_latex` / `get_cloud_folders` | Información del sistema |

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

#### Uso desde VS Code

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

> Para abrir rápido la tarea por defecto en VS Code usa `Ctrl+Shift+B`.

```powershell
# Windows → genera MSI + NSIS + portable ZIP en target\release\bundle\
.\scripts\build-windows.ps1
```

```bash
# Linux → genera .deb + .rpm + .AppImage en target/release/bundle/
bash scripts/build-linux.sh

# macOS → genera DMG universal (Intel + Apple Silicon)
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
10. Campos nuevos en modelos persistidos usan `#[serde(default)]` para retrocompatibilidad.

---

*TeXisStudio — desarrollado originalmente por Gonzalo Andrade Estrella*
