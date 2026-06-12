# Instrucciones para Claude — documentación de TeXisStudio

## Objetivo

Mantener y ampliar el sitio oficial bilingüe de TeXisStudio sin volver a
introducir afirmaciones no verificadas. La documentación debe describir la app
y los repositorios tal como existen en código.

## Arquitectura

- Sitio web: `docs-site/` — Astro Starlight.
- Español: `docs-site/src/content/docs/`.
- Inglés: `docs-site/src/content/docs/en/`.
- Ayuda compacta de la app: `docs/user-guide/`.
- Plan editorial: `docs/documentation-professionalization-plan.md`.
- Build y despliegue: `.github/workflows/docs.yml`.

Cada página española e inglesa debe usar exactamente la misma ruta técnica.
Por ejemplo:

```text
src/content/docs/app/basic.md
src/content/docs/en/app/basic.md
```

No usar `basico.md` en un idioma y `basic.md` en otro: Starlight lo interpreta
como dos páginas distintas y rompe el cambio de idioma contextual.

## Estructura editorial obligatoria

La documentación tiene tres módulos:

1. Uso de la app.
2. Uso de LaTeX.
3. Contribución al ecosistema.

Cada módulo tiene nivel básico, intermedio y avanzado. La contribución debe
cubrir App, Plugins, Languages y Profiles.

## Reglas

1. No documentar funcionalidad planeada como si estuviera disponible.
2. Verificar botones y rutas directamente en los componentes React.
3. Verificar atajos en los listeners de teclado, no en traducciones ni README.
4. Verificar formatos de plugins, idiomas y perfiles en sus repositorios.
5. Actualizar español e inglés juntos y con profundidad equivalente.
6. No mezclar ambos idiomas dentro de una misma página.
7. No traducir identificadores técnicos: LaTeX, Tectonic, latexmk, amsmath,
   biblatex, Biber, TikZ, pgfplots, circuitikz, mhchem, xcolor, JSON y YAML.
8. No enseñar `$$...$$`; usar `\[...\]` o entornos LaTeX adecuados.
9. Mantener ejemplos cortos, reproducibles y compatibles con la explicación.
10. Si una afirmación no puede verificarse, marcarla como pendiente y no
    publicarla como instrucción.

## Estado verificado

- La preferencia global de compilación elige Tectonic o una suite completa
  mediante latexmk, con fallback opcional.
- La app no presenta pdfLaTeX, XeLaTeX y LuaLaTeX como tres preferencias
  globales independientes.
- Atajos implementados en el editor: `Ctrl/Cmd+K`, `Ctrl/Cmd+[`,
  `Ctrl/Cmd+S` y `Escape`.
- No hay atajo global implementado para Compilar.
- Profiles usa `_institution.yaml`, `profile.yaml` y `manifest.yaml`.
- Languages usa `language.yaml`, `ui.json`, `latex.json` y archivos opcionales.
- Plugins registra metadata, `engineId` y serializers en su estructura actual.

## Comandos de verificación

```bash
cd docs-site
npm ci
ASTRO_TELEMETRY_DISABLED=1 npm run check
ASTRO_TELEMETRY_DISABLED=1 npm run build
```

Después de cambiar enlaces de la app:

```bash
cd texis-app
npm run check:i18n
npm test -- --run
npm run build
```

## Git y alcance

- Leer `git status` antes de editar.
- No revertir cambios ajenos o sin commit.
- Mantener cambios de documentación separados de refactors no relacionados.
- Actualizar README y CHANGELOG cuando cambie arquitectura o despliegue.
- Antes del commit, ejecutar `git diff --check`.

## Trabajo siguiente recomendado

1. Sustituir la wiki por una portada de migración que apunte a GitHub Pages.
2. Añadir capturas estandarizadas de Windows, macOS y Linux.
3. Crear una matriz automática de atajos para compartir entre app y docs.
4. Añadir comprobación de enlaces externos y paridad ES/EN en CI.
5. Ampliar contribución avanzada con enlaces a esquemas y fixtures reales.

## Referencias

- `docs-site/README.md`
- `docs/documentation-professionalization-plan.md`
- `README.md`, sección de documentación.
- Commit inicial del sitio: `e3b013f`.
