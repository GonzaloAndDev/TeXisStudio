import type { ContentBlock, ProjectModel } from "../types";

export interface ProjectReadiness {
  setupCompletion: number;
  writingCompletion: number;
  deliveryReadiness: number;
  setupPending: string[];
  writingPending: string[];
  deliveryPending: string[];
}

function countWords(blocks: ContentBlock[]): number {
  return blocks.reduce((total, block) => {
    if (block.type !== "paragraph") return total;
    return total + block.content.split(/\s+/).filter(Boolean).length;
  }, 0);
}

export function deriveProjectReadiness(project: ProjectModel): ProjectReadiness {
  // Acepta el campo nuevo (array) O el campo legacy (string), filtrando strings vacíos.
  const hasAdvisor =
    project.student.advisors?.some((a) => a.trim().length > 0) ??
    (project.student.advisor?.trim().length ?? 0) > 0;
  const setupChecks = [
    { ok: !!project.metadata.title.trim(), label: "Define el título del trabajo" },
    { ok: !!project.student.full_name.trim(), label: "Completa la autoría principal" },
    { ok: !!project.institution.name.trim(), label: "Indica la institución" },
    { ok: !!project.profile_id.trim(), label: "Selecciona un perfil académico" },
    { ok: !!project.metadata.language.trim(), label: "Elige el idioma base" },
    { ok: hasAdvisor, label: "Agrega al menos un asesor o director de tesis" },
  ];

  const bodySections = project.sections.filter((section) => section.enabled && section.placement === "body");
  const draftedBodySections = bodySections.filter((section) => section.blocks.length > 0);
  const reviewedSections = bodySections.filter((section) => {
    const status = section.status ?? "draft";
    return status === "revised" || status === "approved";
  });
  const totalWords = bodySections.reduce((sum, section) => sum + countWords(section.blocks), 0);

  const writingChecks = [
    { ok: bodySections.length > 0, label: "Activa al menos una sección de contenido" },
    { ok: draftedBodySections.length > 0, label: "Escribe contenido en una sección principal" },
    { ok: totalWords >= 150, label: "Desarrolla un primer borrador sustancial" },
    { ok: reviewedSections.length > 0, label: "Marca al menos una sección como revisada" },
  ];

  const hasReferencesSection = project.sections.some((section) => section.enabled && section.element_id === "references");
  const hasAbstractContent = project.sections.some((section) =>
    (section.element_id === "abstract" || section.element_id === "abstract_es") &&
    section.blocks.length > 0 &&
    section.blocks.some((b) => b.type === "paragraph" && b.content.trim().length > 20)
  );
  const requiredBodySections = bodySections.filter((section) => section.required ?? false);
  const allRequiredHaveContent = requiredBodySections.length === 0 ||
    requiredBodySections.every((section) => section.blocks.length > 0);
  const hasUnconfirmedRawLatex = project.sections.some((section) =>
    section.blocks.some((block) => block.type === "raw_latex" && !block.user_confirmed)
  );
  const hasCommitteeWhenAdvanced =
    project.metadata.academic_level === "doctorado" || project.metadata.academic_level === "posdoctorado"
      ? (project.student.committee?.length ?? 0) > 0
      : true;

  const deliveryChecks = [
    { ok: hasReferencesSection, label: "Incluye una sección de referencias" },
    { ok: hasAbstractContent, label: "Escribe el resumen o abstract del trabajo" },
    { ok: allRequiredHaveContent, label: "Completa las secciones obligatorias del perfil" },
    { ok: !hasUnconfirmedRawLatex, label: "Confirma o elimina bloques LaTeX sin validar" },
    { ok: hasCommitteeWhenAdvanced, label: "Completa el comité para trabajos avanzados" },
    { ok: reviewedSections.length >= Math.min(2, bodySections.length || 0), label: "Revisa las secciones principales antes de entregar" },
  ];

  const percentage = (passed: number, total: number) => total === 0 ? 0 : Math.round((passed / total) * 100);

  return {
    setupCompletion: percentage(setupChecks.filter((item) => item.ok).length, setupChecks.length),
    writingCompletion: percentage(writingChecks.filter((item) => item.ok).length, writingChecks.length),
    deliveryReadiness: percentage(deliveryChecks.filter((item) => item.ok).length, deliveryChecks.length),
    setupPending: setupChecks.filter((item) => !item.ok).map((item) => item.label),
    writingPending: writingChecks.filter((item) => !item.ok).map((item) => item.label),
    deliveryPending: deliveryChecks.filter((item) => !item.ok).map((item) => item.label),
  };
}
