import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { CircuiTikZDocument, CircuitComponent, CircuitNode, ComponentType, Direction } from "../../types-engines";

interface Props {
  doc: CircuiTikZDocument;
  onChange: (updated: CircuiTikZDocument) => void;
}

const COMPONENT_GROUPS: { label: string; types: ComponentType[] }[] = [
  { label: "Pasivos",      types: ["resistor", "capacitor", "inductor"] },
  { label: "Fuentes",      types: ["voltage-source", "current-source", "battery"] },
  { label: "Semiconductores", types: ["diode", "zener", "npn", "pnp", "nmos", "pmos"] },
  { label: "Medición",     types: ["ammeter", "voltmeter", "ohmmeter"] },
  { label: "Otros",        types: ["switch", "op-amp", "transformer", "lamp", "antenna", "ground"] },
];

const DIRECTIONS: Direction[] = ["right", "left", "up", "down"];

function nextId(prefix: string, existingIds: string[]): string {
  const used = new Set(existingIds);
  let i = 1;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

export function CircuitEditor({ doc, onChange }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"components" | "nodes" | "connections">("components");

  const nodeIds = doc.nodes.map((n) => n.id);
  const allIds = [
    ...doc.nodes.map((n) => n.id),
    ...doc.components.map((c) => c.id),
  ];

  // ── Components ──────────────────────────────────────────────────────────────

  const updateComponent = useCallback((id: string, patch: Partial<CircuitComponent>) => {
    onChange({ ...doc, components: doc.components.map((c) => c.id === id ? { ...c, ...patch } : c) });
  }, [doc, onChange]);

  const deleteComponent = useCallback((id: string) => {
    onChange({
      ...doc,
      components: doc.components.filter((c) => c.id !== id),
      connections: doc.connections.filter((cn) => cn.from !== id && cn.to !== id),
    });
  }, [doc, onChange]);

  const addComponent = useCallback(() => {
    const from = nodeIds[0] ?? "n1";
    const to = nodeIds[1] ?? "n2";
    const id = nextId("c", allIds);
    onChange({
      ...doc,
      components: [...doc.components, { id, type: "resistor", from, to, direction: "right" }],
    });
  }, [doc, onChange, nodeIds, allIds]);

  // ── Nodes ───────────────────────────────────────────────────────────────────

  const updateNode = useCallback((id: string, patch: Partial<CircuitNode>) => {
    onChange({ ...doc, nodes: doc.nodes.map((n) => n.id === id ? { ...n, ...patch } : n) });
  }, [doc, onChange]);

  const deleteNode = useCallback((id: string) => {
    onChange({
      ...doc,
      nodes: doc.nodes.filter((n) => n.id !== id),
      components: doc.components.filter((c) => c.from !== id && c.to !== id),
      connections: doc.connections.filter((cn) => cn.from !== id && cn.to !== id),
    });
  }, [doc, onChange]);

  const addNode = useCallback(() => {
    const id = nextId("n", allIds);
    const lastNode = doc.nodes[doc.nodes.length - 1];
    onChange({
      ...doc,
      nodes: [...doc.nodes, { id, x: (lastNode?.x ?? 0) + 2, y: lastNode?.y ?? 0 }],
    });
  }, [doc, onChange, allIds]);

  // ── Connections ─────────────────────────────────────────────────────────────

  const deleteConnection = useCallback((idx: number) => {
    onChange({ ...doc, connections: doc.connections.filter((_, i) => i !== idx) });
  }, [doc, onChange]);

  const addConnection = useCallback(() => {
    if (nodeIds.length < 2) return;
    onChange({ ...doc, connections: [...doc.connections, { from: nodeIds[0], to: nodeIds[nodeIds.length - 1] }] });
  }, [doc, onChange, nodeIds]);

  const updateConnection = useCallback((idx: number, field: "from" | "to", val: string) => {
    onChange({
      ...doc,
      connections: doc.connections.map((cn, i) => i === idx ? { ...cn, [field]: val } : cn),
    });
  }, [doc, onChange]);

  const tabs = ["components", "nodes", "connections"] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-soft)", marginBottom: 10 }}>
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "5px 14px", border: "none",
            borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
            background: "transparent",
            color: activeTab === tab ? "var(--accent)" : "var(--fg-muted)",
            fontSize: "var(--fs-sm)", cursor: "pointer",
            fontWeight: activeTab === tab ? 600 : 400,
          }}>
            {tab === "components"
              ? `${t("circuit.components", "Componentes")} (${doc.components.length})`
              : tab === "nodes"
              ? `${t("circuit.nodes", "Nodos")} (${doc.nodes.length})`
              : `${t("circuit.connections", "Conexiones")} (${doc.connections.length})`}
          </button>
        ))}
      </div>

      {activeTab === "components" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {doc.components.map((comp) => (
            <div key={comp.id} style={cardStyle}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={idBadge}>{comp.id}</span>
                <select
                  value={comp.type}
                  onChange={(e) => updateComponent(comp.id, { type: e.target.value as ComponentType })}
                  style={selectStyle}
                >
                  {COMPONENT_GROUPS.map((g) => (
                    <optgroup key={g.label} label={t(`circuit.group_${g.label.toLowerCase()}`, g.label)}>
                      {g.types.map((ct) => (
                        <option key={ct} value={ct}>{t(`circuit.type_${ct}`, ct)}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span style={labelStyleSmall}>{t("circuit.from", "De")}</span>
                <select value={comp.from} onChange={(e) => updateComponent(comp.id, { from: e.target.value })} style={selectStyle}>
                  {nodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                <span style={labelStyleSmall}>{t("circuit.to", "A")}</span>
                <select value={comp.to} onChange={(e) => updateComponent(comp.id, { to: e.target.value })} style={selectStyle}>
                  {nodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
                <select
                  value={comp.direction}
                  onChange={(e) => updateComponent(comp.id, { direction: e.target.value as Direction })}
                  style={{ ...selectStyle, minWidth: 70 }}
                >
                  {DIRECTIONS.map((d) => <option key={d} value={d}>{t(`circuit.dir_${d}`, d)}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                <span style={labelStyleSmall}>{t("circuit.label", "Etiq.")}</span>
                <input
                  value={comp.label ?? ""}
                  onChange={(e) => updateComponent(comp.id, { label: e.target.value || undefined })}
                  placeholder={t("circuit.label_hint", "R1, C1...")}
                  style={{ ...inputStyle, maxWidth: 80 }}
                />
                <span style={labelStyleSmall}>{t("circuit.value", "Valor")}</span>
                <input
                  value={comp.value ?? ""}
                  onChange={(e) => updateComponent(comp.id, { value: e.target.value || undefined })}
                  placeholder="1k, 10µF..."
                  style={{ ...inputStyle, maxWidth: 80 }}
                />
                <button onClick={() => deleteComponent(comp.id)} style={deleteBtnStyle} title={t("visual_editor.delete")}>✕</button>
              </div>
            </div>
          ))}
          {nodeIds.length >= 2
            ? <button onClick={addComponent} style={addBtnStyle}>+ {t("circuit.add_component", "Componente")}</button>
            : <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("circuit.need_nodes", "Añade al menos 2 nodos primero.")}</div>
          }
        </div>
      )}

      {activeTab === "nodes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {doc.nodes.map((node) => (
            <div key={node.id} style={{ ...cardStyle, display: "flex", gap: 6, alignItems: "center" }}>
              <span style={idBadge}>{node.id}</span>
              <span style={labelStyleSmall}>x</span>
              <input
                type="number"
                value={node.x}
                onChange={(e) => updateNode(node.id, { x: Number(e.target.value) })}
                style={{ ...inputStyle, maxWidth: 55 }}
              />
              <span style={labelStyleSmall}>y</span>
              <input
                type="number"
                value={node.y}
                onChange={(e) => updateNode(node.id, { y: Number(e.target.value) })}
                style={{ ...inputStyle, maxWidth: 55 }}
              />
              <input
                value={node.label ?? ""}
                onChange={(e) => updateNode(node.id, { label: e.target.value || undefined })}
                placeholder={t("circuit.node_label", "Etiqueta (opc.)")}
                style={inputStyle}
              />
              <button onClick={() => deleteNode(node.id)} style={deleteBtnStyle} title={t("visual_editor.delete")}>✕</button>
            </div>
          ))}
          <button onClick={addNode} style={addBtnStyle}>+ {t("circuit.add_node", "Nodo")}</button>
        </div>
      )}

      {activeTab === "connections" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginBottom: 4 }}>
            {t("circuit.connections_hint", "Conexiones directas (wire) entre nodos que no pasan por un componente.")}
          </div>
          {doc.connections.map((cn, idx) => (
            <div key={idx} style={{ ...cardStyle, display: "flex", gap: 6, alignItems: "center" }}>
              <select value={cn.from} onChange={(e) => updateConnection(idx, "from", e.target.value)} style={selectStyle}>
                {nodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <span style={{ color: "var(--fg-faint)", fontSize: 12 }}>—</span>
              <select value={cn.to} onChange={(e) => updateConnection(idx, "to", e.target.value)} style={selectStyle}>
                {nodeIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <button onClick={() => deleteConnection(idx)} style={deleteBtnStyle} title={t("visual_editor.delete")}>✕</button>
            </div>
          ))}
          {nodeIds.length >= 2
            ? <button onClick={addConnection} style={addBtnStyle}>+ {t("circuit.add_connection", "Conexión")}</button>
            : <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>{t("circuit.need_nodes", "Añade al menos 2 nodos primero.")}</div>
          }
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "var(--bg-app)", border: "1px solid var(--border-soft)",
  borderRadius: "var(--r-sm)", padding: "6px 8px",
};
const idBadge: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 10,
  color: "var(--fg-faint)", minWidth: 28, flexShrink: 0,
};
const labelStyleSmall: React.CSSProperties = {
  fontSize: "var(--fs-xs)", color: "var(--fg-muted)", whiteSpace: "nowrap", flexShrink: 0,
};
const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 50, padding: "4px 7px",
  borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)",
};
const selectStyle: React.CSSProperties = {
  padding: "4px 5px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)",
};
const deleteBtnStyle: React.CSSProperties = {
  padding: "2px 6px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)",
  background: "transparent", color: "var(--fg-faint)", cursor: "pointer", fontSize: 11, flexShrink: 0,
};
const addBtnStyle: React.CSSProperties = {
  padding: "5px 12px", borderRadius: "var(--r-sm)", border: "1px dashed var(--border-firm)",
  background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: "var(--fs-xs)",
  alignSelf: "flex-start",
};
