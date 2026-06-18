/**
 * MathExpressionEditor — editor visual para math-engine en modos no-matrix.
 *
 * Cubre:
 *  - equation / display / gather: tree de filas, cada una con su LaTeX
 *  - align: tree de filas con marcador `&` para alineación
 *  - system: lista de ecuaciones + variables
 *  - cases anidado (Piecewise): cada nodo "cases" del tree expone expr/cond
 *
 * Cada textarea se registra en mathInsertManager — al hacer foco, la paleta
 * lateral del documento y la `MathSymbolGrid` embebida insertan ahí. Tab/Shift+Tab
 * salta entre `{}` vacíos, igual que el bloque inline de ecuaciones.
 *
 * Renderiza KaTeX en vivo usando `MathEngine.generateLatex(doc)` para que el
 * usuario vea exactamente lo que el PDF mostrará.
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MathEngine } from "@texisstudio/plugins/engines/math-engine/engine.js";
import type { MathEngineDocument, MathMode, MathNode, SystemDocument } from "../../types-engines";
import { mathInsertManager, findNextEmptySlot, findPrevEmptySlot } from "../../lib/mathInsertManager";
import { KaTeXPreview } from "../../views/editor/BlockEditors";
import { MathSymbolGrid } from "./MathSymbolGrid";
import { SlotLegend } from "../SlotLegend";
import {
  treeToSystem,
  systemToTree,
  addRow as addRowT,
  addCasesBlock as addCasesBlockT,
  removeRow as removeRowT,
  parseVariables,
  sanitizeLabel,
  setCaseField,
  addCase as addCaseT,
  removeCase as removeCaseT,
} from "./math-transforms";

const engine = new MathEngine();

// Modos editables aquí (matrix tiene editor propio; inline no se usa para figuras).
const SUPPORTED_MODES: MathMode[] = ["equation", "display", "align", "gather", "cases", "system"];

type AnyMathDoc = MathEngineDocument | SystemDocument;

interface Props {
  doc: AnyMathDoc;
  onChange: (updated: AnyMathDoc) => void;
}

export function MathExpressionEditor({ doc, onChange }: Props) {
  const { t } = useTranslation();

  const isSystem = doc.mode === "system";

  const setMode = (mode: MathMode) => {
    if (mode === "system" && !isSystem) {
      onChange(treeToSystem(doc as MathEngineDocument, (doc as Partial<SystemDocument>).variables ?? []));
      return;
    }
    if (mode !== "system" && isSystem) {
      onChange(systemToTree(doc as SystemDocument, mode));
      return;
    }
    onChange({ ...doc, mode } as AnyMathDoc);
  };

  // ── Renderizado preview ─────────────────────────────────────────────────
  // Serializamos el doc completo con el motor para que el preview siempre
  // refleje el LaTeX final (incluido el entorno align/equation y \label).
  let previewLatex = "";
  try {
    previewLatex = engine.generateLatex(doc as MathEngineDocument);
  } catch (e) {
    previewLatex = `% preview error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── Barra superior: modo + numbered + label ───────────────────── */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={labelStyle}>{t("math_editor.mode")}</span>
          <select
            value={doc.mode}
            onChange={(e) => setMode(e.target.value as MathMode)}
            style={inputStyle}
          >
            {SUPPORTED_MODES.map((m) => (
              <option key={m} value={m}>{t(`math_editor.mode_${m}`)}</option>
            ))}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", marginTop: 14 }}>
          <input
            type="checkbox"
            checked={doc.numbered}
            onChange={(e) => onChange({ ...doc, numbered: e.target.checked } as AnyMathDoc)}
            style={{ accentColor: "var(--accent)" }}
          />
          {t("math_editor.numbered")}
        </label>

        {doc.numbered && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={labelStyle}>{t("math_editor.label")}</span>
            <input
              value={doc.label ?? ""}
              onChange={(e) => onChange({ ...doc, label: sanitizeLabel(e.target.value) || undefined } as AnyMathDoc)}
              placeholder="eq:my-equation"
              spellCheck={false}
              style={{ ...inputStyle, width: 180, fontFamily: "var(--font-mono)" }}
            />
          </div>
        )}
      </div>

      {/* ── Cuerpo según modo ─────────────────────────────────────────── */}
      {isSystem
        ? <SystemBody doc={doc as SystemDocument} onChange={onChange as (d: SystemDocument) => void} />
        : <TreeBody  doc={doc as MathEngineDocument} onChange={onChange as (d: MathEngineDocument) => void} />}

      {/* ── Preview KaTeX ─────────────────────────────────────────────── */}
      <div style={previewStyle}>
        <div style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
          {t("math_editor.preview")}
        </div>
        <KaTeXPreview latex={previewLatex} displayMode />
      </div>

      {/* ── Paleta embebida ───────────────────────────────────────────── */}
      {/* Abierta por defecto: dentro del modal de figura el panel lateral
          queda tapado por el backdrop, así que la grid embebida es la
          única vía para insertar símbolos. */}
      <details open>
        <summary style={{ cursor: "pointer", fontSize: "var(--fs-xs)", color: "var(--fg-muted)", padding: "4px 0" }}>
          {t("math_editor.symbol_palette")}
        </summary>
        <div style={{ marginTop: 6 }}>
          <MathSymbolGrid />
        </div>
      </details>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Tree body — para modos equation/display/align/gather/cases
// ───────────────────────────────────────────────────────────────────────────

function TreeBody({ doc, onChange }: { doc: MathEngineDocument; onChange: (d: MathEngineDocument) => void }) {
  const { t } = useTranslation();
  const tree = doc.tree;

  const updateNode = (i: number, node: MathNode) => {
    const next = tree.map((n, idx) => (idx === i ? node : n));
    onChange({ ...doc, tree: next });
  };
  const addRow = () => onChange(addRowT(doc));
  const addCasesBlock = () => onChange(addCasesBlockT(doc));
  const removeRow = (i: number) => onChange(removeRowT(doc, i));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={labelStyle}>{t("math_editor.rows")}</span>
      {tree.length === 0 && (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", fontStyle: "italic" }}>
          {t("math_editor.empty_hint")}
        </div>
      )}
      {tree.map((node, i) => {
        if (node.type === "cases") {
          return (
            <CasesRow
              key={i}
              node={node}
              onChange={(n) => updateNode(i, n)}
              onRemove={() => removeRow(i)}
              rowLabel={t("math_editor.cases_block", { n: i + 1 })}
            />
          );
        }
        return (
          <SymbolRow
            key={i}
            value={node.content}
            onChange={(v) => updateNode(i, { ...node, type: node.type === "text" ? "text" : "symbol", content: v })}
            onRemove={() => removeRow(i)}
            placeholder={doc.mode === "align" ? "x &= y + z" : "f(x) = \\sin(x)"}
            rowLabel={t("math_editor.row_n", { n: i + 1 })}
          />
        );
      })}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={addRow} style={{ fontSize: "var(--fs-xs)" }}>
          + {t("math_editor.add_row")}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={addCasesBlock} style={{ fontSize: "var(--fs-xs)" }}>
          + {t("math_editor.add_cases")}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// System body — para mode "system"
// ───────────────────────────────────────────────────────────────────────────

function SystemBody({ doc, onChange }: { doc: SystemDocument; onChange: (d: SystemDocument) => void }) {
  const { t } = useTranslation();

  const setEquation = (i: number, value: string) => {
    const equations = doc.equations.map((e, idx) => (idx === i ? value : e));
    onChange({ ...doc, equations });
  };
  const addEquation = () => {
    onChange({ ...doc, equations: [...doc.equations, "x &= 0"] });
  };
  const removeEquation = (i: number) => {
    onChange({ ...doc, equations: doc.equations.filter((_, idx) => idx !== i) });
  };
  const setVariables = (value: string) => {
    onChange({ ...doc, variables: parseVariables(value) });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={labelStyle}>{t("math_editor.equations")}</span>
      {doc.equations.map((eq, i) => (
        <SymbolRow
          key={i}
          value={eq}
          onChange={(v) => setEquation(i, v)}
          onRemove={() => removeEquation(i)}
          placeholder="x_1 + 2 x_2 &= 3"
          rowLabel={t("math_editor.row_n", { n: i + 1 })}
        />
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={addEquation} style={{ alignSelf: "flex-start", fontSize: "var(--fs-xs)" }}>
        + {t("math_editor.add_equation")}
      </button>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
        <span style={labelStyle}>{t("math_editor.variables")}</span>
        <input
          value={doc.variables.join(", ")}
          onChange={(e) => setVariables(e.target.value)}
          placeholder="x_1, x_2, x_3"
          spellCheck={false}
          style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
        />
        <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t("math_editor.variables_hint")}</span>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Filas (textarea con insert manager + Tab navigation + slot helpers)
// ───────────────────────────────────────────────────────────────────────────

function SymbolRow({
  value, onChange, onRemove, placeholder, rowLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  placeholder: string;
  rowLabel: string;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Cada fila se registra al hacer foco, para que la paleta inserte aquí.
  const handleFocus = () => {
    if (ref.current) mathInsertManager.register(ref.current, (v) => onChangeRef.current(v), "equation");
  };
  const handleBlur = () => {
    if (ref.current) mathInsertManager.unregister(ref.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      const el = ref.current;
      if (!el) return;
      const pos = el.selectionEnd ?? 0;
      const target = e.shiftKey
        ? findPrevEmptySlot(el.value, pos)
        : findNextEmptySlot(el.value, pos + 1);
      if (target !== null) {
        e.preventDefault();
        el.setSelectionRange(target, target);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <span style={{ ...labelStyle, alignSelf: "center", width: 40, textAlign: "right" }}>{rowLabel}</span>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          rows={1}
          style={{
            flex: 1, fontFamily: "var(--font-mono)", fontSize: 12,
            color: "var(--fg-default)", background: "var(--bg-paper)",
            border: "1px solid var(--border-soft)", outline: "none",
            padding: "6px 8px", borderRadius: "var(--r-sm)", resize: "vertical",
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onRemove}
          title={t("math_editor.remove_row")}
          style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}
        >
          ×
        </button>
      </div>
      <SlotLegend ownerEl={ref.current} />
    </div>
  );
}

function CasesRow({
  node, onChange, onRemove, rowLabel,
}: {
  node: MathNode;
  onChange: (n: MathNode) => void;
  onRemove: () => void;
  rowLabel: string;
}) {
  const { t } = useTranslation();
  const cases = (node.options?.["cases"] as Array<{ expr: string; cond: string }>) ?? [];

  const setCase = (i: number, field: "expr" | "cond", value: string) => onChange(setCaseField(node, i, field, value));
  const addCase = () => onChange(addCaseT(node));
  const removeCase = (i: number) => onChange(removeCaseT(node, i));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, border: "1px dashed var(--border-soft)", borderRadius: "var(--r-sm)", padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={labelStyle}>{rowLabel}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove} style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }} title={t("math_editor.remove_row")}>×</button>
      </div>
      {cases.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            value={c.expr}
            onChange={(e) => setCase(i, "expr", e.target.value)}
            placeholder={t("math_editor.case_expr_placeholder")}
            spellCheck={false}
            style={{ ...inputStyle, fontFamily: "var(--font-mono)", flex: 1 }}
          />
          <span style={{ color: "var(--fg-faint)", fontSize: 11 }}>{t("math_editor.case_if")}</span>
          <input
            value={c.cond}
            onChange={(e) => setCase(i, "cond", e.target.value)}
            placeholder={t("math_editor.case_cond_placeholder")}
            spellCheck={false}
            style={{ ...inputStyle, fontFamily: "var(--font-mono)", flex: 1 }}
          />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeCase(i)} style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>×</button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={addCase} style={{ alignSelf: "flex-start", fontSize: "var(--fs-xs)", marginTop: 2 }}>
        + {t("math_editor.add_case")}
      </button>
    </div>
  );
}

// ── estilos compartidos ────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  color: "var(--fg-faint)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  padding: "4px 7px",
  borderRadius: "var(--r-xs)",
  border: "1px solid var(--border-soft)",
  background: "var(--bg-panel)",
  color: "var(--fg-default)",
  fontSize: "var(--fs-xs)",
  outline: "none",
};

const previewStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--bg-paper)",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-subtle)",
};
