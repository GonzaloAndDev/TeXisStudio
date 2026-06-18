/**
 * Funciones puras de transformación para MathExpressionEditor.
 * Aisladas aquí para que los tests verifiquen la implementación de
 * producción directamente, sin tener que montar React.
 */

import type { MathEngineDocument, MathMode, MathNode, SystemDocument } from "../../types-engines";

/**
 * Migra un MathEngineDocument (tree-based) a SystemDocument (equations[]).
 * Cada nodo `symbol`/`text` del tree se convierte en una ecuación. Otros
 * tipos de nodo se descartan porque no encajan en el formato de sistema.
 * Si no hay ecuaciones recuperables, devuelve una ecuación placeholder.
 */
export function treeToSystem(doc: MathEngineDocument, existingVariables: string[] = []): SystemDocument {
  const equations = doc.tree
    .filter((n): n is MathNode & { type: "symbol" | "text" } => n.type === "symbol" || n.type === "text")
    .map((n) => n.content);
  return {
    engineId: "math-engine",
    version: doc.version,
    mode: "system",
    numbered: doc.numbered,
    label: doc.label,
    tree: [],
    equations: equations.length > 0 ? equations : ["x_1 + x_2 &= 0"],
    variables: existingVariables,
  };
}

/**
 * Migra un SystemDocument a MathEngineDocument. Cada ecuación se vuelve un
 * nodo `symbol` en el tree. El modo destino lo elige el llamador.
 */
export function systemToTree(doc: SystemDocument, targetMode: MathMode): MathEngineDocument {
  const tree: MathNode[] = doc.equations.map((eq) => ({
    type: "symbol",
    content: eq,
  }));
  return {
    engineId: "math-engine",
    version: doc.version,
    mode: targetMode,
    numbered: doc.numbered,
    label: doc.label,
    tree,
  };
}

/** Añade una fila vacía al final del tree. */
export function addRow(doc: MathEngineDocument): MathEngineDocument {
  return { ...doc, tree: [...doc.tree, { type: "symbol", content: "" }] };
}

/** Añade un bloque `cases` con 2 entradas placeholder. */
export function addCasesBlock(doc: MathEngineDocument): MathEngineDocument {
  return {
    ...doc,
    tree: [
      ...doc.tree,
      { type: "cases", content: "", options: { cases: [
        { expr: "", cond: "\\text{if } " },
        { expr: "", cond: "\\text{otherwise}" },
      ] } },
    ],
  };
}

/** Elimina la fila en el índice dado (no-op si fuera de rango). */
export function removeRow(doc: MathEngineDocument, index: number): MathEngineDocument {
  if (index < 0 || index >= doc.tree.length) return doc;
  return { ...doc, tree: doc.tree.filter((_, i) => i !== index) };
}

/**
 * Convierte "x_1, x_2 , x_3" → ["x_1", "x_2", "x_3"]. Filtra vacíos.
 * Usado para el campo "Variables" del modo system.
 */
export function parseVariables(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Sanitiza una etiqueta `\label{...}` a caracteres válidos. */
export function sanitizeLabel(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_:-]/g, "");
}

// ── Cases helpers ──────────────────────────────────────────────────────────

export function setCaseField(
  node: MathNode,
  index: number,
  field: "expr" | "cond",
  value: string,
): MathNode {
  const cases = (node.options?.["cases"] as Array<{ expr: string; cond: string }>) ?? [];
  const next = cases.map((c, i) => (i === index ? { ...c, [field]: value } : c));
  return { ...node, options: { ...(node.options ?? {}), cases: next } };
}

export function addCase(node: MathNode): MathNode {
  const cases = (node.options?.["cases"] as Array<{ expr: string; cond: string }>) ?? [];
  return {
    ...node,
    options: { ...(node.options ?? {}), cases: [...cases, { expr: "", cond: "\\text{if } " }] },
  };
}

export function removeCase(node: MathNode, index: number): MathNode {
  const cases = (node.options?.["cases"] as Array<{ expr: string; cond: string }>) ?? [];
  return {
    ...node,
    options: { ...(node.options ?? {}), cases: cases.filter((_, i) => i !== index) },
  };
}
