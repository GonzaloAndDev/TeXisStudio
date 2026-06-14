import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useConfirm } from "../../components/ui/useConfirm";
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronD,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconLock,
  IconMore,
  IconPlus,
  IconTrash,
} from "../../components/Icons";
import { useProjectStore } from "../../stores/project";
import { api } from "../../lib/tauri";
import type { ContentBlock, ProjectSection, SectionPlacement, SectionStatus } from "../../types";
import { STATUS_CONFIG } from "./BlockEditors";
import { SectionEditor } from "./SectionEditor";
import { getSuggestions, KIND_KEY } from "./sectionTemplates";
import type { SectionTemplate } from "./sectionTemplates";

// ── Types ─────────────────────────────────────────────────────────

interface SectionTreeProps {
  activeProjectPath: string | null;
  localBlocks: ContentBlock[];
  localizedTitle: (s: { id: string; element_id: string; title?: string }) => string;
  userMode: "basic" | "advanced";
}

// ── Constants ──────────────────────────────────────────────────────

const PLACEMENT_KEYS: Record<SectionPlacement, string> = {
  front_matter: "editor.placement_front",
  body:         "editor.placement_body",
  back_matter:  "editor.placement_back",
  appendix:     "editor.placement_appendix",
};

const ADD_OPTIONS: Array<{ key: string; placement: SectionPlacement }> = [
  { key: "editor.tree_add_chapter",  placement: "body" },
  { key: "editor.tree_add_appendix", placement: "appendix" },
  { key: "editor.tree_add_back",     placement: "back_matter" },
  { key: "editor.tree_add_prelim",   placement: "front_matter" },
];

function makeId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `sec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── SectionTree ────────────────────────────────────────────────────

export function SectionTree({ activeProjectPath, localBlocks, localizedTitle, userMode }: SectionTreeProps) {
  const { t } = useTranslation();
  const confirm = useConfirm();

  const {
    activeProject,
    activeSectionId,
    setActiveSectionId,
    addSection,
    removeSection,
    insertSectionAt,
    toggleSectionEnabled,
    moveSectionUp,
    moveSectionDown,
    renameSection,
    patchSection,
    reorderSection,
  } = useProjectStore();

  const [addMenuOpen, setAddMenuOpen]       = useState(false);
  const [openMenuId, setOpenMenuId]         = useState<string | null>(null);
  const [renamingId, setRenamingId]         = useState<string | null>(null);
  const [renameValue, setRenameValue]       = useState("");
  const [editingSection, setEditingSection] = useState<ProjectSection | null>(null);
  const [dragId, setDragId]                 = useState<string | null>(null);
  const [dragOverId, setDragOverId]         = useState<string | null>(null);
  const [dragPos, setDragPos]               = useState<"before" | "after">("after");

  const [undoState, setUndoState] = useState<{ section: ProjectSection; index: number } | null>(null);

  const addMenuRef    = useRef<HTMLDivElement>(null);
  const dotMenuRef    = useRef<HTMLDivElement>(null);
  const renameRef     = useRef<HTMLInputElement>(null);
  const dragPlacement = useRef<string | null>(null);
  const didDrag       = useRef(false);
  const undoTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear undo timer on unmount
  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (addMenuOpen && addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
      if (openMenuId && dotMenuRef.current && !dotMenuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [addMenuOpen, openMenuId]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingId) renameRef.current?.select();
  }, [renamingId]);

  // ── Save helper ─────────────────────────────────────────────────
  const persistProject = useCallback(async () => {
    if (!activeProjectPath) return;
    const isTauri = "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;
    const project = useProjectStore.getState().activeProject;
    if (!project) return;
    try { await api.saveProject(activeProjectPath, project); }
    catch (e) { console.error("SectionTree: error saving project", e); }
  }, [activeProjectPath]);

  // ── Actions ─────────────────────────────────────────────────────

  const handleAdd = useCallback(async (placement: SectionPlacement) => {
    setAddMenuOpen(false);
    const newSection: ProjectSection = {
      id:          makeId(),
      element_id:  "custom_section",
      title:       t("editor.tree_new_section_name"),
      placement,
      required:    false,
      enabled:     true,
      status:      "draft",
      blocks:      [],
      fields:      {},
      children:    [],
    };
    addSection(newSection);
    await persistProject();
    setActiveSectionId(newSection.id);
    setRenamingId(newSection.id);
    setRenameValue(t("editor.tree_new_section_name"));
  }, [t, addSection, persistProject, setActiveSectionId]);

  const handleAddFromTemplate = useCallback(async (tmpl: SectionTemplate) => {
    setAddMenuOpen(false);
    const title = t(tmpl.titleKey as Parameters<typeof t>[0]);
    const newSection: ProjectSection = {
      id:         makeId(),
      element_id: tmpl.element_id,
      title,
      placement:  tmpl.placement,
      required:   false,
      enabled:    true,
      status:     "draft",
      blocks:     [],
      fields:     {},
      children:   [],
    };
    addSection(newSection);
    await persistProject();
    setActiveSectionId(newSection.id);
    // Template sections already have a good name — no rename prompt
  }, [t, addSection, persistProject, setActiveSectionId]);

  const handleEditDetails = useCallback((s: ProjectSection) => {
    setOpenMenuId(null);
    setEditingSection(s);
  }, []);

  const handleEditorSave = useCallback(async (patch: Partial<ProjectSection>) => {
    if (!editingSection) return;
    patchSection(editingSection.id, patch);
    await persistProject();
  }, [editingSection, patchSection, persistProject]);

  // ── Drag-and-drop ───────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, s: ProjectSection) => {
    e.dataTransfer.effectAllowed = "move";
    dragPlacement.current = s.placement;
    didDrag.current = true;
    setDragId(s.id);
    setOpenMenuId(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, s: ProjectSection) => {
    if (!dragPlacement.current || s.placement !== dragPlacement.current) {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOverId(s.id);
    setDragPos(e.clientY < rect.top + rect.height / 2 ? "before" : "after");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverId(null);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const from = dragId;
    setDragId(null);
    setDragOverId(null);
    if (!from || from === targetId) return;
    reorderSection(from, targetId, dragPos);
    await persistProject();
  }, [dragId, dragPos, reorderSection, persistProject]);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverId(null);
    dragPlacement.current = null;
    // Reset didDrag after the click event that follows dragend has fired
    setTimeout(() => { didDrag.current = false; }, 0);
  }, []);

  const handleRenameStart = useCallback((s: ProjectSection) => {
    setOpenMenuId(null);
    setRenamingId(s.id);
    setRenameValue(s.title ?? localizedTitle(s));
  }, [localizedTitle]);

  const handleRenameCommit = useCallback(async () => {
    if (!renamingId) return;
    renameSection(renamingId, renameValue.trim());
    setRenamingId(null);
    setRenameValue("");
    await persistProject();
  }, [renamingId, renameValue, renameSection, persistProject]);

  const handleRenameKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter")  { e.preventDefault(); void handleRenameCommit(); }
    if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
  }, [handleRenameCommit]);

  const handleToggleEnabled = useCallback(async (s: ProjectSection) => {
    setOpenMenuId(null);
    if (s.required && s.enabled) {
      const hide = await confirm({
        title:        t("editor.tree_delete_title"),
        message:      t("editor.tree_delete_required", { title: localizedTitle(s) }),
        confirmLabel: t("editor.tree_hide"),
        cancelLabel:  t("common.cancel"),
      });
      if (!hide) return;
    }
    toggleSectionEnabled(s.id);
    await persistProject();
  }, [confirm, localizedTitle, persistProject, t, toggleSectionEnabled]);

  const confirmRequiredVisibilityChange = useCallback(async (enabled: boolean) => {
    if (enabled || !editingSection?.required || !editingSection.enabled) return true;
    return confirm({
      title:        t("editor.tree_delete_title"),
      message:      t("editor.tree_delete_required", { title: localizedTitle(editingSection) }),
      confirmLabel: t("editor.tree_hide"),
      cancelLabel:  t("common.cancel"),
    });
  }, [confirm, editingSection, localizedTitle, t]);

  const handleMoveUp = useCallback(async (id: string) => {
    setOpenMenuId(null);
    moveSectionUp(id);
    await persistProject();
  }, [moveSectionUp, persistProject]);

  const handleMoveDown = useCallback(async (id: string) => {
    setOpenMenuId(null);
    moveSectionDown(id);
    await persistProject();
  }, [moveSectionDown, persistProject]);

  const handleDelete = useCallback(async (s: ProjectSection) => {
    setOpenMenuId(null);

    if (s.required) return;

    const blockCount = s.id === activeSectionId ? localBlocks.length : s.blocks.length;
    const message = blockCount > 0
      ? t("editor.tree_delete_with_blocks", { title: localizedTitle(s), count: blockCount })
      : t("editor.tree_delete_empty",       { title: localizedTitle(s) });

    const ok = await confirm({
      title:        t("editor.tree_delete_title"),
      message,
      confirmLabel: t("editor.tree_delete"),
      destructive:  true,
    });
    if (!ok) return;

    // Snapshot silencioso antes de eliminar (red de seguridad permanente, complementa el undo de 8s)
    if (activeProjectPath) {
      api.createSnapshot(activeProjectPath, `auto-delete-${s.id}`).catch(() => undefined);
    }

    // If we're deleting the active section, move focus to the next available one
    const allSections = activeProject!.sections;
    const deletedIdx = allSections.findIndex((x) => x.id === s.id);
    if (s.id === activeSectionId) {
      const others = allSections.filter((x) => x.id !== s.id && x.enabled);
      setActiveSectionId(others[0]?.id ?? null);
    }
    removeSection(s.id);
    await persistProject();

    // Arm undo — replaces any previous pending undo
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoState({ section: s, index: deletedIdx });
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null);
      undoTimerRef.current = null;
    }, 8000);
  }, [
    confirm, t, localizedTitle, activeSectionId, localBlocks,
    activeProject, toggleSectionEnabled, removeSection,
    persistProject, setActiveSectionId,
  ]);

  const handleUndo = useCallback(async () => {
    if (!undoState) return;
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
    const { section, index } = undoState;
    setUndoState(null);
    insertSectionAt(section, index);
    setActiveSectionId(section.id);
    await persistProject();
  }, [undoState, insertSectionAt, setActiveSectionId, persistProject]);

  // ── Render ──────────────────────────────────────────────────────

  if (!activeProject) return null;

  const sections = activeProject.sections;

  // Group by placement, preserving array order
  const groups: Array<{ placement: SectionPlacement; label: string; items: ProjectSection[] }> = [];
  for (const s of sections) {
    const label = t(PLACEMENT_KEYS[s.placement] as Parameters<typeof t>[0]);
    let group = groups.find((g) => g.placement === s.placement);
    if (!group) { group = { placement: s.placement, label, items: [] }; groups.push(group); }
    group.items.push(s);
  }

  const headerLabel = userMode === "basic" ? t("editor.document_path") : t("editor.sections");

  // Smart suggestions based on document kind
  const docKind = activeProject.metadata.document_kind;
  const existingElementIds = new Set(sections.map((s) => s.element_id));
  const suggestions = getSuggestions(docKind, existingElementIds);
  const kindLabel = t(KIND_KEY[docKind] as Parameters<typeof t>[0]);

  return (
    <div style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", minHeight: 0 }}>

      {/* ── Header with + button ──────────────────────────────────── */}
      <div style={{ padding: "12px 14px 8px", fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        {headerLabel}
        <div style={{ position: "relative" }} ref={addMenuRef}>
          <button
            className="btn btn-ghost btn-icon"
            style={{ padding: 4 }}
            title={t("editor.tree_add")}
            onClick={() => setAddMenuOpen((v) => !v)}
          >
            <IconPlus size={12} />
          </button>
          {addMenuOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200,
              background: "var(--bg-panel)", border: "1px solid var(--border-firm)",
              borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)", minWidth: 200, padding: 4,
              maxHeight: 320, overflowY: "auto",
            }}>
              {/* Smart suggestions */}
              {suggestions.length > 0 && (
                <>
                  <div style={{ padding: "5px 12px 3px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)" }}>
                    {t("editor.tmpl_suggestions", { kind: kindLabel })}
                  </div>
                  {suggestions.map((tmpl) => (
                    <button
                      key={tmpl.element_id}
                      className="tx-unstyled-button"
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 12px", fontSize: "var(--fs-sm)", borderRadius: "var(--r-sm)", color: "var(--fg-default)" }}
                      onClick={() => void handleAddFromTemplate(tmpl)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      {t(tmpl.titleKey as Parameters<typeof t>[0])}
                    </button>
                  ))}
                  <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "4px 0" }} />
                  <div style={{ padding: "5px 12px 3px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)" }}>
                    {t("editor.tmpl_custom")}
                  </div>
                </>
              )}
              {ADD_OPTIONS.map(({ key, placement }) => (
                <button
                  key={placement}
                  className="tx-unstyled-button"
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 12px", fontSize: "var(--fs-sm)", borderRadius: "var(--r-sm)", color: "var(--fg-default)" }}
                  onClick={() => void handleAdd(placement)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {t(key as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section list ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 6px 12px" }} className="scroll">
        {groups.map(({ placement, label, items }) => (
          <div key={placement}>
            <div style={{ margin: "6px 8px 2px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)", display: "flex", alignItems: "center", gap: 6 }}>
              <IconChevronD size={10} /> {label}
            </div>

            {items.map((s) => {
              const sStatus    = s.status ?? "draft";
              const dotColor   = STATUS_CONFIG[sStatus as SectionStatus]?.color ?? "#888";
              const isActive   = s.id === activeSectionId;
              const isHidden   = !s.enabled;
              const isRequired = s.required;
              const blockCount = isActive ? localBlocks.length : s.blocks.length;
              const title      = localizedTitle(s);

              // Whether this section can move within its group
              const groupItems  = items;
              const idxInGroup  = groupItems.findIndex((x) => x.id === s.id);
              const canMoveUp   = idxInGroup > 0;
              const canMoveDown = idxInGroup < groupItems.length - 1;

              const isMenuOpen  = openMenuId === s.id;
              const isDragging  = dragId === s.id;
              const isDropBefore = dragOverId === s.id && dragPos === "before";
              const isDropAfter  = dragOverId === s.id && dragPos === "after";

              return (
                <div
                  key={s.id}
                  style={{ position: "relative" }}
                  className="section-tree-row"
                  onDragOver={(e) => handleDragOver(e, s)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => void handleDrop(e, s.id)}
                >
                  {/* Drop indicator — before */}
                  {isDropBefore && (
                    <div style={{ height: 2, background: "var(--accent-deep)", borderRadius: 1, margin: "0 8px", pointerEvents: "none" }} />
                  )}

                  {renamingId === s.id ? (
                    /* ── Inline rename input ──────────────────── */
                    <div style={{ padding: "3px 8px" }}>
                      <input
                        ref={renameRef}
                        className="input"
                        style={{ width: "100%", fontSize: "var(--fs-sm)", padding: "3px 6px", height: 26 }}
                        value={renameValue}
                        placeholder={t("editor.tree_rename_placeholder")}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={handleRenameKey}
                        onBlur={() => void handleRenameCommit()}
                      />
                    </div>
                  ) : (
                    /* ── Section row ─────────────────────────── */
                    <div
                      role="option"
                      tabIndex={0}
                      aria-selected={isActive}
                      draggable
                      className="tx-unstyled-button section-tree-item"
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 8px", borderRadius: "var(--r-sm)",
                        fontSize: "var(--fs-base)", width: "100%",
                        background: isActive ? "var(--bg-selected)" : "transparent",
                        color: isActive ? "var(--accent-deep)" : isHidden ? "var(--fg-faint)" : "var(--fg-default)",
                        fontWeight: isActive ? 500 : 400,
                        minHeight: 26,
                        opacity: isDragging ? 0.35 : isHidden ? 0.6 : 1,
                        cursor: dragId ? "grabbing" : "grab",
                        transition: "opacity 0.15s",
                      }}
                      onClick={() => { if (didDrag.current || !s.enabled) return; setActiveSectionId(s.id); }}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && s.enabled) {
                          e.preventDefault();
                          setActiveSectionId(s.id);
                        }
                      }}
                      onDoubleClick={() => { if (!didDrag.current) handleRenameStart(s); }}
                      onDragStart={(e) => handleDragStart(e, s)}
                      onDragEnd={handleDragEnd}
                      title={isHidden ? `${title} — ${t("editor.tree_hidden_badge")}` : title}
                    >
                      {/* Status dot or hidden icon */}
                      {isHidden
                        ? <IconEyeOff size={10} style={{ flexShrink: 0, color: "var(--fg-faint)" }} />
                        : <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                      }

                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {title}
                      </span>

                      {/* Block count badge */}
                      {blockCount > 0 && (
                        <span aria-hidden style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", flexShrink: 0 }}>
                          {blockCount}
                        </span>
                      )}

                      {/* Required lock badge */}
                      {isRequired && (
                        <span aria-label={t("editor.tree_required_badge")} style={{ flexShrink: 0, display: "flex" }}>
                          <IconLock size={9} style={{ color: "var(--fg-faint)" }} />
                        </span>
                      )}

                      {/* ··· menu trigger */}
                      <button
                        type="button"
                        className="tx-unstyled-button section-tree-menu-btn"
                        style={{
                          flexShrink: 0, padding: "2px 3px", borderRadius: "var(--r-sm)",
                          color: "var(--fg-faint)", opacity: 0,
                          transition: "opacity 0.1s",
                        }}
                        title={t("editor.tree_section_options")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isMenuOpen ? null : s.id);
                        }}
                      >
                        <IconMore size={12} />
                      </button>
                    </div>
                  )}

                  {/* Drop indicator — after */}
                  {isDropAfter && (
                    <div style={{ height: 2, background: "var(--accent-deep)", borderRadius: 1, margin: "0 8px", pointerEvents: "none" }} />
                  )}

                  {/* ── Context menu ─────────────────────────── */}
                  {isMenuOpen && (
                    <div
                      ref={dotMenuRef}
                      style={{
                        position: "absolute", top: "100%", right: 8, zIndex: 300,
                        background: "var(--bg-panel)", border: "1px solid var(--border-firm)",
                        borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)",
                        minWidth: 170, padding: 4,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ContextMenuItem label={t("editor.tree_edit_details")} onClick={() => handleEditDetails(s)} icon={<IconEdit size={12} />} />
                      <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "4px 0" }} />
                      <ContextMenuItem label={t("editor.tree_rename")} onClick={() => handleRenameStart(s)} />
                      <ContextMenuItem label={t("editor.tree_move_up")}   onClick={() => void handleMoveUp(s.id)}   disabled={!canMoveUp} icon={<IconArrowUp size={12} />} />
                      <ContextMenuItem label={t("editor.tree_move_down")} onClick={() => void handleMoveDown(s.id)} disabled={!canMoveDown} icon={<IconArrowDown size={12} />} />
                      <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "4px 0" }} />
                      <ContextMenuItem
                        label={s.enabled ? t("editor.tree_hide") : t("editor.tree_show")}
                        icon={s.enabled ? <IconEyeOff size={12} /> : <IconEye size={12} />}
                        onClick={() => void handleToggleEnabled(s)}
                      />
                      <ContextMenuItem
                        label={t("editor.tree_delete")}
                        icon={<IconTrash size={12} />}
                        onClick={() => void handleDelete(s)}
                        disabled={s.required}
                        danger={!s.required}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Undo bar ─────────────────────────────────────────────── */}
      {undoState && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 10px", gap: 8, flexShrink: 0,
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-hover)",
          fontSize: "var(--fs-xs)", color: "var(--fg-muted)",
        }}>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t("editor.tree_deleted_msg", { title: localizedTitle(undoState.section) })}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: "2px 8px", fontSize: "var(--fs-xs)", flexShrink: 0 }}
            onClick={() => void handleUndo()}
          >
            {t("editor.tree_undo")}
          </button>
        </div>
      )}

      {/* ── Status legend ────────────────────────────────────────── */}
      <div style={{ padding: "8px 10px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexWrap: "wrap", gap: "4px 10px", flexShrink: 0 }} aria-label={t("editor.section_status_legend")}>
        {(Object.entries(STATUS_CONFIG) as [SectionStatus, typeof STATUS_CONFIG[SectionStatus]][]).map(([s, cfg]) => (
          <span key={s} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0, display: "inline-block" }} />
            {t(cfg.labelKey as Parameters<typeof t>[0])}
          </span>
        ))}
      </div>

      {/* ── Section editor modal ─────────────────────────────────── */}
      {editingSection && (
        <SectionEditor
          section={editingSection}
          localizedTitle={localizedTitle}
          userMode={userMode}
          onSave={(patch) => void handleEditorSave(patch)}
          onClose={() => setEditingSection(null)}
          onRequiredVisibilityChange={confirmRequiredVisibilityChange}
        />
      )}
    </div>
  );
}

// ── ContextMenuItem helper ─────────────────────────────────────────

interface ContextMenuItemProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

function ContextMenuItem({ label, onClick, icon, disabled, danger }: ContextMenuItemProps) {
  return (
    <button
      type="button"
      className="tx-unstyled-button"
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: "100%", textAlign: "left",
        padding: "7px 12px", fontSize: "var(--fs-sm)",
        borderRadius: "var(--r-sm)",
        color: danger ? "var(--error)" : disabled ? "var(--fg-faint)" : "var(--fg-default)",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "var(--bg-hover)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
    >
      {icon && <span style={{ width: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>}
      {label}
    </button>
  );
}
