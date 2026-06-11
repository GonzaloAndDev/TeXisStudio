/**
 * Visual editor for graph-node-engine documents.
 * Used by: Flowchart, Block Diagrams, Software Architecture, Concept Maps,
 *          Causal DAG, Markov Chains, ER Diagrams, State Machine, UML Class,
 *          Network Graph, Biomedical Flow, CONSORT Flow, etc.
 *
 * Presents a structured form — no LaTeX required.
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { GraphNodeDocument, GraphNode, GraphEdge } from "../../types-engines";

const NODE_SHAPES = ["rectangle", "circle", "diamond", "ellipse", "rounded-rectangle", "none"] as const;
const EDGE_TYPES  = ["directed", "undirected", "bidirected", "dashed", "dotted"] as const;

interface Props {
  doc: GraphNodeDocument;
  onChange: (updated: GraphNodeDocument) => void;
}

/** Collision-safe ID: scans existing IDs and picks next unused integer suffix. */
function nextId(prefix: string, existingIds: string[]): string {
  const used = new Set(existingIds);
  let i = 1;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

export function GraphNodeEditor({ doc, onChange }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"nodes" | "edges">("nodes");

  const updateNode = useCallback((id: string, patch: Partial<GraphNode>) => {
    onChange({
      ...doc,
      nodes: doc.nodes.map((n) => n.id === id ? { ...n, ...patch } : n),
    });
  }, [doc, onChange]);

  const deleteNode = useCallback((id: string) => {
    onChange({
      ...doc,
      nodes: doc.nodes.filter((n) => n.id !== id),
      edges: doc.edges.filter((e) => e.from !== id && e.to !== id),
    });
  }, [doc, onChange]);

  const addNode = useCallback(() => {
    const id = nextId("n", doc.nodes.map((n) => n.id));
    onChange({
      ...doc,
      nodes: [...doc.nodes, { id, label: t("visual_editor.new_node"), shape: "rectangle" }],
    });
  }, [doc, onChange, t]);

  const updateEdge = useCallback((id: string, patch: Partial<GraphEdge>) => {
    onChange({
      ...doc,
      edges: doc.edges.map((e) => e.id === id ? { ...e, ...patch } : e),
    });
  }, [doc, onChange]);

  const deleteEdge = useCallback((id: string) => {
    onChange({ ...doc, edges: doc.edges.filter((e) => e.id !== id) });
  }, [doc, onChange]);

  const addEdge = useCallback(() => {
    if (doc.nodes.length < 2) return;
    const id = nextId("e", doc.edges.map((e) => e.id));
    onChange({
      ...doc,
      edges: [...doc.edges, {
        id,
        from: doc.nodes[0].id,
        to:   doc.nodes[1].id,
        type: "directed",
      }],
    });
  }, [doc, onChange]);

  const nodeIds = doc.nodes.map((n) => n.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-soft)", marginBottom: 10 }}>
        {(["nodes", "edges"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "5px 14px",
              border: "none",
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab ? "var(--accent)" : "var(--fg-muted)",
              fontSize: "var(--fs-sm)",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab === "nodes"
              ? `${t("visual_editor.nodes")} (${doc.nodes.length})`
              : `${t("visual_editor.edges")} (${doc.edges.length})`}
          </button>
        ))}
      </div>

      {activeTab === "nodes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {doc.nodes.map((node) => (
            <div key={node.id} style={{ display: "flex", gap: 6, alignItems: "center", background: "var(--bg-app)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "6px 8px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-faint)", minWidth: 36, flexShrink: 0 }}>{node.id}</div>
              <input
                value={node.label}
                onChange={(e) => updateNode(node.id, { label: e.target.value })}
                placeholder={t("visual_editor.label")}
                style={inputStyle}
              />
              <select
                value={node.shape}
                onChange={(e) => updateNode(node.id, { shape: e.target.value as GraphNode["shape"] })}
                style={selectStyle}
              >
                {NODE_SHAPES.map((s) => (
                  <option key={s} value={s}>{t(`visual_editor.shape_${s}`, s)}</option>
                ))}
              </select>
              <button onClick={() => deleteNode(node.id)} style={deleteBtnStyle} title={t("visual_editor.delete")}>✕</button>
            </div>
          ))}
          <button onClick={addNode} style={addBtnStyle}>+ {t("visual_editor.add_node")}</button>
        </div>
      )}

      {activeTab === "edges" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {doc.edges.map((edge) => (
            <div key={edge.id} style={{ display: "flex", gap: 6, alignItems: "center", background: "var(--bg-app)", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "6px 8px" }}>
              <select value={edge.from} onChange={(e) => updateEdge(edge.id, { from: e.target.value })} style={selectStyle}>
                {nodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <span style={{ color: "var(--fg-faint)", fontSize: 12 }}>→</span>
              <select value={edge.to} onChange={(e) => updateEdge(edge.id, { to: e.target.value })} style={selectStyle}>
                {nodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <select value={edge.type} onChange={(e) => updateEdge(edge.id, { type: e.target.value as GraphEdge["type"] })} style={selectStyle}>
                {EDGE_TYPES.map((et) => <option key={et} value={et}>{t(`visual_editor.edge_${et}`, et)}</option>)}
              </select>
              <input
                value={edge.label ?? ""}
                onChange={(e) => updateEdge(edge.id, { label: e.target.value || undefined })}
                placeholder={t("visual_editor.edge_label_hint")}
                style={{ ...inputStyle, maxWidth: 100 }}
              />
              <button onClick={() => deleteEdge(edge.id)} style={deleteBtnStyle} title={t("visual_editor.delete")}>✕</button>
            </div>
          ))}
          {doc.nodes.length >= 2
            ? <button onClick={addEdge} style={addBtnStyle}>+ {t("visual_editor.add_edge")}</button>
            : <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("visual_editor.need_nodes_first")}</div>
          }
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 60, padding: "4px 7px",
  borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)",
};
const selectStyle: React.CSSProperties = {
  padding: "4px 5px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)",
};
const deleteBtnStyle: React.CSSProperties = {
  padding: "2px 6px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "transparent", color: "var(--fg-faint)", cursor: "pointer", fontSize: 11,
  flexShrink: 0,
};
const addBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: "var(--r-sm)", border: "1px dashed var(--border-firm)",
  background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: "var(--fs-xs)",
  alignSelf: "flex-start",
};
