# ADR 0001 — Núcleo documental: monolito modular hexagonal con MDI

- Estado: **Aceptado** (Etapa A en curso)
- Fecha: 2026-06-23
- Contexto del programa: `docs/MASTER-DOCUMENT-MODULE-HARDENING-PLAN.md`

## Contexto

TeXisStudio tenía **autoridad arquitectónica duplicada** (§3 del Plan Maestro):
`project::ProjectModel` y `texis_project::TexisProject` gobiernan partes solapadas;
`generator` y `template_engine` pueden producir estructura; `main_tex.rs` y
`sections.rs` mezclan ensamblado, paquetes, idioma, tipografía, índices y orden;
los validadores reinterpretan reglas que el generador ya interpretó. Modularizar el
código actual sin reconstruir esa autoridad solo trasladaría las inconsistencias.

## Decisión

Reconstruir el núcleo como **monolito modular orientado al dominio, con arquitectura
hexagonal por capa y una canalización dirigida por un Modelo Documental Intermedio
(MDI / `DocumentIR`)** (§2). LaTeX pasa a ser un *backend de render*, no el modelo.

### Layout físico de crates (decisión del propietario, 2026-06-23)

```
texis-document-contracts   Shared Kernel + contratos versionados; sin deps internas
        ▲
texis-document-domain      DocumentIR, fases, precedencia, DocumentPlan; SOLO depende de contracts
        ▲
texis-document-application puertos + casos de uso; depende de domain + contracts
        ▲
texis-document-infra       adaptadores (importador legacy, serialización); depende de application + texis-core
```

Se eligió **crates separados** (no módulos en un crate) para que el compilador de
Rust **impida físicamente** las dependencias prohibidas del §16.1 (p. ej. dominio →
LaTeX/Tauri/filesystem/YAML). `texis-core` NO puede depender de `texis-document-infra`
(evita ciclo, porque infra lee `texis-core::ProjectModel`).

### Estrategia de legado: paralelo hasta la Etapa I

El generador actual sigue produciendo el PDF de producción **intacto y congelado**
(solo fixes críticos) mientras el núcleo nuevo madura detrás. Corte único y
controlado en la Etapa I, tras demostrar equivalencia/mejoras, migración sin pérdida,
matriz LaTeX/PDF completa, app ≡ CLI y rollback funcional.

## Consecuencias

**Positivas**
- Una sola autoridad emergente para el modelo documental (`DocumentIR`).
- Fronteras verificadas por el compilador + `tests/architecture.rs` (§16.1).
- El IR se valida sin LaTeX instalado y se serializa para CI (§5.1).
- Provenance explícita por valor (§5.3) y diagnósticos estructurados (§10).
- Cero riesgo para las tesis reales durante la obra (legado intacto).

**Costes aceptados**
- Modelado duplicado transitorio (legacy + IR) hasta la Etapa I.
- `texis-document-infra` depende de `texis-core` temporalmente; se retira en I.

## Estado de implementación (Etapa A)

Implementado y verificado en este corte vertical:

- Shared Kernel: IDs, diagnósticos (§10), provenance, assets, medidas,
  capacidades, locale, versiones de contrato.
- `DocumentIR` (§5) con invariantes comprobables (`check_invariants`): sin rutas
  absolutas, assets de figura/logo resueltos.
- Fases canónicas (§5.2) y política de precedencia (§5.3) con tests.
- `DocumentPlan` (§8.1) como contrato de tipos (lógica de ensamblado → Etapa B).
- Contrato `DocumentResolver` + importador legacy `ProjectModel → DocumentIR`.
- Serialización JSON del IR + comando CLI `texis import-ir [--demo]`.
- Fixture de tesis de referencia y pruebas de importación, round-trip y
  arquitectura.

### Criterio de salida (cumplido)

- Una tesis (fixture representativo) se importa y produce un `DocumentIR` válido,
  sin diagnósticos bloqueantes y con invariantes satisfechas.
- El único punto que interpreta el modelo legacy es el importador (infra); el
  dominio trabaja sobre un IR neutral, sin aliases ni perfiles crudos.

## Estado de implementación (Etapa B — Pipeline)

Implementado y verificado en este corte vertical (sin tocar el generador legacy):

- `PlanBuilder` (dominio, puro y determinista): `DocumentIR → DocumentPlan`. Única
  autoridad del orden global de fases; resuelve y deduplica paquetes (ordenados),
  assets, toolchain y expectativas de verificación.
- Puerto `RenderBackend` + `BackendCapabilities`/`RenderedDocument` (§8.2).
- `LatexRenderBackend` (infra): primer backend. Ensambla preámbulo (clase,
  paquetes, geometría, fuentes, biblatex con estilo/backend resueltos, metadatos
  PDF) y `main.tex` con fases en orden canónico (`\frontmatter`/`\mainmatter`/
  `\appendix`). Render básico-fiel de nodos; fidelidad profunda en C–G.
- Manifiesto de build reproducible (`BuildManifest`, contrato versionado) con
  hashes sha256 de entrada (IR) y artefactos, toolchain y capacidades resueltas.
- Servicio único de build `AssembleDocumentUseCase` (aplicación): import → plan →
  render → manifiesto. App y CLI llaman a este mismo caso de uso.
- Comando CLI `texis build-plan [--demo] [--manifest]`.

### Criterio de salida (cumplido)

- Solo el ensamblador nuevo produce `main.tex` (vía el servicio único).
- Build **determinista**: con entradas idénticas, manifiesto y artefactos idénticos
  (test `build_is_deterministic`).
- No se compila a PDF en esta etapa (LaTeX no es requisito) ni se altera producción.

## Pendiente (siguientes etapas)

- Etapas C–G: profundizar cada módulo (portada → anexos) con editor, validación,
  render fiel y verificación PDF.
- Etapa "capabilities/provenance/grafo incremental": `CapabilityRegistry`,
  confianza, build incremental por grafo semántico.
- `texis-certification`: matriz profesional (paso 16).
- Etapa I: retirar el generador legacy y la dependencia hacia `texis-core`.
