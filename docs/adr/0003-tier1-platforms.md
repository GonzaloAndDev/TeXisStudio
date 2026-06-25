# ADR 0003 — Windows, macOS y Linux como plataformas Tier 1

- Estado: **Aceptado**
- Fecha: 2026-06-25
- Owners: @GonzaloAndDev
- Programa: "Profesionalización Industrial" §4, §5, §12

## Contexto

TeXisStudio (Tauri) corre en los tres sistemas de escritorio. Tratar uno como
"secundario" llevaría a roturas no detectadas (linking, fuentes, rutas, firma).

## Decisión

Windows, macOS y Linux son **Tier 1**: mismo nivel de soporte, pruebas y release.

- CI ejecuta en los tres (los tests pesados de Tauri pueden limitarse a Linux por
  coste de linking, pero core/CLI corren en los tres).
- Un fallo en cualquier Tier 1 **bloquea** `stable` (gate de producción).
- Distribución por plataforma: Windows (Authenticode, MSI/NSIS), macOS (Developer
  ID, hardened runtime, notarización, stapling, DMG, universal binary), Linux
  (AppImage/DEB/RPM con checksums y firma).

## Alternativas consideradas

- **macOS/Windows primero, Linux best-effort**: rechazado; el público académico
  usa Linux ampliamente y TeXLive es nativo allí.

## Consecuencias

**Positivas** — paridad real, menos sorpresas en release.

**Costes** — firma/notarización requieren certificados y claves del propietario
(no están en el repo); el CI multiplataforma es más caro.

## Migración

N/A (política, no cambio de formato).

## Condiciones de revisión

Si una plataforma deja de tener usuarios medibles o su coste de mantenimiento se
vuelve insostenible para un equipo pequeño.
