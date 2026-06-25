# Runbook — Dependencia comprometida

**Síntoma:** `cargo audit`/`cargo deny` o el job `Security` reportan una
vulnerabilidad/yank, o se anuncia una dependencia comprometida.

## Detectar
- Workflow `Security` (cargo-deny advisories/licenses/sources, cargo-audit,
  npm audit) falla.
- Aviso de RustSec / GitHub.

## Contener
- No publicar releases desde un commit con vulnerabilidad crítica conocida
  (gate de producción §12).

## Corregir
1. Identificar la dependencia y la versión afectada (`cargo tree -i <crate>`).
2. Actualizar a la versión parcheada (o fijar a una segura); regenerar lockfiles.
3. Si no hay parche: evaluar `deny.toml` (`ignore` temporal documentado con razón
   y fecha) o sustituir la dependencia.
4. Re-ejecutar `cargo deny check` y `cargo audit`.

## Recuperar / prevenir
- Regenerar SBOM (job `Security`) y verificar hashes de artefactos.
- Confirmar acciones de GitHub fijadas y Dependabot activo.
- Si hubo build publicado afectado, ver `bad-release.md` (rollback).
