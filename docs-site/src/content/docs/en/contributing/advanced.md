---
title: Advanced
description: Contracts, compatibility, security, catalogs, and coordinated releases.
sidebar:
  order: 3
---

## Cross-repository changes

1. Add the contract and compatibility layer in Plugins or Profiles.
2. Consume it from the app while preserving fallback for older versions.
3. Update catalogs, checksums, and minimum versions only when installers consume them.
4. Publish documentation and end-to-end tests.

## Gates

- App: TypeScript, Vitest, build, i18n, and applicable Rust tests.
- Plugins: manifests, registry, serializers, and real compilation.
- Languages: JSON/YAML, key parity, placeholders, capabilities, and dictionary licenses.
- Profiles: schema, institutional fixtures, catalog, and packaging.

Do not enable shell escape by default. Treat LaTeX options, URLs, and downloaded files as untrusted input. Releases are complete only when remote catalogs and documentation match the version consumed by the app.
