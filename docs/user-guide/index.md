# Guía de usuario — TeXisStudio

Documentación compacta para el **Centro de ayuda** integrado. El sitio bilingüe completo vive en [`../../docs-site/`](../../docs-site/).

---

## Contenidos

| Archivo | Sección en el Centro de ayuda | Descripción |
|---|---|---|
| [getting-started.md](getting-started.md) | Primeros pasos | Crear proyecto, editor de bloques, compilar |
| [figures.md](figures.md) | Figuras | Tipos de figura, editores visuales, título/etiqueta |
| [minimal-latex.md](minimal-latex.md) | LaTeX mínimo | Llaves, comandos, subíndices, fracciones, símbolos |
| [errors.md](errors.md) | Errores frecuentes | Diagnósticos y soluciones para los problemas más comunes |

---

## Convenciones

- Los archivos están en español y deben mantenerse alineados con las claves i18n del Centro de ayuda.
- Los encabezados H2 corresponden a secciones que el Centro de ayuda puede enlazar directamente con `HelpLink`.
- Los fragmentos de código LaTeX van en bloques de código con ` ```latex `.
- Las tablas de comandos usan tres columnas: **LaTeX** | **Resultado** | **Nota**.

---

## Cómo mantener esta documentación

Al añadir una feature nueva que el usuario final interactúa directamente:

1. Añade o actualiza la sección relevante en el archivo correspondiente.
2. Si la feature tiene su propia sección en el Centro de ayuda, añade el encabezado H2 con el mismo texto que la clave `help.section_*` en los locales de i18n.
3. Actualiza el `CHANGELOG.md` del repo principal.

---

## Relación con el Centro de ayuda integrado

El Centro de ayuda (`src/components/help/HelpCenter.tsx`) tiene 5 secciones:

| Sección (`HelpSection`) | Archivo fuente |
|---|---|
| `start` | `getting-started.md` |
| `figures` | `figures.md` |
| `latex` | `minimal-latex.md` |
| `errors` | `errors.md` |
| `faq` | — (generado inline desde i18n) |

La implementación actual renderiza las secciones directamente desde i18n (sin parsear estos archivos). El contenido web más amplio y bilingüe se mantiene en `docs-site/`.
