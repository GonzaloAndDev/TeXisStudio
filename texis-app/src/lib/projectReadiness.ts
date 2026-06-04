import type { ContentBlock, ProjectModel } from "../types";

export interface ProjectReadiness {
  setupCompletion: number;
  writingCompletion: number;
  deliveryReadiness: number;
  qualityCompletion: number;
  overallCompletion: number;
  setupPending: string[];
  writingPending: string[];
  deliveryPending: string[];
  qualityPending: string[];
  deliveryBlocked: boolean;
}

function blockText(block: ContentBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return block.content;
    case "raw_latex":
      return block.content.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*])?(?:\{[^}]*})?/g, " ");
    case "table":
      return [block.caption, block.headers.join(" "), block.rows.flat().join(" ")].join(" ");
    case "figure":
    case "plugin_figure":
      return block.caption;
    case "equation":
      return block.latex_content;
    case "list":
      return block.items.join(" ");
    case "algorithm":
      return [block.caption, block.input, block.output, block.body].filter(Boolean).join(" ");
    case "theorem":
      return [block.title, block.content].filter(Boolean).join(" ");
    case "glossary_entry":
      return [block.term, block.definition].join(" ");
    case "acronym_entry":
      return [block.acronym, block.full_form, block.description].filter(Boolean).join(" ");
    default:
      return "";
  }
}

function countWords(blocks: ContentBlock[]): number {
  return blocks.reduce((total, block) => {
    const text = blockText(block);
    return total + text.split(/\s+/).filter(Boolean).length;
  }, 0);
}

function sectionBlocks(section: ProjectModel["sections"][number]): ContentBlock[] {
  return Array.isArray(section.blocks) ? section.blocks : [];
}

function hasCitationEvidence(project: ProjectModel): boolean {
  return project.sections.some((section) =>
    sectionBlocks(section).some((block) =>
      block.type === "citation" ||
      (block.type === "raw_latex" && /\\(?:cite|parencite|textcite|autocite|footcite)\w*\{[^}]+}/.test(block.content))
    )
  );
}

function looksLikePlaceholder(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return true;
  const markers = [
    "titulo",
    "titulo de la tesis",
    "title",
    "thesis title",
    "estudiante",
    "student",
    "universidad",
    "university",
  ];
  return markers.some((marker) => normalized === marker || normalized.includes(` ${marker} `));
}

export function deriveProjectReadiness(project: ProjectModel): ProjectReadiness {
  const hasAdvisor =
    project.student.advisors?.some((a) => a.trim().length > 0) ??
    (project.student.advisor?.trim().length ?? 0) > 0;

  const setupChecks = [
    { ok: !looksLikePlaceholder(project.metadata.title), label: "readiness.setup_title" },
    { ok: !looksLikePlaceholder(project.student.full_name), label: "readiness.setup_author" },
    { ok: !looksLikePlaceholder(project.institution.name), label: "readiness.setup_institution" },
    { ok: !!project.profile_id.trim(), label: "readiness.setup_profile" },
    { ok: !!project.metadata.language.trim(), label: "readiness.setup_language" },
    { ok: hasAdvisor, label: "readiness.setup_advisor" },
  ];

  const bodySections = project.sections.filter((section) => section.enabled && section.placement === "body");
  const draftedBodySections = bodySections.filter((section) => sectionBlocks(section).length > 0);
  const reviewedSections = bodySections.filter((section) => {
    const status = section.status ?? "draft";
    return status === "revised" || status === "approved";
  });
  const totalWords = bodySections.reduce((sum, section) => sum + countWords(sectionBlocks(section)), 0);

  const writingChecks = [
    { ok: bodySections.length > 0, label: "readiness.writing_sections" },
    { ok: draftedBodySections.length > 0, label: "readiness.writing_draft" },
    { ok: totalWords >= 150, label: "readiness.writing_words" },
    { ok: reviewedSections.length > 0, label: "readiness.writing_reviewed" },
  ];

  const hasReferencesSection = project.sections.some((section) => section.enabled && section.element_id === "references");
  const hasAbstractContent = project.sections.some((section) =>
    (section.element_id === "abstract" || section.element_id === "abstract_es") &&
    sectionBlocks(section).length > 0 &&
    sectionBlocks(section).some((block) => blockText(block).trim().length > 20)
  );
  const requiredBodySections = bodySections.filter((section) => section.required ?? false);
  const allRequiredHaveContent = requiredBodySections.length === 0 ||
    requiredBodySections.every((section) => sectionBlocks(section).length > 0);
  const hasUnconfirmedRawLatex = project.sections.some((section) =>
    sectionBlocks(section).some((block) => block.type === "raw_latex" && !block.user_confirmed)
  );
  const hasCommitteeWhenAdvanced =
    project.metadata.academic_level === "doctorado" || project.metadata.academic_level === "posdoctorado"
      ? (project.student.committee?.length ?? 0) > 0
      : true;

  const deliveryChecks = [
    { ok: hasReferencesSection, label: "readiness.delivery_references" },
    { ok: hasAbstractContent, label: "readiness.delivery_abstract" },
    { ok: allRequiredHaveContent, label: "readiness.delivery_required" },
    { ok: !hasUnconfirmedRawLatex, label: "readiness.delivery_latex" },
    { ok: hasCommitteeWhenAdvanced, label: "readiness.delivery_committee" },
    { ok: reviewedSections.length >= Math.min(2, bodySections.length || 0), label: "readiness.delivery_review_main" },
  ];

  const requiredBodyReviewed = requiredBodySections.length === 0 ||
    requiredBodySections.every((section) => {
      const status = section.status ?? "draft";
      return status === "revised" || status === "approved";
    });
  const hasRawLatex = project.sections.some((section) =>
    sectionBlocks(section).some((block) => block.type === "raw_latex")
  );
  const hasPluginWarnings = project.sections.some((section) =>
    sectionBlocks(section).some((block) => block.type === "plugin_figure" && block.warnings.length > 0)
  );
  const usesGenericProfile = project.profile_id.startsWith("generic.");
  const usesInstitutionalOrCustomProfile = !usesGenericProfile || project.profile_id.startsWith("custom.");

  const qualityChecks = [
    { ok: hasCitationEvidence(project), label: "readiness.quality_citation" },
    { ok: requiredBodyReviewed, label: "readiness.quality_required_reviewed" },
    { ok: !hasRawLatex, label: "readiness.quality_raw_latex" },
    { ok: !hasPluginWarnings, label: "readiness.quality_plugin_warnings" },
    { ok: usesInstitutionalOrCustomProfile, label: "readiness.quality_profile" },
  ];

  const percentage = (passed: number, total: number) => total === 0 ? 0 : Math.round((passed / total) * 100);
  const setupCompletion = percentage(setupChecks.filter((item) => item.ok).length, setupChecks.length);
  const writingCompletion = percentage(writingChecks.filter((item) => item.ok).length, writingChecks.length);
  const deliveryReadiness = percentage(deliveryChecks.filter((item) => item.ok).length, deliveryChecks.length);
  const qualityCompletion = percentage(qualityChecks.filter((item) => item.ok).length, qualityChecks.length);
  const overallCompletion = Math.round((setupCompletion + writingCompletion + deliveryReadiness + qualityCompletion) / 4);

  return {
    setupCompletion,
    writingCompletion,
    deliveryReadiness,
    qualityCompletion,
    overallCompletion,
    setupPending: setupChecks.filter((item) => !item.ok).map((item) => item.label),
    writingPending: writingChecks.filter((item) => !item.ok).map((item) => item.label),
    deliveryPending: deliveryChecks.filter((item) => !item.ok).map((item) => item.label),
    qualityPending: qualityChecks.filter((item) => !item.ok).map((item) => item.label),
    deliveryBlocked: deliveryReadiness < 100 || qualityCompletion < 100,
  };
}
