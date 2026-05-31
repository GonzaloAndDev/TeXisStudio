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
    { ok: !looksLikePlaceholder(project.metadata.title), label: "Define el titulo real del trabajo" },
    { ok: !looksLikePlaceholder(project.student.full_name), label: "Completa la autoria principal" },
    { ok: !looksLikePlaceholder(project.institution.name), label: "Indica la institucion real" },
    { ok: !!project.profile_id.trim(), label: "Selecciona un perfil academico" },
    { ok: !!project.metadata.language.trim(), label: "Elige el idioma base" },
    { ok: hasAdvisor, label: "Agrega al menos un asesor o director de tesis" },
  ];

  const bodySections = project.sections.filter((section) => section.enabled && section.placement === "body");
  const draftedBodySections = bodySections.filter((section) => sectionBlocks(section).length > 0);
  const reviewedSections = bodySections.filter((section) => {
    const status = section.status ?? "draft";
    return status === "revised" || status === "approved";
  });
  const totalWords = bodySections.reduce((sum, section) => sum + countWords(sectionBlocks(section)), 0);

  const writingChecks = [
    { ok: bodySections.length > 0, label: "Activa al menos una seccion de contenido" },
    { ok: draftedBodySections.length > 0, label: "Escribe contenido en una seccion principal" },
    { ok: totalWords >= 150, label: "Desarrolla un primer borrador sustancial" },
    { ok: reviewedSections.length > 0, label: "Marca al menos una seccion como revisada" },
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
    { ok: hasReferencesSection, label: "Incluye una seccion de referencias" },
    { ok: hasAbstractContent, label: "Escribe el resumen o abstract del trabajo" },
    { ok: allRequiredHaveContent, label: "Completa las secciones obligatorias del perfil" },
    { ok: !hasUnconfirmedRawLatex, label: "Confirma o elimina bloques LaTeX sin validar" },
    { ok: hasCommitteeWhenAdvanced, label: "Completa el comite para trabajos avanzados" },
    { ok: reviewedSections.length >= Math.min(2, bodySections.length || 0), label: "Revisa las secciones principales antes de entregar" },
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
    { ok: hasCitationEvidence(project), label: "Incluye al menos una cita verificable en el cuerpo del trabajo" },
    { ok: requiredBodyReviewed, label: "Marca como revisadas las secciones obligatorias del cuerpo" },
    { ok: !hasRawLatex, label: "Migra o revisa manualmente los bloques LaTeX importados antes de entrega final" },
    { ok: !hasPluginWarnings, label: "Resuelve advertencias de figuras o plugins antes de la entrega final" },
    { ok: usesInstitutionalOrCustomProfile, label: "Usa un perfil institucional o personalizado para entregas formales" },
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
