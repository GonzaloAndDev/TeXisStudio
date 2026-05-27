// Tipos TypeScript que reflejan los structs Rust de texis-core.

export type DocumentKind = "tesis" | "tesina" | "tesis_posgrado";

export type AcademicLevel =
  | "bachillerato"
  | "tecnico"
  | "licenciatura"
  | "maestria"
  | "doctorado";

export type SectionPlacement = "front_matter" | "body" | "back_matter" | "appendix";

export type SectionStatus = "draft" | "in_review" | "revised" | "approved";

export type HeadingLevel = "section" | "subsection" | "subsubsection";

export type FigureWidth = "half" | "three_quarters" | "full";

export type CitationType = "parenthetical" | "narrative" | "multiple" | "footnote";

export type ListType = "itemize" | "enumerate" | "description";

// ── Content Blocks ──────────────────────────────────────────────

export interface ParagraphBlock {
  type: "paragraph";
  id: string;
  content: string;
}

export interface HeadingBlock {
  type: "heading";
  id: string;
  level: HeadingLevel;
  content: string;
}

export interface FigureBlock {
  type: "figure";
  id: string;
  file: string;
  caption: string;
  source?: string;
  width: FigureWidth;
  label: string;
  include_in_list: boolean;
}

export type TableStyle = "simple" | "wide" | "long" | "booktabs";

export interface TableBlock {
  type: "table";
  id: string;
  caption: string;
  source?: string;
  label: string;
  include_in_list: boolean;
  headers: string[];
  rows: string[][];
  table_style?: TableStyle;
}

export interface CitationBlock {
  type: "citation";
  id: string;
  citation_key: string;
  citation_type: CitationType;
  page?: string;
  prefix?: string;
  suffix?: string;
}

export interface EquationBlock {
  type: "equation";
  id: string;
  latex_content: string;
  label?: string;
  numbered: boolean;
}

export interface ListBlock {
  type: "list";
  id: string;
  list_type: ListType;
  items: string[];
}

export interface RawLatexBlock {
  type: "raw_latex";
  id: string;
  content: string;
  user_confirmed: boolean;
}

// ── Bloques de posgrado ─────────────────────────────────────────

export interface GlossaryEntryBlock {
  type: "glossary_entry";
  id: string;
  term: string;
  definition: string;
}

export interface AcronymEntryBlock {
  type: "acronym_entry";
  id: string;
  acronym: string;
  full_form: string;
  description?: string;
}

export interface CodeBlock {
  type: "code";
  id: string;
  language: string;
  caption?: string;
  label?: string;
  content: string;
  show_line_numbers: boolean;
}

export interface AlgorithmBlock {
  type: "algorithm";
  id: string;
  caption: string;
  label?: string;
  input?: string;
  output?: string;
  body: string;
}

export type TheoremKind =
  | "theorem" | "lemma" | "corollary" | "definition"
  | "proposition" | "proof" | "remark";

export interface TheoremBlock {
  type: "theorem";
  id: string;
  kind: TheoremKind;
  title?: string;
  content: string;
  numbered: boolean;
}

export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | FigureBlock
  | TableBlock
  | CitationBlock
  | EquationBlock
  | ListBlock
  | RawLatexBlock
  | GlossaryEntryBlock
  | AcronymEntryBlock
  | CodeBlock
  | AlgorithmBlock
  | TheoremBlock;

// ── Project Model ───────────────────────────────────────────────

export interface ProjectSection {
  id: string;
  element_id: string;
  title?: string;
  placement: SectionPlacement;
  required: boolean;
  enabled: boolean;
  label?: string;
  /** Estado editorial de la sección. Por defecto "draft". */
  status?: SectionStatus;
  /** Notas internas del autor (no se incluyen en el PDF). */
  notes?: string;
  blocks: ContentBlock[];
  fields: Record<string, unknown>;
  children: ProjectSection[];
}

export interface ProjectMetadata {
  title: string;
  subtitle?: string;
  document_kind: DocumentKind;
  academic_level: AcademicLevel;
  language: string;
  city: string;
  year: number;
  keywords: string[];
  funding?: string;
}

export interface CommitteeMember {
  full_name: string;
  role?: string;
  institution?: string;
}

export interface InstitutionData {
  name: string;
  faculty?: string;
  department?: string;
  country: string;
}

export interface CoAuthor {
  full_name: string;
  student_id?: string;
}

export interface StudentData {
  full_name: string;
  student_id?: string;
  email?: string;
  /** @deprecated usar advisors[] en proyectos nuevos */
  advisor?: string;
  /** @deprecated usar advisors[] en proyectos nuevos */
  co_advisor?: string;
  /** Lista completa de asesores. Tiene prioridad sobre advisor. */
  advisors?: string[];
  /** Co-autores en trabajos grupales. */
  co_authors?: CoAuthor[];
  /** Comité sinodal / jurado (posgrado). */
  committee?: CommitteeMember[];
  /** ORCID iD del autor. */
  orcid?: string;
}

// ── LaTeX typography settings ────────────────────────────────────

export interface LatexTypography {
  /** "10pt" | "11pt" | "12pt" */
  font_size?: string;
  /** "a4paper" | "letterpaper" */
  paper_size?: string;
  /** "single" | "onehalf" | "double" */
  line_spacing?: string;
  /** Margen uniforme en cm, ej. 2.5 */
  margin_cm?: number;
}

export interface LatexConfig {
  document_class: { name: string; options: string[] };
  bibliography_style: string;
  typography: LatexTypography;
}

export interface ProjectModel {
  id: string;
  schema_version: string;
  created_at: string;
  updated_at: string;
  metadata: ProjectMetadata;
  institution: InstitutionData;
  student: StudentData;
  profile_id: string;
  latex_config?: LatexConfig;
  sections: ProjectSection[];
}

// ── Validation ──────────────────────────────────────────────────

export type IssueSeverity = "Error" | "Warning" | "Suggestion";

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  suggestion?: string;
  section_id?: string;
  rule_id?: string;
  profile_id?: string;
  profile_status?: string;
  source_url?: string;
  source_title?: string;
  automated?: boolean;
  expected?: string;
  actual?: string;
}

export interface ValidationReport {
  has_errors: boolean;
  issues: ValidationIssue[];
}

// ── Compilation ─────────────────────────────────────────────────

export interface UserError {
  message: string;
  suggestion?: string;
  raw_log_line?: string;
}

export interface CompilationResult {
  success: boolean;
  pdf_path?: string;
  user_errors: UserError[];
  warnings: string[];
  log_preview: string;
  backend_used?: string;
}

// ── Profiles ────────────────────────────────────────────────────

export interface ProfileSectionInfo {
  id: string;
  element_id: string;
  placement: string;  // "front_matter" | "body" | "back_matter" | "appendix"
  required: boolean;
  title?: string;
  label?: string;
  guidance?: string;
}

export type ProfileStatus =
  | "experimental"
  | "draft"
  | "reviewed"
  | "verified"
  | "stale"
  | "deprecated";

export interface ProfileVerification {
  verified_at?: string;
  verified_by?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  source_urls: string[];
  review_interval_days?: number;
}

export interface PdfaRequirement {
  required: boolean;
  level?: string;
}

export interface PdfRequirements {
  pdfa?: PdfaRequirement;
}

export interface ProfileInfo {
  id: string;
  name: string;
  description?: string;
  meta: string;
  tags: string[];
  sections_count: number;
  sections: ProfileSectionInfo[];
  author?: string;
  version?: string;
  license?: string;
  document_class?: string;
  bibliography_style?: string;
  latex_engine?: string;
  status: ProfileStatus;
  verification?: ProfileVerification;
  max_words?: number;
  max_abstract_words?: number;
  pdf_requirements?: PdfRequirements;
}

// ── System ──────────────────────────────────────────────────────

export interface LatexInfo {
  has_latexmk: boolean;
  has_xelatex: boolean;
  has_biber: boolean;
  is_usable: boolean;
  latexmk_usable: boolean;
  latexmk_version?: string;
  texlive_year?: number;
  has_tectonic: boolean;
  tectonic_version?: string;
  available_backends: string[];
  preferred_backend?: string;
}

// ── Cloud Folders (from get_cloud_folders) ───────────────────────

export interface CloudFolder {
  service: string;   // "OneDrive" | "Google Drive" | "Dropbox"
  path: string;
  icon: string;
  hint: string;
}

// ── Bibliography entry (from list_references) ───────────────────

export interface BibReference {
  key: string;
  entry_type: string;
  title: string;
  author: string;
  year: string;
  journal: string;
  doi?: string;
  pages?: string;
  volume?: string;
  publisher?: string;
  url?: string;
}

export interface BatchDoiResult {
  doi: string;
  bibtex?: string;
  key?: string;
  error?: string;
}

// ── Profile update payload (for update_profile command) ─────────

export interface ProfileUpdatePayload {
  name: string;
  description?: string;
  author?: string;
  version?: string;
  license?: string;
  latex_engine: string;
  document_class: string;
  bibliography_style: string;
  bibliography_backend: string;
  tags: string[];
  sections: ProfileSectionInfo[];
}

// ── Language packs ──────────────────────────────────────────────

export interface LangCapabilities {
  /** UI translation available */
  ui: boolean;
  /** Hunspell spell-check dictionary available */
  spelling: boolean;
  /** Per-language autocorrect table available */
  autocorrect: boolean;
  /** Grammar via LanguageTool remote API */
  grammar_remote: boolean;
  /** Local grammar checker (offline) */
  grammar_local: boolean;
  /** LaTeX babel package support */
  latex_babel: boolean;
  /** LaTeX polyglossia package support */
  latex_polyglossia: boolean;
}

export type LangStatus = "stable" | "beta" | "experimental";

export interface LangPackMaintainer {
  name: string;
  contact?: string;
}

/** Entry in catalog.json — describes one downloadable language pack */
export interface LangPackEntry {
  id: string;             // BCP-47 e.g. "ru", "pt-BR", "th", "hi"
  name: string;           // English name
  native_name: string;    // e.g. "Русский"
  flag: string;           // emoji
  status: LangStatus;
  version: string;
  maintainers: LangPackMaintainer[];
  capabilities: LangCapabilities;
  // Download URLs — can be GitHub raw or npm CDN
  ui_url: string;
  spelling_aff_url?: string;
  spelling_dic_url?: string;
  autocorrect_url?: string;
  latex_url?: string;
}

/** What gets persisted to localStorage after installation */
export interface InstalledLangPack {
  id: string;
  version: string;
  installed_at: string;
  entry: LangPackEntry;
  /** Full locale JSON, stored so it survives offline */
  ui_data?: Record<string, unknown>;
}

export interface LangCatalog {
  schema_version: string;
  updated_at: string;
  packages: LangPackEntry[];
  vocabulary_packs?: VocabPackEntry[];
}

// ── Vocabulary packs (domain-specific, independent of base language) ──

/** Entry in catalog.json vocabulary_packs — a domain-specific wordlist */
export interface VocabPackEntry {
  id: string;               // e.g. "es-engineering", "en-mathematics"
  name: string;             // Display name
  type: "vocabulary";
  status: LangStatus;
  version: string;
  base_language_hint?: string;  // Suggested pairing (non-binding)
  description: string;
  pack_url: string;         // URL to the pack.yaml
}

/** Locally installed vocabulary pack */
export interface InstalledVocabPack {
  id: string;
  version: string;
  installed_at: string;
  entry: VocabPackEntry;
  /** Terms loaded from the pack */
  terms: string[];
}

/**
 * A custom external vocabulary repository.
 * Any URL pointing to a catalog.json with vocabulary_packs section.
 * Fully independent — users add their own repos without affecting the core repo.
 */
export interface CustomVocabRepo {
  id: string;           // user-assigned alias
  url: string;          // URL to a catalog.json compatible file
  added_at: string;
  last_synced_at?: string;
  packs?: VocabPackEntry[];
  error?: string;
}

// ── PDF Postflight ───────────────────────────────────────────────

export type PdfIssueSeverity = "error" | "warning" | "info";

export interface PdfIssue {
  severity: PdfIssueSeverity;
  code: string;
  message: string;
  suggestion?: string;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  creator?: string;
  producer?: string;
  creation_date?: string;
  pages?: number;
  pdf_version?: string;
  file_size_bytes?: number;
  page_size?: string;
  is_encrypted: boolean;
  is_linearized: boolean;
  has_javascript: boolean;
}

export interface FontCheck {
  name: string;
  font_type: string;
  embedded: boolean;
  subset: boolean;
}

export interface PdfaCheck {
  compliant: boolean;
  flavour: string | null;
  summary: string;
  verapdf_version: string | null;
}

export interface PdfPostflightResult {
  pdf_exists: boolean;
  metadata: PdfMetadata;
  fonts: FontCheck[];
  all_fonts_embedded: boolean;
  non_embedded_fonts: string[];
  issues: PdfIssue[];
  passed: boolean;
  tools_available: string[];
  tools_missing: string[];
  pdfa: PdfaCheck | null;
}

export type ExportMode = "draft" | "review" | "final";

export interface ExportDeliveryResult {
  zip_path: string;
  export_mode: string;
  validation_errors: number;
  postflight_passed: boolean;
  all_fonts_embedded: boolean;
}

// ── Recent project entry (from list_recent_projects) ────────────

export interface RecentProject {
  path: string;
  title: string;
  profile_id: string;
  academic_level: string;
  updated_at: string;
}

// ── Zotero / Better BibTeX integration ──────────────────────────

export interface ZoteroStatus {
  available: boolean;
  version: string | null;
  message: string | null;
}

export interface ZoteroItem {
  key: string;
  title: string;
  author: string;
  year: string;
  item_type: string;
  cite_key: string | null;
}

export interface ZoteroImportResult {
  key: string;
  bibtex: string | null;
  cite_key: string | null;
  error: string | null;
}

// ── System Doctor ────────────────────────────────────────────────

export type ToolStatus = "available" | "missing" | "unknown";

export interface InstallHint {
  macos?: string;
  linux?: string;
  windows?: string;
}

export interface DoctorCheck {
  name: string;
  status: ToolStatus;
  version?: string;
  description: string;
  critical: boolean;
  install_hint?: InstallHint;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  environment_ok: boolean;
  has_critical_missing: boolean;
}

// ── Profile Lock ─────────────────────────────────────────────────

export interface ProfileLockData {
  profile_id: string;
  profile_version: string;
  profile_status_at_lock: string;
  source: string;
  sha256: string;
  locked_at: string;
  texis_core_version: string;
}

export interface ProfileLockStatus {
  locked: boolean;
  lock: ProfileLockData | null;
}

// ── P5A — Progreso de secciones ──────────────────────────────────

export interface SectionProgress {
  id: string;
  element_id: string;
  title: string;
  placement: SectionPlacement;
  status: SectionStatus;
  enabled: boolean;
  word_count: number;
  has_notes: boolean;
  notes: string | null;
  block_count: number;
}
