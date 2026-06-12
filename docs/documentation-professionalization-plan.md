# Plan de profesionalización de la documentación

## Decisión

La documentación oficial debe migrar de GitHub Wiki a un sitio de **Astro
Starlight publicado con GitHub Pages**. El contenido seguirá versionado en este
repositorio y se revisará en los mismos pull requests que cambian la app.

GitHub Wiki puede quedar temporalmente como portada y redirección. No debe
seguir siendo la fuente canónica porque no ofrece una arquitectura real de
idiomas, su navegación es manual y GitHub limita su indexación en buscadores.

Starlight aporta navegación para documentación, búsqueda estática, selector de
idioma, fallback controlado, soporte RTL y componentes accesibles sin requerir
un servicio de pago. GitHub Pages aloja el resultado de forma gratuita para el
repositorio público.

Referencias de la decisión:

- <https://docs.github.com/en/communities/documenting-your-project-with-wikis/about-wikis>
- <https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages>
- <https://starlight.astro.build/guides/i18n/>

## Problemas actuales

La wiki existente es un primer borrador, no documentación publicable todavía:

- Mezcla español e inglés dentro de las mismas páginas y las dos versiones no
  tienen la misma profundidad.
- Documenta atajos que la app no implementa, como `Ctrl+Shift+B`,
  `Ctrl+Shift+S`, `Ctrl+Shift+G`, `Ctrl+Enter` y `Ctrl+Shift+E`.
- Presenta pdfLaTeX, XeLaTeX y LuaLaTeX como opciones directas de la app, pero
  la configuración actual selecciona Tectonic o una suite mediante latexmk.
- Describe estructuras antiguas o inexistentes para perfiles (`profile.json`,
  `template.tex`) e idiomas (`meta.json`). Los repositorios actuales usan YAML,
  catálogos y capacidades explícitas.
- Afirma interacciones no verificadas, como arrastrar bibliografías, menús
  contextuales de secciones y creación automática de versiones.
- No identifica versión, plataforma, estado de revisión ni fuente técnica de
  cada procedimiento.
- Carece de capturas mantenibles, búsqueda, enlaces entre niveles y pruebas de
  enlaces o fragmentos de código.

## Arquitectura del sitio

El sitio vive en `docs-site/`, con su propio `package.json`, y se publica
mediante un workflow dedicado de GitHub Pages.

```text
docs-site/
  src/content/docs/
    es/
      index.mdx
      app/
      latex/
      contributing/
    en/
      index.mdx
      app/
      latex/
      contributing/
  src/assets/
    shared/
    es/
    en/
```

Cada página tendrá el mismo identificador conceptual en ambos idiomas y estos
metadatos mínimos. Las rutas serán iguales en todos los idiomas; sólo se
localizarán los títulos y el contenido:

```yaml
title: Editar y compilar un proyecto
level: basic
area: app
last_verified_version: 1.2.0
platforms: [windows, macos, linux]
status: reviewed
```

## Mapa de contenidos

### 1. Uso de la app

| Nivel | Español | English |
|---|---|---|
| Básico | instalación, primer proyecto, bloques, guardado y PDF | install, first project, blocks, save and PDF |
| Intermedio | figuras visuales, citas, revisión, perfiles y motores | visual figures, citations, review, profiles and engines |
| Avanzado | configuración técnica, diagnóstico, exportación y recuperación | technical settings, diagnostics, export and recovery |

### 2. Uso de LaTeX

| Nivel | Español | English |
|---|---|---|
| Básico | modo matemático, llaves, comandos y caracteres especiales | math mode, braces, commands and special characters |
| Intermedio | ecuaciones, tablas, figuras, referencias y bibliografía | equations, tables, figures, references and bibliography |
| Avanzado | preámbulo, paquetes, macros, TikZ/pgfplots y motores | preamble, packages, macros, TikZ/pgfplots and engines |

La guía debe distinguir siempre entre LaTeX estándar, sintaxis de un paquete y
campos propios de TeXisStudio. No se enseñará `$$...$$`; para matemáticas en
bloque se usarán `\[...\]` o entornos documentados.

### 3. Contribución al proyecto

Cada repositorio tendrá recorridos básico, intermedio y avanzado:

| Área | Básico | Intermedio | Avanzado |
|---|---|---|---|
| App | entorno, issue y cambio pequeño | frontend/backend, tests e i18n | arquitectura, seguridad, releases y migraciones |
| Plugins | usar contrato y ejecutar tests | crear engine/plugin y serializer | contratos, compatibilidad y publicación |
| Idiomas | corregir una cadena | completar pack y capacidades | catálogos, diccionarios, RTL y control editorial |
| Perfiles | corregir metadatos | crear perfil institucional | esquema, validación, empaquetado y gobernanza |

Los ejemplos de estructura se obtendrán de los repositorios reales. No se
mantendrán árboles de archivos escritos de memoria.

## Plan de ejecución

### Fase 0 — Contención

1. Marcar la wiki actual como borrador no verificado.
2. Retirar de la navegación principal las páginas con instrucciones falsas.
3. Conservar una portada con enlaces al README y al futuro sitio.

### Fase 1 — Plataforma (implementada)

1. Crear `docs-site/` con Starlight, locales `es` y `en` y búsqueda Pagefind.
2. Añadir despliegue a GitHub Pages, un artefacto de preview para cada pull
   request y verificación de enlaces.
3. Definir componentes para pasos, advertencias, diferencias por plataforma,
   capturas y referencias al código.

### Fase 2 — Fuente de verdad

1. Crear una matriz de funcionalidades a partir de rutas, botones, atajos,
   contratos y pruebas reales.
2. Marcar cada afirmación como verificada, planeada o no soportada.
3. Convertir `docs/user-guide/` en contenido bilingüe o migrarlo al sitio sin
   mantener dos fuentes canónicas.

### Fase 3 — Contenido de usuario (base publicada)

1. Publicar primero App básico y LaTeX básico en español e inglés.
2. Añadir niveles intermedios con capturas de Windows, macOS y Linux sólo donde
   la interfaz difiera.
3. Cerrar los niveles avanzados con procedimientos reproducibles y diagnósticos.

### Fase 4 — Contribución

1. Documentar App, Plugins, Languages y Profiles desde sus esquemas actuales.
2. Enlazar cada comando a un script real del repositorio.
3. Añadir una página de compatibilidad entre versiones de los cuatro repos.

### Fase 5 — Sustitución de la wiki

1. Cambiar los enlaces de la app y README al sitio de Pages.
2. Reemplazar cada página de la wiki por una nota breve de migración.
3. Mantener la wiki en sólo lectura durante una versión y después desactivarla.

## Puertas de calidad

- Paridad de páginas entre `es` y `en`; una página nueva no se publica en un
  solo idioma salvo que quede marcada como traducción pendiente.
- Build del sitio, enlaces internos/externos y fragmentos JSON/YAML válidos en
  CI.
- Revisión contra la versión actual de la app antes de cada release.
- Capturas con resolución, tema y datos de ejemplo estandarizados.
- Términos técnicos protegidos: LaTeX, Tectonic, latexmk, amsmath, TikZ,
  pgfplots, circuitikz, mhchem y nombres de formatos.
- Ningún atajo, botón o capacidad se documenta sin una referencia a código o
  prueba que confirme su existencia.

## Criterio de terminado

La migración termina cuando los tres módulos y los cuatro recorridos de
contribución existen en español e inglés, la app enlaza al nuevo sitio, la wiki
sólo redirige y el pipeline impide publicar páginas desactualizadas o sin par.
