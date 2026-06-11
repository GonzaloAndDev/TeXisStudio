/**
 * Hierarchical tree editor for tree-forest-engine documents.
 * Used by: PhylogeneticTrees, SyntaxTrees, ProbabilityTrees,
 *          DecisionTree, Genealogy.
 *
 * Presents the tree as an indented list — no LaTeX required.
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { TreeForestDocument, TreeNode } from "../../types-engines";

interface Props {
  doc: TreeForestDocument;
  onChange: (updated: TreeForestDocument) => void;
}

const TREE_STYLES = ["syntax", "taxonomic", "phylogenetic", "genealogy", "decision", "probability"] as const;
const GROWTHS     = ["south", "north", "east", "west"] as const;

/** Collect all node IDs recursively. */
function allIds(node: TreeNode): string[] {
  return [node.id, ...node.children.flatMap(allIds)];
}

/** Collision-safe ID: picks next unused integer suffix across the whole tree. */
function nextNodeId(root: TreeNode): string {
  const used = new Set(allIds(root));
  let i = 1;
  while (used.has(`n${i}`)) i++;
  return `n${i}`;
}

function cloneNode(n: TreeNode): TreeNode {
  return { ...n, children: n.children.map(cloneNode) };
}

function updateNodeInTree(root: TreeNode, id: string, patch: Partial<TreeNode>): TreeNode {
  if (root.id === id) return { ...root, ...patch };
  return { ...root, children: root.children.map((c) => updateNodeInTree(c, id, patch)) };
}

function addChildToNode(root: TreeNode, parentId: string, child: TreeNode): TreeNode {
  if (root.id === parentId) return { ...root, children: [...root.children, child] };
  return { ...root, children: root.children.map((c) => addChildToNode(c, parentId, child)) };
}

function removeNodeFromTree(root: TreeNode, id: string): TreeNode | null {
  if (root.id === id) return null;
  const children = root.children.map((c) => removeNodeFromTree(c, id)).filter(Boolean) as TreeNode[];
  return { ...root, children };
}

export function TreeEditor({ doc, onChange }: Props) {
  const { t } = useTranslation();

  const updateNode = useCallback((id: string, patch: Partial<TreeNode>) => {
    onChange({ ...doc, root: updateNodeInTree(cloneNode(doc.root), id, patch) });
  }, [doc, onChange]);

  const addChild = useCallback((parentId: string) => {
    const child: TreeNode = { id: nextNodeId(doc.root), label: t("visual_editor.new_node"), children: [] };
    onChange({ ...doc, root: addChildToNode(cloneNode(doc.root), parentId, child) });
  }, [doc, onChange, t]);

  const removeNode = useCallback((id: string) => {
    if (id === doc.root.id) return;
    const updated = removeNodeFromTree(cloneNode(doc.root), id);
    if (updated) onChange({ ...doc, root: updated });
  }, [doc, onChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Global options */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Selector label={t("visual_editor.tree_style")} value={doc.style} onChange={(v) => onChange({ ...doc, style: v as TreeForestDocument["style"] })} options={TREE_STYLES} />
        <Selector label={t("visual_editor.growth_dir")} value={doc.growth} onChange={(v) => onChange({ ...doc, growth: v as TreeForestDocument["growth"] })} options={GROWTHS} />
      </div>

      {/* Tree */}
      <div style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", padding: "8px 10px", overflowY: "auto", maxHeight: 300 }}>
        <NodeRow node={doc.root} depth={0} onUpdate={updateNode} onAddChild={addChild} onRemove={removeNode} isRoot t={t} />
      </div>
    </div>
  );
}

function NodeRow({ node, depth, onUpdate, onAddChild, onRemove, isRoot, t }: {
  node: TreeNode; depth: number; isRoot?: boolean;
  onUpdate: (id: string, patch: Partial<TreeNode>) => void;
  onAddChild: (parentId: string) => void;
  onRemove: (id: string) => void;
  t: TFunction;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: depth * 18, marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "var(--fg-faint)" }}>{depth === 0 ? "◆" : "├─"}</span>
        <input
          value={node.label}
          onChange={(e) => onUpdate(node.id, { label: e.target.value })}
          style={{ flex: 1, padding: "3px 6px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)", background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)" }}
        />
        <input
          value={node.edgeLabel ?? ""}
          onChange={(e) => onUpdate(node.id, { edgeLabel: e.target.value || undefined })}
          placeholder={t("visual_editor.edge_label_hint", "edge label")}
          style={{ width: 80, padding: "3px 6px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)", background: "var(--bg-panel)", color: "var(--fg-faint)", fontSize: "var(--fs-xs)" }}
        />
        <button
          onClick={() => onAddChild(node.id)}
          title={t("visual_editor.add_child", "Add child")}
          style={{ fontSize: 10, padding: "2px 5px", border: "1px solid var(--border-soft)", borderRadius: "var(--r-xs)", background: "transparent", color: "var(--accent)", cursor: "pointer" }}
        >+</button>
        {!isRoot && (
          <button
            onClick={() => onRemove(node.id)}
            style={{ fontSize: 10, padding: "2px 5px", border: "none", background: "transparent", color: "var(--fg-faint)", cursor: "pointer" }}
          >✕</button>
        )}
      </div>
      {node.children.map((child) => (
        <NodeRow key={child.id} node={child} depth={depth + 1} onUpdate={onUpdate} onAddChild={onAddChild} onRemove={onRemove} t={t} />
      ))}
    </div>
  );
}

function Selector({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[]; }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "4px 5px", borderRadius: "var(--r-xs)", border: "1px solid var(--border-soft)", background: "var(--bg-panel)", color: "var(--fg-default)", fontSize: "var(--fs-xs)" }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
