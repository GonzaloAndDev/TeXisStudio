# Community Dictionaries

This directory hosts community-contributed Hunspell dictionaries for TeXisStudio's
built-in spell checker.

## Structure

```
community/dictionaries/
  index.json          ← registry file read by the app
  pt-BR/
    index.aff
    index.dic
    meta.json
  it/
    index.aff
    index.dic
    meta.json
  ...
```

## How to contribute

1. **Fork** the TeXisStudio repository.
2. Create a subdirectory with the BCP-47 language code (e.g. `pt-BR`, `it`, `nl`, `pl`).
3. Add the Hunspell `.aff` and `.dic` files.
4. Add a `meta.json` in your directory:

```json
{
  "id": "pt-BR",
  "lang": "pt-BR",
  "label": "Português (Brasil)",
  "description": "Dicionário Hunspell para português brasileiro.",
  "author": "Your Name",
  "license": "LGPL-2.1",
  "source": "https://github.com/LibreOffice/dictionaries"
}
```

5. Add your entry to `index.json` (see existing entries).
6. Open a **Pull Request** against `main`.

## index.json format

```json
[
  {
    "id": "pt-BR",
    "type": "dictionary",
    "lang": "pt-BR",
    "label": "Português (Brasil)",
    "description": "Dicionário Hunspell para português brasileiro.",
    "repoPath": "community/dictionaries/pt-BR"
  }
]
```

## Licenses

Each dictionary must declare its license in `meta.json`.
Only open-source licenses (LGPL, MPL, MIT, GPL, Apache 2.0, CC-BY-SA or similar) are accepted.
The TeXisStudio app itself is licensed under **AGPL v3 + Commons Clause** — contributed
dictionaries retain their original license.

## Built-in dictionaries

The following languages are bundled by default (via npm `dictionary-*` packages):

| Code | Language    |
|------|-------------|
| `es` | Español     |
| `en` | English     |
| `fr` | Français    |
| `de` | Deutsch     |

Community dictionaries extend this list without touching the core bundle.
