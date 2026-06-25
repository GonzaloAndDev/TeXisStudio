# Política de recuperación de datos

Programa Industrial §2. TeXisStudio protege el trabajo del usuario y **nunca
sobrescribe en silencio** el último estado recuperable.

## Garantías

- **Guardado transaccional:** cada guardado valida → escribe temporal → `fsync` →
  `rename` atómico → verifica relectura, con journal y snapshot del estado previo.
  Ante un fallo, se restaura el estado anterior (rollback) — no hay estados a medias.
- **Snapshots:** copias verificables con retención configurable y restauración
  atómica.
- **Integridad:** checksums sha256 detectan corrupción o modificación externa.
- **Lock de proyecto:** evita que dos ventanas/instancias corrompan el proyecto.

## Recovery Center

Si al abrir un proyecto se detectan problemas, el Recovery Center los **reporta**
(operaciones incompletas, temporales residuales, problemas de integridad,
snapshots disponibles, titular del lock) y ofrece acciones — sin borrar ni
sobrescribir automáticamente.

## Procedimientos

Ver los runbooks: [`runbooks/project-corruption.md`](runbooks/project-corruption.md)
y [`runbooks/failed-migration.md`](runbooks/failed-migration.md).

## Implementación

Crate `texis-platform` (módulos `atomic`, `lock`, `journal`, `integrity`,
`snapshot`, `lifecycle`, `recovery`), expuesto a la app con los comandos
`recovery_scan`, `recovery_list_snapshots`, `recovery_restore_snapshot` y
`verify_integrity`.
