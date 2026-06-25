# Runbook — Corrupción de proyecto

**Síntoma:** la app no abre un proyecto, o reporta integridad inconsistente.

## Detectar
- `recovery_scan` reporta `integrity_issues`, `leftover_temporaries` o
  `incomplete_operations`.
- `verify_integrity` lista archivos `modified`/`missing`.

## Contener
- **No guardar** sobre el proyecto (evitar sobrescribir el último estado bueno).
- La plataforma nunca sobrescribe en silencio: el estado recuperable se conserva.

## Recuperar
1. Revisar `recovery_scan`: si hay `leftover_temporaries` (`.tmp`/`.bak`), proceden
   de un guardado interrumpido; el original suele seguir intacto.
2. Listar snapshots (`recovery_list_snapshots`) y restaurar el más reciente
   verificado (`recovery_restore_snapshot`). La restauración es atómica.
3. Si no hay snapshot, usar el `.bak` del guardado atómico previo.

## Analizar / prevenir
- Confirmar que el guardado usó `transactional_save` (journal sin `incomplete`).
- Si la corrupción vino de edición externa concurrente, revisar el lock de proyecto.
