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

## Traducciones eficientes y relativamente confiables

### Principio

No leer, pegar ni reescribir archivos de miles de claves dentro del chat. Los
tokens del modelo deben gastarse en decidir significado, terminología y revisar
casos dudosos; la comparación, inserción, orden y validación pertenecen a los
scripts.

`en.json` es el esquema canónico. `es.json` se revisa editorialmente antes de
propagar claves nuevas. Nunca usar otro idioma como fuente de traducción, salvo
el fallback español explícito para los packs experimentales que no tienen
traducción automática fiable.

### Flujo obligatorio

1. Ejecutar primero el auditor, sin abrir todos los locales:

   ```bash
   cd TeXisStudio/texis-app
   npm run check:i18n
   ```

2. Extraer sólo las claves faltantes o modificadas de `en.json` y `es.json`.
   Trabajar por namespace o por lotes semánticos pequeños, normalmente entre 10
   y 40 cadenas. No pedir al modelo que reproduzca la estructura completa del
   JSON.

3. Revisar EN y ES antes de traducir:
   - significado inequívoco;
   - terminología consistente;
   - placeholders correctos;
   - comandos y nombres técnicos intactos;
   - textos cortos adecuados para UI.

4. Usar el traductor incremental del repositorio, que añade únicamente claves
   ausentes y conserva traducciones existentes:

   ```bash
   cd TeXisStudio-Languages
   node scripts/translate-ui-json.mjs --bundled
   ```

5. Para idiomas experimentales sin soporte automático fiable, usar sólo el
   fallback español declarado por el proyecto:

   ```bash
   node scripts/translate-ui-json.mjs \
     --spanish-fallback --include-experimental nah yua tzh mix zap
   ```

6. Volver a ejecutar `npm run check:i18n`. El proceso no termina mientras haya
   claves faltantes, extras o placeholders rotos.

7. Revisar muestras, no archivos completos:
   - un idioma latino cercano, por ejemplo francés o portugués;
   - alemán o ruso para expansión de texto;
   - japonés o chino para CJK;
   - árabe, hebreo o persa para RTL;
   - cada cadena que contenga términos técnicos, interpolaciones o comandos.

8. Corregir manualmente las traducciones sospechosas y ejecutar otra vez el
   auditor. Una traducción automática completa no equivale a una revisión
   editorial completa.

### Qué debe protegerse

El script debe proteger antes de enviar texto al traductor:

- variables i18next como `{{count}}`;
- placeholders y etiquetas HTML;
- URLs y comandos LaTeX;
- nombres de archivos, extensiones e identificadores;
- LaTeX, TeXisStudio, Tectonic, latexmk, amsmath, biblatex, Biber, TikZ,
  pgfplots, circuitikz, mhchem, xcolor, JSON, YAML y otros términos de dominio.

Si aparece un término nuevo, añadirlo a `PROTECTED_PATTERNS` en
`TeXisStudio-Languages/scripts/translate-ui-json.mjs` antes de traducir. No
corregir el mismo error manualmente en 26 idiomas si puede impedirse desde la
fuente.

### Cómo ahorrar tokens

- Usar `rg` o un script Node para imprimir sólo `ruta.clave = valor` de las
  claves pendientes.
- Hacer una sola solicitud de traducción por idioma y lote semántico, no una
  solicitud por cadena.
- No pegar locales completos al modelo para comprobar paridad; usar
  `check-i18n.mjs`.
- No pedir explicaciones de cada traducción. Pedir salida estructurada y revisar
  únicamente términos ambiguos.
- No volver a traducir valores existentes. El modo correcto es missing-only.
- Si varios idiomas ya están completos, excluirlos del trabajo en vez de
  releerlos.
- Separar cobertura de calidad: primero lograr paridad mecánica; después revisar
  una muestra de riesgo y las cadenas marcadas por el auditor.

### Formato recomendado para revisión manual

Dar al modelo únicamente un objeto plano como éste:

```json
{
  "settings.latex_primary_title": "Preferred LaTeX backend",
  "settings.latex_fallback_hint": "Use the other installed backend when the preferred one is unavailable."
}
```

Solicitar como respuesta el mismo objeto, con las mismas claves, sin Markdown,
sin comentarios y sin alterar placeholders. Después insertar los valores con un
script, no mediante reemplazos manuales sobre el archivo completo.

### Señales que exigen revisión humana

- La salida traduce o translitera un nombre técnico.
- Conserva una frase completa en inglés sin una razón clara.
- Cambia `{{variable}}`, barras invertidas, etiquetas o puntuación estructural.
- Una etiqueta de botón crece demasiado para la interfaz.
- Traduce literalmente un concepto de LaTeX que tiene terminología establecida.
- Un idioma RTL mezcla términos latinos con puntuación en orden incorrecto.
- El significado cambia entre acción, estado y descripción.

### Límite de confianza

Las traducciones automáticas sirven para completar cobertura y producir un
borrador razonable. Alemán, francés, portugués, italiano y lenguas similares
suelen requerir una revisión ligera. CJK y RTL requieren una muestra más
cuidadosa. Lenguas originarias y minorizadas no deben declararse revisadas sin
una persona competente; mientras tanto deben conservar su estado experimental
y el fallback explícito.

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
