# TeXisStudio — Community Language Packages

Downloadable language packs that extend TeXisStudio without inflating the installer.
Born in Mexico, built for the world — including minority and indigenous languages.

---

## Table of contents

1. [Architecture overview](#architecture-overview)
2. [Available packages](#available-packages)
3. [Package structure](#package-structure)
4. [Capability model](#capability-model)
5. [Catalog format](#catalog-format)
6. [Security model](#security-model)
7. [Contributing a language](#contributing-a-language)
8. [Personal dictionary](#personal-dictionary)
9. [Specialized domain dictionaries](#specialized-domain-dictionaries)
10. [Status meanings](#status-meanings)
11. [Spelling dictionary sources](#spelling-dictionary-sources)

---

## Architecture overview

TeXisStudio separates language support into **three independent layers**.
A language pack can implement any combination of them — they do not have to come together.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 · UI Language                                      │
│  Translations for menus, buttons, panels, error messages.   │
│  Lives in: ui.json  (i18next format)                        │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 · Document Language (LaTeX)                        │
│  babel / polyglossia config, chapter names, bibliography    │
│  label, figure/table labels, hyphenation engine choice.     │
│  Lives in: latex.json + language.yaml                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 3 · Writing Tools                                    │
│  Spell-check dictionary (Hunspell .aff + .dic),             │
│  autocorrect rules, grammar via LanguageTool API.           │
│  Lives in: spelling/ + autocorrect.json                     │
└─────────────────────────────────────────────────────────────┘
```

**Key principle:** the app never advertises a capability that the package does not declare.
A language with `spelling: false` will never show the spell-check panel — no silent failures.

---

## Available packages

### Bundled in the app (always available, no download needed)

| ID | Language | UI | Spelling | Grammar | LaTeX |
|----|----------|----|----------|---------|-------|
| `es` | Español | ✅ | ✅ | ✅ LT | babel `spanish` |
| `en` | English | ✅ | ✅ | ✅ LT | babel `english` |
| `fr` | Français | ✅ | ✅ | ✅ LT | babel `french` |
| `de` | Deutsch | ✅ | ✅ | ✅ LT | babel `german` |
| `zh` | 中文 | ✅ | — | — | polyglossia `chinese` |
| `ja` | 日本語 | ✅ | — | — | polyglossia `japanese` |

### Community packages (downloadable from Settings → Community)

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

> **Indigenous Mexican languages** — The five most-spoken indigenous languages of Mexico
> (INEGI 2020 census: Náhuatl 1.65 M · Maya 860 K · Tzeltal 589 K · Mixtec 529 K · Zapotec 479 K).
> Translations are experimental and need native-speaker review.
> No Hunspell dictionaries or LanguageTool support exist yet for these languages —
> contributions from native speakers are warmly welcomed.

---

## Package structure

```
community/languages/
  catalog.json              ← master registry read by the app at runtime
  <bcp47>/
    language.yaml           ← metadata, capabilities, LaTeX config (human-readable)
    ui.json                 ← full UI translation (i18next format, all 9 sections)
    latex.json              ← machine-readable LaTeX config (chapter names, etc.)
    autocorrect.json        ← autocorrect rules (optional)
    spelling/               ← Hunspell files (optional — or referenced via CDN URL)
      index.aff
      index.dic
```

### `ui.json` sections

All 9 sections must be present for a complete translation:

| Section | Contents |
|---------|----------|
| `common` | Shared buttons and labels (Save, Cancel, Close…) |
| `lang` | Language picker labels |
| `home` | Home screen: project list, time labels, LaTeX status |
| `wizard` | New-project wizard: steps, placeholders |
| `editor` | Editor: block types, metadata fields, compile button |
| `spell` | Spell-check panel |
| `grammar` | Grammar panel, LanguageTool notices |
| `settings` | All 8 settings sections |
| `validation` | Error and warning messages from the document validator |

See [`../../../texis-app/src/i18n/locales/en.json`](../../texis-app/src/i18n/locales/en.json) for
the canonical key list to translate from.

### `language.yaml` reference

```yaml
id: nah                       # BCP-47 language code
name: Nahuatl                 # Name in English
native_name: "Nāhuatl"        # Name in the language itself
flag: "🌵"                    # Emoji used in the UI picker
status: experimental          # stable | beta | experimental
version: 1.0.0

maintainers:
  - name: Your Name
    contact: your@email.com   # optional

capabilities:
  ui: true                    # ui.json is present and complete
  spelling: false             # Hunspell dictionary available
  autocorrect: false          # autocorrect.json is present
  grammar_remote: false       # LanguageTool supports this language
  grammar_local: false        # Offline grammar checker available
  latex_babel: false          # babel package name declared in latex.json
  latex_polyglossia: false    # polyglossia config available in latex.json

notes:
  - Any human-readable note about this language
  - Orthography, required fonts, input methods, etc.

latex:
  engine: xelatex             # pdflatex | xelatex | lualatex
  font: "Noto Serif"          # Recommended font (for fontspec)
  encoding: UTF-8
  chapter_name: "Centlamantli"
  bibliography_name: "Tlahtolnextilihtzin"
  figure_name: "Tlaixnextiloni"
  table_name: "Tlahcuilōamaitl"
  abstract_name: "Ioltenehualiztli"
  contents_name: "Tlapohualamaitl"
```

---

## Capability model

The app reads `capabilities` from `language.yaml` and **enforces** them at runtime:

| Capability | `true` means… | `false` means… |
|---|---|---|
| `ui` | Full interface translation available | App falls back to Spanish |
| `spelling` | Hunspell dict present (or CDN URL in catalog) | Spell panel hidden |
| `autocorrect` | `autocorrect.json` present | Autocorrect silently disabled |
| `grammar_remote` | LanguageTool has an API code for this language | Grammar panel hidden |
| `grammar_local` | Offline grammar checker bundled | — (not yet implemented) |
| `latex_babel` | `latex.json` has a `babel_name` field | babel not configured |
| `latex_polyglossia` | `latex.json` has `polyglossia_name` | polyglossia not configured |

**Never set a capability to `true` if it isn't real.**
The community will catch it, users will be frustrated, and it hurts trust.

---

## Catalog format

`catalog.json` is the single file the app fetches to discover available packages.
Keep entries minimal; full metadata lives in `language.yaml`.

```jsonc
{
  "schema_version": "1.0",
  "updated_at": "YYYY-MM-DD",
  "packages": [
    {
      "id": "ru",
      "name": "Russian",
      "native_name": "Русский",
      "flag": "🇷🇺",
      "status": "stable",
      "version": "1.0.0",
      "maintainers": [{ "name": "..." }],
      "capabilities": { /* same shape as language.yaml */ },

      // Required URLs — served from this repo via raw.githubusercontent.com
      "ui_url": "https://raw.githubusercontent.com/GonzaloAndDev/TeXisStudio/main/community/languages/ru/ui.json",
      "latex_url": "https://raw.githubusercontent.com/.../latex.json",

      // Optional — only when capabilities.spelling = true
      "spelling_aff_url": "https://cdn.jsdelivr.net/npm/dictionary-ru@latest/index.aff",
      "spelling_dic_url": "https://cdn.jsdelivr.net/npm/dictionary-ru@latest/index.dic",

      // Optional — only when capabilities.autocorrect = true
      "autocorrect_url": "https://raw.githubusercontent.com/.../autocorrect.json"
    }
  ]
}
```

---

## Security model

Language packs are **data only** — they cannot execute code.

| Rule | Details |
|---|---|
| No code execution | Packages contain only JSON, YAML, and Hunspell binary dicts. |
| No path traversal | Paths like `../../../` in any file field are rejected on install. |
| Atomic installation | Files are downloaded to a temp key, validated, then swapped in localStorage in one operation. A failed download leaves the previous version intact. |
| CDN pinning | Hunspell dicts are served from jsDelivr CDN (npm `dictionary-*` packages) with known, auditable release hashes. |
| No telemetry | The app only fetches URLs declared in `catalog.json`. No usage data is sent. |
| Grammar consent | If `grammar_remote: true`, the app shows an explicit privacy notice before sending text to LanguageTool. |

> **Roadmap:** `sha256` checksums will be added to each catalog entry in a future version
> to verify file integrity after download.

---

## Contributing a language

### Option A — Add a new language

1. **Fork** this repository and create `community/languages/<bcp47>/`

2. **Copy** `ru/language.yaml` and fill in every field. Be honest with `capabilities`.

3. **Translate** `ui.json` — use the canonical English keys from
   `texis-app/src/i18n/locales/en.json`.
   All 9 sections and ~190 keys must be present for `status: stable`.
   Partial translations can be submitted as `status: experimental`.

4. **Add** `latex.json` with localized chapter/bibliography/figure names.

5. **Optional:** Add `autocorrect.json` if you have correction rules.

6. **Optional:** Add Hunspell dictionary URLs to your `catalog.json` entry
   (prefer npm `dictionary-*` packages via jsDelivr CDN rather than committing large binary files).

7. **Update** `catalog.json` with your entry and bump `updated_at`.

8. **Open a Pull Request.** CI will:
   - Validate all JSON files
   - Check that all required keys are present in `ui.json`
   - Confirm that `capabilities` matches what files are actually present
   - Reject any `../` path patterns

### Option B — Improve an existing translation

1. Fork the repo and edit the relevant `ui.json` or `language.yaml`.
2. Open a PR with a description of what you changed and why.
3. If you are a native speaker verifying an `experimental` pack,
   note that in the PR and suggest upgrading the status to `beta`.

### Option C — Work locally without submitting

You don't need to submit anything to use a custom translation yourself:

1. Create your language pack files anywhere on disk.
2. In TeXisStudio → Settings → Community, click **"Install from file"**
   and select your `ui.json`.
3. The translation is stored locally and never leaves your machine.
4. If you later want to share it, export it and open a PR.

### Contribution checklist

- [ ] `language.yaml` is valid YAML and passes schema check
- [ ] BCP-47 ID is correct (`es-MX`, `ru`, `yua`, `nah-MX`, …)
- [ ] `ui.json` has all required keys (compare to `en.json`)
- [ ] `capabilities` matches what files actually exist
- [ ] Dictionary license is noted in `language.yaml` (LGPL, MIT, Apache…)
- [ ] No files larger than 5 MB committed to the repo
- [ ] No `../` path traversal in any string value
- [ ] `catalog.json` entry added / updated

---

## Personal dictionary

Every TeXisStudio user has a **personal dictionary** — words added in
Settings → Personal Dictionary that the spell checker will always accept.

### How it works

- Words are stored locally (browser `localStorage`).
- They layer on top of the language pack dictionary — no conflicts.
- The dictionary works even offline.

### Exporting and sharing

You can export your personal dictionary as a plain `.txt` file (one word per line).
This makes it easy to:

- Back it up or move it to another machine.
- Share it with colleagues in the same field.
- **Contribute it back to the community** as a domain dictionary (see below).

To import a word list: Settings → Personal Dictionary → Import `.txt`.

---

## Specialized domain dictionaries

General-purpose dictionaries don't know words like
*"acetylcholinesterase"*, *"eigenvalue"*, or *"isogeometric analysis"*.
Domain dictionaries extend the base language pack for specific fields.

### Planned structure (roadmap)

```
community/dictionaries/
  medical-es/
    dict.yaml           ← metadata, license, field: medicine
    wordlist.txt        ← one word per line (or .aff + .dic for Hunspell)
  engineering-en/
    dict.yaml
    wordlist.txt
  legal-mx/
    dict.yaml
    wordlist.txt
  computing-es/
    dict.yaml
    wordlist.txt
```

### `dict.yaml` reference (planned)

```yaml
id: medical-es
name: Medical Spanish
field: medicine
base_language: es
license: CC0-1.0
version: 1.0.0
maintainers:
  - name: ...
word_count: 12000
sources:
  - "SNOMED CT Spanish Edition"
  - "Diccionario de términos médicos — RAE"
```

### What kinds of domain dictionaries make sense?

| Field | Examples |
|-------|---------|
| Medicine & health sciences | Anatomical terms, drug names, procedures |
| Engineering (civil, mechanical, electrical) | Technical jargon, unit abbreviations |
| Computer science | Programming terms, algorithm names |
| Law | Legal terminology by country |
| Natural sciences | Taxonomy, chemical names, geological terms |
| Social sciences | Sociology, economics, political science |
| Indigenous studies | Academic terms, place names, ethnonyms |

### How to contribute a domain dictionary

1. Collect your word list (one word per line, UTF-8).
2. Create `community/dictionaries/<id>/` with `dict.yaml` and `wordlist.txt`.
3. Ensure you have the right to redistribute the word list (check its license).
4. Open a PR — we'll validate format and license before merging.

> Domain dictionaries are **not yet implemented in the app** — this is a planned feature.
> If you're interested in working on it, open an issue labeled `domain-dicts`.

---

## Status meanings

| Status | Meaning |
|--------|---------|
| `stable` | Complete, reviewed by a native speaker, test coverage |
| `beta` | Functional but not fully reviewed by a native speaker |
| `experimental` | Partial, machine-assisted, or unreviewed — use with caution |

If you are a native speaker who has reviewed an `experimental` pack and found it accurate,
please open a PR to upgrade it to `beta`. Full native-speaker review → `stable`.

---

## Spelling dictionary sources

| Language | Source | License |
|----------|--------|---------|
| Russian (`ru`) | [`dictionary-ru`](https://www.npmjs.com/package/dictionary-ru) via jsDelivr | LGPL 2.1 |
| Portuguese (`pt-BR`) | [`dictionary-pt`](https://www.npmjs.com/package/dictionary-pt) via jsDelivr | LGPL 2.1 |
| Thai (`th`) | No open Hunspell dict — Thai requires libthai word segmentation | — |
| Hindi (`hi`) | No reliable open Hunspell dict | — |
| Náhuatl, Maya, Tzeltal, Mixtec, Zapotec | No Hunspell dict exists yet | **Contributions welcome** |

Dictionary binary files (`.aff`, `.dic`) are **not committed** to this repository.
They are fetched from jsDelivr CDN at install time and cached by the browser.
This keeps the repo lightweight and dict licensing clean.

### Want to create a Hunspell dictionary for an indigenous language?

Building a Hunspell dictionary requires:
1. A **word list** (ideally 10 000+ words) with correct spelling.
2. An **affix file** (`.aff`) describing morphological rules (prefixes, suffixes).
3. A **permissive license** (CC0, CC-BY, LGPL, or MIT preferred).

Resources:
- [Hunspell documentation](https://linux.die.net/man/4/hunspell)
- [morfologik-stemming](https://github.com/morfologik/morfologik-stemming) — tool for building dicts from word lists
- [INALI corpus tools](https://www.inali.gob.mx/) — Instituto Nacional de Lenguas Indígenas

If you have a word list but not the affix rules, open an issue — the community can help.

---

## Acknowledgements

This language architecture was designed following the principle that **language support
should be honest, modular, and community-driven** — not a marketing checkbox.

The three-layer model (UI · Document · Writing tools) ensures that a user who installs
a Náhuatl pack gets a genuinely translated interface and correct LaTeX chapter names,
without the app pretending to offer spell-check that doesn't yet exist.

Every language added here is one more step toward a world where academic writing tools
work for everyone — not just speakers of half a dozen major languages.

**Tlahtlahzohcamati. Yáax dzo'ok. Ts'o'ok k'op. Ndaticuijui. Riní.**
*(Thank you — in Náhuatl, Maya, Tzeltal, Mixtec, and Zapotec.)*
