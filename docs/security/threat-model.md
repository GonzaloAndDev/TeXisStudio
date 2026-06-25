# Threat Model — TeXisStudio

- Versión: 1.0
- Fecha: 2026-06-25
- Alcance: app de escritorio local-first (núcleo `texis-*`, Tauri, CLI) y
  ecosistema (perfiles, idiomas, plugins).
- Relacionado: `SECURITY.md`, `docs/adr/0002-local-first-privacy.md`.

## Activos a proteger

- Contenido académico del usuario (tesis, datos, citas) — **confidencialidad e integridad**.
- Integridad del proyecto en disco (no corrupción, no pérdida silenciosa).
- El equipo del usuario (no ejecución de código arbitrario vía documentos/plugins).

## Modelo

Atacante = contenido no confiable que entra al sistema (proyectos importados,
LaTeX crudo, templates de perfil, plugins, assets/PDF externos, URLs). El usuario
y su SO se consideran confiables. No hay backend propio (local-first).

## Superficies y controles

Cada superficie declara límites de **ruta, tamaño, tiempo, memoria y capacidades**.

| Superficie | Riesgo | Control |
| ---------- | ------ | ------- |
| Importación de proyectos | rutas maliciosas, datos corruptos | `texis-platform::safety::resolve_within` (sin absolutas/`..`/symlink-escape); validación de schema; backup+journal antes de migrar |
| LaTeX crudo (`TrustedRawLatex`) | inyección, comandos peligrosos | nodo explícito, auditable; requiere `user_confirmed`; sin shell-escape |
| `shell_escape` | ejecución arbitraria | **desactivado por defecto**; sujeto a consentimiento explícito |
| Templates de perfil | expansión peligrosa | funciones de plantilla limitadas; sin acceso a fs/red |
| Plugins | red/fs arbitrario, paquetes/preámbulo | contrato Contribution 2.x: `FORBIDDEN_COMMANDS` (write18/openout/catcode/documentclass/usepackage), `isUnsafePath` (absolutas/traversal); artefacto saneado en el backend (`PLUGIN-003/004`); directorio propio; permisos declarados (mínimo privilegio) |
| Perfiles | reglas/aserciones falsas | contrato versionado; `verified` exige evidencia+fecha (`Profile2::self_consistency_errors`) |
| Assets externos | path traversal, ejecutables | rutas relativas (invariante del IR); `resolve_within`; hash de contenido |
| PDFs incluidos | contenido activo | tratados como no confiables; inclusión controlada |
| URLs | exfiltración, SSRF | dominios declarados por el plugin; consentimiento contextual |
| Actualizaciones | binario malicioso | updater desactivado hasta firma+verificación cripto (ADR-0004) |
| Credenciales | filtración | almacén seguro del SO; nunca en JSON/localStorage (ADR-0002) |
| Compiladores / procesos hijos | runaway, fuga | límites de tiempo/memoria; compilación aislada cuando la plataforma lo permita |

## Límites por defecto (presupuestos de seguridad)

- Rutas: siempre relativas y dentro de la raíz del proyecto (`resolve_within`).
- Tiempo: la compilación y los procesos hijos tienen timeout y cancelación.
- Tamaño: límites a assets e importaciones (a definir por la capa de aplicación).
- Capacidades: ningún plugin obtiene red/fs sin declararlo y obtener permiso.
- Telemetría: ninguna por defecto; crash reports opt-in y redactados.

## Lo que NO cubre este modelo

- Atacante con acceso físico/root al equipo del usuario.
- Vulnerabilidades del propio TeX Live / compiladores (se mitiga con límites de
  proceso, no se elimina).
- Colaboración en red / cuentas (fuera de alcance actual).

## Revisión

Este documento se versiona. Cualquier superficie nueva (p. ej. sync, plugins con
red) requiere actualizarlo antes de habilitar la función.
