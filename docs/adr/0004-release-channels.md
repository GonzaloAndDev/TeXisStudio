# ADR 0004 — Canales de release: nightly, beta, stable

- Estado: **Aceptado**
- Fecha: 2026-06-25
- Owners: @GonzaloAndDev
- Programa: "Profesionalización Industrial" §4, §5

## Contexto

Liberar todo directamente a usuarios finales arriesga datos académicos. Se necesita
exposición gradual con rollback verificado.

## Decisión

Tres canales con feed, claves y configuración **separados**:

- **nightly**: build automático por commit verde en `main`; sólo pruebas internas.
- **beta**: usuarios voluntarios; exige migraciones y rollback verificados.
- **stable**: gate de producción completo (§12) y **aprobación manual**.

El actualizador (Tauri Updater) sólo se activa cuando existan: claves fuera del
repo, artefactos firmados, manifiesto HTTPS, validación criptográfica, rollback y
prueba de actualización desde las **dos** versiones estables anteriores (N-2).
Hasta entonces, el updater permanece desactivado (estado actual del repo).

## Alternativas consideradas

- **Un solo canal**: rechazado; sin red de seguridad para migraciones.
- **Updater activo ya**: rechazado; sin claves/firma seguras sería un vector.

## Consecuencias

**Positivas** — exposición controlada, rollback, confianza.

**Costes** — tres pipelines/feeds; aprobación manual de `stable`.

## Migración

Al activar el updater: documentar política para migraciones incompatibles y probar
N-2 antes de publicar.

## Condiciones de revisión

Disponibilidad de infraestructura de firma/notarización y de claves gestionadas.
