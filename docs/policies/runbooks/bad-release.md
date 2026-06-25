# Runbook — Release defectuoso / rollback

**Síntoma:** un release (beta/stable) introduce una regresión grave, una
actualización falla, o una migración del release rompe proyectos.

## Detectar
- Reportes de usuarios (beta), crash reports opt-in, o fallo de un gate de
  producción detectado tarde.

## Contener
1. **Despromover** el canal: dejar de ofrecer la versión afectada en el feed.
2. Comunicar en las notas del canal el problema y la mitigación.

## Recuperar (rollback)
- El updater conserva rollback N-2 (cuando esté activo; hoy desactivado hasta
  firma segura — ADR-0004). Mientras tanto, ofrecer el instalador de la versión
  estable anterior.
- Para proyectos afectados por una migración del release: ver `failed-migration.md`
  (restaurar snapshot pre-migración).

## Corregir
- Reproducir con la matriz (`certify --compile-matrix`, tests de plataforma, app
  empaquetada) antes de re-publicar.
- Promover a `stable` solo desde un commit verde con todos los gates §12.

## Prevenir
- Asegurar que el RC corrió instalaciones limpias y prueba de actualización N-2.
- Añadir el caso a la suite de regresión.
