---
title: Avanzado
description: Diagnóstico, portabilidad, motores y recuperación del proyecto.
sidebar:
  order: 3
---

## Qué significa cada backend

- **Tectonic** es autocontenido y obtiene paquetes bajo demanda. Es práctico para empezar y para documentos compatibles con su ecosistema.
- **Suite completa** significa que TeXisStudio invoca `latexmk`; la distribución instalada puede ser MacTeX, TeX Live o MiKTeX.

TeXisStudio no expone pdfLaTeX, XeLaTeX y LuaLaTeX como tres preferencias globales independientes. La selección interna del motor depende del perfil y de la configuración generada para el documento.

## Diagnosticar una compilación

1. Confirma el backend seleccionado y su disponibilidad.
2. Revisa primero los errores estructurados; después consulta el log completo.
3. Si Tectonic no cubre un paquete especializado, instala una suite completa y habilita fallback.
4. Si una figura falla, abre su editor y usa **Restaurar ejemplo** para comprobar si el problema está en los datos personalizados.

## Portabilidad

El proyecto conserva su modelo estructurado y genera archivos LaTeX. Mantén juntos el proyecto, sus recursos y bibliografía. Para entregar o archivar, verifica también el PDF resultante y no sólo la existencia del archivo.

## Recuperación

Los editores visuales conservan historial local durante la sesión. **Deshacer** y **Rehacer** cubren cambios dentro del modal; **Restaurar ejemplo** reemplaza el documento visual actual por un ejemplo válido del motor.
