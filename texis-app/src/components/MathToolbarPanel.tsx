/**
 * MathToolbarPanel — panel lateral de símbolos y operadores matemáticos LaTeX.
 *
 * Se integra con mathInsertManager para insertar en la última textarea activa.
 * Todos los botones usan onMouseDown + preventDefault para evitar que se pierda
 * el foco de la textarea al hacer clic (patrón estándar de paletas de herramientas).
 */

import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { mathInsertManager } from "../lib/mathInsertManager";
import { CATEGORIES, SYMBOLS, type MathCategory } from "../lib/mathSymbols";
import { IconX, IconSigma, IconChevronR, IconChevronL } from "./Icons";

type Category = MathCategory;


// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Previene que el foco salga de la textarea activa cuando el usuario hace clic
 * en los botones del panel. Sin esto, el blur dispara ANTES de click, y
 * mathInsertManager.current queda null antes de que insert() se ejecute.
 */
const noBlur = (e: React.MouseEvent) => e.preventDefault();

// ── Componente ────────────────────────────────────────────────────────────────

export function MathToolbarPanel({ onClose, collapsed, onToggleCollapse }: { onClose: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const { t } = useTranslation();
  const [activeCat, setActiveCat] = useState<Category>("greek");

  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(() => mathInsertManager.subscribe(forceUpdate), []);

  const insertionMode = mathInsertManager.insertionMode();
  const canInsert = insertionMode !== "none";
  const symbols = SYMBOLS[activeCat];

  if (collapsed) {
    return (
      <div
        className="editor-panel-rail editor-panel-rail-right"
        style={{ flexDirection: "column", alignItems: "center", gap: 4 }}
      >
        <button
          className="btn btn-ghost btn-icon"
          onMouseDown={noBlur}
          onClick={onToggleCollapse}
          title={t("math_toolbar.expand")}
          style={{ padding: 5 }}
        >
          <IconChevronL size={13} />
        </button>
        <IconSigma size={12} style={{ color: "var(--fg-muted)", marginTop: 4 }} />
        <span className="editor-rail-label">{t("math_toolbar.title")}</span>
        <button
          className="btn btn-ghost btn-icon"
          onMouseDown={noBlur}
          onClick={onClose}
          title={t("common.close")}
          style={{ padding: 4, marginTop: "auto", marginBottom: 8, color: "var(--fg-muted)" }}
        >
          <IconX size={11} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="editor-math-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid var(--border-firm)",
        background: "var(--bg-panel)",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "9px 10px 9px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          gap: 7,
          background: "var(--bg-chrome)",
        }}
      >
        <IconSigma size={12} style={{ color: "var(--fg-muted)", flexShrink: 0 }} />
        <span
          style={{
            flex: 1,
            fontSize: "var(--fs-xs)",
            fontWeight: 600,
            color: "var(--fg-strong)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {t("math_toolbar.title")}
        </span>
        <button
          className="btn btn-ghost btn-icon"
          onMouseDown={noBlur}
          onClick={onToggleCollapse}
          title={t("math_toolbar.collapse")}
          style={{ padding: 3, color: "var(--fg-muted)" }}
        >
          <IconChevronR size={11} />
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onMouseDown={noBlur}
          onClick={onClose}
          title={t("common.close")}
          style={{ padding: 3, color: "var(--fg-muted)" }}
        >
          <IconX size={11} />
        </button>
      </div>

      {/* ── Hint contextual: qué hará el siguiente clic ──────────── */}
      {insertionMode !== "insert" && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "10px 12px",
            margin: "8px",
            background: "var(--bg-app)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--r-sm)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
            {insertionMode === "create" ? "∑" : "⌨"}
          </span>
          <p style={{ margin: 0, fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
            {insertionMode === "create"
              ? t("math_toolbar.hint_create_block")
              : t("math_toolbar.hint_no_target")}
          </p>
        </div>
      )}

      {/* ── Pestañas de categoría ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
          padding: "8px 8px 6px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {CATEGORIES.map(({ id, labelKey }) => (
          <button
            key={id}
            className={`btn btn-sm ${activeCat === id ? "btn-accent" : "btn-ghost"}`}
            onMouseDown={noBlur}
            onClick={() => setActiveCat(id)}
            style={{
              fontSize: 10,
              padding: "3px 8px",
              fontWeight: activeCat === id ? 600 : 400,
            }}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* ── Grid de símbolos ──────────────────────────────────────── */}
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 6px 4px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(34px, 1fr))",
            gap: 2,
          }}
        >
          {symbols.map((sym, i) => {
            const isLong = sym.display.length > 4;
            const isMed  = !isLong && sym.display.length > 2;
            return (
              <button
                key={i}
                className="btn btn-ghost"
                title={sym.titleKey ? t(sym.titleKey) : (sym.title ?? sym.latex)}
                onMouseDown={noBlur}
                onClick={() => mathInsertManager.insert(sym.latex)}
                disabled={!canInsert}
                style={{
                  fontSize: isLong ? 8 : isMed ? 9 : 15,
                  fontFamily: isMed || isLong ? "var(--font-mono)" : "Georgia, 'Times New Roman', serif",
                  padding: "3px 2px",
                  minHeight: 30,
                  minWidth: 30,
                  lineHeight: 1,
                  opacity: canInsert ? 1 : 0.35,
                  color: canInsert ? "var(--fg-body)" : "var(--fg-faint)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  border: "1px solid transparent",
                  transition: "border-color 0.1s, background 0.1s",
                }}
              >
                {sym.display}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 9,
            color: "var(--fg-faint)",
            textAlign: "center",
            lineHeight: 1.4,
            paddingBottom: 4,
          }}
        >
          {t("math_toolbar.footer_hint")}
        </div>
      </div>
    </div>
  );
}
