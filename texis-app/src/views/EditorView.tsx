import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConfirm } from "../components/ui/useConfirm";
import { useToast } from "../components/ui/ToastProvider";
import { ExternalConflictBanner } from "../components/ExternalConflictBanner";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import { EditorMetaPanel } from "../components/EditorMetaPanel";
import { SectionGuidancePanel } from "../components/SectionGuidancePanel";
import { ProjectDiagnosticsPanel } from "../components/ProjectDiagnosticsPanel";
import {
  IconAcronym, IconAlgorithm, IconBuild, IconCheck, IconCode, IconFile,
  IconGlossaryEntry, IconHeading, IconHome, IconImage, IconList, IconMore, IconPlus, IconRefresh,
  IconSearch, IconSettings, IconSigma, IconSliders, IconSplit, IconTable, IconText, IconTheorem, IconTrash, IconX,
} from "../components/Icons";
import { SectionTree } from "./editor/SectionTree";
import { LanguagePicker } from "../components/LanguagePicker";
import { SpellPanel } from "../components/SpellPanel";
import { GrammarPanel } from "../components/GrammarPanel";
import { AiAssistantPanel } from "../components/AiAssistantPanel";
import { MathToolbarPanel } from "../components/MathToolbarPanel";
import { mathInsertManager } from "../lib/mathInsertManager";
import { useAiStore } from "../stores/ai";
import type { GrammarMatch } from "../services/grammar";
import { useSettingsStore } from "../stores/settings";
import { api } from "../lib/tauri";
import { ensureProfileLocale, localizeProfile } from "../services/profile-i18n";
import { useProjectStore } from "../stores/project";
import { useWorkspaceStore } from "../stores/workspace";
import type { BibReference, ContentBlock, LatexTypography, PluginFigureBlock, ProjectSection, SectionStatus } from "../types";
import { SectionStatusBar } from "./editor/BlockEditors";
import { CitationPickerModal } from "./editor/CitationPickerModal";
import { FigurePickerModal } from "../components/FigurePickerModal";
import { FigureEditModal } from "../components/FigureEditModal";


import { BlockItem } from "./editor/BlockItem";
import { CommandPalette } from "./editor/CommandPalette";
import { DocumentOptionsPanel } from "./editor/DocumentOptionsPanel";
import { HelpCenter } from "../components/help/HelpCenter";
import { useHelpStore } from "../stores/help";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { isAnyDialogOpen } from "../lib/dialogStack";

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
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const confirm = useConfirm();
  const toast = useToast();
  const { activeProject, activeProjectPath, activeSectionId, setActiveSectionId } = useProjectStore();
  const { userMode } = useSettingsStore();
  const workspaceActiveFile = useWorkspaceStore((state) => state.activeFile);

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

  // Navigation guard — bloquear si hay cambios sin guardar.
  // The ref form is used so the blocker reads a synchronous, up-to-date value
  // at navigation time. With the boolean form, an `await doSave()` followed by
  // a synchronous navigate() would see a stale `isUnsaved` (React hasn't
  // re-rendered yet), incorrectly blocking the user even after a successful
  // flush — this matters especially for `goToCompile`.
  const isUnsaved = saveStatus === "unsaved" || saveStatus === "error";
  const isUnsavedRef = useRef(isUnsaved);
  useEffect(() => { isUnsavedRef.current = isUnsaved; }, [isUnsaved]);
  const blocker = useBlocker(() => isUnsavedRef.current);

  // Toolbar académico
  const [paletteOpen, setPaletteOpen]     = useState(false);
  const [citPickerOpen, setCitPickerOpen]         = useState(false);
  const [pluginPickerOpen, setPluginPickerOpen]   = useState(false);
  const [figureEditBlock, setFigureEditBlock] = useState<PluginFigureBlock | null>(null);
  const { open: helpOpen, section: helpSection, openHelp, closeHelp } = useHelpStore();
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

  useEffect(() => {
    if (!activeProject || !activeProjectPath || !activeSectionId) return;
    const section = activeProject.sections.find((item) => item.id === activeSectionId);
    if (!section) return;
    const file = sectionTexPath(section, activeProject.sections, activeProjectPath);
    if (!file) return;
    const workspace = useWorkspaceStore.getState();
    workspace.addOpenFile(file);
    workspace.setActiveFile(file);
  }, [activeProject, activeProjectPath, activeSectionId]);

  useEffect(() => {
    if (!activeProject || !activeProjectPath || !workspaceActiveFile) return;
    const section = activeProject.sections.find(
      (item) => sectionTexPath(item, activeProject.sections, activeProjectPath) === workspaceActiveFile,
    );
    if (section && section.id !== activeSectionId) {
      setActiveSectionId(section.id);
    }
  }, [activeProject, activeProjectPath, activeSectionId, setActiveSectionId, workspaceActiveFile]);

  useEffect(() => {
    if (!workspaceActiveFile) return;

    const captureCursor = () => {
      const element = document.activeElement;
      if (!(element instanceof HTMLTextAreaElement)) return;
      const offset = element.selectionStart ?? 0;
      const beforeCursor = element.value.slice(0, offset);
      const lines = beforeCursor.split("\n");
      useWorkspaceStore.getState().setCursorPosition(workspaceActiveFile, {
        line: lines.length,
        column: lines[lines.length - 1]?.length ?? 0,
      });
    };

    document.addEventListener("selectionchange", captureCursor);
    document.addEventListener("input", captureCursor);
    return () => {
      document.removeEventListener("selectionchange", captureCursor);
      document.removeEventListener("input", captureCursor);
    };
  }, [workspaceActiveFile]);

  // Paneles de revisión de texto
  const [spellPanelOpen, setSpellPanelOpen]     = useState(false);
  const [grammarPanelOpen, setGrammarPanelOpen] = useState(false);
  const [mathPanelOpen, setMathPanelOpen]       = useState(false);
  const [mathPanelCollapsed, setMathPanelCollapsed] = useState(false);
  const aiPanel = useAiStore();

  // Estado de colapso de paneles laterales
  const [leftCollapsed, setLeftCollapsed]   = useState(false);
  const [metaCollapsed, setMetaCollapsed]   = useState(false);

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

  // Cuando cambia la sección activa, hidratamos localBlocks y reiniciamos
  // todo el estado de edición. Esto se separa intencionalmente del sync que
  // viene del store en el efecto siguiente: si activeProject muta porque
  // NOSOTROS acabamos de guardar, no queremos sacar al usuario de su edición
  // — solo queremos resetear cuando la sección realmente cambia.
  const lastSectionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSectionIdRef.current === activeSectionId) return;
    lastSectionIdRef.current = activeSectionId ?? null;
    const section = activeProject?.sections.find((s) => s.id === activeSectionId);
    setLocalBlocks(section?.blocks ?? []);
    setEditingId(null);
    setSaveStatus("saved");
    useAiStore.getState().setUiContext({
      activePanel: "editor",
      activeSectionType: section?.element_id,
      profileId: activeProject?.profile_id,
    });
  }, [activeSectionId, activeProject]);

  // Resync silencioso de localBlocks cuando el proyecto cambia por causas
  // externas (snapshot restaurado, conflict resolution, etc.) — pero NUNCA
  // mientras el usuario está editando un bloque, porque eso pisaría su
  // borrador y le movería el cursor. El autosave habitual cae aquí también
  // y es inofensivo: localBlocks ya contiene lo que se acaba de guardar.
  useEffect(() => {
    if (editingId) return;
    const section = activeProject?.sections.find((s) => s.id === activeSectionId);
    if (section) setLocalBlocks(section.blocks);
  }, [activeProject, activeSectionId, editingId]);

  const doSave = useCallback(async (blocks: ContentBlock[], sectionId: string): Promise<boolean> => {
    setSaveStatus("saving");
    useProjectStore.getState().updateSectionBlocks(sectionId, blocks);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv && activeProjectPath) {
      try {
        await api.saveSection(activeProjectPath, sectionId, blocks);
      } catch (e) {
        console.error("Error guardando:", e);
        toast.error(t("editor.error_save_section"));
        setSaveStatus("error");
        // Sync ref so a navigate() right after this still sees "unsaved" state.
        isUnsavedRef.current = true;
        return false;
      }
    }
    setSaveStatus("saved");
    // Sync ref so `goToCompile` can navigate immediately without the blocker
    // firing on a stale state snapshot.
    isUnsavedRef.current = false;
    return true;
  }, [activeProjectPath]);

  /**
   * Flushes any pending autosave debounce immediately, then navigates to the
   * compile view with autostart. If the flush fails we stay in the editor so
   * the user can react to the error instead of compiling a stale .tex on disk.
   */
  const goToCompile = useCallback(async () => {
    if (!activeProjectPath) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (activeSectionId && (saveStatus === "unsaved" || saveStatus === "error")) {
      const ok = await doSave(localBlocks, activeSectionId);
      if (!ok) return; // stay in editor; toast already shown
    }
    navigate(`/project/${encodeURIComponent(activeProjectPath)}/compile?auto=1`);
  }, [activeProjectPath, activeSectionId, doSave, localBlocks, navigate, saveStatus]);

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

  // Single in-flight guard for all snapshot mutations. UI disables buttons via
  // `snapBusy` state, but that's React state and async — defensive ref guard
  // prevents fast double-taps from triggering two writes back-to-back.
  const snapshotInFlightRef = useRef(false);

  const handleCreateSnapshot = useCallback(async () => {
    if (!activeProjectPath || !newSnapLabel.trim()) return;
    if (snapshotInFlightRef.current) return;
    snapshotInFlightRef.current = true;
    setSnapBusy(true);
    try {
      await api.createSnapshot(activeProjectPath, newSnapLabel.trim());
      setNewSnapLabel("");
      await loadSnapshots();
    } catch (e) {
      console.error("Error creando snapshot:", e);
      toast.error(t("editor.error_snapshot_create"));
    } finally {
      snapshotInFlightRef.current = false;
      setSnapBusy(false);
    }
  }, [activeProjectPath, newSnapLabel, loadSnapshots, toast, t]);

  const handleRestoreSnapshot = useCallback(async (filename: string) => {
    if (!activeProjectPath) return;
    if (snapshotInFlightRef.current) return;
    const ok = await confirm({
      title: t("editor.snapshot_restore_title"),
      message: t("editor.snapshot_restore_confirm"),
      confirmLabel: t("editor.snapshot_restore_action"),
      cancelLabel: t("common.cancel"),
      destructive: false,
    });
    if (!ok) return;
    snapshotInFlightRef.current = true;
    setSnapBusy(true);
    try {
      await api.restoreSnapshot(activeProjectPath, filename);
      const model = await api.getProject(activeProjectPath);
      useProjectStore.getState().openProject(model, activeProjectPath);
      // The restore replaced disk state — local editor blocks are stale.
      // Clear `unsaved` since the disk is now the source of truth.
      isUnsavedRef.current = false;
      setSaveStatus("saved");
      setSnapshotsOpen(false);
    } catch (e) {
      console.error("Error restaurando snapshot:", e);
      toast.error(t("editor.error_snapshot_restore"));
    } finally {
      snapshotInFlightRef.current = false;
      setSnapBusy(false);
    }
  }, [activeProjectPath, confirm, t, toast]);

  const handleDeleteSnapshot = useCallback(async (filename: string) => {
    if (!activeProjectPath) return;
    if (snapshotInFlightRef.current) return;
    const ok = await confirm({
      title: t("editor.snapshot_delete_title"),
      message: t("editor.snapshot_delete_confirm"),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    snapshotInFlightRef.current = true;
    try {
      await api.deleteSnapshot(activeProjectPath, filename);
      await loadSnapshots();
    } catch (e) {
      console.error("Error eliminando snapshot:", e);
      toast.error(t("editor.error_snapshot_delete"));
    } finally {
      snapshotInFlightRef.current = false;
    }
  }, [activeProjectPath, confirm, t, loadSnapshots, toast]);

  const scheduleAutoSave = useCallback((blocks: ContentBlock[]) => {
    setSaveStatus("unsaved");
    // Keep ref in sync with the unsaved transition so the blocker fires
    // immediately on a subsequent navigation, without waiting for re-render.
    isUnsavedRef.current = true;
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

  // Math panel creator path. When the user clicks a symbol with no equation
  // textarea focused, spawn a new EquationBlock right after the currently
  // edited block (or at the end of the section), seeded with the snippet.
  // The new block autofocuses, registers itself as the equation target, so
  // subsequent clicks append into the same block.
  //
  // editingId lives in a ref so this effect doesn't re-register on every
  // cursor move — the creator always reads the latest value when fired.
  const editingIdRef = useRef<string | null>(editingId);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);

  useEffect(() => {
    if (!mathPanelOpen) return;
    return mathInsertManager.registerCreator((latex) => {
      const id = newId();
      const newBlock: ContentBlock = { type: "equation", id, latex_content: latex, numbered: false };
      setLocalBlocks((prev) => {
        const insertAfter = editingIdRef.current ?? (prev.length > 0 ? prev[prev.length - 1].id : null);
        let next: ContentBlock[];
        if (insertAfter) {
          const idx = prev.findIndex((b) => b.id === insertAfter);
          next = idx !== -1
            ? [...prev.slice(0, idx + 1), newBlock, ...prev.slice(idx + 1)]
            : [...prev, newBlock];
        } else {
          next = [...prev, newBlock];
        }
        scheduleAutoSave(next);
        return next;
      });
      setEditingId(id);
    });
  }, [mathPanelOpen, scheduleAutoSave]);

  const deleteBlock = useCallback((id: string) => {
    setLocalBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      scheduleAutoSave(next);
      return next;
    });
    setEditingId(null);
  }, [scheduleAutoSave]);

  /**
   * Divide el bloque de párrafo actualmente en edición en dos bloques,
   * justo en la posición del cursor.
   *
   * Usa document.activeElement + closest('[data-block-id]') para localizar el
   * bloque sin necesidad de singletons adicionales, dado que el botón usa
   * onMouseDown + preventDefault para mantener el foco en la textarea.
   */
  const handleSplitBlock = useCallback(() => {
    const el = document.activeElement as HTMLTextAreaElement | null;
    if (!el || el.tagName !== "TEXTAREA") return;
    const blockEl = el.closest("[data-block-id]");
    if (!blockEl) return;
    const blockId = blockEl.getAttribute("data-block-id");
    if (!blockId) return;

    const pos = el.selectionStart ?? el.value.length;
    if (pos <= 0 || pos >= el.value.length) return; // cursor en extremo — nada que dividir

    const before = el.value.slice(0, pos).trimEnd();
    const after  = el.value.slice(pos).trimStart();
    const newId_ = newId();

    setLocalBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      if (idx === -1) return prev;
      const block = prev[idx];
      if (block.type !== "paragraph") return prev;

      const newBlock: ContentBlock = { type: "paragraph", id: newId_, content: after };
      const updated = [...prev.slice(0, idx), { ...block, content: before }, newBlock, ...prev.slice(idx + 1)];
      scheduleAutoSave(updated);
      return updated;
    });
    // Mover el foco al bloque nuevo para que el usuario continúe escribiendo allí
    setEditingId(newId_);
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

  // Insertar figura de plugin desde el FigurePickerModal
  const insertPluginFigure = useCallback((block: import("../types").PluginFigureBlock) => {
    setLocalBlocks((prev) => {
      const next = [...prev, block];
      scheduleAutoSave(next);
      return next;
    });
    setEditingId(block.id);
    setPluginPickerOpen(false);
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
      catch (e) { console.error("Error guardando metadatos:", e); toast.error(t("editor.error_save_metadata")); }
    }
  }, [activeProject, activeProjectPath, toast, t]);

  // ── Estado / notas de sección ──────────────────────────────────
  const handleSectionStatusChange = useCallback(async (sectionId: string, status: SectionStatus) => {
    if (!activeProjectPath) return;
    const section = activeProject?.sections.find((s) => s.id === sectionId);
    useProjectStore.getState().updateSectionMeta(sectionId, status, section?.notes);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      try { await api.updateSectionMeta(activeProjectPath, sectionId, status, section?.notes); }
      catch (e) { console.error("Error actualizando estado:", e); toast.error(t("editor.error_save_status")); }
    }
  }, [activeProjectPath, activeProject, toast, t]);

  const handleSectionNotesChange = useCallback(async (sectionId: string, notes: string) => {
    if (!activeProjectPath) return;
    const section = activeProject?.sections.find((s) => s.id === sectionId);
    const status = section?.status ?? "draft";
    useProjectStore.getState().updateSectionMeta(sectionId, status, notes || undefined);
    const isTauriEnv = "__TAURI_INTERNALS__" in window;
    if (isTauriEnv) {
      try { await api.updateSectionMeta(activeProjectPath, sectionId, status, notes || undefined); }
      catch (e) { console.error("Error actualizando notas:", e); toast.error(t("editor.error_save_notes")); }
    }
  }, [activeProjectPath, activeProject, toast, t]);

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
          .catch((e: unknown) => { console.error("Error guardando preámbulo:", e); toast.error(t("editor.error_save_preamble")); });
      } catch (e) {
        console.error("Error guardando tipografía:", e);
        toast.error(t("editor.error_save_typography"));
      }
    }
  }, [activeProjectPath, activeProject, toast, t]);

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
      // Esc → cerrar modales o salir del modo edición.
      // Si hay un modal activo (palette, snapshots, visual selector, etc.) su
      // propio handler atiende el Esc via useDialogEscape; aquí solo nos
      // ocupamos del fallback "no hay modal" — salir de modo edición inline.
      if (e.key === "Escape") {
        if (isAnyDialogOpen()) return;
        setEditingId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSectionId, localBlocks, doSave]);

  // Wire Esc + dialog-stack participation to the inline modals (visual block
  // type selector, snapshots panel, unsaved-changes blocker). These bypass
  // AppDialog and used to have no Esc handling at all — the user could only
  // close them with the mouse on the backdrop or the close button.
  const closeVisualSelector = useCallback(() => setVisualSelectorOpen(null), []);
  useDialogEscape(visualSelectorOpen !== null, closeVisualSelector);
  const closeSnapshots = useCallback(() => setSnapshotsOpen(false), []);
  useDialogEscape(snapshotsOpen, closeSnapshots);
  const cancelBlocker = useCallback(() => {
    // Esc on the unsaved-changes blocker is equivalent to "Keep editing".
    blocker.reset?.();
  }, [blocker]);
  useDialogEscape(blocker.state === "blocked", cancelBlocker);

  if (!activeProject || !activeProjectPath) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--fg-muted)", background: "var(--bg-app)" }}>
        <p>{t("editor.project_not_loaded")}</p>
        <button className="btn" onClick={() => navigate("/")}>← {t("library.back_home").replace("← ", "")}</button>
      </div>
    );
  }

  const projectRouteId = encodeURIComponent(activeProjectPath);

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
        ["raw_latex", <IconCode size={12} />, t("editor.toolbar_raw_latex_label"), t("editor.toolbar_raw_latex_tip")],
      ]
    : [
        ["paragraph", <IconText size={12} />, t("editor.block_paragraph"), t("editor.toolbar_paragraph_tip")],
        ["heading", <IconHeading size={12} />, t("editor.block_heading"), t("editor.toolbar_heading_tip")],
        ["list", <IconList size={12} />, t("editor.block_list"), "Itemize / Enumerate"],
        ["equation", <IconSigma size={12} />, t("editor.block_equation"), "equation / equation* (amsmath)"],
        ["visual", <span style={{ fontSize: 11 }}>⬤⬤</span>, t("editor.block_visual"), t("editor.toolbar_visual_tip")],
        ["figure", <IconImage size={12} />, t("editor.block_figure")],
        ["table", <IconTable size={12} />, t("editor.block_table")],
        ["raw_latex", <IconCode size={12} />, t("editor.toolbar_raw_latex_label"), t("editor.toolbar_raw_latex_tip")],
        ["code", <IconCode size={12} />, t("editor.block_code"), t("editor.toolbar_code_tip")],
        ["algorithm", <IconAlgorithm size={12} />, t("editor.block_algorithm"), t("editor.toolbar_algorithm_tip")],
        ["theorem", <IconTheorem size={12} />, t("editor.block_theorem"), t("editor.toolbar_theorem_tip")],
        ["glossary_entry", <IconGlossaryEntry size={12} />, t("editor.block_glossary"), t("editor.toolbar_glossary_tip")],
        ["acronym_entry", <IconAcronym size={12} />, t("editor.block_acronym"), t("editor.toolbar_acronym_tip")],
      ];

  // "Dividir bloque" solo aplica cuando se está editando un párrafo
  const canSplit = editingId !== null && localBlocks.some((b) => b.id === editingId && b.type === "paragraph");

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
            <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/project/${projectRouteId}/progress`)} title={t("editor.progress_title")}>
              {t("progress.tab_progress")}
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/project/${projectRouteId}/recovery`)} title={t("recovery.title")}>
              {t("recovery.tab_recovery")}
            </button>
            <button className="btn btn-accent btn-sm" onClick={() => void goToCompile()}>
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
              onClick={() => openHelp("start")}
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
      {helpOpen && <HelpCenter onClose={closeHelp} initialSection={helpSection} />}
      <ExternalConflictBanner projectPath={activeProjectPath} />

      <div className="editor-shell">
      <div className={`editor-grid${leftCollapsed ? " editor-grid-left-collapsed" : ""}${metaCollapsed ? " editor-grid-meta-collapsed" : ""}`}>

        {/* ── Árbol de secciones ─────────────────────────────────── */}
        <SectionTree
          activeProjectPath={activeProjectPath}
          localBlocks={localBlocks}
          localizedTitle={localizedSectionTitle}
          userMode={userMode}
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed((v) => !v)}
        />

        {/* ── Canvas editor ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Toolbar */}
          <div className="editor-toolbar scroll" style={{ height: 60, flexShrink: 0, borderBottom: "1px solid var(--border-firm)", padding: "3px 10px 2px", display: "flex", alignItems: "center", gap: 2, background: "var(--bg-panel)", fontSize: "var(--fs-sm)", overflowX: "auto", overflowY: "hidden" }}>
            {toolbarItems.map(([type, icon, label, tooltip]) => (
              <button
                key={type}
                className="btn btn-ghost btn-sm editor-tool-button"
                onClick={() => addBlock(type)}
                title={label + (tooltip ? ` — ${tooltip}` : "")}
                style={{}}
              >
                {icon}<span>{label}</span>
              </button>
            ))}

            {/* Separador */}
            <div style={{ width: 1, height: 22, background: "var(--border-subtle)", margin: "0 4px", flexShrink: 0 }} />

            {/* Picker de citas */}
            <button
              className="btn btn-ghost btn-sm editor-tool-button"
              onClick={() => setCitPickerOpen(true)}
              title={t("editor.insert_citation_title")}
              style={{}}
            >
              <IconMore size={12} /><span>{t("editor.block_citation")}</span>
            </button>

            {/* Picker de figuras de plugin */}
            <button
              className="btn btn-ghost btn-sm editor-tool-button"
              onClick={() => setPluginPickerOpen(true)}
              title={t("editor.insert_plugin_figure_title")}
              style={{}}
            >
              <IconImage size={12} /><span>{t("editor.block_plugin_figure")}</span>
            </button>

            {/* Herramientas LaTeX */}
            <div style={{ width: 1, height: 22, background: "var(--border-subtle)", margin: "0 4px", flexShrink: 0 }} />
            <button
              className="btn btn-ghost btn-sm editor-tool-button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSplitBlock}
              disabled={!canSplit}
              title={canSplit ? t("editor.toolbar_split_tip") : t("editor.toolbar_split_tip_inactive")}
              style={{ opacity: canSplit ? 1 : 0.4 }}
            >
              <IconSplit size={12} /><span>{t("editor.toolbar_split_label")}</span>
            </button>

            <div style={{ flex: "1 0 12px" }} />

            {/* Botones de revisión */}
            <div style={{ width: 1, height: 22, background: "var(--border-subtle)", margin: "0 4px", flexShrink: 0 }} />
            <button
              className={`btn btn-sm ${mathPanelOpen ? "btn-accent" : "btn-ghost"}`}
              onClick={() => setMathPanelOpen((v) => !v)}
              aria-label={t("math_toolbar.title")}
              aria-pressed={mathPanelOpen}
              title={t("math_toolbar.toggle_title")}
              style={{ fontSize: "var(--fs-xs)", padding: "4px 8px", gap: 4 }}
            >
              <IconSigma size={11} />
              {t("math_toolbar.toggle_label")}
            </button>
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
                        onEditPluginFigure={block.type === "plugin_figure" ? () => setFigureEditBlock(block) : undefined}
                        projectPath={activeProjectPath ?? undefined}
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
          onCompile={() => void goToCompile()}
          diagnosticsPanel={<ProjectDiagnosticsPanel projectPath={activeProjectPath} />}
          collapsed={metaCollapsed}
          onToggleCollapse={() => setMetaCollapsed((v) => !v)}
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

      {/* Panel de símbolos matemáticos — dentro de editor-shell para que aparezca como panel lateral derecho */}
      {mathPanelOpen && (
        <MathToolbarPanel
          onClose={() => { setMathPanelOpen(false); setMathPanelCollapsed(false); }}
          collapsed={mathPanelCollapsed}
          onToggleCollapse={() => setMathPanelCollapsed((v) => !v)}
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
                    return { ...b, config: defaultConfig(kind, t) };
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

      {/* Picker de figuras de plugin */}
      {pluginPickerOpen && (
        <FigurePickerModal
          projectPath={activeProjectPath}
          onInsert={insertPluginFigure}
          onClose={() => setPluginPickerOpen(false)}
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

      {figureEditBlock && (
        <FigureEditModal
          block={figureEditBlock}
          projectPath={activeProjectPath}
          onUpdate={(updated) => {
            updateBlock(updated.id, { ...updated });
            setFigureEditBlock(updated);
          }}
          onClose={() => setFigureEditBlock(null)}
        />
      )}

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
