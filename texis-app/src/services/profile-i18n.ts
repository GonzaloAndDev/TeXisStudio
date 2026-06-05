import profilesEn from "../../../../TeXisStudio-Profiles/i18n/en.json";
import profilesEs from "../../../../TeXisStudio-Profiles/i18n/es.json";
import type { ProfileInfo, ProfileSectionInfo } from "../types";
import type { CatalogProfile } from "./profileCatalog";

type LocaleId =
  | "ar"
  | "cs"
  | "de"
  | "en"
  | "es"
  | "fa"
  | "fr"
  | "he"
  | "hi"
  | "it"
  | "ja"
  | "ko"
  | "mix"
  | "nah"
  | "nl"
  | "pl"
  | "pt-BR"
  | "ro"
  | "ru"
  | "sv"
  | "th"
  | "tr"
  | "tzh"
  | "uk"
  | "vi"
  | "yua"
  | "zap"
  | "zh";

type ProfileSectionMessages = {
  title?: string;
  guidance?: string;
};

type ProfileMessages = {
  name?: string;
  description?: string;
  institution?: string;
  department?: string;
  faculty?: string;
  program_name?: string;
  sections?: Record<string, ProfileSectionMessages>;
};

type ProfilesLocale = {
  profiles?: Record<string, ProfileMessages>;
};

const LOCALES: Partial<Record<LocaleId, ProfilesLocale>> = {
  en: profilesEn as ProfilesLocale,
  es: profilesEs as ProfilesLocale,
};

const LOCALE_LOADERS: Partial<Record<LocaleId, () => Promise<{ default: ProfilesLocale }>>> = {
  ar: () => import("../../../../TeXisStudio-Profiles/i18n/ar.json"),
  cs: () => import("../../../../TeXisStudio-Profiles/i18n/cs.json"),
  de: () => import("../../../../TeXisStudio-Profiles/i18n/de.json"),
  fa: () => import("../../../../TeXisStudio-Profiles/i18n/fa.json"),
  fr: () => import("../../../../TeXisStudio-Profiles/i18n/fr.json"),
  he: () => import("../../../../TeXisStudio-Profiles/i18n/he.json"),
  hi: () => import("../../../../TeXisStudio-Profiles/i18n/hi.json"),
  it: () => import("../../../../TeXisStudio-Profiles/i18n/it.json"),
  ja: () => import("../../../../TeXisStudio-Profiles/i18n/ja.json"),
  ko: () => import("../../../../TeXisStudio-Profiles/i18n/ko.json"),
  mix: () => import("../../../../TeXisStudio-Profiles/i18n/mix.json"),
  nah: () => import("../../../../TeXisStudio-Profiles/i18n/nah.json"),
  nl: () => import("../../../../TeXisStudio-Profiles/i18n/nl.json"),
  pl: () => import("../../../../TeXisStudio-Profiles/i18n/pl.json"),
  "pt-BR": () => import("../../../../TeXisStudio-Profiles/i18n/pt-BR.json"),
  ro: () => import("../../../../TeXisStudio-Profiles/i18n/ro.json"),
  ru: () => import("../../../../TeXisStudio-Profiles/i18n/ru.json"),
  sv: () => import("../../../../TeXisStudio-Profiles/i18n/sv.json"),
  th: () => import("../../../../TeXisStudio-Profiles/i18n/th.json"),
  tr: () => import("../../../../TeXisStudio-Profiles/i18n/tr.json"),
  tzh: () => import("../../../../TeXisStudio-Profiles/i18n/tzh.json"),
  uk: () => import("../../../../TeXisStudio-Profiles/i18n/uk.json"),
  vi: () => import("../../../../TeXisStudio-Profiles/i18n/vi.json"),
  yua: () => import("../../../../TeXisStudio-Profiles/i18n/yua.json"),
  zap: () => import("../../../../TeXisStudio-Profiles/i18n/zap.json"),
  zh: () => import("../../../../TeXisStudio-Profiles/i18n/zh.json"),
};

const loadingLocales: Partial<Record<LocaleId, Promise<void>>> = {};

const LOCALE_ALIASES: Record<string, LocaleId> = {
  "pt": "pt-BR",
  "pt-br": "pt-BR",
  "zh-cn": "zh",
  "zh-hans": "zh",
  "iw": "he",
};

function localeId(language?: string): LocaleId {
  const raw = (language || "es").toLowerCase();
  const aliased = LOCALE_ALIASES[raw];
  if (aliased) return aliased;

  const available = new Set([...Object.keys(LOCALES), ...Object.keys(LOCALE_LOADERS)]);
  const exact = [...available].find((key) => key.toLowerCase() === raw);
  if (exact) return exact as LocaleId;

  const base = raw.split("-")[0];
  const baseMatch = [...available].find((key) => key.toLowerCase() === base);
  return (baseMatch as LocaleId | undefined) ?? "es";
}

export function getProfileLocaleId(language?: string): LocaleId {
  return localeId(language);
}

export async function ensureProfileLocale(language?: string): Promise<void> {
  const id = localeId(language);
  if (LOCALES[id]) return;

  loadingLocales[id] ??= (async () => {
    const loader = LOCALE_LOADERS[id];
    if (!loader) return;
    const mod = await loader();
    LOCALES[id] = mod.default as ProfilesLocale;
  })();

  await loadingLocales[id];
}

function profileIdCandidates(id: string): string[] {
  const dotted = id.replace(/_/g, ".");
  const underscored = id.replace(/\./g, "_");
  return [...new Set([id, underscored, dotted])];
}

function profileMessages(id: string, language?: string): ProfileMessages | undefined {
  const locale = LOCALES[localeId(language)] ?? LOCALES.es ?? LOCALES.en;
  if (!locale) return undefined;
  for (const candidate of profileIdCandidates(id)) {
    const messages = locale.profiles?.[candidate];
    if (messages) return messages;
  }
  return undefined;
}

const SECTION_KEY_ALIASES: Record<string, string[]> = {
  abstract: ["resumen", "abstract_ingles", "abstract_en", "summary"],
  acknowledgements: ["agradecimientos", "acknowledgments"],
  anexos: ["appendices", "apendices", "appendix"],
  apendices: ["appendices", "anexos", "appendix"],
  appendices: ["apendices", "anexos", "appendix"],
  conclusiones: ["conclusion", "conclusions"],
  conclusion: ["conclusiones", "conclusions"],
  conclusions: ["conclusiones", "conclusion"],
  discusion: ["discussion"],
  discussion: ["discusion"],
  indice: ["table_of_contents", "toc", "contents"],
  introduccion: ["introduction", "intro"],
  introduction: ["introduccion", "intro"],
  material_y_metodos: ["materiales_metodos", "materials_and_methods", "methodology", "methods"],
  materiales_metodos: ["material_y_metodos", "materials_and_methods", "methodology", "methods"],
  materials_and_methods: ["materiales_metodos", "material_y_metodos", "methodology", "methods"],
  metodologia: ["methodology", "methods", "materials_and_methods", "materiales_metodos"],
  methodology: ["metodologia", "methods", "materials_and_methods", "materiales_metodos"],
  portada: ["title_page", "cover"],
  referencias: ["references", "bibliography"],
  references: ["referencias", "bibliography"],
  resultados: ["results"],
  results: ["resultados"],
  resumen: ["abstract", "summary"],
  table_of_contents: ["indice", "toc", "contents"],
  title_page: ["portada", "cover"],
};

function normalizeSectionKey(value?: string): string | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || null;
}

function sectionKeyCandidates(values: Array<string | undefined>): string[] {
  const candidates = new Set<string>();
  const add = (value?: string) => {
    const key = normalizeSectionKey(value);
    if (!key || candidates.has(key)) return;
    candidates.add(key);
    for (const alias of SECTION_KEY_ALIASES[key] ?? []) add(alias);
  };
  values.forEach(add);
  return [...candidates];
}

function sectionMessages(
  messages: ProfileMessages | undefined,
  section: ProfileSectionInfo,
): ProfileSectionMessages | undefined {
  if (!messages?.sections) return undefined;
  for (const candidate of sectionKeyCandidates([section.id, section.element_id, section.title])) {
    const localized = messages.sections[candidate];
    if (localized) return localized;
  }
  return undefined;
}

export function localizeProfile(profile: ProfileInfo, language?: string): ProfileInfo {
  const messages = profileMessages(profile.id, language);
  if (!messages) return profile;

  const sections = (profile.sections ?? []).map((section) => {
    const localized = sectionMessages(messages, section);
    if (!localized) return section;
    return {
      ...section,
      title: localized.title ?? section.title,
      guidance: localized.guidance ?? section.guidance,
    };
  });

  return {
    ...profile,
    name: messages.name ?? profile.name,
    description: messages.description ?? profile.description,
    sections,
  };
}

export function localizeProfiles(profiles: ProfileInfo[], language?: string): ProfileInfo[] {
  return profiles.map((profile) => localizeProfile(profile, language));
}

export function localizeCatalogProfile(profile: CatalogProfile, language?: string): CatalogProfile {
  const messages = profileMessages(profile.id, language);
  if (!messages) return profile;
  return {
    ...profile,
    name: messages.name ?? profile.name,
    description: messages.description ?? profile.description,
    institution: messages.institution ?? profile.institution,
    department: messages.department ?? profile.department,
    faculty: messages.faculty ?? profile.faculty,
    program_name: messages.program_name ?? profile.program_name,
  };
}
