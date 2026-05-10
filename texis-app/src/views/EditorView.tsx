import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBuild, IconChevronD, IconCode, IconDoc, IconDrag, IconFile,
  IconHeading, IconImage, IconList, IconMore, IconPlus, IconRefresh,
  IconSearch, IconSettings, IconSigma, IconTable, IconText, IconTrash, IconX,
} from "../components/Icons";
import { api } from "../lib/tauri";
import { useProjectStore } from "../stores/project";
import type { ContentBlock, HeadingLevel, ProjectSection } from "../types";

// ── Utilidades ────────────────────────────────────────────────────

const PLACEMENT_LABELS: Record<string, string> = {
  front_matter: "Portada y preliminares",
  body: "Cuerpo principal",
  back_matter: "Material final",
  appendix: "Anexos",
};

function placementGroup(sections: ProjectSection[]) {
  const groups: Record<string, ProjectSection[]> = {};
  for (const s of sections) {
    const g = PLACEMENT_LABELS[s.placement] ?? s.placement;
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

function countWords(blocks: ContentBlock[]): number {
  return blocks
    .filter((b) => b.type === "paragraph")
    .reduce((acc, b) => acc + (b.type === "paragraph" ? b.content.split(/\s+/).filter(Boolean).length : 0), 0);
}

// ── Componentes de bloque: modo edición ───────────────────────────

function ParagraphEditor({
  content, onChange, onBlur,
}: {
  content: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, []);
  return (
    <textarea
      ref={ref}
      value={content}
      onChange={(e) => {
        onChange(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = e.target.scrollHeight + "px";
      }}
      onBlur={onBlur}
      onKeyDown={(e) => { if (e.key === "Escape") onBlur(); }}
      style={{
        width: "100%", border: "none", outline: "none", resize: "none",
        fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.65,
        color: "var(--fg-default)", background: "transparent",
        padding: 0, minHeight: 50,
      }}
      placeholder="Escribe aquí el contenido del párrafo…"
    />
  );
}

function HeadingEditor({
  content, level, onChange, onLevelChange, onBlur,
}: {
  content: string; level: HeadingLevel;
  onChange: (v: string) => void;
  onLevelChange: (v: HeadingLevel) => void;
  onBlur: () => void;
}) {
  const fontSizes: Record<HeadingLevel, number> = { section: 22, subsection: 18, subsubsection: 16 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(["section", "subsection", "subsubsection"] as HeadingLevel[]).map((l) => (
          <button
            key={l}
            className={`btn btn-sm ${level === l ? "btn-accent" : "btn-ghost"}`}
            onClick={() => onLevelChange(l)}
            style={{ fontSize: "var(--fs-xs)", padding: "3px 8px" }}
          >
            {l === "section" ? "H1" : l === "subsection" ? "H2" : "H3"}
          </button>
        ))}
      </div>
      <input
        autoFocus
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === "Escape") onBlur(); }}
        style={{
          border: "none", outline: "none",
          fontFamily: "var(--font-display)", fontSize: fontSizes[level], fontWeight: 500,
          color: "var(--fg-strong)", background: "transparent", padding: 0, width: "100%",
        }}
        placeholder="Título de la sección…"
      />
    </div>
  );
}

function EquationEditor({
  latex_content, numbered, onChange, onNumberedChange, onBlur,
}: {
  latex_content: string; numbered: boolean;
  onChange: (v: string) => void;
  onNumberedChange: (v: boolean) => void;
  onBlur: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontFamily: "var(--font-mono)" }}>LaTeX</span>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", cursor: "pointer" }}>
          <input type="checkbox" checked={numbered} onChange={(e) => onNumberedChange(e.target.checked)} style={{ accentColor: "var(--accent)" }} />
          numerada
        </label>
      </div>
      <textarea
        autoFocus
        value={latex_content}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => { if (e.key === "Escape") onBlur(); }}
        rows={3}
        style={{
          fontFamily: "var(--font-mono)", fontSize: 13, color: "#C8C2B5",
          background: "var(--ink-900)", border: "none", outline: "none",
          padding: "10px 14px", borderRadius: "var(--r-sm)", resize: "vertical",
          width: "100%",
        }}
        placeholder="\frac{d}{dx} f(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}"
      />
    </div>
  );
}

function ListEditor({
  items, list_type, onChange, onTypeChange, onBlur,
}: {
  items: string[]; list_type: string;
  onChange: (items: string[]) => void;
  onTypeChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {["itemize", "enumerate"].map((t) => (
          <button
            key={t}
            className={`btn btn-sm ${list_type === t ? "btn-accent" : "btn-ghost"}`}
            onClick={() => onTypeChange(t)}
            style={{ fontSize: "var(--fs-xs)", padding: "3px 8px" }}
          >
            {t === "itemize" ? "• Lista" : "1. Numerada"}
          </button>
        ))}
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ color: "var(--fg-faint)", fontFamily: "var(--font-mono)", fontSize: 12, minWidth: 16 }}>
            {list_type === "enumerate" ? `${i + 1}.` : "•"}
          </span>
          <input
            autoFocus={i === items.length - 1}
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); onChange([...items.slice(0, i + 1), "", ...items.slice(i + 1)]); }
              if (e.key === "Backspace" && item === "" && items.length > 1) { e.preventDefault(); onChange(items.filter((_, j) => j !== i)); }
              if (e.key === "Escape") onBlur();
            }}
            style={{
              flex: 1, border: "none", outline: "none",
              fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.65,
              color: "var(--fg-default)", background: "transparent", padding: 0,
            }}
            placeholder={`Ítem ${i + 1}…`}
          />
          {items.length > 1 && (
            <button
              className="btn btn-ghost btn-icon"
              style={{ padding: 2, opacity: 0.5 }}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <IconX size={10} />
            </button>
          )}
        </div>
      ))}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onChange([...items, ""])}
        style={{ alignSelf: "flex-start", fontSize: "var(--fs-xs)" }}
      >
        <IconPlus size={11} /> Agregar ítem
      </button>
    </div>
  );
}

// ── BlockItem: combina preview + edición ──────────────────────────

function BlockItem({
  block, isEditing, onStartEdit, onUpdate, onDelete,
}: {
  block: ContentBlock;
  isEditing: boolean;
  onStartEdit: () => void;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const renderEdit = () => {
    switch (block.type) {
      case "paragraph":
        return (
          <ParagraphEditor
            content={block.content}
            onChange={(content) => onUpdate({ content } as Partial<ContentBlock>)}
            onBlur={() => {}}
          />
        );
      case "heading":
        return (
          <HeadingEditor
            content={block.content}
            level={block.level}
            onChange={(content) => onUpdate({ content } as Partial<ContentBlock>)}
            onLevelChange={(level) => onUpdate({ level } as Partial<ContentBlock>)}
            onBlur={() => {}}
          />
        );
      case "equation":
        return (
          <EquationEditor
            latex_content={block.latex_content}
            numbered={block.numbered}
            onChange={(latex_content) => onUpdate({ latex_content } as Partial<ContentBlock>)}
            onNumberedChange={(numbered) => onUpdate({ numbered } as Partial<ContentBlock>)}
            onBlur={() => {}}
          />
        );
      case "list":
        return (
          <ListEditor
            items={block.items}
            list_type={block.list_type}
            onChange={(items) => onUpdate({ items } as Partial<ContentBlock>)}
            onTypeChange={(list_type) => onUpdate({ list_type } as Partial<ContentBlock>)}
            onBlur={() => {}}
          />
        );
      case "raw_latex":
        return (
          <div>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-warn)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
              ⚠ LaTeX manual — puede romper la compilación
            </div>
            <textarea
              autoFocus
              value={block.content}
              onChange={(e) => onUpdate({ content: e.target.value } as Partial<ContentBlock>)}
              rows={4}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5",
                background: "var(--ink-900)", border: "none", outline: "none",
                padding: "10px 14px", borderRadius: "var(--r-sm)", resize: "vertical", width: "100%",
              }}
            />
          </div>
        );
      default:
        return <div style={{ color: "var(--fg-faint)" }}>Bloque no editable</div>;
    }
  };

  const renderPreview = () => {
    switch (block.type) {
      case "paragraph":
        return (
          <p style={{ fontFamily: "var(--font-display)", fontSize: 15, color: block.content ? "var(--fg-default)" : "var(--fg-faint)", lineHeight: 1.65, margin: 0 }}>
            {block.content || "Párrafo vacío — clic para editar"}
          </p>
        );
      case "heading": {
        const fsMap: Record<HeadingLevel, number> = { section: 22, subsection: 18, subsubsection: 16 };
        return (
          <div style={{ fontFamily: "var(--font-display)", fontSize: fsMap[block.level], fontWeight: 500, color: block.content ? "var(--fg-strong)" : "var(--fg-faint)", lineHeight: 1.2 }}>
            {block.content || "Título vacío — clic para editar"}
          </div>
        );
      }
      case "equation":
        return (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-muted)", padding: "10px 16px", background: "var(--bg-app)", borderRadius: "var(--r-sm)", textAlign: "center" }}>
            {block.latex_content || "Ecuación vacía — clic para editar"}
          </div>
        );
      case "list":
        return block.items.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {block.items.map((item, i) => (
              <li key={i} style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.65 }}>{item || "(ítem vacío)"}</li>
            ))}
          </ul>
        ) : <div style={{ color: "var(--fg-faint)" }}>Lista vacía</div>;
      case "figure":
        return (
          <div style={{ padding: "12px 16px", background: "var(--bg-app)", borderRadius: "var(--r-sm)", border: "1px dashed var(--border-firm)", textAlign: "center" }}>
            <div style={{ color: "var(--fg-faint)", fontSize: 13 }}>📷 {block.file}</div>
            <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>{block.caption}</div>
          </div>
        );
      case "raw_latex":
        return (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#C8C2B5", padding: "10px 14px", background: "var(--ink-900)", borderRadius: "var(--r-sm)" }}>
            {block.content || "(LaTeX vacío)"}
          </div>
        );
      default:
        return <div style={{ color: "var(--fg-faint)" }}>[bloque desconocido]</div>;
    }
  };

  return (
    <div
      style={{
        position: "relative", margin: "4px -32px", padding: "6px 32px 6px 44px",
        borderRadius: 6,
        background: isEditing ? "var(--accent-tint)" : hovered ? "var(--bg-hover)" : "transparent",
        border: isEditing ? "1px solid var(--accent-soft)" : "1px solid transparent",
        cursor: isEditing ? "default" : "text",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!isEditing) onStartEdit(); }}
    >
      {/* Drag handle */}
      <div style={{ position: "absolute", left: 8, top: 12, color: "var(--fg-faint)", opacity: hovered ? 0.7 : 0 }}>
        <IconDrag size={12} />
      </div>

      {/* Tipo de bloque chip */}
      {(isEditing || hovered) && (
        <div style={{ position: "absolute", left: 24, top: -9, background: "var(--bg-panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-xs)", padding: "1px 6px", fontSize: 9, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", letterSpacing: "0.05em", zIndex: 1 }}>
          {block.type}
        </div>
      )}

      {/* Contenido */}
      {isEditing ? renderEdit() : renderPreview()}

      {/* Botón eliminar */}
      {(isEditing || hovered) && (
        <button
          className="btn btn-ghost btn-icon"
          style={{ position: "absolute", right: 6, top: 6, padding: 3, opacity: 0.6 }}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Eliminar bloque"
        >
          <IconTrash size={11} />
        </button>
      )}
    </div>
  );
}

// ── EditorView principal ──────────────────────────────────────────

type SaveStatus = "saved" | "saving" | "unsaved";

export default function EditorView() {
  const { id: encodedPath } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, activeProjectPath, activeSectionId, setActiveSectionId } = useProjectStore();

  const [localBlocks, setLocalBlocks] = useState<ContentBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronizar localBlocks cuando cambia la sección activa
  useEffect(() => {
    const section = activeProject?.sections.find((s) => s.id === activeSectionId);
    setLocalBlocks(section?.blocks ?? []);
    setEditingId(null);
    setSaveStatus("saved");
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
      }
    }
    setSaveStatus("saved");
  }, [activeProjectPath]);

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
      case "paragraph":   block = { type, id, content: "" }; break;
      case "heading":     block = { type, id, level: "section", content: "" }; break;
      case "list":        block = { type, id, list_type: "itemize", items: [""] }; break;
      case "equation":    block = { type, id, latex_content: "", numbered: false }; break;
      case "raw_latex":   block = { type, id, content: "", user_confirmed: true }; break;
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

  if (!activeProject || !activeProjectPath) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--fg-muted)", background: "var(--bg-app)" }}>
        <p>Proyecto no cargado.</p>
        <button className="btn" onClick={() => navigate("/")}>← Inicio</button>
      </div>
    );
  }

  const groups = placementGroup(activeProject.sections);
  const activeSection = activeProject.sections.find((s) => s.id === activeSectionId)
    ?? activeProject.sections.find((s) => s.placement === "body" && s.enabled)
    ?? activeProject.sections[0];

  const bodyWordCount = activeProject.sections
    .filter((s) => s.placement === "body")
    .reduce((acc, s) => acc + countWords(s.id === activeSectionId ? localBlocks : s.blocks), 0);

  const projectName = activeProject.metadata.title;

  const saveLabel = saveStatus === "saving" ? "Guardando…" : saveStatus === "unsaved" ? "Sin guardar" : "Guardado";
  const saveDot = saveStatus === "saving" ? "var(--build-warn)" : saveStatus === "unsaved" ? "var(--build-err)" : "var(--build-ok)";

  return (
    <>
      <TxAppbar
        left={<><TxLogo /><TxBreadcrumb parts={[projectName, activeSection?.title ?? "Sección"]} /></>}
        center={null}
        right={
          <>
            <button className="btn btn-ghost btn-sm"><IconSearch size={13} /></button>
            <button className="btn btn-accent btn-sm" onClick={() => navigate(`/project/${encodedPath}/compile`)}>
              <IconBuild size={13} /> Compilar
            </button>
            <button className="btn btn-ghost btn-icon"><IconSettings size={14} /></button>
          </>
        }
      />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr 340px", minHeight: 0, background: "var(--bg-app)" }}>

        {/* ── Árbol de secciones ─────────────────────────────────── */}
        <div style={{ borderRight: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "12px 14px 8px", fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            Secciones
            <button className="btn btn-ghost btn-icon" style={{ padding: 4 }}><IconPlus size={12} /></button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 6px 12px" }} className="scroll">
            {Object.entries(groups).map(([groupLabel, secs]) => (
              <div key={groupLabel}>
                <div style={{ margin: "6px 8px 2px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)", display: "flex", alignItems: "center", gap: 6 }}>
                  <IconChevronD size={10} /> {groupLabel}
                </div>
                {secs.filter((s) => s.enabled).map((s) => (
                  <div
                    key={s.id}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: "var(--r-sm)", fontSize: "var(--fs-base)", cursor: "pointer", background: s.id === activeSectionId ? "var(--bg-selected)" : "transparent", color: s.id === activeSectionId ? "var(--accent-deep)" : "var(--fg-default)", fontWeight: s.id === activeSectionId ? 500 : 400, minHeight: 26 }}
                    onClick={() => setActiveSectionId(s.id)}
                  >
                    <IconDoc size={11} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title ?? s.element_id}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>
                      {(s.id === activeSectionId ? localBlocks.length : s.blocks.length) || ""}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Canvas editor ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Toolbar */}
          <div style={{ height: 38, flexShrink: 0, borderBottom: "1px solid var(--border-subtle)", padding: "0 14px", display: "flex", alignItems: "center", gap: 2, background: "var(--bg-panel)", fontSize: "var(--fs-sm)", overflowX: "auto" }}>
            {([
              ["paragraph", <IconText size={12} />, "Párrafo"],
              ["heading",   <IconHeading size={12} />, "Título"],
              ["list",      <IconList size={12} />, "Lista"],
              ["equation",  <IconSigma size={12} />, "Ecuación"],
              ["raw_latex", <IconCode size={12} />, "LaTeX"],
            ] as [ContentBlock["type"], React.ReactNode, string][]).map(([type, icon, label]) => (
              <button
                key={type}
                className="btn btn-ghost btn-sm"
                onClick={() => addBlock(type)}
                title={`Agregar ${label}`}
                style={{ flexDirection: "column", gap: 1, padding: "5px 8px", height: "auto", fontSize: 9 }}
              >
                {icon}<span>{label}</span>
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: "var(--border-subtle)", margin: "0 4px" }} />
            <button className="btn btn-ghost btn-sm" title="Figura (próximamente)" style={{ flexDirection: "column", gap: 1, padding: "5px 8px", height: "auto", fontSize: 9, opacity: 0.4 }}>
              <IconImage size={12} /><span>Figura</span>
            </button>
            <button className="btn btn-ghost btn-sm" title="Tabla (próximamente)" style={{ flexDirection: "column", gap: 1, padding: "5px 8px", height: "auto", fontSize: 9, opacity: 0.4 }}>
              <IconTable size={12} /><span>Tabla</span>
            </button>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", fontFamily: "var(--font-mono)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: saveDot }} />
              <IconRefresh size={11} /> {saveLabel}
            </div>
          </div>

          {/* Paper canvas */}
          <div
            style={{ flex: 1, overflow: "auto", padding: "32px 0", background: "var(--bg-app)" }}
            className="scroll"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null); }}
          >
            {activeSection ? (
              <div style={{ width: 680, margin: "0 auto", background: "var(--bg-paper)", borderRadius: 4, boxShadow: "var(--shadow-paper)", border: "1px solid var(--bg-paper-edge)", padding: "56px 72px 80px", minHeight: 800 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", letterSpacing: "0.05em", marginBottom: 4 }}>
                  {activeSection.element_id}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 500, color: "var(--fg-strong)", margin: "4px 0 28px", letterSpacing: "-0.015em", lineHeight: 1.15 }}>
                  {activeSection.title ?? activeSection.element_id}
                </div>

                {localBlocks.length === 0 ? (
                  <div
                    style={{ textAlign: "center", padding: "60px 0", color: "var(--fg-faint)", fontSize: "var(--fs-md)", cursor: "text" }}
                    onClick={() => addBlock("paragraph")}
                  >
                    <p style={{ margin: 0 }}>Sección vacía.</p>
                    <p style={{ fontSize: "var(--fs-sm)", marginTop: 8, color: "var(--fg-faint)" }}>
                      Clic aquí para agregar un párrafo, o usa la barra de herramientas arriba.
                    </p>
                  </div>
                ) : (
                  <>
                    {localBlocks.map((block) => (
                      <BlockItem
                        key={block.id}
                        block={block}
                        isEditing={editingId === block.id}
                        onStartEdit={() => setEditingId(block.id)}
                        onUpdate={(updates) => updateBlock(block.id, updates as Record<string, unknown>)}
                        onDelete={() => deleteBlock(block.id)}
                      />
                    ))}
                    {/* Zona de click al final para agregar párrafo */}
                    <div
                      style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-faint)", fontSize: "var(--fs-sm)", cursor: "text", borderRadius: 6, marginTop: 8 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                      onClick={() => addBlock("paragraph")}
                    >
                      <IconPlus size={12} style={{ marginRight: 6 }} /> Nuevo párrafo
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--fg-faint)", marginTop: 80 }}>
                Selecciona una sección en el árbol
              </div>
            )}
          </div>
        </div>

        {/* ── Panel derecho: metadata ─────────────────────────────── */}
        <div style={{ borderLeft: "1px solid var(--border-subtle)", background: "var(--bg-chrome)", display: "flex", flexDirection: "column", minHeight: 0, padding: 16 }}>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 12 }}>
            Proyecto
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "var(--fs-sm)" }}>
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Título</div>
              <div style={{ color: "var(--fg-strong)", fontFamily: "var(--font-display)", lineHeight: 1.3 }}>{activeProject.metadata.title}</div>
            </div>
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Autor</div>
              <div>{activeProject.student.full_name}</div>
            </div>
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Institución</div>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>{activeProject.institution.name}</div>
            </div>
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Perfil</div>
              <span className="chip tx-mono" style={{ fontSize: 11 }}>{activeProject.profile_id}</span>
            </div>
            <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Palabras</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-base)", fontWeight: 500 }}>
                {bodyWordCount.toLocaleString("es")}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Bloques en sección</div>
              <div style={{ fontFamily: "var(--font-mono)" }}>{localBlocks.length}</div>
            </div>
            <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
              <div style={{ marginBottom: 4, fontWeight: 600, color: "var(--fg-muted)" }}>Atajos</div>
              <div>Clic → editar bloque</div>
              <div>Esc → salir de edición</div>
              <div>Enter en lista → nuevo ítem</div>
            </div>
          </div>
          <div style={{ marginTop: "auto" }}>
            <button className="btn btn-accent" style={{ width: "100%" }} onClick={() => navigate(`/project/${encodedPath}/compile`)}>
              <IconBuild size={13} /> Compilar PDF
            </button>
          </div>
        </div>
      </div>

      <TxStatusbar items={[
        { text: saveLabel, dot: saveDot },
        { icon: <IconFile size={11} />, text: projectName },
        { text: `${bodyWordCount.toLocaleString("es")} palabras` },
        { right: true, text: `${activeProject.sections.filter((s) => s.enabled).length} secciones` },
      ]} />
    </>
  );
}
