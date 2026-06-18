/**
 * Singleton that routes math-symbol insertions from the side panel to the
 * right destination in the document:
 *
 *  1. If an equation textarea is the live target, the snippet is inserted at
 *     the cursor inside it.
 *  2. Otherwise, if the host view has registered a `creator`, the snippet
 *     is used to spawn a new equation block in the document. This is the
 *     "dedicated block" path — the panel never dumps raw LaTeX into a
 *     paragraph or arbitrary text field.
 *  3. With neither path available, insert() is a no-op.
 *
 * ── Modelo "sticky target" (unificado entre el bloque inline y el plugin) ──
 *
 * TODOS los textareas de matemáticas siguen el mismo contrato:
 *   • onFocus   → register(): este textarea pasa a ser el target activo.
 *   • onBlur    → clearActiveInsertion(): solo oculta el legend de slots; el
 *                 target sigue apuntando aquí (sticky), de modo que un clic en
 *                 la paleta inserta en la última caja donde estuvo el cursor,
 *                 aunque el foco se haya ido al hacer clic en el botón.
 *   • onUnmount → unregister(): libera el target SOLO si seguía siendo este
 *                 (fila eliminada, modal cerrado, bloque desmontado). Evita
 *                 que el manager retenga un <textarea> ya desconectado.
 *
 * insert() valida `el.isConnected` antes de escribir: si el target quedó
 * huérfano (desmontado sin cleanup), cae al creator o a no-op en vez de
 * escribir en un nodo muerto.
 *
 * Solo textareas de ecuación registran como target (kind: "equation").
 * Párrafos / raw-latex NO registran, así un clic en la paleta mientras se
 * edita un párrafo crea un bloque de ecuación nuevo en vez de corromperlo.
 */

import { OPERATOR_SLOTS, computeSlotRanges } from "./mathSymbols";

type TargetKind = "equation";

/**
 * Cualquier campo que pueda recibir LaTeX desde la paleta. Aceptamos tanto
 * <textarea> (filas de ecuación, bloque inline) como <input> (campos expr/cond
 * de los bloques cases). Ambos exponen value, selectionStart/End y
 * setSelectionRange, que es todo lo que necesitan el slot-nav y el insert.
 */
export type MathField = HTMLTextAreaElement | HTMLInputElement;

/** True if the pair at index `i` is an empty `{}` or `[]` slot. */
function isEmptySlotAt(text: string, i: number): boolean {
  if (i < 0 || i + 1 >= text.length) return false;
  const a = text[i];
  const b = text[i + 1];
  return (a === "{" && b === "}") || (a === "[" && b === "]");
}

/**
 * Returns the cursor position inside the first empty slot within [from, to),
 * or null if no slot exists in that range. A "slot" is an empty `{}` or `[]`
 * pair. Position is the index right after the opening bracket, so placing
 * the cursor there puts it inside the empty pair — ready for the user to
 * type.
 *
 * Used for "fill-in-the-blanks" math input: snippets like `\frac{}{}`
 * insert with the cursor pre-positioned in the first slot.
 */
export function findFirstEmptySlot(text: string, from: number, to: number): number | null {
  const stop = Math.min(to, text.length) - 1;
  for (let i = Math.max(from, 0); i <= stop; i++) {
    if (isEmptySlotAt(text, i)) return i + 1;
  }
  return null;
}

/** Next empty slot at or after `from` in the full text. */
export function findNextEmptySlot(text: string, from: number): number | null {
  return findFirstEmptySlot(text, from, text.length);
}

/**
 * Previous empty slot strictly before `before` (the cursor position).
 * Scans backwards so the closest preceding slot wins.
 */
export function findPrevEmptySlot(text: string, before: number): number | null {
  for (let i = Math.min(before - 2, text.length - 2); i >= 0; i--) {
    if (isEmptySlotAt(text, i)) return i + 1;
  }
  return null;
}

interface MathTarget {
  el: MathField;
  onChange: (v: string) => void;
  kind: TargetKind;
}

/**
 * Información de la última inserción multi-slot. La consulta `SlotLegend`
 * para mostrar al usuario qué espera cada `{}` del comando que acaba de
 * insertar. Se setea desde `insert()` cuando hay metadata en
 * `OPERATOR_SLOTS`. Se limpia automáticamente cuando:
 *   - se inserta algo nuevo (cualquier inserción reinicia el estado)
 *   - la textarea pierde foco (blur)
 *   - el cursor se aleja del primer al último slot (lo decide el consumidor)
 */
export interface ActiveInsertion {
  el: MathField;
  latex: string;
  nameKey: string;
  slots: Array<{ start: number; end: number; labelKey: string }>;
}

let _current: MathTarget | null = null;
let _creator: ((latex: string) => void) | null = null;
let _listeners: Array<() => void> = [];
let _activeInsertion: ActiveInsertion | null = null;

export const mathInsertManager = {
  /** Call on math-field focus to register it as the active (sticky) target. */
  register(el: MathField, onChange: (v: string) => void, kind: TargetKind = "equation"): void {
    _current = { el, onChange, kind };
    _notify();
  },

  /**
   * Call on UNMOUNT (not blur) to release the target if it's still this el.
   * Blur must NOT call this — the target is sticky so the palette keeps
   * inserting into the last-focused row even after focus moves to a button.
   */
  unregister(el: MathField): void {
    if (_current?.el === el) {
      _current = null;
      _notify();
    }
    if (_activeInsertion?.el === el) {
      _activeInsertion = null;
      _notify();
    }
  },

  /** Última inserción multi-slot, o null si no hay una activa. */
  activeInsertion(): ActiveInsertion | null {
    return _activeInsertion;
  },

  /** Limpia el legend (lo invoca el consumidor al salir del último slot). */
  clearActiveInsertion(): void {
    if (_activeInsertion !== null) {
      _activeInsertion = null;
      _notify();
    }
  },

  /**
   * Register a fallback creator. When no equation textarea is focused, the
   * panel calls this with the LaTeX snippet to spawn a new equation block.
   * Returns an unregister fn so the host view can clean up on unmount.
   */
  registerCreator(fn: (latex: string) => void): () => void {
    _creator = fn;
    _notify();
    return () => {
      if (_creator === fn) {
        _creator = null;
        _notify();
      }
    };
  },

  /** True iff there is a currently focused equation target. */
  hasTarget(): boolean {
    return _current !== null;
  },

  /**
   * True iff a panel click would produce *some* result: either insert into
   * the focused equation, or spawn a new equation block via the creator.
   */
  hasInsertionPath(): boolean {
    return _current !== null || _creator !== null;
  },

  /**
   * What clicking a symbol will do right now — used by the panel hint:
   *   "insert" → there is a focused equation textarea
   *   "create" → no focused equation, but a creator can spawn a new block
   *   "none"   → nothing is wired up
   */
  insertionMode(): "insert" | "create" | "none" {
    if (_current) return "insert";
    if (_creator) return "create";
    return "none";
  },

  /**
   * Insert LaTeX. If an equation textarea is focused, splice it at the
   * cursor and restore focus + caret on the next frame. Otherwise, hand
   * the snippet to the registered creator so a new equation block is
   * spawned in the document.
   */
  insert(latex: string): void {
    // Si el target quedó desconectado del DOM (desmontado sin cleanup), no
    // escribimos en un nodo muerto: lo soltamos y caemos al creator/no-op.
    if (_current && !_current.el.isConnected) {
      _current = null;
      _activeInsertion = null;
    }
    if (_current) {
      const { el, onChange } = _current;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + latex + el.value.slice(end);
      onChange(next);
      // If the snippet contains an empty `{}` slot, drop the cursor inside
      // the first one so the user types directly into the placeholder. This
      // is the Wolfram-style "fill in the boxes" UX. Otherwise, cursor
      // lands at the end of the inserted text as before.
      const insertedEnd = start + latex.length;
      const slot = findFirstEmptySlot(next, start, insertedEnd);
      const pos = slot ?? insertedEnd;

      // Si el snippet es uno de los multi-slot conocidos, calculamos los
      // rangos absolutos de cada `{}` y los publicamos para que `SlotLegend`
      // muestre qué espera cada caja.
      const meta = OPERATOR_SLOTS[latex];
      if (meta && meta.slotKeys.length > 0) {
        const ranges = computeSlotRanges(latex, start);
        _activeInsertion = {
          el,
          latex,
          nameKey: meta.nameKey,
          slots: ranges.slice(0, meta.slotKeys.length).map((r, i) => ({
            start: r.start,
            end: r.end,
            labelKey: meta.slotKeys[i],
          })),
        };
      } else {
        _activeInsertion = null;
      }
      _notify();

      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    if (_creator) {
      _creator(latex);
    }
  },

  /** Subscribe to target / creator changes (for the panel to re-render). */
  subscribe(fn: () => void): () => void {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter((l) => l !== fn); };
  },
};

function _notify(): void {
  for (const fn of _listeners) fn();
}
