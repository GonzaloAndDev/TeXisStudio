# Presupuestos de rendimiento — TeXisStudio

Programa Industrial §7. Objetivos verificables para mantener la app fluida en
equipos modestos (referencia: 16 GB RAM, SSD). Una regresión por encima del
presupuesto **bloquea** salvo aprobación documentada.

## Presupuestos objetivo

| Operación | Presupuesto | Notas |
| --------- | ----------- | ----- |
| Arranque en frío (hasta UI interactiva) | < 2.5 s | sin proyecto abierto |
| Apertura de tesis (100 pág.) | < 1.0 s | import + validación estructural |
| Guardado transaccional | < 300 ms | `texis-platform::transactional_save` (lock+snapshot+atomic+journal) |
| Validación incremental | < 150 ms | por cambio de módulo, vía grafo de dependencias |
| Preview de módulo | < 500 ms | render de una fase, sin compilar todo |
| Ensamblado (`build-plan`, sin PDF) | < 500 ms | IR → plan → render → manifiesto |
| Memoria en reposo (1 proyecto) | < 400 MB | proceso principal |
| Bundle de la app | < 60 MB | instalador por plataforma |

## Cómo se mide

- **Núcleo (Rust):** `certify`/`build-plan` ya son deterministas; los tiempos se
  miden en el job nightly (`document-matrix`). Para micro-operaciones se pueden
  añadir benches con `criterion` por crate cuando una operación entre en zona de
  riesgo (no antes — evitar benchmarks decorativos).
- **Plataforma:** `transactional_save`, `dir_digest` y `recovery::scan` se miden
  en el job `platform`.
- **Frontend/app:** arranque y memoria se miden manualmente en cada RC y, cuando
  haya runners adecuados, con trazas de Tauri.

## Estrategia de rendimiento

Integrada con el grafo semántico del núcleo (`texis-document-domain::graph`):

- caché por contenido (hashes del manifiesto de build);
- invalidación precisa (`invalidation_set`) para recompilar solo lo afectado;
- operaciones cancelables y con backpressure (capa de aplicación);
- carga diferida de plugins y UI.

## Enforcement

- El job **nightly** ejecuta la matriz pesada y las pruebas de plataforma.
- Las regresiones de presupuesto se revisan en el RC (release candidate); no se
  promueve a `stable` una regresión grave sin justificación documentada (gate §12).
