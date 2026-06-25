<!-- Describe el cambio de forma clara. Enlaza issue/plan/ADR si aplica. -->

## Qué y por qué

## Declaración (Programa §17 / §8)

- **Frontera arquitectónica afectada:**
- **Contratos añadidos o cambiados:** (DocumentIR / Profile / Pack / Plugin / manifest)
- **Migración:** (N/A si no aplica)
- **Compatibilidad:** (entre repos / versiones)
- **Rollback:** (cómo revertir)

## Checklist

- [ ] `cargo fmt --all -- --check`
- [ ] `cargo clippy --workspace --all-targets -- -D warnings`
- [ ] `cargo test --workspace`
- [ ] Frontend: `npm run build` + `npm test` (si toca `texis-app/`)
- [ ] `certify` estructural verde (si toca el núcleo documental)
- [ ] ADR añadido/actualizado (si es decisión transversal)
- [ ] Sin `TeXisStudio.code-workspace` ni cambios locales de entorno
- [ ] Commits firmados y Conventional Commits
- [ ] Sin secretos ni contenido académico en el diff
- [ ] Núcleo legado intacto (o fix crítico justificado)
