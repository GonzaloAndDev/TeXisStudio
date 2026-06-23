# TeXisStudio: Master Plan for Document Module Hardening

Status: execution plan  
Audience: implementation agent and maintainers  
Scope: TeXisStudio, TeXisStudio-Profiles, TeXisStudio-Languages, TeXisStudio-Plugins

## 1. Objective

Turn the universal parts of an academic thesis into independently maintainable,
professionally tested document modules:

1. Cover and institutional title pages
2. Preliminary matter and generated indexes
3. Main body
4. Bibliography and references
5. Appendices
6. Final document assembly

Each module must own its domain model, normalization, validation, LaTeX rendering,
PDF checks, UI capabilities, and fixtures. The application shell must assemble
modules through stable contracts instead of duplicating document-order rules.

This is a modular monolith, not a microservice conversion. Modules are isolated by
Rust and TypeScript APIs, dependency rules, schemas, and tests while remaining in
one application and one build pipeline.

## 2. Current Findings

The implementation must begin from these observed constraints:

- `project::ProjectModel` is the active YAML model used by the editor, generator,
  validators, importer, exporter, CLI, and Tauri project commands.
- `texis_project::TexisProject` is a second model used by `build_engine` and
  `template_engine`.
- `generator` and `template_engine` can both decide document order and emit
  `main.tex`. They have already diverged in the past.
- `main_tex.rs` currently owns assembly, package inference, language setup,
  typography, document metadata, indexes, bibliography, glossary, and ordering.
- `sections.rs` renders the cover, every section type, and all content blocks.
- Profiles contain historical aliases such as `cover`, `toc`, `bibliography`, and
  sometimes declare appendices as `back_matter`.
- Language packs provide LaTeX configuration, but document labels and generated
  headings are also hardcoded in core renderers.
- Visual plugins export raw LaTeX blocks and required packages. The document core
  must validate and normalize those contributions before assembly.
- Postflight checks inspect the final PDF, but they do not receive the resolved
  document contract, expected language, profile requirements, or module ownership.

Therefore, moving functions into new files is insufficient. The first architectural
goal is one canonical document plan and one assembly pipeline.

## 3. Non-Negotiable Invariants

1. A project has one persisted source of truth during this migration:
   `project::ProjectModel`.
2. A build has one normalized, immutable source of truth:
   `ResolvedDocument`.
3. Only `DocumentAssembler` may decide global ordering or emit `main.tex`.
4. A document module may emit fragments and requirements, never reorder another
   module or write another module's files.
5. Profiles declare policy and institutional requirements; they do not execute
   arbitrary Rust, TypeScript, shell, or unrestricted LaTeX generation.
6. Language packs supply localized document vocabulary and language configuration;
   UI translations remain separate from document translations.
7. Plugins contribute typed content/artifacts and package requirements; they do not
   mutate the preamble or final document directly.
8. Existing projects must load and compile throughout the migration.
9. Generated stress projects and PDFs stay outside repositories.
10. Every phase ends with clean worktrees and focused commits in each affected repo.

## 4. Target Architecture

```text
ProjectModel + Profile + DocumentLocale + PluginContributions
                              |
                              v
                    DocumentResolver
          aliases, defaults, policy, compatibility
                              |
                              v
                     ResolvedDocument
             immutable canonical build contract
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
        CoverModule     FrontMatterModule   BodyModule
             |                |                |
             +----------+-----+-----+----------+
                        |           |
                        v           v
              BibliographyModule  AppendixModule
                        \           /
                         \         /
                          v       v
                    DocumentAssembler
            package plan, file plan, main.tex
                              |
                              v
                  Compiler -> Module Postflight
```

### 4.1 Canonical build contract

Create `texis-core/src/document_model/` with:

- `ResolvedDocument`
- `ResolvedMetadata`
- `ResolvedSection`
- `DocumentPhase`
- `DocumentLocale`
- `DocumentCapabilities`
- `PackageRequirement`
- `AssetRequirement`
- `RenderFragment`
- `ModuleDiagnostic`
- `ModuleId`

`DocumentPhase` must be explicit and ordered:

```rust
pub enum DocumentPhase {
    Cover,
    FrontMatter,
    MainMatter,
    Appendices,
    BackMatter,
}
```

Do not infer phase from directory names or arbitrary strings after resolution.

### 4.2 Shared module contract

Create `texis-core/src/document_modules/contract.rs`:

```rust
pub trait DocumentModule {
    fn id(&self) -> ModuleId;
    fn supports(&self, document: &ResolvedDocument) -> bool;
    fn validate(&self, context: &ModuleContext) -> Vec<ModuleDiagnostic>;
    fn requirements(&self, context: &ModuleContext) -> ModuleRequirements;
    fn render(&self, context: &ModuleContext) -> CoreResult<ModuleOutput>;
    fn postflight(&self, context: &PostflightContext) -> Vec<ModuleDiagnostic>;
}
```

`ModuleOutput` contains only owned files, ordered fragments, and declared
requirements. It cannot write to disk. A shared writer applies the file plan and
respects `FileState::Manual`.

### 4.3 Dependency rule

Allowed:

```text
modules -> document_model, rendering primitives, diagnostics
assembler -> module contract, resolved outputs
resolver -> ProjectModel, Profile, locale/plugin DTOs
UI/Tauri/CLI -> application services
```

Forbidden:

```text
cover -> bibliography
bibliography -> appendices
plugin -> assembler internals
profile -> renderer internals
module -> filesystem writer
module -> compiler process
```

Add an architecture test that rejects forbidden imports and direct `main.tex`
generation outside the assembler.

## 5. Module Responsibilities

### 5.1 Cover module

Owns:

- Institutional identity, logos, title, subtitle, author, degree, advisors,
  committee, city, date, signatures, legal notices, and optional secondary cover.
- Layout variants and overflow strategy.
- Accessible fallback when assets or fonts are unavailable.
- PDF metadata derived from the same normalized cover metadata.

Profile contract:

- Replace unrestricted single-template behavior with a versioned
  `cover_spec`, while preserving `title_page_template` as a legacy adapter.
- Support ordered blocks, required fields, asset roles, spacing bounds,
  committee placement, signature pages, and overflow policy.
- Allow an advanced trusted template only when explicitly marked and validated.

Required checks:

- Required data and official assets.
- No cover spill unless the profile explicitly defines multiple cover pages.
- No clipped blocks, orphaned advisor/city lines, missing logo, or placeholder data.
- PDF title and author metadata match normalized project metadata.

### 5.2 Front matter and indexes module

Owns:

- Dedication, acknowledgements, declarations, abstracts, keywords, epigraph,
  nomenclature, glossary/acronym presentation, table of contents, and lists of
  figures, tables, algorithms, and listings.
- Roman numbering policy, ToC inclusion, heading visibility, ordering, and blank
  page policy.

Profile contract:

- `front_matter.order`
- required/optional item rules
- numbering and ToC policy
- abstract languages and word limits
- enabled generated lists and empty-list behavior

Language contract:

- Localized generated labels such as contents, figures, tables, glossary,
  acronyms, declaration labels, and abstract names.
- No hardcoded Spanish headings in renderers.

Required checks:

- Stable order regardless of YAML section order.
- No empty generated index unless profile/user explicitly allows it.
- Correct language and numbering transition into main matter.

### 5.3 Body module

Owns:

- Chapters and sections, content block rendering, labels, cross-references,
  figures, tables, equations, theorems, code, citations, and plugin blocks.
- Chapter file naming and stable ordering.
- Block-level package and asset requirements.

Plugin contract:

- Introduce a versioned `DocumentContribution` DTO.
- Contributions declare semantic kind, source, editable payload reference,
  output artifact, required packages, labels, caption, language, and warnings.
- Core sanitizes paths, labels, package requests, and LaTeX before accepting the
  contribution.
- Raw LaTeX remains an explicit advanced escape hatch with trust state.

Required checks:

- Unique and valid labels.
- All references, citations, assets, and plugin outputs resolve.
- Plugin artifacts survive save/load/export/import.
- Package conflicts are diagnosed before compilation.

### 5.4 Bibliography module

Owns:

- Bibliography source discovery, parsing, normalization, duplicate resolution,
  citation validation, backend/style compatibility, build requirements, and final
  bibliography placement.
- Biber/BibTeX command plan and bibliography-specific diagnostics.

Profile contract:

- Canonical style ID, backend constraints, heading policy, sorting, locale, URL/DOI
  requirements, and optional institutional bibliography rules.

Required checks:

- Realistic fixtures for APA, Vancouver, IEEE, Chicago notes, MHRA, ABNT, and
  GB/T 7714.
- Missing fields, malformed names, fake placeholder authors, unresolved citation
  keys, duplicate entries, and incompatible backend/style pairs.
- Bibliography appears once and only in the declared phase.

### 5.5 Appendix module

Owns:

- Appendix groups, numbering, titles, per-appendix labels, tables/figures/equations,
  included external documents, and appendix-specific ToC behavior.
- Transition from main matter to appendices and from appendices to back matter.

Profile contract:

- `appendices.allowed`, `required`, title style, numbering style, ToC depth,
  placement relative to bibliography, and external-PDF policy.

Required checks:

- Canonical `DocumentPhase::Appendices`; never represent appendices as back matter.
- No `.1.1` numbering, duplicate “Appendix A” prefixes, or bibliography inside an
  appendix counter context.
- Empty appendices and unsafe external files are diagnosed.

### 5.6 Assembler

Owns only:

- Calling modules in canonical phase order.
- Merging and resolving package requirements.
- Building a deterministic file plan.
- Emitting readable `main.tex`, preamble/config files, and module inputs.
- Applying atomic writes and manual-file preservation.
- Producing a machine-readable `build-manifest.json` with module ownership,
  versions, files, packages, assets, warnings, and hashes.

The assembler contains no institution-specific layouts, bibliography parsing,
content-block rendering, or localized labels.

## 6. Cross-Repository Contracts

### TeXisStudio-Profiles

- Introduce profile schema 2.x only after core can read both 1.x and 2.x.
- Add canonical phases and module-specific configuration.
- Migrate aliases on load first, then migrate repository YAML in a separate commit.
- Correct existing semantic errors, including appendices stored as `back_matter`
  and repeated/misidentified list elements.
- Validate every profile against JSON Schema and semantic policy.
- Compile a representative sample and attach CI evidence before `verified`.

### TeXisStudio-Languages

- Add `document.json` per language pack; do not overload `ui.json`.
- Define a base schema for generated document labels and LaTeX language metadata.
- Require complete keys for supported document locales.
- Mexican Indigenous language packs may use Spanish document labels when native
  terminology is unavailable, but must declare the fallback explicitly.
- Add parity, placeholder, locale-tag, and LaTeX-command validation in CI.

### TeXisStudio-Plugins

- Version the contribution contract independently from plugin catalog metadata.
- Add contract fixtures consumed by both TypeScript tests and Rust core tests.
- Require semantic output, package declarations, deterministic serialization,
  editable source, and export/import round trips.
- Keep external-tool bridges explicit when LaTeX cannot faithfully model the task.

## 7. Migration Strategy

Use a strangler migration. Do not replace the generator in one large change.

### Phase 0: Baseline and characterization

Deliverables:

- Freeze representative `main.tex`, config, section, and PDF text snapshots.
- Build 8-10 external stress fixtures covering languages, profiles, bibliography
  styles, plugins, long tables, figures, appendices, and committee covers.
- Record current compiler time, output hashes, warnings, and known defects.
- Add a command that emits the resolved project/profile/language inputs for tests.

Exit gate:

- Current behavior is reproducible and failures are classified.

### Phase 1: Canonical resolver and document contract

Deliverables:

- Add `ResolvedDocument` and `DocumentResolver`.
- Normalize aliases exactly once.
- Convert string placements into `DocumentPhase`.
- Resolve profile, project overrides, locale, and plugin requirements with explicit
  precedence and provenance.
- Add compatibility adapters for current profiles and projects.

Exit gate:

- Generator output remains unchanged for legacy fixtures.
- No renderer consumes raw profile aliases.

### Phase 2: Pure assembler and file plan

Deliverables:

- Extract ordering and filesystem writes from `main_tex.rs`/`sections.rs`.
- Add `DocumentAssembler`, `FilePlan`, atomic writer, and build manifest.
- Route `DocumentEngine`, exporter, CLI, and Tauri through one application service.
- Mark the second template-generation path deprecated; make it call the canonical
  resolver/assembler or limit it to scaffolding with no independent `main.tex`.

Exit gate:

- Exactly one production function emits `main.tex`.
- Both app and CLI produce byte-equivalent builds from the same input.

### Phase 3: Cover module

Deliverables:

- Implement typed cover spec, legacy adapter, overflow policies, assets, signatures,
  and PDF metadata.
- Add cover preview and profile-editor validation.
- Add one-page, two-page institutional, long-title, multi-advisor, committee, and
  missing-asset fixtures.

Exit gate:

- No accidental split cover in the fixture matrix.
- Trusted advanced templates are sandboxed and clearly identified.

### Phase 4: Front matter and indexes module

Deliverables:

- Move all preliminary rendering and list generation into the module.
- Add document-localization catalog and fallback policy.
- Make ordering, numbering, ToC behavior, and empty-list policy explicit.

Exit gate:

- All generated labels match the document language.
- Numbering transitions and index contents pass structural and PDF checks.

### Phase 5: Body and plugin boundary

Deliverables:

- Move block rendering and requirement collection into the body module.
- Implement `DocumentContribution` adapters for existing plugins.
- Centralize labels, asset paths, package requirements, and raw-LaTeX trust.

Exit gate:

- Every official-core plugin passes save/load, edit, compile, export/import, and
  package-conflict tests through the application contract.

### Phase 6: Bibliography module

Deliverables:

- Consolidate current bibliography manager, registry, normalizer, formatter,
  validator, backend policy, and exporter behind one service.
- Move command planning and final placement to the module contract.
- Add professional reference fixtures instead of synthetic numeric authors.

Exit gate:

- Seven target styles compile and pass style-specific structural checks.
- No unresolved citation or duplicate bibliography emission in release fixtures.

### Phase 7: Appendix module

Deliverables:

- Migrate appendices to their canonical phase.
- Add numbering/title policies, external-document support, and PDF checks.
- Update profile repository data after compatibility support ships.

Exit gate:

- Appendix numbering, ToC entries, labels, bibliography order, and external assets
  pass all fixtures.

### Phase 8: UI module workspaces

Deliverables:

- Give each module a focused editor/configuration panel and readiness summary.
- Profile creator exposes module capabilities and constraints instead of raw YAML
  first; YAML preview/import/export remains visible for advanced users.
- Show source provenance, profile confidence, unsupported requests, and alternatives.

Exit gate:

- A non-LaTeX user can configure a professional document without editing source.
- An advanced user can inspect the resolved contract and generated LaTeX.

### Phase 9: Remove duplicate architecture

Deliverables:

- Migrate remaining `TexisProject`/`template_engine` consumers.
- Keep one canonical project domain or rename the secondary type to its limited
  workspace/build role.
- Delete deprecated generator branches and compatibility code only after telemetry,
  fixtures, and migrations prove they are unused.

Exit gate:

- One project model boundary, one build service, one assembler.

### Phase 10: Release hardening

Deliverables:

- Full matrix in CI across engines, profiles, languages, bibliography styles, and
  plugin tiers.
- PDF visual/text postflight receives `ResolvedDocument` and module expectations.
- Performance budgets, deterministic builds, fuzz/property tests, and security tests.
- Migration and rollback documentation.

Exit gate:

- Release candidate passes all quality gates below on clean machines.

## 8. Test Pyramid and Quality Gates

Every module requires:

1. Unit tests for normalization, validation, requirements, and rendering.
2. Golden LaTeX snapshots for stable output.
3. Property tests for ordering, IDs, paths, and serialization round trips.
4. Contract tests against profile, language, and plugin schemas.
5. Compile tests with XeLaTeX; selected fixtures also with LuaLaTeX/PdfLaTeX.
6. PDF text checks for numbering, labels, language, metadata, and ordering.
7. Visual PDF checks for cover overflow, clipping, blank pages, tables, and figures.
8. Import/export round trips.
9. Backward-compatibility tests for real legacy projects.

Release blockers:

- Any compile failure in the required matrix.
- Missing/non-embedded fonts when the profile requires them.
- Missing bibliography entries or unresolved citations.
- Broken numbering, duplicate labels, or wrong phase order.
- Generated text in the wrong document language.
- Cover overflow outside an explicit multi-page policy.
- Profile marked `verified` without sources, sample, and CI evidence.
- Plugin writing outside its owned asset directory or requiring undeclared packages.

## 9. CI Matrix

Use layered CI to control cost:

- Per commit: Rust/TypeScript unit tests, schemas, contract tests, snapshots.
- Per pull request: core LaTeX fixtures and one fixture per changed module.
- Nightly: full profile/language/plugin compatibility matrix.
- Release: 8-10 long theses, all supported bibliography styles, PDF postflight,
  visual regression, clean-machine compilation, and delivery export.

Cache TeX dependencies, but run at least one uncached clean build in release CI.

## 10. Commit and PR Discipline

Do not create one cross-repository mega-commit. Use small dependency-ordered PRs.

Recommended sequence:

1. `TeXisStudio`: characterization tests and architecture decision record.
2. `TeXisStudio`: resolved document contract and legacy adapters.
3. `TeXisStudio-Languages`: `document.json` schema and initial catalogs.
4. `TeXisStudio-Plugins`: contribution contract and shared fixtures.
5. `TeXisStudio`: assembler/file plan and integration adapters.
6. One PR per document module.
7. `TeXisStudio-Profiles`: schema 2.x and data migration after core compatibility.
8. `TeXisStudio`: UI workspaces, duplicate-path removal, release hardening.

Each commit must:

- Represent one reviewable concern.
- Include tests with the behavior change.
- Avoid generated PDFs/build directories.
- Leave all affected repositories clean.
- State migration impact and rollback path in the commit/PR description.

## 11. Execution Rules for the Implementing Agent

Before each phase:

1. Re-read this plan and inspect the current worktree.
2. Create or update an ADR for any changed architectural decision.
3. Add characterization tests before moving behavior.
4. Keep compatibility adapters until all consumers and external repos have migrated.

During each phase:

1. Make pure extraction commits before behavioral changes where practical.
2. Never add a second ordering rule or renderer as a temporary shortcut.
3. Do not silently reinterpret unknown profile or language fields.
4. Emit diagnostics with stable codes and module ownership.
5. Store stress outputs only under a temporary external directory.

At phase completion, report:

- Files and contracts changed.
- Tests and fixtures added.
- Commands run and exact pass/fail totals.
- Compatibility impact.
- Remaining risks.
- Commit hashes in every affected repository.

## 12. Final Definition of Done

The hardening program is complete when:

- Cover, front matter/indexes, body, bibliography, and appendices are independent
  modules implementing the same stable contract.
- The assembler is the sole authority for ordering and final LaTeX structure.
- Profiles, language packs, and plugins integrate through versioned schemas with CI
  contract tests.
- Existing projects migrate without data loss and compile equivalently or with
  documented intentional improvements.
- Professional long-thesis fixtures compile, export, and pass structural, textual,
  visual, bibliographic, localization, and PDF checks.
- The profile creator can express professional requirements without promising
  capabilities LaTeX cannot provide, and offers explicit external-tool integration
  where appropriate.
- Maintenance inside one document module does not require changes in unrelated
  modules unless a versioned shared contract changes.

