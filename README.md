# TeXisStudio

Editor profesional de tesis con LaTeX — sin necesitar aprender LaTeX directamente.

**Autor:** Gonzalo Andrade Estrella · [@GonzaloAndDev](https://github.com/GonzaloAndDev)  
**Licencia:** AGPL v3 + Commons Clause *(pendiente revisión legal)*  
**Estado:** Release 0.3 beta

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
| Core | Rust (Edition 2021) · `texis-core` |
| CLI | Rust · `texis-cli` · clap v4 |
| Desktop | Tauri v2 · WebView2 (Windows) |
| Frontend | React 18 · TypeScript · Vite 5 |
| Templates | MiniJinja v2 |
| LaTeX | XeLaTeX · latexmk · biber · biblatex |
| Serialización | serde_yaml (solo en `loader.rs`) |
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
├── profiles/            # Perfiles YAML (generic.thesis, generic.tesina)
├── schemas/             # JSON Schema v0.1.0 (project, profile, element, block, manifest)
└── docs/
```

---

## Lo que está implementado

### Release 0.1 — Core técnico ✅

- **`texis-core`**: generador LaTeX completo con `\frontmatter/\mainmatter/\backmatter`
- **`latex_escape`**: escaping explícito de todo contenido de usuario (13 unit tests)
- **`TemplateEngine`**: MiniJinja v2 con filtros `latex_escape` y `raw`
- **`CompilationBackend`**: trait desde el día 1; `LatexmkBackend` funcional, `TectonicBackend` stub tipado
- **`Validator`**: validaciones académicas (título, autor) y técnicas (imágenes, bib, labels duplicados)
- **`ProjectModel`** + **`ContentBlock`**: round-trip serde YAML verificado
- **`texis-cli`**: comandos `create`, `validate`, `compile`, `export`, `import`
- **29 tests verdes** · **`cargo clippy -D warnings` = 0 warnings**
- **Snapshot tests** con `insta` (main.tex + sección introduction)
- **Schemas JSON Schema v0.1.0**: project, profile, element, manifest, block
- **Perfiles**: `generic.thesis` y `generic.tesina` en YAML
- **`Cargo.lock` versionado** (distribuye binarios)

### Release 0.2 — App de escritorio ~80% ✅

**Backend Tauri (`src-tauri/`):**
- `create_project` — crea proyecto, estructura de dirs, .gitignore, README-compilacion.txt
- `get_project` — carga `tesis.project.yaml`
- `list_recent_projects` — escanea directorio buscando proyectos
- `save_section` — guarda bloques de una sección y regenera build/
- `save_project` — guarda modelo completo (metadatos) y regenera build/
- `validate_project` — devuelve reporte de issues con sugerencias
- `compile_project` — latexmk + traduce errores a lenguaje humano
- `get_profiles` — lista perfiles disponibles
- `detect_latex` — detecta latexmk, xelatex, biber, versión TeX Live

**Frontend (`src/`):**
- **HomeView** (`/`): proyectos recientes, sidebar, estado LaTeX en statusbar
- **WizardView** (`/new`): 3 pasos — tipo de documento → datos → perfil; campo de carpeta destino editable
- **EditorView** (`/project/:id`): editor de bloques completo
  - 8 tipos de bloque: Párrafo, Título, Lista, Ecuación, Figura, Tabla, Cita, LaTeX raw
  - Edición inline con autoFocus, Esc para cancelar, Enter en lista = nuevo ítem
  - Auto-guardado debounce 1.5s → `save_section`
  - `Ctrl+S` / `Cmd+S` → guardar inmediato
  - Panel de metadatos editable: título, subtítulo, autor, asesor, institución, facultad, ciudad, año
  - Árbol de secciones agrupado por placement (frontmatter / body / backmatter / appendix)
  - Conteo de palabras en tiempo real
- **CompileView** (`/project/:id/compile`): errores traducidos con sugerencias + log crudo latexmk
- **LibraryView** (`/library`): perfiles instalados + próximamente, buscador
- **AboutView** (`/about`): autoría, licencia, stack, roadmap

**Sistema de diseño:**
- Tokens CSS en `tokens.css`: paleta papel/tinta, acento sienna `#B5532D`
- Modo claro y oscuro con `[data-theme="dark"]`
- Fuentes: Newsreader (display/serif) · Geist (UI sans) · JetBrains Mono

---

## Lo que falta (pendiente)

### Para completar Release 0.2
- [ ] Probar flujo completo nativo: crear proyecto → editar → compilar PDF real
- [ ] Depurar bugs que aparezcan en uso real con Tauri nativo
- [ ] Iconos de la app reales (actualmente placeholders 1×1 px)  
  `cd texis-app && npx tauri icon ruta/icono.png`
- [ ] `npm run tauri build` — generar instalador `.exe` distribuible

### Release 0.3 — Perfiles desde la UI ✅
- [x] ProfileRegistry wired — `get_profiles` carga desde `profiles/` en disco (prod: bundle, dev: workspace)
- [x] Importar/exportar `.texisprofile` — diálogo nativo, copia a directorio de perfiles
- [x] Perfiles adicionales: `apa.basic`, `vancouver.health`, `engineering.basic`, `company.internship`
- [x] Catálogo de elementos en LibraryView — 8 tipos de bloque con descripción y salida LaTeX
- [x] Panel de detalle de perfil — secciones, especificaciones técnicas, acciones
- [x] WizardView carga perfiles desde API + preview de secciones al seleccionar
- [x] `ProfileInfo` extendido: `sections`, `sections_count`, `author`, `version`, `license`
- [ ] Editor visual de perfiles (estructura de secciones, estilo bib) — Release 0.4

### Release 0.4 — Instalación LaTeX
- [ ] Asistente de instalación de LaTeX dentro de la app
- [ ] `TectonicBackend` funcional (sin instalar TeX Live)

### Release 0.5 — Biblioteca comunitaria
- [ ] Biblioteca remota de perfiles comunitarios
- [ ] Publicar y descargar perfiles institucionales

### Release 0.6 — Editor avanzado
- [ ] Drag & drop de bloques para reordenarlos
- [ ] Toolbar académico avanzado (citas mientras se escribe, etc.)

### Release 1.0 — Producción
- [ ] Schema 1.0.0 congelado definitivamente
- [ ] Instaladores firmados (Windows, macOS, Linux)
- [ ] Documentación completa
- [ ] Revisión legal de licencia finalizada

---

## Requisitos del sistema

| Componente | Versión mínima |
|---|---|
| Rust | 1.75+ |
| Node.js | 18+ |
| MiKTeX o TeX Live | 2024+ |
| Strawberry Perl | Cualquiera (necesario para latexmk en Windows) |
| WebView2 | Incluido en Windows 10/11 |

---

## Correr en desarrollo

```bash
# Backend Rust (core + CLI)
cargo test --workspace
cargo clippy --workspace -- -D warnings

# App de escritorio (primera vez ~10 min)
cd texis-app
npm install
npm run tauri dev

# Solo frontend en browser
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

---

*TeXisStudio — desarrollado originalmente por Gonzalo Andrade Estrella*
