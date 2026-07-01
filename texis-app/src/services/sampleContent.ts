// Starter content for brand-new projects.
//
// When the wizard's "include example content" option is on, we seed each
// enabled body section with a helpful starting block so the very first
// compile produces a real, non-empty PDF the beginner can build on — instead
// of a nearly blank document with placeholder metadata. This runs entirely on
// the frontend, in the same enrich-then-save step the wizard already performs
// after create_project, so it never touches the backend creation path.
//
// The seeded prose is *document* content (it ends up in the PDF), so it is
// keyed off the document's language — not the UI language — with a built-in
// map for Spanish and English and an English fallback for every other
// language. This deliberately avoids bloating the seven UI locale files with
// long paragraphs.

import type { ContentBlock, ProjectSection } from "../types";

function makeId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `blk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface SamplePack {
  /** Guiding paragraph for a generic body section, given its title. */
  generic: (title: string) => string;
  /** Introduction section: overview paragraph. */
  introOverview: string;
  /** Introduction section: lead-in for the objectives list. */
  introObjectivesLead: string;
  /** Introduction section: objective bullet items. */
  introObjectives: string[];
  /** Introduction section: lead-in paragraph before the example equation. */
  introEquationLead: string;
}

const PACKS: Record<string, SamplePack> = {
  es: {
    generic: (title) =>
      `Esta es la sección «${title}». Sustituye este texto por tu contenido. ` +
      `Usa la barra de herramientas del editor para añadir párrafos, ecuaciones, ` +
      `figuras, tablas y citas; TeXisStudio genera el LaTeX correcto por ti.`,
    introOverview:
      `Bienvenido a tu documento. Este párrafo de ejemplo demuestra que tu ` +
      `proyecto ya compila a un PDF real. Empieza aquí describiendo el problema ` +
      `que abordas, su relevancia y el enfoque general de tu trabajo.`,
    introObjectivesLead: "A modo de ejemplo, estos podrían ser tus objetivos:",
    introObjectives: [
      "Plantear con claridad la pregunta de investigación.",
      "Describir el método o enfoque elegido.",
      "Presentar y discutir los resultados obtenidos.",
    ],
    introEquationLead:
      "Puedes insertar ecuaciones numeradas como esta, referenciables desde el texto:",
  },
  en: {
    generic: (title) =>
      `This is the “${title}” section. Replace this text with your own content. ` +
      `Use the editor toolbar to add paragraphs, equations, figures, tables, and ` +
      `citations; TeXisStudio generates the correct LaTeX for you.`,
    introOverview:
      `Welcome to your document. This example paragraph proves your project ` +
      `already compiles to a real PDF. Start here by describing the problem you ` +
      `address, why it matters, and your overall approach.`,
    introObjectivesLead: "As an example, these could be your objectives:",
    introObjectives: [
      "State the research question clearly.",
      "Describe the chosen method or approach.",
      "Present and discuss the results obtained.",
    ],
    introEquationLead:
      "You can insert numbered equations like this one, referenceable from the text:",
  },
};

function packFor(lang: string): SamplePack {
  return PACKS[lang] ?? PACKS.en;
}

function isIntroduction(section: ProjectSection): boolean {
  const haystack = `${section.id} ${section.element_id} ${section.title ?? ""}`.toLowerCase();
  return /introduc/.test(haystack);
}

function introBlocks(pack: SamplePack): ContentBlock[] {
  return [
    { type: "paragraph", id: makeId(), content: pack.introOverview },
    { type: "paragraph", id: makeId(), content: pack.introObjectivesLead },
    { type: "list", id: makeId(), list_type: "itemize", items: pack.introObjectives },
    { type: "paragraph", id: makeId(), content: pack.introEquationLead },
    { type: "equation", id: makeId(), latex_content: "E = mc^2", numbered: true },
  ];
}

/**
 * Returns a copy of `sections` with starter blocks seeded into every enabled
 * body section that is currently empty. Sections with existing content, and
 * non-body sections (front/back matter, appendices), are left untouched, so
 * this is safe to run on any freshly created project.
 */
export function seedSampleContent(
  sections: ProjectSection[],
  documentLanguage: string,
): ProjectSection[] {
  const pack = packFor(documentLanguage);
  return sections.map((section) => {
    if (section.placement !== "body" || !section.enabled || section.blocks.length > 0) {
      return section;
    }
    const blocks = isIntroduction(section)
      ? introBlocks(pack)
      : [{ type: "paragraph", id: makeId(), content: pack.generic(section.title ?? section.element_id) } as ContentBlock];
    return { ...section, blocks };
  });
}
