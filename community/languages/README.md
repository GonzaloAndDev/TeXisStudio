# TeXisStudio — Community Language Packages

Downloadable language packs that extend TeXisStudio without inflating the installer.

## Available packages

| ID | Language | UI | Spelling | Grammar | Status |
|----|----------|----|----------|---------|--------|
| `ru` | Русский (Russian) | ✅ | ✅ | ✅ LT | stable |
| `pt-BR` | Português — Brasil | ✅ | ✅ | ✅ LT | stable |
| `th` | ภาษาไทย (Thai) | ✅ | — | — | beta |
| `hi` | हिन्दी (Hindi) | ✅ | — | — | beta |
| `nah` | Nāhuatl | ✅ | — | — | experimental |
| `yua` | Maaya t'aan (Yucatec Maya) | ✅ | — | — | experimental |
| `tzh` | Batz'il k'op (Tzeltal) | ✅ | — | — | experimental |
| `mix` | Tu'un Savi (Mixtec) | ✅ | — | — | experimental |
| `zap` | Diidxazá (Zapotec) | ✅ | — | — | experimental |

**Bundled in the app** (always available): `es`, `en`, `fr`, `de`, `zh`, `ja`

> **Indigenous Mexican languages** — The five most-spoken indigenous languages of Mexico
> (INEGI 2020 census). All translations are community-contributed and experimental.
> Native speaker review is strongly encouraged. Spell-check and grammar-check require
> Hunspell dictionaries and LanguageTool support respectively — neither exists yet for
> these languages. Contributions welcome!

## Package structure

```
languages/
  catalog.json          ← master registry (read by the app)
  ru/
    language.yaml       ← capabilities, maintainers, LaTeX config (human)
    ui.json             ← full UI translation (i18next compatible)
    autocorrect.json    ← autocorrect rules table
    latex.json          ← LaTeX/babel/polyglossia config
  pt-BR/
    ...
  th/
    language.yaml
    ui.json
    latex.json
  hi/
    language.yaml
    ui.json
    latex.json
```

## Capability model

Every language declares its capabilities honestly in `language.yaml`:

| Capability | Meaning |
|---|---|
| `ui` | Full UI translation available |
| `spelling` | Hunspell dictionary available |
| `autocorrect` | Autocorrect rules table present |
| `grammar_remote` | LanguageTool remote API works for this language |
| `grammar_local` | Offline grammar checker available |
| `latex_babel` | babel package name declared |
| `latex_polyglossia` | polyglossia config available |

The app **never offers a capability that isn't declared** — e.g., Thai won't show
a spell-check panel because `spelling: false`.

## Adding a new language

1. Fork the repo and create `community/languages/<bcp47>/`
2. Copy `ru/language.yaml` and fill in all fields
3. Translate `ru/ui.json` → `<lang>/ui.json` (all keys from `en/ui.json` in the app)
4. If Hunspell dictionaries exist (e.g. via npm `dictionary-*`), add CDN URLs
5. Add your entry to `catalog.json`
6. Open a Pull Request — CI validates the JSON and checks all required keys

## Status meanings

| Status | Meaning |
|---|---|
| `stable` | Full test coverage, reviewed by native speaker |
| `beta` | Functional but not fully reviewed |
| `experimental` | Machine-translated or partial — use with caution |

## Spelling dictionary sources

- Russian: [`dictionary-ru`](https://www.npmjs.com/package/dictionary-ru) (LGPL 2.1)
- Portuguese: [`dictionary-pt`](https://www.npmjs.com/package/dictionary-pt) (LGPL 2.1)
- Thai: no open Hunspell dictionary available (Thai word segmentation requires libthai)
- Hindi: no reliable open Hunspell dictionary (contributions welcome)

Dict files are **not committed** to this repo — they are fetched from jsDelivr CDN at
install time. This keeps the repo lightweight.
