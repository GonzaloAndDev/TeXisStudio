# Soporte de TeXisStudio

TeXisStudio es una aplicación de escritorio **local-first** en desarrollo activo
previo al primer release estable público.

## Plataformas soportadas (Tier 1)

| Plataforma | Estado | Distribución prevista |
| ---------- | ------ | --------------------- |
| Windows 10/11 (x64) | Tier 1 | MSI / NSIS (Authenticode) |
| macOS 12+ (Intel y Apple Silicon) | Tier 1 | DMG firmado + notarizado (universal) |
| Linux (glibc moderno) | Tier 1 | AppImage / DEB / RPM con checksums |

Ver `docs/adr/0003-tier1-platforms.md`.

## Canales

- **nightly** — automático, solo pruebas internas; sin garantías.
- **beta** — voluntarios; migraciones y rollback verificados.
- **stable** — gate de producción completo y aprobación manual.

Ver `docs/adr/0004-release-channels.md`. (El actualizador automático está
desactivado hasta tener firma y claves seguras.)

## Ciclo de soporte

- Antes del primer estable: solo la rama `main` recibe correcciones.
- Tras el primer estable: soporte para la versión actual y la anterior (N-1).

## Compatibilidad de proyectos

- Los proyectos 1.x se **migran** al núcleo documental nuevo como operación crítica
  certificada (preflight + backup + validación + reporte). Ver
  `docs/adr/0001-nucleo-documental.md`.
- No se elimina contenido recuperable de forma silenciosa (Recovery Center).

## Requisitos externos

- Para compilar a PDF: una distribución LaTeX (TeX Live / MacTeX) con XeLaTeX,
  LuaLaTeX o PdfLaTeX y `biber`. La app detecta el toolchain y degrada con
  diagnósticos claros si falta.

## Dónde pedir ayuda

- Dudas y errores no sensibles: issues de GitHub.
- Vulnerabilidades de seguridad: **no** abrir issue público; ver `SECURITY.md`.

## Límites conocidos

LaTeX y los plugins tienen límites declarados; ver `docs/policies/`.
