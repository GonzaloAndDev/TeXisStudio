# Contribuir a TeXisStudio

Gracias por contribuir. Este documento define el **gobierno técnico** del
repositorio (Programa de Profesionalización Industrial, §8).

## Principios

- **Local-first y privacidad por defecto** (ver `docs/adr/0002-local-first-privacy.md`).
- **`main` siempre liberable**: nada se mezcla si rompe un gate.
- **Núcleo legado congelado**: `texis-core/src/generator/` y `texis-core/src/texis_project/`
  solo aceptan correcciones críticas justificadas; lo nuevo va al núcleo documental
  (`texis-document-*`).

## Política de ramas y merge

`main` está protegida. La configuración esperada del repositorio (GitHub → Settings):

- prohibido el push directo a `main`;
- PR con al menos una revisión de los **CODEOWNERS** del dominio afectado;
- **status checks requeridos**: CI (`test`), `Security` (cargo-deny/audit), `tsc`
  y los tests de frontend;
- **merge queue** habilitada;
- **commits firmados** (`git commit -S`) requeridos;
- releases solo desde commits verdes.

> Estas opciones se activan en los ajustes del repositorio; este documento es su
> contrato. CODEOWNERS está en `.github/CODEOWNERS`.

## Commits

- Conventional Commits: `tipo(scope): resumen` (`feat`, `fix`, `refactor`, `docs`,
  `chore`, `test`, `perf`, `build`, `ci`).
- Un commit por corrección/contrato lógico; no mezclar features.
- No incluir cambios locales de entorno (p. ej. `TeXisStudio.code-workspace`).
- Mensajes en español; cuerpo explicando el porqué.

## ADRs

Toda decisión **transversal** requiere un ADR en `docs/adr/` (usa
`0000-template.md`). Las decisiones pequeñas y reversibles NO necesitan ADR.

## Gates locales antes de abrir PR

```bash
# Rust (workspace completo)
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

# Frontend
cd texis-app && npm run build && npm test

# Certificación del núcleo documental (estructural; rápida)
cargo run -p texis-cli -- certify
# Con toolchain LaTeX (opcional, más lento): matriz de compilación real
cargo run -p texis-cli -- certify --compile-matrix
```

## Seguridad

No abras issues públicos para vulnerabilidades: ver `SECURITY.md`.

## Calidad de código (gates)

- dependencias unidireccionales entre crates (verificado por `tests/architecture.rs`);
- APIs públicas mínimas; errores tipados;
- sin `unwrap`/`expect` en rutas productivas críticas (sí en tests/fixtures);
- sin código muerto;
- pruebas de contrato para cambios de contrato (con prueba del consumidor).
