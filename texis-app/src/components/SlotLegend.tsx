/**
 * SlotLegend — banda de ayuda visual que aparece debajo de la textarea
 * activa cuando el usuario acaba de insertar un comando LaTeX multi-slot.
 *
 * Muestra el nombre del comando + lista ordenada de slots con etiqueta
 * humana ("numerador", "denominador", "límite inferior", etc.). El slot
 * activo (el que contiene el cursor) se resalta. Cuando el cursor sale del
 * último slot o la textarea pierde el foco, el legend se oculta.
 *
 * Se renderiza una vez por host (EquationEditor, SymbolRow del editor de
 * figuras). Cada instancia se compara contra la textarea registrada en el
 * manager: solo la que coincide se muestra. Así un mismo legend global
 * funciona sin que el host tenga que pasarle el ref.
 */

import { useEffect, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import { mathInsertManager } from "../lib/mathInsertManager";

/**
 * `ownerEl` es la textarea cuyo "dueño" puede mostrar el legend. Si el
 * activeInsertion del manager apunta a esta misma, se renderiza; si no,
 * el componente no produce salida. Acepta `null` (el ref aún no se asignó).
 */
export function SlotLegend({ ownerEl }: { ownerEl: HTMLTextAreaElement | null }) {
  const { t } = useTranslation();
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [caretPos, setCaretPos] = useState<number>(0);

  useEffect(() => mathInsertManager.subscribe(force), []);

  useEffect(() => {
    if (!ownerEl) return;
    const onSel = () => {
      if (document.activeElement === ownerEl) {
        setCaretPos(ownerEl.selectionStart ?? 0);
      }
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [ownerEl]);

  const active = mathInsertManager.activeInsertion();
  if (!active || !ownerEl || active.el !== ownerEl) return null;

  // Slot activo: el que envuelve al cursor. Como cada slot empieza colapsado
  // en `{}`, usamos heurística por rangos: cursor entre slot[i].start y
  // slot[i+1].start pertenece al slot i.
  const slots = active.slots;
  let activeIdx = -1;
  for (let i = 0; i < slots.length; i++) {
    const startBound = slots[i].start;
    const endBound = i + 1 < slots.length ? slots[i + 1].start : Number.MAX_SAFE_INTEGER;
    if (caretPos >= startBound - 1 && caretPos <= endBound) {
      activeIdx = i;
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "5px 8px",
        marginTop: 4,
        background: "var(--accent-tint)",
        border: "1px solid var(--accent-soft)",
        borderRadius: "var(--r-xs)",
        fontSize: 11,
        color: "var(--fg-default)",
      }}
    >
      <span style={{ fontWeight: 600, color: "var(--accent-deep)" }}>
        {t(active.nameKey)}
      </span>
      <span style={{ color: "var(--fg-faint)" }}>·</span>
      {slots.map((slot, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              display: "inline-block",
              minWidth: 14,
              padding: "0 4px",
              borderRadius: 3,
              background: i === activeIdx ? "var(--accent)" : "var(--bg-panel)",
              color: i === activeIdx ? "#fff" : "var(--fg-muted)",
              fontWeight: 600,
              fontSize: 10,
              textAlign: "center",
            }}
          >
            {i + 1}
          </span>
          <span style={{
            color: i === activeIdx ? "var(--fg-strong)" : "var(--fg-muted)",
            fontWeight: i === activeIdx ? 600 : 400,
          }}>
            {t(slot.labelKey)}
          </span>
          {i < slots.length - 1 && <span style={{ color: "var(--fg-faint)", marginLeft: 4 }}>·</span>}
        </span>
      ))}
      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--fg-faint)", fontStyle: "italic" }}>
        {t("math_ops.tab_hint")}
      </span>
    </div>
  );
}
