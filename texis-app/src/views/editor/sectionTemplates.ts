import type { DocumentKind, SectionPlacement } from "../../types";

export interface SectionTemplate {
  element_id: string;
  titleKey: string;
  placement: SectionPlacement;
}

// Common section suggestions per document kind.
// These are filtered at runtime to exclude sections already in the project.
const TEMPLATES: Record<DocumentKind, SectionTemplate[]> = {
  tesis: [
    { element_id: "abstract",              titleKey: "editor.tmpl_abstract",    placement: "front_matter" },
    { element_id: "acknowledgements",      titleKey: "editor.tmpl_ack",         placement: "front_matter" },
    { element_id: "table_of_contents",     titleKey: "editor.tmpl_toc",         placement: "front_matter" },
    { element_id: "introduction",          titleKey: "editor.tmpl_intro",       placement: "body" },
    { element_id: "theoretical_framework", titleKey: "editor.tmpl_theory",      placement: "body" },
    { element_id: "methodology",           titleKey: "editor.tmpl_method",      placement: "body" },
    { element_id: "results",               titleKey: "editor.tmpl_results",     placement: "body" },
    { element_id: "discussion",            titleKey: "editor.tmpl_discussion",  placement: "body" },
    { element_id: "conclusions",           titleKey: "editor.tmpl_conclusions", placement: "body" },
    { element_id: "references",            titleKey: "editor.tmpl_references",  placement: "back_matter" },
  ],
  tesina: [
    { element_id: "introduction", titleKey: "editor.tmpl_intro",       placement: "body" },
    { element_id: "development",  titleKey: "editor.tmpl_development", placement: "body" },
    { element_id: "conclusions",  titleKey: "editor.tmpl_conclusions", placement: "body" },
    { element_id: "references",   titleKey: "editor.tmpl_references",  placement: "back_matter" },
  ],
  tesis_posgrado: [
    { element_id: "abstract",              titleKey: "editor.tmpl_abstract",    placement: "front_matter" },
    { element_id: "acknowledgements",      titleKey: "editor.tmpl_ack",         placement: "front_matter" },
    { element_id: "table_of_contents",     titleKey: "editor.tmpl_toc",         placement: "front_matter" },
    { element_id: "introduction",          titleKey: "editor.tmpl_intro",       placement: "body" },
    { element_id: "literature_review",     titleKey: "editor.tmpl_litreview",   placement: "body" },
    { element_id: "theoretical_framework", titleKey: "editor.tmpl_theory",      placement: "body" },
    { element_id: "methodology",           titleKey: "editor.tmpl_method",      placement: "body" },
    { element_id: "results",               titleKey: "editor.tmpl_results",     placement: "body" },
    { element_id: "discussion",            titleKey: "editor.tmpl_discussion",  placement: "body" },
    { element_id: "conclusions",           titleKey: "editor.tmpl_conclusions", placement: "body" },
    { element_id: "references",            titleKey: "editor.tmpl_references",  placement: "back_matter" },
  ],
};

export function getSuggestions(
  kind: DocumentKind,
  existingElementIds: Set<string>,
): SectionTemplate[] {
  return (TEMPLATES[kind] ?? []).filter(
    (tmpl) => !existingElementIds.has(tmpl.element_id),
  );
}

export const KIND_KEY: Record<DocumentKind, string> = {
  tesis:          "editor.tmpl_kind_tesis",
  tesina:         "editor.tmpl_kind_tesina",
  tesis_posgrado: "editor.tmpl_kind_tesis_posgrado",
};
