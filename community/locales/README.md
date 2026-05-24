# Community Locales (UI translations)

This directory hosts community-contributed UI translations for TeXisStudio.

## Structure

```
community/locales/
  index.json          ← registry file read by the app
  pt-BR/
    translation.json
    meta.json
  it/
    translation.json
    meta.json
  ...
```

## Built-in languages

The following languages are bundled in the app:

| Code | Language   | Status    |
|------|------------|-----------|
| `es` | Español    | ✅ Completo |
| `en` | English    | ✅ Complete |
| `fr` | Français   | ✅ Complet  |
| `de` | Deutsch    | ✅ Vollständig |
| `zh` | 中文       | ✅ 完整     |
| `ja` | 日本語     | ✅ 完全     |

## How to contribute a new language

1. **Fork** the TeXisStudio repository.
2. Copy `texis-app/src/i18n/locales/en.json` as your starting template.
3. Create `community/locales/<lang-code>/translation.json` with all keys translated.
4. Create `community/locales/<lang-code>/meta.json`:

```json
{
  "id": "pt-BR",
  "lang": "pt-BR",
  "label": "Português (Brasil)",
  "flag": "🇧🇷",
  "author": "Your Name",
  "completeness": 100
}
```

5. Add your entry to `index.json`.
6. Open a **Pull Request** against `main`.

## Translation key reference

All keys are documented in `texis-app/src/i18n/locales/en.json`.
Keys follow the pattern `section.key`, e.g. `editor.compile`, `home.new_project`.

### Sections

| Section      | Description                        |
|--------------|------------------------------------|
| `common`     | Generic actions (save, cancel…)    |
| `lang`       | Language picker labels             |
| `home`       | Home screen                        |
| `wizard`     | New project wizard                 |
| `editor`     | Editor view                        |
| `spell`      | Spell check panel                  |
| `grammar`    | Grammar check panel                |
| `settings`   | Settings view                      |
| `validation` | Validation error messages          |

## index.json format

```json
[
  {
    "id": "pt-BR",
    "type": "locale",
    "lang": "pt-BR",
    "label": "Português (Brasil)",
    "flag": "🇧🇷",
    "description": "Tradução para português brasileiro.",
    "repoPath": "community/locales/pt-BR",
    "completeness": 100
  }
]
```

## Review process

- All keys in the reference file (`en.json`) must be present.
- Machine-translated PRs are welcome as a starting point but must be reviewed by a native speaker.
- Add yourself to the `author` field — your contribution will be credited in the app's About screen.
