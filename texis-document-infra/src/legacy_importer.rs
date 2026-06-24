//! Importador legacy: `ProjectModel` (1.x) → `DocumentIR` (§11.1).
//!
//! Es el adaptador de entrada que aísla el modelo legacy. Tras la importación,
//! el dominio trabaja sobre un `DocumentIR` neutral: **ningún renderer vuelve a
//! interpretar aliases ni perfiles crudos** (criterio de salida de la Etapa A).
//!
//! Toda degradación (p. ej. normalizar una ruta absoluta, remapear una fase) se
//! registra como diagnóstico estructurado (§18.10).

use texis_core::project::model as legacy;
use texis_document_contracts::assets::{is_absolute_path, AssetRef, AssetRole};
use texis_document_contracts::diagnostics::{Diagnostic, DiagnosticStage, Diagnostics};
use texis_document_contracts::ids::{AssetId, DocumentId, ModuleId, NodeId, ProfileId, SectionId};
use texis_document_contracts::locale::{DocumentLocale, LanguageTag};
use texis_document_contracts::measures::Length;
use texis_document_contracts::provenance::{ProvenanceEntry, ResolutionProvenance, ValueSource};
use texis_document_contracts::text::LocalizedText;
use texis_document_contracts::version::{ContractVersion, DocumentSchemaVersion};

use texis_document_domain::ir::body_node::*;
use texis_document_domain::ir::meta::*;
use texis_document_domain::ir::modules::*;
use texis_document_domain::ir::resources::{PackageRequirement, ResourceGraph};
use texis_document_domain::ir::DocumentIR;
use texis_document_domain::resolver::{DocumentResolver, Resolution};

/// Resolutor que importa un `ProjectModel` legacy. Implementa el contrato de
/// dominio `DocumentResolver` con el propio modelo legacy como entrada.
#[derive(Default)]
pub struct LegacyProjectImporter;

impl LegacyProjectImporter {
    pub fn new() -> Self {
        Self
    }
}

impl DocumentResolver for LegacyProjectImporter {
    type Input = legacy::ProjectModel;

    fn resolve(&self, model: legacy::ProjectModel) -> Resolution<DocumentIR> {
        let mut ctx = ImportCtx::default();
        let ir = ctx.import(&model);
        Resolution::with_diagnostics(Some(ir), ctx.diags)
    }
}

/// Conveniencia: importa por referencia (no consume el modelo).
pub fn import_project(model: &legacy::ProjectModel) -> Resolution<DocumentIR> {
    let mut ctx = ImportCtx::default();
    let ir = ctx.import(model);
    Resolution::with_diagnostics(Some(ir), ctx.diags)
}

#[derive(Default)]
struct ImportCtx {
    diags: Diagnostics,
    resources: ResourceGraph,
    provenance: ResolutionProvenance,
    asset_counter: usize,
}

impl ImportCtx {
    fn import(&mut self, m: &legacy::ProjectModel) -> DocumentIR {
        let identity = DocumentIdentity {
            id: DocumentId::new(&m.id),
            created_at: m.created_at.clone(),
            updated_at: m.updated_at.clone(),
            source_schema: Some(m.schema_version.clone()),
        };

        let metadata = self.metadata(m);
        let locale = DocumentLocale::new(LanguageTag::new(&m.metadata.language));
        let profile = self.profile(m);
        let cover = self.cover(m);

        // Clasificar secciones por placement canónico.
        let mut preliminaries = PreliminariesDocument::default();
        let mut body = BodyDocument::default();
        let mut appendices = AppendicesDocument::default();

        for section in &m.sections {
            if !section.enabled {
                continue;
            }
            match section.placement {
                legacy::SectionPlacement::FrontMatter => {
                    preliminaries.items.push(self.preliminary(section));
                }
                legacy::SectionPlacement::Body => {
                    body.sections.push(self.body_section(section));
                }
                legacy::SectionPlacement::Appendix => {
                    appendices.appendices.push(self.appendix(section));
                }
                legacy::SectionPlacement::BackMatter => {
                    // Back matter legacy (glosario, nomenclatura) se modela como
                    // preliminar en el nuevo dominio; la bibliografía proviene de
                    // la configuración, no de secciones. Se deja constancia.
                    self.diags.push(
                        Diagnostic::new(
                            "IMPORT-010",
                            ModuleId::Resolver,
                            texis_document_contracts::diagnostics::Severity::Info,
                            DiagnosticStage::Import,
                            "import.back_matter_remapped",
                        )
                        .with_param("section", &section.id),
                    );
                    preliminaries.items.push(self.preliminary(section));
                }
            }
        }

        let indexes = self.indexes(m);
        let bibliography = self.bibliography(m);

        // Paquetes declarados en la configuración.
        for pkg in &m.latex_config.packages_required {
            self.resources
                .require_package(PackageRequirement::new(pkg.clone()));
        }
        for pkg in &m.latex_config.packages_with_options {
            self.resources.require_package(PackageRequirement {
                name: pkg.name.clone(),
                options: pkg.options.clone(),
            });
        }

        DocumentIR {
            schema: DocumentSchemaVersion::CURRENT,
            identity,
            metadata,
            locale,
            profile,
            cover,
            preliminaries,
            indexes,
            body,
            bibliography,
            appendices,
            resources: std::mem::take(&mut self.resources),
            provenance: std::mem::take(&mut self.provenance),
        }
    }

    fn metadata(&mut self, m: &legacy::ProjectModel) -> ResolvedMetadata {
        self.provenance.record(ProvenanceEntry::new(
            "metadata.title",
            ValueSource::ProjectExplicit,
            "legacy.metadata.title",
        ));
        ResolvedMetadata {
            title: m.metadata.title.clone(),
            subtitle: m.metadata.subtitle.clone(),
            document_kind: map_document_kind(&m.metadata.document_kind),
            academic_level: map_academic_level(&m.metadata.academic_level),
            keywords: m.metadata.keywords.clone(),
            funding: m.metadata.funding.clone(),
        }
    }

    fn profile(&mut self, m: &legacy::ProjectModel) -> ResolvedProfile {
        let geometry = self.page_geometry(m);
        self.provenance.record(ProvenanceEntry::new(
            "profile.id",
            ValueSource::ProjectExplicit,
            "legacy.profile_id",
        ));
        let typo = &m.latex_config.preamble_config;
        ResolvedProfile {
            id: ProfileId::new(&m.profile_id),
            contract_version: ContractVersion::new(1, 0),
            document_class: m.latex_config.document_class.name.clone(),
            document_class_options: m.latex_config.document_class.options.clone(),
            page_geometry: geometry,
            typography: Typography {
                base_font_size: m.latex_config.typography.font_size.clone(),
                main_font: typo.main_font.clone(),
                sans_font: typo.sans_font.clone(),
                mono_font: typo.mono_font.clone(),
            },
        }
    }

    fn page_geometry(&mut self, m: &legacy::ProjectModel) -> PageGeometry {
        // Prioridad: page_layout del perfil > typography del usuario.
        if let Some(layout) = &m.latex_config.page_layout {
            let margins = layout.margins.as_ref();
            self.provenance.record(ProvenanceEntry::new(
                "profile.page_geometry",
                ValueSource::ProfileRecommendation,
                "legacy.page_layout",
            ));
            return PageGeometry {
                paper: normalize_paper(layout.paper.as_deref()),
                margin_top: margins.and_then(|x| x.top.as_deref()).and_then(Length::parse),
                margin_bottom: margins
                    .and_then(|x| x.bottom.as_deref())
                    .and_then(Length::parse),
                margin_left: margins.and_then(|x| x.left.as_deref()).and_then(Length::parse),
                margin_right: margins
                    .and_then(|x| x.right.as_deref())
                    .and_then(Length::parse),
                line_spacing: layout.line_spacing,
            };
        }
        let t = &m.latex_config.typography;
        self.provenance.record(ProvenanceEntry::new(
            "profile.page_geometry",
            ValueSource::ProjectExplicit,
            "legacy.typography",
        ));
        let margin = t.margin_cm.map(Length::cm);
        PageGeometry {
            paper: normalize_paper(t.paper_size.as_deref()),
            margin_top: margin,
            margin_bottom: margin,
            margin_left: margin,
            margin_right: margin,
            line_spacing: None,
        }
    }

    fn cover(&mut self, m: &legacy::ProjectModel) -> CoverDocument {
        let logo = m
            .institution
            .logo_path
            .as_ref()
            .map(|p| self.register_logo(&p.to_string_lossy()));

        let institution = InstitutionIdentity {
            name: m.institution.name.clone(),
            faculty: m.institution.faculty.clone(),
            department: m.institution.department.clone(),
            country: m.institution.country.clone(),
            logo,
        };

        let s = &m.student;
        let author = Author {
            full_name: s.full_name.clone(),
            student_id: s.student_id.clone(),
            email: s.email.clone(),
            orcid: s.orcid.clone(),
        };
        let mut authors = vec![author];
        for co in &s.co_authors {
            authors.push(Author {
                full_name: co.full_name.clone(),
                student_id: co.student_id.clone(),
                email: None,
                orcid: None,
            });
        }

        let mut authorities = Vec::new();
        // `advisors` tiene prioridad sobre el campo legacy `advisor`.
        if !s.advisors.is_empty() {
            for a in &s.advisors {
                authorities.push(AcademicAuthority {
                    full_name: a.clone(),
                    role: AuthorityRole::Advisor,
                    committee_role: None,
                    institution: None,
                });
            }
        } else if let Some(a) = &s.advisor {
            authorities.push(AcademicAuthority {
                full_name: a.clone(),
                role: AuthorityRole::Advisor,
                committee_role: None,
                institution: None,
            });
        }
        if let Some(co) = &s.co_advisor {
            authorities.push(AcademicAuthority {
                full_name: co.clone(),
                role: AuthorityRole::CoAdvisor,
                committee_role: None,
                institution: None,
            });
        }
        for c in &s.committee {
            authorities.push(AcademicAuthority {
                full_name: c.full_name.clone(),
                role: AuthorityRole::CommitteeMember,
                committee_role: c.role.clone(),
                institution: c.institution.clone(),
            });
        }

        CoverDocument {
            institution,
            title: m.metadata.title.clone(),
            subtitle: m.metadata.subtitle.clone(),
            authors,
            authorities,
            city: m.metadata.city.clone(),
            year: m.metadata.year,
        }
    }

    fn register_logo(&mut self, path: &str) -> AssetId {
        let id = AssetId::new(format!("logo-{}", self.next_asset_n()));
        let relative = self.relativize(path, "cover.logo");
        let mut asset = AssetRef::new(id.clone(), AssetRole::InstitutionLogo, relative);
        asset.source = Some("institution".to_string());
        self.resources.add_asset(asset);
        id
    }

    /// Garantiza la invariante "sin rutas absolutas": si la ruta es absoluta,
    /// usa solo el último componente y emite un diagnóstico de normalización.
    fn relativize(&mut self, path: &str, field: &str) -> String {
        if is_absolute_path(path) {
            let leaf = path
                .rsplit(['/', '\\'])
                .next()
                .filter(|s| !s.is_empty())
                .unwrap_or(path)
                .to_string();
            self.diags.push(
                Diagnostic::warning(
                    "IMPORT-001",
                    ModuleId::Resolver,
                    DiagnosticStage::Import,
                    "import.absolute_path_normalized",
                )
                .with_param("field", field)
                .with_param("original", path)
                .with_param("relative", &leaf),
            );
            leaf
        } else {
            path.to_string()
        }
    }

    fn indexes(&self, m: &legacy::ProjectModel) -> IndexesDocument {
        // Detecta presencia de figuras/tablas/código/algoritmos en el contenido
        // para habilitar las listas correspondientes.
        let mut has_fig = false;
        let mut has_tab = false;
        let mut has_code = false;
        let mut has_algo = false;
        for section in &m.sections {
            scan_blocks(section, &mut has_fig, &mut has_tab, &mut has_code, &mut has_algo);
        }
        let mut lists = vec![IndexList {
            kind: IndexKind::TableOfContents,
            enabled: true,
            depth: None,
        }];
        if has_fig {
            lists.push(IndexList {
                kind: IndexKind::ListOfFigures,
                enabled: true,
                depth: None,
            });
        }
        if has_tab {
            lists.push(IndexList {
                kind: IndexKind::ListOfTables,
                enabled: true,
                depth: None,
            });
        }
        if has_algo {
            lists.push(IndexList {
                kind: IndexKind::ListOfAlgorithms,
                enabled: true,
                depth: None,
            });
        }
        if has_code {
            lists.push(IndexList {
                kind: IndexKind::ListOfCode,
                enabled: true,
                depth: None,
            });
        }
        IndexesDocument { lists }
    }

    fn bibliography(&self, m: &legacy::ProjectModel) -> BibliographyDocument {
        BibliographyDocument {
            style: m.latex_config.bibliography_style.clone(),
            backend: Some(match m.latex_config.bibliography_backend {
                legacy::BibliographyBackend::Biber => BibliographyBackend::Biber,
                legacy::BibliographyBackend::Bibtex => BibliographyBackend::Bibtex,
            }),
            sources: Vec::new(),
        }
    }

    fn preliminary(&mut self, s: &legacy::ProjectSection) -> PreliminaryItem {
        let nodes = self.nodes(s);
        let mut title = LocalizedText::new();
        if let Some(t) = &s.title {
            title.insert(&LanguageTag::new("und"), t.clone());
        }
        PreliminaryItem {
            id: SectionId::new(&s.id),
            kind: infer_preliminary_kind(&s.element_id),
            title,
            nodes,
            user_provided: true,
        }
    }

    fn body_section(&mut self, s: &legacy::ProjectSection) -> BodySection {
        BodySection {
            id: SectionId::new(&s.id),
            title: s.title.clone(),
            label: s.label.clone(),
            status: map_status(&s.status),
            nodes: self.nodes(s),
            children: s.children.iter().map(|c| self.body_section(c)).collect(),
        }
    }

    fn appendix(&mut self, s: &legacy::ProjectSection) -> Appendix {
        Appendix {
            id: SectionId::new(&s.id),
            title: s.title.clone(),
            label: s.label.clone(),
            nodes: self.nodes(s),
            children: s.children.iter().map(|c| self.body_section(c)).collect(),
        }
    }

    fn nodes(&mut self, s: &legacy::ProjectSection) -> Vec<BodyNode> {
        s.blocks.iter().map(|b| self.block(b)).collect()
    }

    fn block(&mut self, b: &legacy::ContentBlock) -> BodyNode {
        use legacy::ContentBlock as B;
        match b {
            B::Paragraph(p) => BodyNode::Paragraph(Paragraph {
                id: NodeId::new(&p.id),
                content: RichText::maybe_math(&p.content, p.verbatim),
            }),
            B::Heading(h) => BodyNode::Heading(Heading {
                id: NodeId::new(&h.id),
                level: map_heading(&h.level),
                text: h.content.clone(),
            }),
            B::Figure(f) => {
                let asset_id = AssetId::new(format!("fig-{}", self.next_asset_n()));
                let relative = self.relativize(&f.file, "body.figure");
                self.resources
                    .add_asset(AssetRef::new(asset_id.clone(), AssetRole::Figure, relative));
                BodyNode::Figure(Figure {
                    id: NodeId::new(&f.id),
                    asset: asset_id,
                    caption: RichText::maybe_math(&f.caption, f.verbatim_caption),
                    source: f.source.clone(),
                    width: map_width(&f.width),
                    label: f.label.clone(),
                    include_in_list: f.include_in_list,
                })
            }
            B::Table(t) => BodyNode::Table(Table {
                id: NodeId::new(&t.id),
                caption: RichText::maybe_math(&t.caption, t.verbatim_caption),
                source: t.source.clone(),
                label: t.label.clone(),
                include_in_list: t.include_in_list,
                headers: t
                    .headers
                    .iter()
                    .map(|h| RichText::maybe_math(h, t.raw_headers))
                    .collect(),
                rows: t
                    .rows
                    .iter()
                    .map(|row| {
                        row.iter()
                            .map(|c| RichText::maybe_math(c, t.raw_cells))
                            .collect()
                    })
                    .collect(),
            }),
            B::Citation(c) => BodyNode::Citation(Citation {
                id: NodeId::new(&c.id),
                citation_key: c.citation_key.clone(),
                kind: map_citation(&c.citation_type),
                page: c.page.clone(),
                prefix: c.prefix.clone(),
                suffix: c.suffix.clone(),
            }),
            B::Equation(e) => BodyNode::Equation(Equation {
                id: NodeId::new(&e.id),
                latex: e.latex_content.clone(),
                label: e.label.clone(),
                numbered: e.numbered,
            }),
            B::List(l) => BodyNode::List(ListNode {
                id: NodeId::new(&l.id),
                kind: map_list(&l.list_type),
                items: l.items.clone(),
            }),
            B::RawLatex(r) => BodyNode::TrustedRawLatex(TrustedRawLatex {
                id: NodeId::new(&r.id),
                content: r.content.clone(),
                user_confirmed: r.user_confirmed,
            }),
            B::GlossaryEntry(g) => BodyNode::GlossaryEntry(GlossaryEntry {
                id: NodeId::new(&g.id),
                term: g.term.clone(),
                definition: RichText::maybe_math(&g.definition, g.verbatim),
            }),
            B::AcronymEntry(a) => BodyNode::AcronymEntry(AcronymEntry {
                id: NodeId::new(&a.id),
                acronym: a.acronym.clone(),
                full_form: a.full_form.clone(),
                description: a.description.clone(),
            }),
            B::Code(c) => BodyNode::CodeListing(CodeListing {
                id: NodeId::new(&c.id),
                language: c.language.clone(),
                caption: c.caption.clone(),
                label: c.label.clone(),
                content: c.content.clone(),
                show_line_numbers: c.show_line_numbers,
            }),
            B::Algorithm(a) => BodyNode::Algorithm(Algorithm {
                id: NodeId::new(&a.id),
                caption: a.caption.clone(),
                label: a.label.clone(),
                input: a.input.clone(),
                output: a.output.clone(),
                body: a.body.clone(),
            }),
            B::Theorem(t) => BodyNode::Theorem(Theorem {
                id: NodeId::new(&t.id),
                kind: map_theorem(&t.kind),
                title: t.title.clone(),
                content: RichText::maybe_math(&t.content, t.verbatim),
                numbered: t.numbered,
            }),
            B::Visual(v) => {
                let config_json = serde_json::to_string(&v.config).unwrap_or_else(|_| "{}".into());
                let kind = visual_kind(&v.config);
                BodyNode::Visual(VisualNode {
                    id: NodeId::new(&v.id),
                    caption: v.caption.clone(),
                    label: v.label.clone(),
                    include_in_list: v.include_in_list,
                    kind,
                    config_json,
                    advanced_override: v
                        .advanced_latex_override
                        .clone()
                        .filter(|_| v.advanced_override_confirmed),
                })
            }
            B::PluginFigure(p) => {
                for pkg in &p.required_packages {
                    self.resources
                        .require_package(PackageRequirement::new(pkg.clone()));
                }
                BodyNode::PluginContribution(PluginContribution {
                    id: NodeId::new(&p.id),
                    plugin_id: p.plugin_id.clone(),
                    figure_id: p.figure_id.clone(),
                    caption: p.caption.clone(),
                    label: p.label.clone(),
                    artifact_latex: p.latex_block.clone(),
                    required_packages: p.required_packages.clone(),
                    editable_source: p.source_json.clone(),
                    warnings: p.warnings.clone(),
                })
            }
        }
    }

    fn next_asset_n(&mut self) -> usize {
        self.asset_counter += 1;
        self.asset_counter
    }
}

// ── Mapeos de enums legacy → canónicos ─────────────────────────────────────

fn map_document_kind(k: &legacy::DocumentKind) -> DocumentKind {
    match k {
        legacy::DocumentKind::Tesis => DocumentKind::Thesis,
        legacy::DocumentKind::Tesina => DocumentKind::Tesina,
        legacy::DocumentKind::TesisPosgrado => DocumentKind::GraduateThesis,
    }
}

fn map_academic_level(l: &legacy::AcademicLevel) -> AcademicLevel {
    match l {
        legacy::AcademicLevel::Bachillerato => AcademicLevel::HighSchool,
        legacy::AcademicLevel::Tecnico => AcademicLevel::Technical,
        legacy::AcademicLevel::Licenciatura => AcademicLevel::Bachelor,
        legacy::AcademicLevel::Especialidad => AcademicLevel::Specialty,
        legacy::AcademicLevel::Maestria => AcademicLevel::Master,
        legacy::AcademicLevel::Doctorado => AcademicLevel::Doctorate,
        legacy::AcademicLevel::Posdoctorado => AcademicLevel::Postdoctorate,
    }
}

fn map_heading(l: &legacy::HeadingLevel) -> HeadingLevel {
    match l {
        legacy::HeadingLevel::Section => HeadingLevel::Section,
        legacy::HeadingLevel::Subsection => HeadingLevel::Subsection,
        legacy::HeadingLevel::Subsubsection => HeadingLevel::Subsubsection,
    }
}

fn map_width(w: &legacy::FigureWidth) -> FigureWidth {
    match w {
        legacy::FigureWidth::Half => FigureWidth::Half,
        legacy::FigureWidth::ThreeQuarters => FigureWidth::ThreeQuarters,
        legacy::FigureWidth::Full => FigureWidth::Full,
    }
}

fn map_list(l: &legacy::ListType) -> ListKind {
    match l {
        legacy::ListType::Itemize => ListKind::Itemize,
        legacy::ListType::Enumerate => ListKind::Enumerate,
        legacy::ListType::Description => ListKind::Description,
    }
}

fn map_citation(c: &legacy::CitationType) -> CitationKind {
    match c {
        legacy::CitationType::Parenthetical => CitationKind::Parenthetical,
        legacy::CitationType::Narrative => CitationKind::Narrative,
        legacy::CitationType::Multiple => CitationKind::Multiple,
        legacy::CitationType::Footnote => CitationKind::Footnote,
    }
}

fn map_theorem(t: &legacy::TheoremKind) -> TheoremKind {
    match t {
        legacy::TheoremKind::Theorem => TheoremKind::Theorem,
        legacy::TheoremKind::Lemma => TheoremKind::Lemma,
        legacy::TheoremKind::Corollary => TheoremKind::Corollary,
        legacy::TheoremKind::Definition => TheoremKind::Definition,
        legacy::TheoremKind::Proposition => TheoremKind::Proposition,
        legacy::TheoremKind::Proof => TheoremKind::Proof,
        legacy::TheoremKind::Remark => TheoremKind::Remark,
    }
}

fn map_status(s: &legacy::SectionStatus) -> EditorialStatus {
    match s {
        legacy::SectionStatus::Draft => EditorialStatus::Draft,
        legacy::SectionStatus::InReview => EditorialStatus::InReview,
        legacy::SectionStatus::Revised => EditorialStatus::Revised,
        legacy::SectionStatus::Approved => EditorialStatus::Approved,
    }
}

fn visual_kind(c: &legacy::VisualConfig) -> String {
    use legacy::VisualConfig as V;
    match c {
        V::VennEuler(_) => "venn_euler",
        V::FlowDiagram(_) => "flow_diagram",
        V::Timeline(_) => "timeline",
        V::ChemReaction(_) => "chem_reaction",
        V::Molecule(_) => "molecule",
        V::Circuit(_) => "circuit",
        V::Feynman(_) => "feynman",
        V::BioPathway(_) => "bio_pathway",
        V::MusicFragment(_) => "music_fragment",
    }
    .to_string()
}

/// Normaliza el tamaño de papel legacy ("a4paper"/"letterpaper") a canónico.
fn normalize_paper(raw: Option<&str>) -> String {
    match raw.unwrap_or("a4paper") {
        "letterpaper" | "letter" => "letter".to_string(),
        _ => "a4".to_string(),
    }
}

/// Infiere la clase de preliminar a partir del `element_id` legacy.
fn infer_preliminary_kind(element_id: &str) -> PreliminaryKind {
    let e = element_id.to_lowercase();
    if e.contains("dedicat") {
        PreliminaryKind::Dedication
    } else if e.contains("agradec") || e.contains("acknowledg") {
        PreliminaryKind::Acknowledgements
    } else if e.contains("original") {
        PreliminaryKind::OriginalityStatement
    } else if e.contains("autoriz") {
        PreliminaryKind::Authorization
    } else if e.contains("resumen") || e.contains("abstract") {
        PreliminaryKind::Abstract
    } else if e.contains("epigraf") || e.contains("epigraph") {
        PreliminaryKind::Epigraph
    } else if e.contains("nomenclat") {
        PreliminaryKind::Nomenclature
    } else if e.contains("glosar") || e.contains("glossary") {
        PreliminaryKind::Glossary
    } else {
        PreliminaryKind::Other
    }
}

fn scan_blocks(
    s: &legacy::ProjectSection,
    has_fig: &mut bool,
    has_tab: &mut bool,
    has_code: &mut bool,
    has_algo: &mut bool,
) {
    for b in &s.blocks {
        match b {
            legacy::ContentBlock::Figure(_)
            | legacy::ContentBlock::Visual(_)
            | legacy::ContentBlock::PluginFigure(_) => *has_fig = true,
            legacy::ContentBlock::Table(_) => *has_tab = true,
            legacy::ContentBlock::Code(_) => *has_code = true,
            legacy::ContentBlock::Algorithm(_) => *has_algo = true,
            _ => {}
        }
    }
    for c in &s.children {
        scan_blocks(c, has_fig, has_tab, has_code, has_algo);
    }
}
