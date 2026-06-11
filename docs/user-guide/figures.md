# Figuras y editores visuales

TeXisStudio tiene tres formas de insertar una figura:

| Tipo | Cuándo usar |
|---|---|
| **Figura de archivo** | Tienes una imagen (PNG, PDF, SVG) lista y quieres incluirla. |
| **Figura visual** | Quieres un diagrama sencillo (Venn, flujo, reacción química) generado directamente desde la app. |
| **Figura de plugin** | Quieres una figura matemática, estadística o de ingeniería con opciones avanzadas. |

---

## Insertar una figura de plugin

1. Haz clic en **+** en la sección y elige **Figura de plugin**, o usa Ctrl+K → "figura".
2. Se abre el **Selector de figuras** con los tipos disponibles filtrados por nivel de dificultad:
   - **Fácil** — editor visual completo, sin conocimiento de LaTeX.
   - **Intermedio** — editor visual con algunos campos técnicos opcionales.
   - **Avanzado** — requiere familiaridad con la sintaxis del engine.
3. Selecciona el tipo de figura y haz clic en **Insertar**.
4. La figura se genera con un ejemplo mínimo y aparece en el bloque.

---

## Editar una figura con el editor visual

1. Haz clic en el bloque de figura de plugin.
2. Haz clic en **Editar figura** en la esquina del bloque.
3. Se abre el **Editor de figura** con dos pestañas:
   - **Editor visual** — formularios, tablas y controles específicos del tipo.
   - **Título y etiqueta** — edita el pie de figura (`\caption`) y la etiqueta (`\label`).

### Barra de herramientas del editor visual

Todos los editores visuales tienen una barra de herramientas en la parte superior:

| Control | Función |
|---|---|
| ↩ | Deshacer el último cambio (hasta 50 pasos). |
| ↪ | Rehacer. |
| Restaurar ejemplo | Reemplaza el contenido con un ejemplo mínimo funcional. |
| ? | Abre el Centro de ayuda en la sección «Figuras». |

### Aplicar cambios

Al terminar de editar, haz clic en **Aplicar** en la parte inferior del modal. El archivo de figura se regenera con el nuevo LaTeX.

---

## Editores disponibles

| Editor | Tipos de figura cubiertos |
|---|---|
| **PGFPlotsEditor** | Funciones 2D, dispersión, barras, histogramas, boxplots, barras de error, mapas de calor |
| **GraphNodeEditor** | Grafos dirigidos y no dirigidos: nodos, aristas, formas |
| **MatrixEditor** | Matrices con selector de delimitadores |
| **GanttEditor** | Diagramas de Gantt con grupos, tareas y dependencias |
| **TableDataEditor** | Tablas de datos exportables a booktabs / longtable / PGFPlots |
| **TreeForestEditor** | Árboles sintácticos, taxonómicos, filogenéticos, de decisión |

---

## Figuras visuales (sin plugin)

Para diagramas sencillos que no necesitan opciones avanzadas, usa los **bloques visuales** integrados:

- `venn_euler` — Diagramas de Venn y Euler
- `flow_diagram` — Diagramas de flujo
- `timeline` — Líneas de tiempo
- `chem_reaction` — Reacciones químicas (mhchem)
- `molecule` — Fórmulas estructurales (chemfig)
- `circuit` — Circuitos electrónicos (circuitikz)
- `feynman` — Diagramas de Feynman
- `bio_pathway` — Rutas biológicas
- `music_fragment` — Fragmentos musicales

---

## Título y etiqueta de la figura

El campo **Título** genera `\caption{…}`. El campo **Etiqueta** genera `\label{fig:…}`.

Para referenciar la figura en el texto usa `\cref{fig:etiqueta}` o inserta un bloque de cita con la paleta de comandos (Ctrl+K → «referencia»).

---

## Temas relacionados

- [Primeros pasos](getting-started.md)
- [Ecuaciones en LaTeX](minimal-latex.md)
