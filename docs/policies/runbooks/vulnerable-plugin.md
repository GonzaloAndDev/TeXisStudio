# Runbook — Plugin vulnerable o malicioso

**Síntoma:** un plugin intenta tocar el preámbulo, rutas fuera de su directorio,
shell-escape, o se reporta una vulnerabilidad.

## Detectar
- Validación del cuerpo: `PLUGIN-003` (inyecta `\usepackage`) / `PLUGIN-004`
  (constructo peligroso: `\write18`, `\openout`, traversal). El backend ya **sanea**
  el artefacto y lo rechaza con un marcador visible.
- Contrato Contribution 2.x: `isUnsafePath`/`FORBIDDEN_COMMANDS`.

## Contener
1. Marcar el artefacto en la `RevocationList` como `Vulnerable` (con nota/CVE).
   La app **advierte** y deja de activarlo; **no borra** proyectos del usuario.
2. El pipeline en modo `Review`/`Final` bloquea por los diagnósticos `PLUGIN-*`.

## Recuperar / corregir
- Sustituir el plugin por una versión corregida (instalación transaccional con
  verificación de hash); conservar rollback.
- Si no hay corrección, el documento puede compilar sin la contribución (el nodo
  queda marcado, no se inserta LaTeX inseguro).

## Prevenir
- Revisar permisos declarados del plugin (mínimo privilegio) y su provenance.
- Añadir el caso al threat model si abre una superficie nueva.
