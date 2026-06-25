# Arquitectura de TeXisStudio — visión general

Documento de continuidad (Programa de Excelencia §15): mapa del sistema para
onboarding reproducible y reducción del bus factor. Para decisiones, ver
`docs/adr/`.

## Repositorios

| Repo | Contenido |
| ---- | --------- |
| `TeXisStudio` | App (Tauri + React), CLI, núcleo documental, plataforma. |
| `TeXisStudio-Profiles` | Perfiles institucionales (YAML 1.x + schema 2.x) y estilos de cita. |
| `TeXisStudio-Languages` | Packs de idioma (`ui/document/latex.json`). |
| `TeXisStudio-Plugins` | Plugins visuales (TypeScript) y contrato Contribution 2.x. |

## Crates del workspace (Rust)

```text
Legado (congelado, solo fixes críticos)
  texis-core            modelo 1.x, generador legacy, postflight, perfiles, etc.

Núcleo documental nuevo (Plan Maestro A→J) — fronteras impuestas por el compilador
  texis-document-contracts   Shared Kernel: IDs, diagnósticos, provenance, assets,
                             medidas, capacidades, locale, versiones, Profile2, manifest
  texis-document-domain      DocumentIR, fases, precedencia, DocumentPlan, validación
                             por módulo, políticas, capacidades, grafo, bib_styles
  texis-document-application puertos + casos de uso (ImportProject, AssembleDocument)
  texis-document-infra       importador legacy, backend LaTeX, parser .bib, fixtures
  texis-certification        matriz de certificación + compile gate (PDF real)

Plataforma de producto/operación (Programa Industrial)
  texis-platform        atomic, lock, journal, integrity, snapshot, lifecycle,
                        recovery, safety, observability, ecosystem, review

Aplicación
  texis-cli             CLI (create/validate/compile/import-ir/build-plan/certify)
  texis-app/src-tauri   comandos Tauri (incluye document_build, recovery_*)
  texis-app/src         frontend React + servicios (documentCore, recoveryCenter)
```

### Reglas de dependencia (verificadas)

```text
contracts <- domain <- application <- infra/certification/app/cli
texis-platform        independiente (no depende del núcleo documental ni del legado)
domain  NO importa    serde_yaml, minijinja, fs real, tauri, LaTeX  (test: tests/architecture.rs)
texis-core  NO depende de texis-document-infra  (evita ciclo; infra lee texis-core)
```

## Pipeline documental

```text
Proyecto (+ perfil/idioma/plugins) → DocumentResolver/importador → DocumentIR
  → validación de dominio + políticas + capacidades → DocumentPlan
  → RenderBackend (LaTeX) → artefactos + BuildManifest → compilación → PDF → postflight
```
Modos de build: `Draft` (continúa con diagnósticos) · `Review`/`Final` (bloquean ante
diagnósticos críticos; nunca inventan datos).

## Gates locales (antes de PR)

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
( cd texis-app && npm run build && npm test )
cargo run -p texis-cli -- certify            # estructural (rápido)
cargo run -p texis-cli -- certify --compile-matrix   # PDF real (requiere LaTeX)
node scripts/check-i18n.mjs && node scripts/pseudo-localize.mjs --check
node scripts/content-lint.mjs
```

## CI

- `ci.yml` por commit/PR (fmt, clippy, tests, integración).
- `security.yml` (cargo-deny, cargo-audit, npm audit, SBOM).
- `nightly.yml` (cross-OS, matriz de compilación PDF, plataforma, i18n).

## Dónde vive cada programa

- **Núcleo documental (A→J):** `texis-document-*`, `texis-certification`. ADR 0001.
- **Plataforma industrial:** `texis-platform`, `.github/`, `SECURITY.md`,
  `deny.toml`, `docs/security/threat-model.md`, `docs/policies/`. ADRs 0002–0004.
- **Excelencia/global:** i18n tooling (`scripts/pseudo-localize.mjs`),
  contenido (`scripts/content-lint.mjs`, `docs/content/`), revisión local
  (`texis-platform::review`); el grueso (UI/diseño/accesibilidad) vive en
  `texis-app/src` y requiere la app corriendo.

## Continuidad

- Ownership: `.github/CODEOWNERS`. Gobierno: `CONTRIBUTING.md`.
- Incidentes: `docs/policies/runbooks/`.
- Memoria de decisiones: `docs/adr/`.
- Claves de firma/notarización: **pendientes** (no en el repo); ver ADR-0004.
