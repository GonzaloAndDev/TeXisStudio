# Errores frecuentes

---

## La compilación falla y no produce PDF

**Síntomas:** el indicador de compilación muestra error rojo; no se abre ningún PDF.

**Causas y soluciones:**

1. **LaTeX no está instalado** — Comprueba la barra de estado inferior. Si el punto junto a «LaTeX» es rojo, instala TeX Live (Linux/macOS) o MiKTeX (Windows). TeXisStudio → Ajustes → Compilación muestra el estado de cada backend.

2. **Error de sintaxis en un bloque LaTeX libre** — Abre el panel de compilación (clic en el error en la barra de estado) y busca la línea `! …`. El error incluye el número de línea del `.tex` generado. Localiza el bloque correspondiente en el editor.

3. **Paquete LaTeX faltante** — El error dice algo como `File 'pgfplots.sty' not found`. Instala el paquete con tu gestor de TeX:
   - TeX Live: `tlmgr install pgfplots`
   - MiKTeX: instala automáticamente al compilar (requiere conexión).

4. **Error de bibliografía** — Si usas Biber y ves `I couldn't open file name 'references.bcf'`, compila con `latexmk -pdf -biber`. TeXisStudio lo hace automáticamente si seleccionas el backend `latexmk`.

---

## El PDF se genera pero hay símbolos extraños o cajas negras

**Causa:** la codificación de caracteres o la fuente no es compatible con el engine seleccionado.

**Solución:**
- Instala una suite completa y selecciónala como backend principal en **Configuración → Motor LaTeX**.
- Verifica que el perfil configure un motor y una fuente compatibles con el idioma del documento.
- Para XeLaTeX o LuaLaTeX, el perfil debe incluir `fontspec`; la elección concreta del motor forma parte de la configuración generada, no de una preferencia global independiente.

---

## No se ve la vista previa del PDF

**Causas:**
- El PDF no existe todavía: compila primero.
- El visor interno no pudo abrir el archivo: el PDF puede estar corrupto (compilación incompleta). Vuelve a compilar.
- En macOS con sandboxing estricto: concede permiso de acceso a la carpeta del proyecto en Sistema → Privacidad y seguridad → Archivos y carpetas.

---

## La ortografía no funciona

- Comprueba que el idioma del documento coincide con el diccionario instalado. En la barra superior, el selector de idioma muestra el idioma activo.
- Si el idioma no tiene punto verde junto al icono de diccionario, ve a Ajustes → Idioma y paquetes → instala el paquete de idioma correspondiente.

---

## La figura de plugin no se regenera

**Síntoma:** hago clic en «Aplicar» en el editor visual, pero el bloque no cambia.

**Causas:**
- El JSON del documento de la figura tiene un error de estructura — el serializer lo rechaza. Usa el botón **Restaurar ejemplo** en el editor visual para volver a un estado válido y empieza de nuevo desde ahí.
- La ruta del proyecto tiene espacios o caracteres especiales — algunos engines tienen dificultades con estas rutas. Mueve el proyecto a una ruta simple (por ejemplo, `/home/usuario/proyectos/mi-tesis`).

---

## El asistente de IA no responde

- El asistente de IA requiere conexión a internet y una clave de API configurada en Ajustes → IA.
- Si ves «Error de API», verifica que la clave sea válida y que tengas créditos disponibles.
- Las acciones de riesgo Medio o mayor requieren confirmación explícita del usuario antes de ejecutarse.

---

## Temas relacionados

- [Primeros pasos](getting-started.md)
- [LaTeX mínimo](minimal-latex.md)
