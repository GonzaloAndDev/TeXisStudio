---
title: Intermediate
description: Visual figures, citations, review tools, and LaTeX backend selection.
sidebar:
  order: 2
---

## Figures without writing LaTeX

The **Figure+** button opens the plugin picker. Filter by difficulty and choose editors for plots, trees, tables, circuits, chemistry, Gantt charts, and TikZ diagrams. After insertion, use **Edit figure** on the block to reopen its visual form.

The editor provides undo, redo, restore example, contextual help, and an advanced panel for technical fields when supported by the engine.

## Citations and references

Open the citation picker with `Ctrl+[` or `⌘[`. The `Ctrl+K` palette can also locate blocks and sections.

The final bibliography depends on the profile and backend. A complete suite through latexmk provides the broadest compatibility for Biber, indexes, and multi-pass documents.

## Choose a backend

Under **Settings → LaTeX engine**, choose Tectonic or a complete suite as the primary backend. Enable fallback so the app can use the other backend when the primary one is unavailable.
