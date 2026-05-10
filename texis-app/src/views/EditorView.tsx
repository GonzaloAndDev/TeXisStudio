import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TxAppbar, TxBreadcrumb, TxLogo, TxStatusbar } from "../components/Chrome";
import {
  IconBuild, IconChevronD, IconCode, IconDoc, IconDrag, IconFile,
  IconHeading, IconImage, IconList, IconMore, IconPlus, IconRefresh,
  IconSearch, IconSettings, IconSigma, IconTable, IconText,
} from "../components/Icons";
import { api } from "../lib/tauri";
import { useProjectStore } from "../stores/project";
import type { ContentBlock, ProjectSection } from "../types";

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

function BlockPreview({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--fg-default)", lineHeight: 1.65, margin: "0 0 14px" }}>{block.content}</p>;
    case "heading":
      return (
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: block.level === "section" ? 22 : block.level === "subsection" ? 18 : 16,
          fontWeight: 500, color: "var(--fg-strong)",
          margin: "24px 0 10px", lineHeight: 1.2,
        }}>
          {block.content}
        </div>
      );
    case "equation":
      return (
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-muted)",
          padding: "10px 16px", background: "var(--bg-app)", borderRadius: "var(--r-sm)",
          margin: "10px 0", textAlign: "center",
        }}>
          {block.latex_content}
        </div>
      );
    case "list":
      return (
        <ul style={{ margin: "10px 0", paddingLeft: 20 }}>
          {block.items.map((item, i) => (
            <li key={i} style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1.65, marginBottom: 4 }}>
              {item}
            </li>
          ))}
        </ul>
      );
    case "figure":
      return (
        <div style={{ margin: "16px 0", padding: "12px 16px", background: "var(--bg-app)", borderRadius: "var(--r-sm)", border: "1px dashed var(--border-firm)", textAlign: "center" }}>
          <div style={{ color: "var(--fg-faint)", fontSize: 13 }}>📷 {block.file}</div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 4 }}>{block.caption}</div>
        </div>
      );
    case "raw_latex":
      return (
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-muted)",
          padding: "10px 14px", background: "var(--ink-900)", color: "#C8C2B5",
          borderRadius: "var(--r-sm)", margin: "10px 0",
        }}>
          {block.content}
        </div>
      );
    default:
      return <div style={{ color: "var(--fg-faint)", fontSize: 13 }}>[bloque: {(block as ContentBlock).type}]</div>;
  }
}

function BlockTypeButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={onClick}
      title={label}
      style={{ flexDirection: "column", gap: 2, padding: "6px 8px", height: "auto", fontSize: "var(--fs-xs)" }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function EditorView() {
  const { id: encodedPath } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, activeProjectPath, activeSectionId, setActiveSectionId } = useProjectStore();
  const [saving, setSaving] = useState(false);

  if (!activeProject || !activeProjectPath) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-muted)" }}>
        <div style={{ textAlign: "center", gap: 12 }}>
          <p>Proyecto no cargado.</p>
          <button className="btn" onClick={() => navigate("/")}>← Inicio</button>
        </div>
      </div>
    );
  }

  const groups = placementGroup(activeProject.sections);
  const activeSection = activeProject.sections.find((s) => s.id === activeSectionId)
    ?? activeProject.sections.find((s) => s.placement === "body" && s.enabled)
    ?? activeProject.sections[0];

  const bodyWordCount = activeProject.sections
    .filter((s) => s.placement === "body")
    .flatMap((s) => s.blocks)
    .filter((b) => b.type === "paragraph")
    .reduce((acc, b) => acc + (b.type === "paragraph" ? b.content.split(/\s+/).filter(Boolean).length : 0), 0);

  const projectName = activeProject.metadata.title;

  return (
    <>
      <TxAppbar
        left={
          <>
            <TxLogo />
            <TxBreadcrumb parts={[projectName, activeSection?.title ?? "Sección"]} />
          </>
        }
        center={null}
        right={
          <>
            <button className="btn btn-ghost btn-sm"><IconSearch size={13} /></button>
            <button
              className="btn btn-accent btn-sm"
              onClick={() => navigate(`/project/${encodedPath}/compile`)}
            >
              <IconBuild size={13} /> Compilar
            </button>
            <button className="btn btn-ghost btn-icon"><IconSettings size={14} /></button>
          </>
        }
      />

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "260px 1fr 380px", minHeight: 0, background: "var(--bg-app)" }}>

        {/* ── Árbol de secciones ─────────────────────────────────── */}
        <div style={{
          borderRight: "1px solid var(--border-subtle)",
          background: "var(--bg-chrome)", display: "flex", flexDirection: "column", minHeight: 0,
        }}>
          <div style={{
            padding: "12px 14px 8px", fontSize: "var(--fs-xs)", textTransform: "uppercase",
            letterSpacing: "0.08em", color: "var(--fg-faint)", fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            Secciones
            <button className="btn btn-ghost btn-icon" style={{ padding: 4 }}><IconPlus size={12} /></button>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "0 6px 12px" }} className="scroll">
            {Object.entries(groups).map(([groupLabel, secs]) => (
              <div key={groupLabel}>
                <div style={{
                  margin: "6px 8px 2px", fontSize: 10, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--fg-faint)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <IconChevronD size={10} /> {groupLabel}
                </div>
                {secs.filter((s) => s.enabled).map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "4px 8px", borderRadius: "var(--r-sm)",
                      fontSize: "var(--fs-base)", cursor: "pointer",
                      background: s.id === activeSectionId ? "var(--bg-selected)" : "transparent",
                      color: s.id === activeSectionId ? "var(--accent-deep)" : "var(--fg-default)",
                      fontWeight: s.id === activeSectionId ? 500 : 400,
                      minHeight: 26,
                    }}
                    onClick={() => setActiveSectionId(s.id)}
                  >
                    <IconDoc size={11} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title ?? s.element_id}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)" }}>
                      {s.blocks.length > 0 ? s.blocks.length : ""}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Editor de bloques (centro) ──────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>
          {/* Toolbar de bloques */}
          <div style={{
            height: 38, flexShrink: 0, borderBottom: "1px solid var(--border-subtle)",
            padding: "0 14px", display: "flex", alignItems: "center", gap: 4,
            background: "var(--bg-panel)", fontSize: "var(--fs-sm)",
            overflowX: "auto",
          }}>
            <BlockTypeButton icon={<IconText size={12} />} label="Párrafo" onClick={() => {}} />
            <BlockTypeButton icon={<IconHeading size={12} />} label="Título" onClick={() => {}} />
            <BlockTypeButton icon={<IconImage size={12} />} label="Figura" onClick={() => {}} />
            <BlockTypeButton icon={<IconTable size={12} />} label="Tabla" onClick={() => {}} />
            <BlockTypeButton icon={<IconSigma size={12} />} label="Ecuación" onClick={() => {}} />
            <BlockTypeButton icon={<IconList size={12} />} label="Lista" onClick={() => {}} />
            <BlockTypeButton icon={<IconCode size={12} />} label="LaTeX" onClick={() => {}} />
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost btn-sm">
              <IconRefresh size={12} /> {saving ? "Guardando…" : "Guardado"}
            </button>
          </div>

          {/* Canvas de papel */}
          <div style={{ flex: 1, overflow: "auto", padding: "32px 0", background: "var(--bg-app)" }} className="scroll">
            {activeSection ? (
              <div style={{
                width: 680, margin: "0 auto",
                background: "var(--bg-paper)",
                borderRadius: 4, boxShadow: "var(--shadow-paper)",
                border: "1px solid var(--bg-paper-edge)",
                padding: "56px 72px 80px",
                minHeight: 800,
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-faint)", letterSpacing: "0.05em", marginBottom: 4 }}>
                  {activeSection.element_id}
                </div>
                <div style={{
                  fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 500,
                  color: "var(--fg-strong)", margin: "4px 0 28px", letterSpacing: "-0.015em", lineHeight: 1.15,
                }}>
                  {activeSection.title ?? activeSection.element_id}
                </div>

                {activeSection.blocks.length === 0 ? (
                  <div style={{
                    textAlign: "center", padding: "40px 0",
                    color: "var(--fg-faint)", fontSize: "var(--fs-md)",
                  }}>
                    <p>Esta sección está vacía.</p>
                    <p style={{ fontSize: "var(--fs-sm)", marginTop: 8 }}>
                      Usa la barra de herramientas para agregar párrafos, figuras, ecuaciones, etc.
                    </p>
                  </div>
                ) : (
                  activeSection.blocks.map((block, i) => (
                    <div
                      key={block.id ?? i}
                      style={{ position: "relative", margin: "6px -32px", padding: "8px 32px", borderRadius: 6 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--bg-hover)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    >
                      <div style={{ position: "absolute", left: 4, top: 10, display: "flex", gap: 2, opacity: 0.7, color: "var(--fg-faint)" }}>
                        <IconDrag size={12} />
                      </div>
                      <BlockPreview block={block} />
                      <div style={{ position: "absolute", right: 6, top: 8, opacity: 0 }} className="block-actions">
                        <button className="btn btn-ghost btn-icon" style={{ padding: 2 }}><IconMore size={12} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "var(--fg-faint)", marginTop: 80 }}>
                Selecciona una sección en el árbol
              </div>
            )}
          </div>
        </div>

        {/* ── Panel derecho: preview / metadata ──────────────────── */}
        <div style={{
          borderLeft: "1px solid var(--border-subtle)",
          background: "var(--bg-chrome)", display: "flex", flexDirection: "column",
          minHeight: 0, padding: 16,
        }}>
          <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)", marginBottom: 12 }}>
            Información del proyecto
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "var(--fs-sm)" }}>
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Título</div>
              <div style={{ color: "var(--fg-strong)", fontFamily: "var(--font-display)" }}>
                {activeProject.metadata.title}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Autor</div>
              <div>{activeProject.student.full_name}</div>
            </div>
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Institución</div>
              <div>{activeProject.institution.name}</div>
            </div>
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Perfil</div>
              <span className="chip tx-mono" style={{ fontSize: 11 }}>{activeProject.profile_id}</span>
            </div>
            <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 0" }} />
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Palabras estimadas</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-base)" }}>
                {bodyWordCount.toLocaleString("es")}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--fg-faint)", fontSize: "var(--fs-xs)", marginBottom: 2 }}>Secciones</div>
              <div style={{ fontFamily: "var(--font-mono)" }}>
                {activeProject.sections.filter((s) => s.enabled).length}
              </div>
            </div>
          </div>

          <div style={{ marginTop: "auto" }}>
            <button
              className="btn btn-accent"
              style={{ width: "100%" }}
              onClick={() => navigate(`/project/${encodedPath}/compile`)}
            >
              <IconBuild size={13} /> Compilar PDF
            </button>
          </div>
        </div>
      </div>

      <TxStatusbar items={[
        { text: "Editor", dot: "var(--build-ok)" },
        { icon: <IconFile size={11} />, text: projectName },
        { text: `${bodyWordCount.toLocaleString("es")} palabras` },
        { right: true, text: `${activeProject.sections.filter((s) => s.enabled).length} secciones` },
      ]} />
    </>
  );
}
