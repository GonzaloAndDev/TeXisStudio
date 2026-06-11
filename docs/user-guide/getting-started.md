# Primeros pasos con TeXisStudio

TeXisStudio genera documentos académicos en LaTeX de calidad editorial a partir de un editor visual por bloques. No es necesario saber LaTeX para empezar.

---

## Crear un proyecto

1. Abre TeXisStudio.
2. En la pantalla de inicio, haz clic en **Nuevo proyecto**.
3. El asistente te pide:
   - **Tipo de documento** — tesis, tesina, maestría, doctorado, etc.
   - **Perfil institucional** — elige el de tu universidad o uno genérico.
   - **Carpeta del proyecto** — elige una carpeta en tu computadora (puede estar en OneDrive o Google Drive para escritorio).
4. Al finalizar el asistente, el proyecto se abre en el **Editor de bloques**.

---

## El editor de bloques

La pantalla principal tiene tres partes:

```
[Árbol de secciones] | [Bloques del capítulo activo] | [Panel de metadatos]
```

- **Árbol de secciones**: lista todas las secciones del documento (Introducción, Metodología, etc.). Haz clic para navegar entre ellas.
- **Área de bloques**: cada sección es una lista de bloques. Los bloques pueden ser párrafos, títulos, ecuaciones, figuras, tablas, citas, etc.
- **Panel de metadatos**: muestra propiedades del bloque seleccionado (etiqueta LaTeX, nivel de revisión).

### Añadir bloques

Haz clic en el botón **+** al final de la sección o usa la **Paleta de comandos** (Ctrl+K / ⌘K) para insertar cualquier tipo de bloque.

### Reordenar bloques

Arrastra el ícono de la izquierda de cada bloque para moverlo dentro de la sección.

---

## Compilar el PDF

1. En la barra superior, haz clic en **Compilar** (o Ctrl+Enter).
2. Si hay advertencias, aparece el panel de revisión previo. Puedes ignorarlas y continuar.
3. El PDF se abre en el visor integrado.

> **Nota:** Para compilar necesitas LaTeX instalado (recomendado: TeX Live completo). Si no tienes LaTeX, TeXisStudio detecta el problema y te muestra instrucciones de instalación.

---

## Guardar el trabajo

TeXisStudio guarda automáticamente cada vez que dejas de escribir (debounce de 800 ms). El indicador de estado en la barra inferior muestra `Guardado` o `No guardado`.

---

## Temas relacionados

- [Figuras y editores visuales](figures.md)
- [Ecuaciones en LaTeX](minimal-latex.md)
- [Errores frecuentes](errors.md)
