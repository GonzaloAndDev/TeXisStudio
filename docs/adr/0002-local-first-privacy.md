# ADR 0002 — Local-first estricto y privacidad por defecto

- Estado: **Aceptado**
- Fecha: 2026-06-25
- Owners: @GonzaloAndDev
- Programa: "Profesionalización Industrial" §3

## Contexto

TeXisStudio maneja contenido académico sensible (tesis no publicadas, datos de
investigación). El producto es una app de escritorio. Una filtración silenciosa de
contenido a un servicio remoto sería un fallo grave de confianza.

## Decisión

TeXisStudio es **local-first estricto**. Por defecto:

- ningún contenido académico sale del equipo;
- ninguna telemetría está activa;
- ningún plugin accede a red ni a filesystem arbitrario;
- ningún servicio de IA/gramática recibe texto sin **consentimiento contextual**;
- ninguna actualización se instala sin política visible.

Todo servicio conectado debe declarar, antes de enviar nada: proveedor, datos
enviados, finalidad, retención conocida y alternativa local. Las credenciales se
guardan en el almacén seguro del SO (Keychain/Credential Manager/Secret Service),
nunca en JSON ni `localStorage`.

## Alternativas consideradas

- **Telemetría opt-out**: rechazada; viola "privacidad por defecto".
- **Sync/cuenta en la nube ahora**: fuera de alcance (ver Supuestos del programa).

## Consecuencias

**Positivas** — confianza, cumplimiento por diseño, superficie de ataque menor.

**Costes** — más fricción para funciones conectadas (requieren UI de
consentimiento) y para diagnósticos remotos (crash reporting es opt-in y redactado).

## Migración

Cualquier feature que envíe datos debe pasar por la capa de consentimiento; las
existentes se auditan contra esta regla (gate de producción: "envío de datos sin
consentimiento" bloquea `stable`).

## Condiciones de revisión

Introducción de colaboración en tiempo real o almacenamiento propio (requeriría un
ADR nuevo que redefina el modelo de datos y consentimiento).
