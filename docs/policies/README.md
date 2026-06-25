# Políticas públicas de TeXisStudio

Índice de las políticas que el producto publica (Programa de Profesionalización
Industrial §10). Algunas viven en la raíz del repo por convención de GitHub.

| Política | Documento | Estado |
| -------- | --------- | ------ |
| Seguridad y divulgación | [`SECURITY.md`](../../SECURITY.md) | ✅ |
| Soporte y plataformas | [`SUPPORT.md`](../../SUPPORT.md) | ✅ |
| Contribución y gobierno | [`CONTRIBUTING.md`](../../CONTRIBUTING.md) | ✅ |
| Privacidad / local-first | [`docs/adr/0002-local-first-privacy.md`](../adr/0002-local-first-privacy.md) | ✅ (ADR) |
| Plataformas Tier 1 | [`docs/adr/0003-tier1-platforms.md`](../adr/0003-tier1-platforms.md) | ✅ (ADR) |
| Canales de release | [`docs/adr/0004-release-channels.md`](../adr/0004-release-channels.md) | ✅ (ADR) |
| Recuperación de datos | [`recovery.md`](recovery.md) | ✅ |
| Runbooks de incidentes | [`runbooks/`](runbooks/README.md) | ✅ |
| Threat model | [`../security/threat-model.md`](../security/threat-model.md) | ✅ |
| Presupuestos de rendimiento | [`../performance/budgets.md`](../performance/budgets.md) | ✅ |
| Deprecaciones | `docs/policies/deprecations.md` | ⏳ pendiente |
| Límites de LaTeX y plugins | `docs/policies/limits.md` | ⏳ pendiente |

## Privacidad (resumen)

Por defecto, **ningún contenido académico ni telemetría** sale del equipo. Todo
servicio conectado es opcional y muestra proveedor, datos enviados, finalidad y
alternativa local antes de enviar nada. Las credenciales se guardan en el almacén
seguro del sistema operativo.

## Convención

Las políticas marcadas ⏳ se añadirán en su etapa del programa. Este índice se
mantiene como única fuente de verdad de qué políticas existen y dónde.
