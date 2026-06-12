---
title: Intermedio
description: Figuras visuales, citas, revisión y selección del backend LaTeX.
sidebar:
  order: 2
---

## Figuras sin escribir LaTeX

El botón **Figura+** abre el selector de plugins. Puedes filtrar por dificultad y elegir editores para gráficas, árboles, tablas, circuitos, química, Gantt y diagramas TikZ. Después de insertar una figura, usa **Editar figura** en su bloque para volver al formulario visual.

El editor ofrece deshacer, rehacer, restaurar el ejemplo, ayuda contextual y un panel avanzado para campos técnicos cuando el motor los admite.

## Citas y referencias

Abre el selector de citas con `Ctrl+[` o `⌘[`. La paleta `Ctrl+K` también permite localizar bloques y secciones.

La bibliografía final depende del perfil y del backend. Una suite completa mediante latexmk ofrece la ruta más compatible para Biber, índices y documentos de varias pasadas.

## Revisión

Los controles de ortografía y gramática dependen del idioma y de las capacidades del paquete instalado. La app no anuncia una capacidad ausente en el paquete activo.

## Elegir motor

En **Configuración → Motor LaTeX** selecciona Tectonic o suite completa como backend principal. Activa el fallback para que la app pruebe el otro backend cuando el elegido no esté disponible.

Esta preferencia establece el valor inicial de la pantalla de compilación; todavía puedes cambiarlo para una compilación concreta.
