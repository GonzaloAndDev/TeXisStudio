// Tipos TypeScript que reflejan los structs Rust de texis-core.

export type DocumentKind = "tesis" | "tesina";

export type AcademicLevel =
  | "bachillerato"
  | "tecnico"
  | "licenciatura"
  | "maestria"
  | "doctorado";

export type SectionPlacement = "front_matter" | "body" | "back_matter" | "appendix";

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

export interface TableBlock {
  type: "table";
  id: string;
  caption: string;
  source?: string;
  label: string;
  include_in_list: boolean;
  headers: string[];
  rows: string[][];
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

export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | FigureBlock
  | TableBlock
  | CitationBlock
  | EquationBlock
  | ListBlock
  | RawLatexBlock;

// ── Project Model ───────────────────────────────────────────────

export interface ProjectSection {
  id: string;
  element_id: string;
  title?: string;
  placement: SectionPlacement;
  required: boolean;
  enabled: boolean;
  label?: string;
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
}

export interface InstitutionData {
  name: string;
  faculty?: string;
  department?: string;
  country: string;
}

export interface StudentData {
  full_name: string;
  student_id?: string;
  email?: string;
  advisor?: string;
  co_advisor?: string;
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
}

// ── Profiles ────────────────────────────────────────────────────

export interface ProfileInfo {
  id: string;
  name: string;
  description: string;
  meta: string;
  tags: string[];
}

// ── System ──────────────────────────────────────────────────────

export interface LatexInfo {
  has_latexmk: boolean;
  has_xelatex: boolean;
  has_biber: boolean;
  is_usable: boolean;
  latexmk_version?: string;
  texlive_year?: number;
}

// ── Recent project entry (from list_recent_projects) ────────────

export interface RecentProject {
  path: string;
  title: string;
  profile_id: string;
  academic_level: string;
  updated_at: string;
}
