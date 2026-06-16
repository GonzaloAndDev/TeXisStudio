/**
 * Singleton that routes math-symbol insertions from the side panel to the
 * right destination in the document:
 *
 *  1. If an equation textarea is currently focused (a "live target"), the
 *     snippet is inserted at the cursor inside it.
 *  2. Otherwise, if the host view has registered a `creator`, the snippet
 *     is used to spawn a new equation block in the document. This is the
 *     "dedicated block" path — the panel never dumps raw LaTeX into a
 *     paragraph or arbitrary text field.
 *  3. With neither path available, insert() is a no-op.
 *
 * Only equation textareas register as live targets (kind: "equation").
 * Paragraph / raw-latex textareas intentionally do NOT register, so a
 * panel click while editing a paragraph creates a new equation block
 * rather than corrupting the paragraph with raw LaTeX.
 */

type TargetKind = "equation";

interface MathTarget {
  el: HTMLTextAreaElement;
  onChange: (v: string) => void;
  kind: TargetKind;
}

let _current: MathTarget | null = null;
let _creator: ((latex: string) => void) | null = null;
let _listeners: Array<() => void> = [];

export const mathInsertManager = {
  /** Call on equation-textarea focus to register it as the active target. */
  register(el: HTMLTextAreaElement, onChange: (v: string) => void, kind: TargetKind = "equation"): void {
    _current = { el, onChange, kind };
    _notify();
  },

  /** Call on textarea blur to unregister (only if it's still the active one). */
  unregister(el: HTMLTextAreaElement): void {
    if (_current?.el === el) {
      _current = null;
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
    if (_current) {
      const { el, onChange } = _current;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + latex + el.value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + latex.length;
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
