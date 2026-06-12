---
title: Advanced
description: Diagnostics, portability, engines, and project recovery.
sidebar:
  order: 3
---

## What each backend means

- **Tectonic** is self-contained and fetches packages on demand.
- **Complete suite** means TeXisStudio invokes `latexmk`; the installed distribution may be MacTeX, TeX Live, or MiKTeX.

TeXisStudio does not expose pdfLaTeX, XeLaTeX, and LuaLaTeX as three independent global preferences. Internal engine selection depends on the profile and generated document configuration.

## Diagnose a compilation

1. Confirm the selected backend and its availability.
2. Read structured errors first, then inspect the full log.
3. If Tectonic lacks a specialized package, install a complete suite and enable fallback.
4. If a figure fails, open its editor and use **Restore example** to isolate custom data problems.

## Recovery and portability

Visual editors keep local history while open. Undo and redo cover changes in the modal; restore example replaces the current visual document with a valid engine sample. Keep the project, assets, and bibliography together when archiving or moving work.
