# Política de Seguridad — TeXisStudio

## Versiones soportadas

TeXisStudio está en desarrollo activo previo al primer release público estable.
Mientras tanto, sólo la rama `main` recibe correcciones de seguridad.

| Versión | Soportada |
| ------- | --------- |
| `main` (desarrollo) | ✅ |
| Pre-releases anteriores | ❌ |

A partir del primer release estable se mantendrá soporte de seguridad para la
versión actual y la inmediatamente anterior (política N-1).

## Cómo reportar una vulnerabilidad

**No abras un issue público** para vulnerabilidades de seguridad.

1. Usa el reporte privado de GitHub: pestaña **Security → Report a vulnerability**
   (GitHub Private Vulnerability Reporting) en este repositorio.
2. Como alternativa, escribe a **gaelsd25@gmail.com** con el asunto
   `[SECURITY] TeXisStudio`.

Incluye, si puedes:

- descripción del problema y su impacto;
- pasos de reproducción o prueba de concepto;
- versión/commit afectado;
- mitigaciones conocidas.

### Compromiso de respuesta

- **Acuse de recibo:** en un máximo de 72 horas.
- **Evaluación inicial:** en un máximo de 7 días.
- **Corrección o plan de mitigación:** coordinado contigo antes de cualquier
  divulgación pública (divulgación coordinada).

## Superficies de riesgo conocidas

El núcleo documental trata estas superficies con cuidado explícito (ver el plan
maestro y `docs/adr/`):

- **LaTeX crudo y `shell-escape`**: desactivado por defecto y sujeto a
  consentimiento del usuario.
- **Plantillas de perfiles y plugins**: validadas contra contratos versionados;
  los artefactos de plugin se sanean (no pueden tocar el preámbulo ni ejecutar
  shell-escape — ver `validation::body` `PLUGIN-003/004`).
- **Rutas y assets externos**: normalizadas dentro de raíces permitidas; sin
  rutas absolutas en el `DocumentIR`.
- **PDFs incluidos y archivos importados**: tratados como no confiables.

## Alcance

Aplica al núcleo (`texis-*`), la app de escritorio (Tauri) y la CLI. Los
repositorios de ecosistema (`TeXisStudio-Profiles`, `-Languages`, `-Plugins`)
tienen sus propias políticas equivalentes.
