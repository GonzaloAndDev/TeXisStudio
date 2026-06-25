# Runbook — Migración defectuosa

**Síntoma:** una migración (1.x → núcleo nuevo, o de schema) falla o produce un
resultado inválido.

## Detectar
- `recovery_scan` muestra una operación `migrate` incompleta en el journal.
- La validación posterior reporta diagnósticos bloqueantes.

## Contener
- La migración es una operación crítica: corre con **preflight + backup** antes de
  tocar nada. Si falló, el backup/snapshot previo está disponible.

## Recuperar
1. Restaurar el snapshot `pre-save`/pre-migración (`recovery_restore_snapshot`).
2. Confirmar con `verify_integrity` que el proyecto volvió a un estado consistente.
3. Reintentar la migración solo tras corregir la causa.

## Analizar / prevenir
- Reproducir con el fixture de la versión de origen (cada versión soportada tiene
  fixture). La migración debe ser **idempotente** y reversible.
- Añadir una prueba de interrupción en la etapa que falló.
