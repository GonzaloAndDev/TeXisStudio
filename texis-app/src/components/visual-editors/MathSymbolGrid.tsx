/**
 * MathSymbolGrid — paleta de símbolos LaTeX embebible.
 *
 * Versión sin el chrome del panel lateral (no header, no collapse). Pensado
 * para encajar dentro de editores visuales de figuras (math-engine,
 * piecewise, system) donde el usuario necesita la misma potencia que la
 * paleta lateral del documento, pero como parte del formulario.
 *
 * Inserta vía `mathInsertManager`, igual que el panel lateral, así que
 * comparte el target con la textarea activa.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { mathInsertManager } from "../../lib/mathInsertManager";
import { CATEGORIES, SYMBOLS, type MathCategory } from "../../lib/mathSymbols";

const noBlur = (e: React.MouseEvent) => e.preventDefault();

export function MathSymbolGrid({ canInsert = true }: { canInsert?: boolean }) {
  const { t } = useTranslation();
  const [activeCat, setActiveCat] = useState<MathCategory>("greek");
  const symbols = SYMBOLS[activeCat];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-sm)",
        background: "var(--bg-panel)",
        overflow: "hidden",
      }}
    >
      {/* Pestañas */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 3,
          padding: "6px 6px 4px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {CATEGORIES.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
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

      {/* Grid */}
      <div
        className="scroll"
        style={{ maxHeight: 220, overflowY: "auto", padding: "6px" }}
      >
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
                type="button"
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
                  color: canInsert ? "var(--fg-default)" : "var(--fg-faint)",
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
      </div>
    </div>
  );
}
