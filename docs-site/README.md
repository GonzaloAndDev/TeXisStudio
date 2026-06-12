# TeXisStudio Documentation Site

Official bilingual documentation built with Astro Starlight.

```bash
npm install
npm run check
npm run dev
```

Spanish is served at the site root and English under `/en/`. Equivalent pages
must use the same file path in both locales so the language switcher preserves
context.

The site is deployed by `.github/workflows/docs.yml`. Pull requests build a
downloadable `documentation-preview` artifact; pushes to `main` deploy to
GitHub Pages.

## Content rules

- Do not document planned behavior as available.
- Verify buttons, shortcuts, formats, and commands against the current code.
- Update Spanish and English together.
- Keep technical identifiers such as LaTeX, Tectonic, latexmk, amsmath, TikZ,
  pgfplots, circuitikz, and mhchem unchanged.
