---
title: Basic
description: Report issues, improve documentation, and fix translations with small changes.
sidebar:
  order: 1
---

## Choose the repository

- **TeXisStudio**: app, Rust core, CLI, and documentation.
- **TeXisStudio-Plugins**: engines, serializers, and visual figure catalog.
- **TeXisStudio-Languages**: UI, LaTeX language configuration, and writing tools.
- **TeXisStudio-Profiles**: institutional formats and academic styles.

## A good first contribution

1. Find an existing issue or open one with reproducible steps.
2. Keep the change focused on one problem.
3. Update tests or documentation when behavior changes.
4. Run the repository checks.
5. Explain what changed and how you verified it.

For UI translations, `en.json` defines the schema and `es.json` is the second editorial reference. Preserve keys, `{{...}}` variables, HTML, and LaTeX commands.
