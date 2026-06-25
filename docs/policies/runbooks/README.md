# Runbooks de incidentes — TeXisStudio

Programa Industrial §10. Procedimientos accionables para incidentes técnicos.

## Proceso general

```text
detectar → contener → comunicar → corregir → recuperar → analizar → prevenir
```

## Runbooks

- [Corrupción de proyecto](project-corruption.md)
- [Migración defectuosa](failed-migration.md)
- [Plugin vulnerable o malicioso](vulnerable-plugin.md)
- [Dependencia comprometida](compromised-dependency.md)
- [Release defectuoso / rollback](bad-release.md)

## Herramientas de apoyo

- `texis-platform`: `scan_recovery`, snapshots (`recovery_*` en la app),
  integridad (`verify_integrity`), `RevocationList`.
- CLI: `texis certify [--compile-matrix]`, `texis build-plan`.
- Seguridad: `SECURITY.md`, `docs/security/threat-model.md`, `cargo audit`/`deny`.
