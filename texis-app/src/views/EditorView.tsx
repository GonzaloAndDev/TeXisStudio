import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConfirm } from "../components/ui/useConfirm";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import { EditorMetaPanel } from "../components/EditorMetaPanel";
import { SectionGuidancePanel } from "../components/SectionGuidancePanel";
import { ProjectDiagnosticsPanel } from "../components/ProjectDiagnosticsPanel";
import {
  IconAcronym, IconAlgorithm, IconBuild, IconCheck, IconChevronD, IconCode, IconFile,
  IconGlossaryEntry, IconHeading, IconHome, IconImage, IconList, IconMore, IconPlus, IconRefresh,
  IconSearch, IconSettings, IconSigma, IconSliders, IconTable, IconText, IconTheorem, IconTrash, IconX,
} from "../components/Icons";
import { LanguagePicker } from "../components/LanguagePicker";
import { SpellPanel } from "../components/SpellPanel";
import { GrammarPanel } from "../components/GrammarPanel";
import { AiAssistantPanel } from "../components/AiAssistantPanel";
import { useAiStore } from "../stores/ai";
import type { GrammarMatch } from "../services/grammar";
import { useSettingsStore } from "../stores/settings";
import { api } from "../lib/tauri";
import { ensureProfileLocale, localizeProfile } from "../services/profile-i18n";
import { useProjectStore } from "../stores/project";
import type { BibReference, ContentBlock, LatexTypography, ProjectSection, SectionStatus } from "../types";
import { SectionStatusBar, STATUS_CONFIG } from "./editor/BlockEditors";
import { CitationPickerModal } from "./editor/CitationPickerModal";


import { BlockItem } from "./editor/BlockItem";
import { CommandPalette } from "./editor/CommandPalette";
import { DocumentOptionsPanel } from "./editor/DocumentOptionsPanel";
import { HelpCenter } from "../components/help/HelpCenter";

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
  methodology: ["metodologia", "materials_and_methods", "materiales_metodos", "methods"],
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

function sectionKeyCandidates(values: Array<string | undefined>): Set<string> {
  const candidates = new Set<string>();
  const add = (value?: string) => {
    const key = normalizeSectionKey(value);
    if (!key || candidates.has(key)) return;
    candidates.add(key);
    for (const alias of SECTION_KEY_ALIASES[key] ?? []) add(alias);
  };
  values.forEach(add);
  return candidates;
}
import { VisualKindSelector, defaultConfig } from "./editor/VisualBlockEditor";
import type { VisualKind } from "../types";
// ── Utilidades ────────────────────────────────────────────────────

const PLACEMENT_KEYS: Record<string, string> = {
  front_matter: "editor.placement_front",
  body: "editor.placement_body",
  back_matter: "editor.placement_back",
  appendix: "editor.placement_appendix",
};

function usePlacementGroup(sections: ProjectSection[]) {
  const { t } = useTranslation();
  const groups: Record<string, ProjectSection[]> = {};
  for (const s of sections) {
    const key = PLACEMENT_KEYS[s.placement];
    const g = key ? t(key as Parameters<typeof t>[0]) : s.placement;
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  }
  return groups;
}

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Block offset utilities ────────────────────────────────────────
// Used by SpellPanel (block-scoped errors) and GrammarPanel (offset mapping).

/**
 * Build a map from joined-text character offsets back to individual blocks.
 * Blocks are joined with `separator` (default "\n\n") — same as what we send to LanguageTool.
 */
function buildBlockOffsetMap(
  blocks: Array<{ id: string; content: string }>,
  separator = "\n\n",
): Array<{ id: string; start: number; end: number }> {
  const map: Array<{ id: string; start: number; end: number }> = [];
  let offset = 0;
  for (const b of blocks) {
    map.push({ id: b.id, start: offset, end: offset + b.content.length });
    offset += b.content.length + separator.length;
  }
  return map;
}

function countWords(blocks: ContentBlock[]): number {
  return blocks
    .filter((b) => b.type === "paragraph")
    .reduce((acc, b) => acc + (b.type === "paragraph" ? b.content.split(/\s+/).filter(Boolean).length : 0), 0);
}

/**
 * Calcula la ruta del .tex generado para una sección dentro de build/.
 * Espeja la lógica de texis-core/src/generator/labels.rs.
 */
function sectionTexPath(
  section: ProjectSection,
  allSections: ProjectSection[],
  projectPath: string,
): string | null {
  const INLINE_ELEMENTS = new Set([
    "table_of_contents", "list_of_figures", "list_of_tables",
    "list_of_algorithms", "list_of_listings", "references",
  ]);
  if (INLINE_ELEMENTS.has(section.element_id)) return null;

  const buildDir = `${projectPath}/build`;

  switch (section.placement) {
    case "front_matter":
      return `${buildDir}/preliminares/${section.id}.tex`;
    case "body": {
      const bodyIdx = allSections
        .filter(s => s.enabled && s.placement === "body")
        .findIndex(s => s.id === section.id);
      const n = String(bodyIdx + 1).padStart(2, "0");
      return `${buildDir}/capitulos/${n}_${section.id}.tex`;
    }
    case "back_matter":
      return `${buildDir}/backmatter/${section.id}.tex`;
    case "appendix":
      return `${buildDir}/anexos/${section.id}.tex`;
    default:
      return null;
  }
}

// ── EditorView principal ──────────────────────────────────────────

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

export default function EditorView() {
  const { id: encodedPath } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
  const { activeProject, activeProjectPath, activeSectionId, setActiveSectionId } = useProjectStore();
  const { userMode } = useSettingsStore();

  const [localBlocks, setLocalBlocks] = useState<ContentBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag & drop state
  const [dragId, setDragId]   = useState<string | null>(null);
  const [dropId, setDropId]   = useState<string | null>(null);

  // Opciones del documento
  const [docOptionsOpen, setDocOptionsOpen] = useState(false);

  // Snapshots (versiones)
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<{ filename: string; timestamp: string; label: string }[]>([]);
  const [newSnapLabel, setNewSnapLabel] = useState("");
  const [snapBusy, setSnapBusy] = useState(false);

  // Navigation guard — bloquear si hay cambios sin guardar
  const isUnsaved = saveStatus === "unsaved" || saveStatus === "error";
  const blocker = useBlocker(isUnsaved);

  // Toolbar académico
  const [paletteOpen, setPaletteOpen]     = useState(false);
  const [citPickerOpen, setCitPickerOpen] = useState(false);
  const [helpOpen, setHelpOpen]           = useState(false);
  const [bibRefs, setBibRefs]             = useState<BibReference[]>([]);
  const [projectAssets, setProjectAssets] = useState<Array<{ name: string; path: string }>>([]);

  // Labels disponibles de todos los bloques del proyecto (para \cref{})
  const availableLabels = useMemo(() => {
    const labels: Array<{ key: string; kind: string; caption: string }> = [];
    for (const section of activeProject?.sections ?? []) {
      for (const block of section.blocks ?? []) {
        if (block.type === "figure" && block.label)
          labels.push({ key: block.label, kind: t("editor.ref_kind_figure"), caption: block.caption ?? "" });
        else if (block.type === "table" && block.label)
          labels.push({ key: block.label, kind: t("editor.ref_kind_table"), caption: block.caption ?? "" });
        else if (block.type === "equation" && block.label)
          labels.push({ key: block.label, kind: t("editor.ref_kind_equation"), caption: "" });
        else if (block.type === "algorithm" && block.label)
          labels.push({ key: block.label, kind: t("editor.ref_kind_algorithm"), caption: block.caption ?? "" });
      }
    }
    return labels;
  }, [activeProject, t]);

  // Paneles de revisión de texto
  const [spellPanelOpen, setSpellPanelOpen]     = useState(false);
  const [grammarPanelOpen, setGrammarPanelOpen] = useState(false);
  const aiPanel = useAiStore();

  // Navegación a bloque específico (desde búsqueda en CommandPalette)
  const [jumpTargetBlockId, setJumpTargetBlockId] = useState<string | null>(null);

  // Selector de tipo de Visual Block — se abre al insertar un bloque visual
  const [visualSelectorOpen, setVisualSelectorOpen] = useState<string | null>(null);

  // Scroll y highlight cuando jumpTargetBlockId cambia
  useEffect(() => {
    if (!jumpTargetBlockId) return;
    // Pequeño delay para asegurar que el bloque ya está renderizado
    // (puede haberse cambiado de sección justo antes)
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${jumpTargetBlockId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // Quitar el highlight después de 2 segundos
      const clearTimer = setTimeout(() => setJumpTargetBlockId(null), 2000);
      return () => clearTimeout(clearTimer);
    }, 80);
    return () => clearTimeout(timer);
  }, [jumpTargetBlockId]);

  // Selección de texto real para el panel de IA
  // Se actualiza cada vez que el usuario selecciona texto en el editor
  const [aiSelection, setAiSelection] = useState<{
    text: string;
    blockId: string;
    start: number;
    end: number;
  } | null>(null);
  const [lastAiUndoBlocks, setLastAiUndoBlocks] = useState<ContentBlock[] | null>(null);

  const captureSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setAiSelection(null);
      return;
    }
    const selectedText = sel.toString();
    // Buscar en qué bloque está la selección comparando con el contenido
    const block = localBlocks.find(
      (b) => b.type === "paragraph" && b.content.includes(selectedText)
    );
    if (block && block.type === "paragraph") {
      const start = block.content.indexOf(selectedText);
      setAiSelection({ text: selectedText, blockId: block.id, start, end: start + selectedText.length });
    } else {
      // Selección sin bloque exacto identificable (por ej. texto heading)
      setAiSelection({ text: selectedText, blockId: "", start: 0, end: selectedText.length });
    }
  }, [localBlocks]);

  // Perfil activo: se carga para mostrar guidance por sección y límites
  const [profileSections, setProfileSections] = useState<import("../types").ProfileSectionInfo[]>([]);
  const [profileMaxWords, setProfileMaxWords] = useState<number | undefined>(undefined);
  useEffect(() => {
    const pid = activeProject?.profile_id;
    if (!pid) return;
    const profileLanguage = i18n.resolvedLanguage || i18n.language;
    let cancelled = false;
    (async () => {
      await ensureProfileLocale(profileLanguage);
      const p = await api.getProfileDetail(pid);
      if (cancelled) return;
      setProfileSections(localizeProfile(p, profileLanguage).sections ?? []);
      setProfileMaxWords(p.max_words);
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [activeProject?.profile_id, i18n.language, i18n.resolvedLanguage]);

  // Sincronizar localBlocks cuando cambia la sección activa
  useEffect(() => {
    const section = activeProject?.sections.find((s) => s.id === activeSectionId);
    setLocalBlocks(section?.blocks ?? []);
    setEditingId(null);
    setSaveStatus("saved");
    // Actualizar contexto de UI para el asistente de IA
    useAiStore.getState().setUiContext({
      activePanel: "editor",
      activeSectionType: section?.element_id,
      profileId: activeProject?.profile_id,
    });
  }, [activeSectionId, activeProject]);

  const doSave = useCallback(async (blocks: ContentBlock[], sectionId: string) => {
    setSaveStatus("saving");
    useProjectStore.getState().updateSectionBlocks(sectionId, blocks);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv && activeProjectPath) {
      try {
        await api.saveSection(activeProjectPath, sectionId, blocks);
      } catch (e) {
        console.error("Error guardando:", e);
        setSaveStatus("error");
        return;
      }
    }
    setSaveStatus("saved");
  }, [activeProjectPath]);

  // Prevenir cierre de ventana/app con cambios sin guardar
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isUnsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isUnsaved]);

  // ── Snapshots ──────────────────────────────────────────────────
  const loadSnapshots = useCallback(async () => {
    if (!activeProjectPath) return;
    try {
      const list = await api.listSnapshots(activeProjectPath);
      setSnapshots(list);
    } catch {
      setSnapshots([]);
    }
  }, [activeProjectPath]);

  useEffect(() => {
    if (snapshotsOpen) loadSnapshots();
  }, [snapshotsOpen, loadSnapshots]);

  const handleCreateSnapshot = useCallback(async () => {
    if (!activeProjectPath || !newSnapLabel.trim()) return;
    setSnapBusy(true);
    try {
      await api.createSnapshot(activeProjectPath, newSnapLabel.trim());
      setNewSnapLabel("");
      await loadSnapshots();
    } catch (e) {
      console.error("Error creando snapshot:", e);
    } finally {
      setSnapBusy(false);
    }
  }, [activeProjectPath, newSnapLabel, loadSnapshots]);

  const handleRestoreSnapshot = useCallback(async (filename: string) => {
    if (!activeProjectPath) return;
    const ok = await confirm({
      title: t("editor.snapshot_restore_title"),
      message: t("editor.snapshot_restore_confirm"),
      confirmLabel: t("editor.snapshot_restore_action"),
      cancelLabel: t("common.cancel"),
      destructive: false,
    });
    if (!ok) return;
    setSnapBusy(true);
    try {
      await api.restoreSnapshot(activeProjectPath, filename);
      const model = await api.getProject(activeProjectPath);
      useProjectStore.getState().openProject(model, activeProjectPath);
      setSnapshotsOpen(false);
    } catch (e) {
      console.error("Error restaurando snapshot:", e);
    } finally {
      setSnapBusy(false);
    }
  }, [activeProjectPath, confirm, t]);

  const handleDeleteSnapshot = useCallback(async (filename: string) => {
    if (!activeProjectPath) return;
    const ok = await confirm({
      title: t("editor.snapshot_delete_title"),
      message: t("editor.snapshot_delete_confirm"),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.deleteSnapshot(activeProjectPath, filename);
      await loadSnapshots();
    } catch (e) {
      console.error("Error eliminando snapshot:", e);
    }
  }, [activeProjectPath, confirm, t, loadSnapshots]);

  const scheduleAutoSave = useCallback((blocks: ContentBlock[]) => {
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!activeSectionId) return;
    saveTimer.current = setTimeout(() => doSave(blocks, activeSectionId), 1500);
  }, [activeSectionId, doSave]);

  const updateBlock = useCallback((id: string, updates: Record<string, unknown>) => {
    setLocalBlocks((prev) => {
      const next = prev.map((b) => b.id === id ? { ...b, ...updates } : b);
      scheduleAutoSave(next);
      return next;
    });
  }, [scheduleAutoSave]);

  const addBlock = useCallback((type: ContentBlock["type"]) => {
    const id = newId();
    let block: ContentBlock;
    switch (type) {
      case "paragraph":      block = { type, id, content: "" }; break;
      case "heading":        block = { type, id, level: "section", content: "" }; break;
      case "list":           block = { type, id, list_type: "itemize", items: [""] }; break;
      case "equation":       block = { type, id, latex_content: "", numbered: false }; break;
      case "raw_latex":      block = { type, id, content: "", user_confirmed: false }; break;
      case "figure":         block = { type, id, file: "", caption: "", width: "full", label: `fig:${id.slice(0, 6)}`, include_in_list: true }; break;
      case "table":          block = { type, id, caption: "", label: `tab:${id.slice(0, 6)}`, include_in_list: true, headers: [t("editor.default_table_column_1"), t("editor.default_table_column_2")], rows: [["", ""], ["", ""]] }; break;
      case "citation":       block = { type, id, citation_key: "", citation_type: "parenthetical" }; break;
      case "glossary_entry": block = { type, id, term: "", definition: "" }; break;
      case "acronym_entry":  block = { type, id, acronym: "", full_form: "", description: undefined }; break;
      case "code":           block = { type, id, language: "Python", content: "", show_line_numbers: true }; break;
      case "algorithm":      block = { type, id, caption: "", body: "" }; break;
      case "theorem":        block = { type, id, kind: "theorem", content: "", numbered: true }; break;
      case "visual": {
        // El selector de tipo visual se abre después — por defecto Venn
        block = {
          type, id,
          caption: "",
          label: `fig:${id.slice(0, 6)}`,
          include_in_list: true,
          config: { kind: "venn_euler", sets: [{ label: t("editor.default_set_a"), color: "red" }, { label: t("editor.default_set_b"), color: "blue" }, { label: t("editor.default_set_c"), color: "green" }], intersections: {} },
        };
        setVisualSelectorOpen(id); // abrimos el selector de tipo
        break;
      }
      default: return;
    }
    setLocalBlocks((prev) => {
      const next = [...prev, block];
      scheduleAutoSave(next);
      return next;
    });
    setEditingId(id);
  }, [scheduleAutoSave]);

  const deleteBlock = useCallback((id: string) => {
    setLocalBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      scheduleAutoSave(next);
      return next;
    });
    setEditingId(null);
  }, [scheduleAutoSave]);

  // Insertar cita bibliográfica desde el picker
  const insertCitation = useCallback((ref: BibReference, citType: "parenthetical" | "narrative" | "footnote" = "parenthetical") => {
    const id = newId();
    const block: ContentBlock = {
      type: "citation",
      id,
      citation_key: ref.key,
      citation_type: citType,
    };
    setLocalBlocks((prev) => {
      const next = [...prev, block];
      scheduleAutoSave(next);
      return next;
    });
    setEditingId(id);
  }, [scheduleAutoSave]);

  // Reordenar bloques al soltar (dragId → antes de dropId)
  const handleDrop = useCallback((targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDropId(null); return; }
    setLocalBlocks((prev) => {
      const src = prev.find((b) => b.id === dragId);
      if (!src) return prev;
      const without = prev.filter((b) => b.id !== dragId);
      const targetIdx = without.findIndex((b) => b.id === targetId);
      if (targetIdx === -1) return prev;
      const next = [...without.slice(0, targetIdx), src, ...without.slice(targetIdx)];
      scheduleAutoSave(next);
      return next;
    });
    setDragId(null);
    setDropId(null);
  }, [dragId, scheduleAutoSave]);

  // Guardar metadatos del proyecto (título, autor, institución)
  const saveMetadata = useCallback(async (updates: Record<string, unknown>) => {
    if (!activeProject || !activeProjectPath) return;
    const updated = { ...activeProject, ...updates };
    useProjectStore.getState().updateProject(updates as Partial<import("../types").ProjectModel>);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      try { await api.saveProject(activeProjectPath, updated); }
      catch (e) { console.error("Error guardando metadatos:", e); }
    }
  }, [activeProject, activeProjectPath]);

  // ── Estado / notas de sección ──────────────────────────────────
  const handleSectionStatusChange = useCallback(async (sectionId: string, status: SectionStatus) => {
    if (!activeProjectPath) return;
    const section = activeProject?.sections.find((s) => s.id === sectionId);
    useProjectStore.getState().updateSectionMeta(sectionId, status, section?.notes);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      try { await api.updateSectionMeta(activeProjectPath, sectionId, status, section?.notes); }
      catch (e) { console.error("Error actualizando estado:", e); }
    }
  }, [activeProjectPath, activeProject]);

  const handleSectionNotesChange = useCallback(async (sectionId: string, notes: string) => {
    if (!activeProjectPath) return;
    const section = activeProject?.sections.find((s) => s.id === sectionId);
    const status = section?.status ?? "draft";
    useProjectStore.getState().updateSectionMeta(sectionId, status, notes || undefined);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      try { await api.updateSectionMeta(activeProjectPath, sectionId, status, notes || undefined); }
      catch (e) { console.error("Error actualizando notas:", e); }
    }
  }, [activeProjectPath, activeProject]);

  // ── Tipografía y preámbulo del documento ─────────────────────────
  const handleSaveTypography = useCallback(async (opts: { typography: LatexTypography; preamble: import("../types").PreambleConfig }) => {
    if (!activeProjectPath || !activeProject) return;
    const typo = opts.typography;
    const preamble = opts.preamble;
    // Actualizar en el store
    const updated = {
      ...activeProject,
      latex_config: {
        ...(activeProject.latex_config ?? { document_class: { name: "book", options: [] }, bibliography_style: "apa", typography: {} }),
        typography: typo,
        preamble_config: preamble,
      },
    };
    useProjectStore.getState().updateProject(updated);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      try {
        await api.updateTypography(
          activeProjectPath,
          typo.font_size,
          typo.paper_size,
          typo.line_spacing,
          typo.margin_cm,
        );
        await api.updatePreambleConfig(activeProjectPath, preamble)
          .catch((e: unknown) => console.error("Error guardando preámbulo:", e));
      } catch (e) {
        console.error("Error guardando tipografía:", e);
      }
    }
  }, [activeProjectPath, activeProject]);

  // Cargar referencias .bib — reutilizable tras agregar entradas por DOI
  const reloadBibRefs = useCallback(() => {
    if (!activeProjectPath) return;
    api.listReferences(activeProjectPath)
      .then(setBibRefs)
      .catch(() => setBibRefs([]));
  }, [activeProjectPath]);

  useEffect(() => { reloadBibRefs(); }, [reloadBibRefs]);

  // Cargar assets del proyecto
  useEffect(() => {
    if (!activeProjectPath) return;
    api.listProjectAssets(activeProjectPath).then(setProjectAssets).catch(() => {});
  }, [activeProjectPath]);

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K → paleta de comandos
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      // Ctrl+[ / Cmd+[ → picker de citas
      if ((e.ctrlKey || e.metaKey) && e.key === "[") {
        e.preventDefault();
        setCitPickerOpen((o) => !o);
        return;
      }
      // Ctrl+S / Cmd+S → guardar inmediatamente
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (activeSectionId) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          doSave(localBlocks, activeSectionId);
        }
        return;
      }
      // Esc → cerrar modales o salir del modo edición
      if (e.key === "Escape") {
        if (paletteOpen)    { setPaletteOpen(false); return; }
        if (citPickerOpen)  { setCitPickerOpen(false); return; }
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSectionId, localBlocks, doSave, paletteOpen, citPickerOpen]);

  if (!activeProject || !activeProjectPath) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--fg-muted)", background: "var(--bg-app)" }}>
        <p>{t("editor.project_not_loaded")}</p>
        <button className="btn" onClick={() => navigate("/")}>← {t("library.back_home").replace("← ", "")}</button>
      </div>
    );
  }

  const groups = usePlacementGroup(activeProject.sections);
  const activeSection = activeProject.sections.find((s) => s.id === activeSectionId)
    ?? activeProject.sections.find((s) => s.placement === "body" && s.enabled)
    ?? activeProject.sections[0];

  const localizedProfileSection = useCallback(
    (s: { id: string; element_id: string; title?: string }) => {
      const sectionKeys = sectionKeyCandidates([s.id, s.element_id, s.title]);
      return profileSections.find((ps) => {
        const profileKeys = sectionKeyCandidates([ps.id, ps.element_id, ps.title]);
        return [...sectionKeys].some((key) => profileKeys.has(key));
      });
    },
    [profileSections],
  );

  // Returns the localized section title from the active profile i18n.
  const localizedSectionTitle = useCallback(
    (s: { id: string; element_id: string; title?: string }) =>
      localizedProfileSection(s)?.title ?? s.title ?? s.element_id,
    [localizedProfileSection],
  );

  const bodyWordCount = activeProject.sections
    .filter((s) => s.placement === "body")
    .reduce((acc, s) => acc + countWords(s.id === activeSectionId ? localBlocks : s.blocks), 0);

  const projectName = activeProject.metadata.title;
  const toolbarItems: [ContentBlock["type"], React.ReactNode, string, string?][] = userMode === "basic"
    ? [
        ["paragraph", <IconText size={12} />, t("editor.toolbar_add_text"), t("editor.toolbar_add_text_tip")],
        ["heading", <IconHeading size={12} />, t("editor.toolbar_add_heading"), t("editor.toolbar_add_heading_tip")],
        ["list", <IconList size={12} />, t("editor.toolbar_add_list"), t("editor.toolbar_add_list_tip")],
        ["citation", <IconMore size={12} />, t("editor.toolbar_add_citation"), t("editor.toolbar_add_citation_tip")],
        ["figure", <IconImage size={12} />, t("editor.toolbar_add_figure"), t("editor.toolbar_add_figure_tip")],
        ["table", <IconTable size={12} />, t("editor.toolbar_add_table"), t("editor.toolbar_add_table_tip")],
        ["equation", <IconSigma size={12} />, t("editor.toolbar_add_equation"), t("editor.toolbar_add_equation_tip")],
        ["visual", <span style={{ fontSize: 12 }}>⬤⬤</span>, t("editor.toolbar_add_visual"), t("editor.toolbar_add_visual_tip")],
      ]
    : [
        ["paragraph", <IconText size={12} />, t("editor.block_paragraph"), t("editor.toolbar_paragraph_tip")],
        ["heading", <IconHeading size={12} />, t("editor.block_heading"), t("editor.toolbar_heading_tip")],
        ["list", <IconList size={12} />, t("editor.block_list"), "Itemize / Enumerate"],
        ["equation", <IconSigma size={12} />, t("editor.block_equation"), "equation / equation* (amsmath)"],
        ["visual", <span style={{ fontSize: 11 }}>⬤⬤</span>, t("editor.block_visual"), t("editor.toolbar_visual_tip")],
        ["figure", <IconImage size={12} />, t("editor.block_figure")],
        ["table", <IconTable size={12} />, t("editor.block_table")],
        ["raw_latex", <IconCode size={12} />, "LaTeX", t("editor.toolbar_raw_latex_tip")],
        ["code", <IconCode size={12} />, t("editor.block_code"), t("editor.toolbar_code_tip")],
        ["algorithm", <IconAlgorithm size={12} />, t("editor.block_algorithm"), t("editor.toolbar_algorithm_tip")],
        ["theorem", <IconTheorem size={12} />, t("editor.block_theorem"), t("editor.toolbar_theorem_tip")],
        ["glossary_entry", <IconGlossaryEntry size={12} />, t("editor.block_glossary"), t("editor.toolbar_glossary_tip")],
        ["acronym_entry", <IconAcronym size={12} />, t("editor.block_acronym"), t("editor.toolbar_acronym_tip")],
      ];

  const saveLabel =
    saveStatus === "saving"  ? t("editor.saving") :
    saveStatus === "unsaved" ? t("editor.unsaved_changes") :
    saveStatus === "error"   ? t("common.error") :
    t("editor.autosaved");
  const saveDot =
    saveStatus === "saving"  ? "var(--build-warn)" :
    saveStatus === "unsaved" ? "var(--build-warn)" :
    saveStatus === "error"   ? "var(--build-err)" :
    "var(--build-ok)";

  return (
    <>
      <TxAppbar
        left={
          <>
            <button
              className="btn btn-ghost btn-icon"
              title={t("home.nav_projects")}
              onClick={() => navigate("/")}
              style={{ marginRight: 2 }}
            >
              <IconHome size={14} />
            </button>
            <TxLogo />
            <TxBreadcrumb parts={[projectName, activeSection ? localizedSectionTitle(activeSection) : t("editor.section_fallback")]} />
          </>
        }
        center={null}
        right={
          <>
            <button className="btn btn-ghost btn-sm" aria-label={t("command_palette.placeholder")} onClick={() => setPaletteOpen(true)}><IconSearch size={13} /></button>
            <button
              className={`btn btn-ghost btn-sm${snapshotsOpen ? " btn-active" : ""}`}
              onClick={() => setSnapshotsOpen((o) => !o)}
              title={t("editor.snapshots_title")}
            >
              <IconRefresh size={13} /> {t("editor.snapshots")}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/project/${encodedPath}/progress`)} title={t("editor.progress_title")}>
              {t("progress.tab_progress")}
            </button>
            <button className="btn btn-accent btn-sm" onClick={() => navigate(`/project/${encodedPath}/compile`)}>
              <IconBuild size={13} /> {t("editor.compile")}
            </button>
            {userMode === "advanced" && (
              <button
                className={`btn btn-ghost btn-icon${docOptionsOpen ? " btn-active" : ""}`}
                title={t("editor.document_options")}
                onClick={() => setDocOptionsOpen(true)}
              >
                <IconSettings size={14} />
              </button>
            )}
            <LanguagePicker />
            <button
              className="btn btn-ghost btn-icon"
              title={t("help.open_help")}
              onClick={() => setHelpOpen(true)}
            >
              ?
            </button>
            <button
              className="btn btn-ghost btn-icon"
              title={t("common.settings")}
              onClick={() => navigate("/settings")}
            >
              <IconSliders size={14} />
            </button>
          </>
        }
      />
      {helpOpen && <HelpCenter onClose={() => setHelpOpen(false)} />}

      <div className="editor-shell">
      <div className="editor-grid">

        {/* ── Árbol de secciones ─────────────────────────────────── */}
        <div style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "12px 14px 8px", fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {userMode === "basic" ? t("editor.document_path") : t("editor.sections")}
            <button className="btn btn-ghost btn-icon" style={{ padding: 4 }}><IconPlus size={12} /></button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 6px 12px" }} className="scroll">
            {Object.entries(groups).map(([groupLabel, secs]) => (
              <div key={groupLabel}>
                <div style={{ margin: "6px 8px 2px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)", display: "flex", alignItems: "center", gap: 6 }}>
                  <IconChevronD size={10} /> {groupLabel}
                </div>
                {secs.filter((s) => s.enabled).map((s) => {
                  const sStatus = s.status ?? "draft";
                  const dotColor = STATUS_CONFIG[sStatus as SectionStatus]?.color ?? "#888";
                  const statusLabel = STATUS_CONFIG[sStatus as SectionStatus]?.labelKey ? t(STATUS_CONFIG[sStatus as SectionStatus].labelKey) : sStatus;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="option"
                      aria-selected={s.id === activeSectionId}
                      aria-label={`${localizedSectionTitle(s)} — ${statusLabel}`}
                      className="tx-unstyled-button"
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "var(--fs-base)", width: "100%", background: s.id === activeSectionId ? "var(--bg-selected)" : "transparent", color: s.id === activeSectionId ? "var(--accent-deep)" : "var(--fg-default)", fontWeight: s.id === activeSectionId ? 500 : 400, minHeight: 26 }}
                      onClick={() => setActiveSectionId(s.id)}
                      title={`${localizedSectionTitle(s)} · ${statusLabel}`}
                    >
                      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{localizedSectionTitle(s)}</span>
                      <span aria-hidden="true" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>
                        {(s.id === activeSectionId ? localBlocks.length : s.blocks.length) || ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Leyenda de estados — accesible sin color */}
          <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexWrap: "wrap", gap: "4px 10px" }} aria-label={t("editor.section_status_legend")}>
            {(Object.entries(STATUS_CONFIG) as [SectionStatus, typeof STATUS_CONFIG[SectionStatus]][]).map(([s, cfg]) => (
              <span key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0, display: "inline-block" }} />
                {t(cfg.labelKey)}
              </span>
            ))}
          </div>
        </div>

        {/* ── Canvas editor ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Toolbar */}
          <div className="editor-toolbar" style={{ height: 38, flexShrink: 0, borderBottom: "1px solid var(--border-subtle)", padding: "0 14px", display: "flex", alignItems: "center", gap: 2, background: "var(--bg-panel)", fontSize: "var(--fs-sm)" }}>
            {toolbarItems.map(([type, icon, label, tooltip]) => (
              <button
                key={type}
                className="btn btn-ghost btn-sm"
                onClick={() => addBlock(type)}
                title={label + (tooltip ? ` — ${tooltip}` : "")}
                style={{ padding: "4px 7px", fontSize: "var(--fs-xs)", gap: 4 }}
              >
                {icon}
              </button>
            ))}

            {/* Separador */}
            <div style={{ width: 1, height: 22, background: "var(--border-subtle)", margin: "0 4px", flexShrink: 0 }} />

            {/* Picker de citas */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setCitPickerOpen(true)}
              title={t("editor.insert_citation_title")}
              style={{ flexDirection: "column", gap: 1, padding: "5px 8px", height: "auto", fontSize: 9 }}
            >
              <IconMore size={12} /><span>{t("editor.block_citation")}</span>
            </button>

            <div style={{ flex: 1 }} />

            {/* Botones de revisión */}
            <div style={{ width: 1, height: 22, background: "var(--border-subtle)", margin: "0 4px", flexShrink: 0 }} />
            <button
              className={`btn btn-sm ${spellPanelOpen ? "btn-accent" : "btn-ghost"}`}
              onClick={() => { setSpellPanelOpen((v) => !v); if (grammarPanelOpen) setGrammarPanelOpen(false); }}
              aria-label={t("spell.panel_title")}
              aria-pressed={spellPanelOpen}
              title={t("spell.panel_title")}
              style={{ fontSize: "var(--fs-xs)", padding: "4px 8px", gap: 4 }}
            >
              <IconCheck size={11} />
              {t("editor.review_spell")}
            </button>
            <button
              className={`btn btn-sm ${grammarPanelOpen ? "btn-accent" : "btn-ghost"}`}
              onClick={() => { setGrammarPanelOpen((v) => !v); if (spellPanelOpen) setSpellPanelOpen(false); }}
              aria-label={t("grammar.panel_title")}
              aria-pressed={grammarPanelOpen}
              title={t("grammar.panel_title")}
              style={{ fontSize: "var(--fs-xs)", padding: "4px 8px", gap: 4 }}
            >
              <IconText size={11} />
              {t("editor.review_grammar")}
            </button>
            <button
              className={`btn btn-sm ${aiPanel.isPanelOpen ? "btn-accent" : "btn-ghost"}`}
              onClick={() => aiPanel.togglePanel()}
              aria-label={t("ai.panel_title")}
              aria-pressed={aiPanel.isPanelOpen}
              title={t("ai.panel_title")}
              style={{ fontSize: "var(--fs-xs)", padding: "4px 8px", gap: 4 }}
            >
              <IconSigma size={11} />
              {t("editor.review_ai")}
            </button>

            <div style={{ display: "none" }} />

            {/* Paleta de comandos */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setPaletteOpen(true)}
              title={t("editor.command_palette_title")}
              style={{ fontSize: "var(--fs-xs)", gap: 5, padding: "4px 10px" }}
            >
              <IconSearch size={11} />
              <span>{t("command_palette.commands")}</span>
              <span className="kbd" style={{ fontSize: 9 }}>⌘K</span>
            </button>

            <div style={{ width: 1, height: 22, background: "var(--border-subtle)", margin: "0 6px", flexShrink: 0 }} />

            <div role="status" aria-live="polite" aria-label={saveLabel} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--fs-xs)", color: saveStatus === "error" ? "var(--build-err)" : "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
              <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: saveDot }} />
              <IconRefresh size={11} /> {saveLabel}
              {saveStatus === "error" && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "var(--fs-xs)", padding: "1px 6px", marginLeft: 4 }}
                  onClick={() => activeProjectPath && doSave(localBlocks, activeSectionId ?? "")}
                >
                  {t("editor.retry")}
                </button>
              )}
            </div>
          </div>

          {/* Paper canvas */}
          <div
            style={{ flex: 1, overflow: "auto", padding: "32px 0", background: "var(--bg-app)" }}
            className="scroll"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null); }}
            onMouseUp={captureSelection}
            onKeyUp={captureSelection}
          >
            {activeSection ? (
              <div className="editor-paper">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", letterSpacing: "0.05em", flex: 1 }}>
                    {userMode === "advanced" ? activeSection.element_id : t("editor.active_section")}
                  </div>
                  {activeProjectPath && userMode === "advanced" && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 10, padding: "2px 8px", color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}
                      title={t("editor.open_generated_tex_title")}
                      onClick={() => {
                        const texPath = sectionTexPath(activeSection, activeProject.sections, activeProjectPath);
                        if (texPath) api.openInSystem(texPath).catch(() => {});
                      }}
                    >
                      .tex ↗
                    </button>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 500, color: "var(--fg-strong)", margin: "4px 0 16px", letterSpacing: "-0.015em", lineHeight: 1.15 }}>
                  {localizedSectionTitle(activeSection)}
                </div>

                {userMode === "basic" && (
                  <div style={{
                    marginBottom: 16, padding: "10px 12px",
                    borderRadius: "var(--r-md)", background: "var(--accent-tint)",
                    border: "1px solid var(--accent-soft)", fontSize: "var(--fs-sm)",
                    color: "var(--accent-deep)", lineHeight: 1.6,
                  }}>
                    {t("editor.basic_section_hint")}
                  </div>
                )}

                <SectionGuidancePanel
                  guidance={localizedProfileSection(activeSection)?.guidance}
                />

                <SectionStatusBar
                  section={activeSection}
                  onChangeStatus={(s) => handleSectionStatusChange(activeSection.id, s)}
                  onChangeNotes={(n) => handleSectionNotesChange(activeSection.id, n)}
                />

                {localBlocks.length === 0 ? (
                  <button
                    type="button"
                    className="tx-unstyled-button tx-card-action"
                    style={{ textAlign: "center", padding: "60px 0", color: "var(--fg-faint)", fontSize: "var(--fs-md)", width: "100%", borderRadius: "var(--r-md)" }}
                    onClick={() => addBlock("paragraph")}
                    aria-label={t("editor.empty_basic_title")}
                  >
                    <p style={{ margin: 0 }}>{userMode === "basic" ? t("editor.empty_basic_title") : t("editor.empty_advanced_title")}</p>
                    <p style={{ fontSize: "var(--fs-sm)", marginTop: 8, color: "var(--fg-faint)" }}>
                      {userMode === "basic"
                        ? t("editor.empty_basic_body")
                        : t("editor.empty_advanced_body")}
                    </p>
                  </button>
                ) : (
                  <>
                    {localBlocks.map((block) => (
                      <BlockItem
                        key={block.id}
                        block={block}
                        isEditing={editingId === block.id}
                        highlighted={jumpTargetBlockId === block.id}
                        onStartEdit={() => setEditingId(block.id)}
                        onUpdate={(updates) => updateBlock(block.id, updates as Record<string, unknown>)}
                        onDelete={() => deleteBlock(block.id)}
                        dragging={dragId === block.id}
                        dragOver={dropId === block.id}
                        availableCiteKeys={bibRefs.map((r) => r.key)}
                        availableLabels={availableLabels}
                        availableAssets={projectAssets}
                        onDragStart={() => { setDragId(block.id); setEditingId(null); }}
                        onDragEnd={() => { setDragId(null); setDropId(null); }}
                        onDragOver={() => { if (dragId && dragId !== block.id) setDropId(block.id); }}
                        onDragLeave={() => setDropId((prev) => prev === block.id ? null : prev)}
                        onDrop={() => handleDrop(block.id)}
                      />
                    ))}
                    {/* Zona de click al final para agregar párrafo */}
                    <button
                      type="button"
                      className="tx-unstyled-button tx-card-action"
                      style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)", borderRadius: 6, marginTop: 8, width: "100%" }}
                      onClick={() => addBlock("paragraph")}
                      aria-label={t("editor.block_paragraph")}
                    >
                      <IconPlus size={12} style={{ marginRight: 6 }} /> {t("editor.add_paragraph")}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--fg-faint)", marginTop: 80 }}>
                {t("editor.select_section")}
              </div>
            )}
          </div>
        </div>

        {/* ── Panel derecho: metadata + diagnósticos ─────────────── */}
        <EditorMetaPanel
          project={activeProject}
          wordCount={bodyWordCount}
          blockCount={localBlocks.length}
          maxWords={profileMaxWords}
          activeSection={activeSection ? { ...activeSection, title: localizedSectionTitle(activeSection) } : undefined}
          userMode={userMode}
          onSave={saveMetadata}
          onCompile={() => navigate(`/project/${encodedPath}/compile`)}
          diagnosticsPanel={<ProjectDiagnosticsPanel projectPath={activeProjectPath} />}
        />
      </div>

      {/* Paneles de revisión ortográfica / gramatical */}
      {spellPanelOpen && (
        <SpellPanel
          blocks={localBlocks
            .filter((b) => b.type === "paragraph")
            .map((b) => ({ id: b.id, content: b.type === "paragraph" ? b.content : "" }))}
          onReplace={(blockId, start, end, replacement) => {
            setLocalBlocks((prev) => {
              const next = prev.map((b) => {
                if (b.id !== blockId || b.type !== "paragraph") return b;
                // Replace only the exact character range — never touches other blocks
                return {
                  ...b,
                  content: b.content.slice(0, start) + replacement + b.content.slice(end),
                };
              });
              scheduleAutoSave(next);
              return next;
            });
          }}
          onClose={() => setSpellPanelOpen(false)}
        />
      )}
      {grammarPanelOpen && (
        <GrammarPanel
          text={localBlocks
            .filter((b) => b.type === "paragraph")
            .map((b) => (b.type === "paragraph" ? b.content : ""))
            .join("\n\n")}
          onAccept={(match: GrammarMatch, replacement: string) => {
            setLocalBlocks((prev) => {
              // Build offset map using the same separator as the text we sent to LT
              const paraBlocks = prev
                .filter((b) => b.type === "paragraph")
                .map((b) => ({ id: b.id, content: b.type === "paragraph" ? b.content : "" }));
              const offsetMap = buildBlockOffsetMap(paraBlocks, "\n\n");

              // Find which block contains the match start offset
              const blockEntry = offsetMap.find(
                (e) => match.offset >= e.start && match.offset < e.end,
              );
              if (!blockEntry) return prev; // offset out of range — skip

              const localStart = match.offset - blockEntry.start;
              const localEnd = localStart + match.length;

              // Safety: reject cross-block corrections (extremely rare but possible)
              if (localEnd > blockEntry.end - blockEntry.start) return prev;

              const next = prev.map((b) => {
                if (b.id !== blockEntry.id || b.type !== "paragraph") return b;
                return {
                  ...b,
                  content:
                    b.content.slice(0, localStart) +
                    replacement +
                    b.content.slice(localEnd),
                };
              });
              scheduleAutoSave(next);
              return next;
            });
          }}
          onClose={() => setGrammarPanelOpen(false)}
        />
      )}
      </div>

      {/* Panel de asistente IA */}
      {aiPanel.isPanelOpen && (
        <AiAssistantPanel
          currentSelection={aiSelection?.text}
          aiSelection={aiSelection}
          currentFileName={activeSection ? `${activeSection.element_id}.tex` : undefined}
          currentFileContent={localBlocks
            .filter((b) => b.type === "paragraph" || b.type === "heading")
            .map((b) => ("content" in b ? b.content : ""))
            .join("\n\n")}
          onApplyReplacement={(original, replacement) => {
            // Reemplazar SOLO usando la selección y posición exactas capturadas por el editor.
            // Si no hay selección ordinaria identificable, no aplicar nada.
            setLocalBlocks((prev) => {
              const sel = aiSelection;
              if (!sel?.blockId) {
                return prev;
              }

              const sourceBlock = prev.find((b) => b.id === sel.blockId && b.type === "paragraph");
              if (!sourceBlock || sourceBlock.type !== "paragraph") {
                return prev;
              }

              const selectedSlice = sourceBlock.content.slice(sel.start, sel.end);
              if (!selectedSlice || selectedSlice !== original) {
                return prev;
              }

              setLastAiUndoBlocks(prev);
              const next = prev.map((b) => {
                if (b.id !== sel.blockId || b.type !== "paragraph") return b;
                return {
                  ...b,
                  content:
                    b.content.slice(0, sel.start) +
                    replacement +
                    b.content.slice(sel.end),
                };
              });

              scheduleAutoSave(next);
              setAiSelection(null);
              return next;
            });
          }}
          onInsertAtCursor={(content) => {
            // Insertar después del bloque activo (editingId) o del último bloque de la sección
            const newBlock: ContentBlock = {
              type: "raw_latex",
              id: `ai-${Date.now()}`,
              content,
              user_confirmed: false,
            };
            setLocalBlocks((prev) => {
              setLastAiUndoBlocks(prev);
              const insertAfter = editingId ?? (prev.length > 0 ? prev[prev.length - 1].id : null);
              let next: ContentBlock[];
              if (insertAfter) {
                const idx = prev.findIndex((b) => b.id === insertAfter);
                if (idx !== -1) {
                  next = [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)];
                } else {
                  next = [...prev, newBlock];
                }
              } else {
                next = [...prev, newBlock];
              }
              scheduleAutoSave(next);
              return next;
            });
          }}
          onUndoLastChange={() => {
            if (!lastAiUndoBlocks) return;
            setLocalBlocks(lastAiUndoBlocks);
            scheduleAutoSave(lastAiUndoBlocks);
            setLastAiUndoBlocks(null);
            setAiSelection(null);
          }}
        />
      )}

      {/* Paleta de comandos (Ctrl+K) */}
      {paletteOpen && (
        <CommandPalette
          sections={activeProject.sections}
          userMode={userMode}
          onInsertBlock={(type) => addBlock(type)}
          onJumpSection={(id) => { setActiveSectionId(id); }}
          onJumpToBlock={(sectionId, blockId) => {
            setActiveSectionId(sectionId);
            setJumpTargetBlockId(blockId);
          }}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {/* Modal: selector de tipo de Visual Block */}
      {visualSelectorOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 950, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setVisualSelectorOpen(null)}
        >
          <div
            style={{ width: 580, background: "var(--bg-chrome)", borderRadius: "var(--r-lg)", border: "1px solid var(--border-firm)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)", padding: 24, maxHeight: "85vh", overflow: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 16 }}>
              {t("editor.visual_type_selector_title")}
            </div>
            <VisualKindSelector onSelect={(kind: VisualKind) => {
              const blockId = visualSelectorOpen;
              setLocalBlocks(prev => {
                const next = prev.map(b => {
                  if (b.id === blockId && b.type === "visual") {
                    return { ...b, config: defaultConfig(kind) };
                  }
                  return b;
                });
                scheduleAutoSave(next);
                return next;
              });
              setVisualSelectorOpen(null);
              setEditingId(blockId);
            }} />
          </div>
        </div>
      )}

      {/* Picker de citas (Ctrl+[) */}
      {citPickerOpen && (
        <CitationPickerModal
          refs={bibRefs}
          onInsert={(ref) => insertCitation(ref, "parenthetical")}
          onClose={() => setCitPickerOpen(false)}
          projectPath={activeProjectPath}
          onBibUpdated={reloadBibRefs}
        />
      )}

      {/* ── Panel de versiones (snapshots) ───────────────────────── */}
      {snapshotsOpen && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", justifyContent: "flex-end", zIndex: 800,
          }}
          onClick={() => setSnapshotsOpen(false)}
        >
          <div
            style={{
              width: 380, height: "100%", background: "var(--bg-chrome)",
              borderLeft: "1px solid var(--border-firm)",
              display: "flex", flexDirection: "column",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--fg-strong)", flex: 1 }}>
                {t("editor.snapshots_title")}
              </span>
              <button className="btn btn-ghost btn-icon" onClick={() => setSnapshotsOpen(false)}>
                <IconX size={13} />
              </button>
            </div>

            {/* Crear nuevo snapshot */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 6 }}>
                {t("editor.snapshot_save_current")}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={newSnapLabel}
                  onChange={(e) => setNewSnapLabel(e.target.value)}
                  placeholder={t("editor.snapshot_name_placeholder")}
                  disabled={snapBusy}
                  onKeyDown={(e) => { if (e.key === "Enter" && newSnapLabel.trim()) handleCreateSnapshot(); }}
                  style={{
                    flex: 1, padding: "6px 10px", borderRadius: "var(--r-sm)",
                    border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
                    fontSize: "var(--fs-sm)", color: "var(--fg-strong)", outline: "none",
                  }}
                />
                <button
                  className="btn btn-accent btn-sm"
                  disabled={!newSnapLabel.trim() || snapBusy}
                  onClick={handleCreateSnapshot}
                >
                  <IconPlus size={11} /> {t("common.save")}
                </button>
              </div>
            </div>

            {/* Lista de snapshots */}
            <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }} className="scroll">
              {snapshots.length === 0 ? (
                <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
                  {t("editor.no_snapshots")}
                  <br />
                  <span style={{ fontSize: "var(--fs-xs)" }}>{t("editor.no_snapshots_hint")}</span>
                </div>
              ) : (
                snapshots.map((snap) => (
                  <div
                    key={snap.filename}
                    style={{
                      padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)",
                      display: "flex", alignItems: "center", gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "var(--fs-sm)", fontWeight: 500, color: "var(--fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {snap.label}
                      </div>
                      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                        {snap.timestamp}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={snapBusy}
                      onClick={() => handleRestoreSnapshot(snap.filename)}
                      title={t("editor.snapshot_restore_title")}
                      style={{ fontSize: "var(--fs-xs)", flexShrink: 0 }}
                    >
                      <IconRefresh size={10} /> {t("editor.restore")}
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      disabled={snapBusy}
                      onClick={() => handleDeleteSnapshot(snap.filename)}
                      title={t("editor.snapshot_delete_title")}
                      style={{ padding: 4, opacity: 0.55, flexShrink: 0 }}
                    >
                      <IconTrash size={11} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Panel de opciones del documento ──────────────────────── */}
      {docOptionsOpen && (() => {
        // Detectar si hay CJK en el documento (para mostrar la sección CJK automáticamente)
        const hasCjk = activeProject.sections.some((s) =>
          s.blocks?.some((b) => {
            const text = b.type === "paragraph" ? b.content
              : b.type === "raw_latex" ? b.content
              : b.type === "heading" ? b.content : "";
            return typeof text === "string" && [...text].some((c) => {
              const u = c.codePointAt(0) ?? 0;
              return (u >= 0x4E00 && u <= 0x9FFF) || (u >= 0x3040 && u <= 0x30FF) || (u >= 0xAC00 && u <= 0xD7AF);
            });
          })
        );
        return (
          <DocumentOptionsPanel
            typography={activeProject.latex_config?.typography ?? {}}
            preamble={activeProject.latex_config?.preamble_config ?? {}}
            hasCjkContent={hasCjk}
            onSave={handleSaveTypography}
            onClose={() => setDocOptionsOpen(false)}
          />
        );
      })()}

      {/* ── Modal: cambios sin guardar al navegar ─────────────────── */}
      {blocker.state === "blocked" && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            width: 430, background: "var(--bg-chrome)", borderRadius: "var(--r-lg)",
            border: "1px solid var(--border-firm)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            padding: "28px 28px 22px",
          }}>
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--fg-strong)", marginBottom: 10 }}>
              {t("editor.unsaved_changes_title")}
            </div>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.6, margin: "0 0 22px" }}>
              {t("editor.unsaved_changes_message")}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                className="btn btn-ghost"
                onClick={() => blocker.reset?.()}
              >
                {t("editor.continue_editing")}
              </button>
              <button
                className="btn"
                style={{ color: "var(--build-err)", borderColor: "var(--build-err)" }}
                onClick={() => blocker.proceed?.()}
              >
                {t("editor.leave_without_saving")}
              </button>
              <button
                className="btn btn-accent"
                onClick={async () => {
                  if (activeSectionId) await doSave(localBlocks, activeSectionId);
                  blocker.proceed?.();
                }}
              >
                <IconCheck size={12} /> {t("editor.save_and_exit")}
              </button>
            </div>
          </div>
        </div>
      )}

      <TxStatusbar items={[
        { text: saveLabel, dot: saveDot },
        { icon: <IconFile size={11} />, text: projectName },
        { text: t("editor.words", { n: bodyWordCount.toLocaleString() }) },
        {
          right: true,
          text: bibRefs.length > 0 ? t("editor.bib_refs_count", { count: bibRefs.length }) : t("editor.no_bib_file"),
          icon: <span style={{ cursor: "pointer" }} onClick={() => setCitPickerOpen(true)} />,
        },
        { right: true, text: t("editor.sections_count", { count: activeProject.sections.filter((s) => s.enabled).length }) },
      ]} />
    </>
  );
}
