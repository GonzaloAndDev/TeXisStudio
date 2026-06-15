/**
 * Singleton that tracks the last focused math textarea so the MathToolbarPanel
 * can insert LaTeX snippets without needing to hold a React ref across components.
 *
 * Usage:
 *   onFocus={() => mathInsertManager.register(ref.current!, onChange)}
 *   onBlur={() => mathInsertManager.unregister(ref.current!)}
 */

interface MathTarget {
  el: HTMLTextAreaElement;
  onChange: (v: string) => void;
}

let _current: MathTarget | null = null;
let _listeners: Array<() => void> = [];

export const mathInsertManager = {
  /** Call on textarea focus to register it as the active target. */
  register(el: HTMLTextAreaElement, onChange: (v: string) => void): void {
    _current = { el, onChange };
    _notify();
  },

  /** Call on textarea blur to unregister (only if it's still the active one). */
  unregister(el: HTMLTextAreaElement): void {
    if (_current?.el === el) {
      _current = null;
      _notify();
    }
  },

  /** Returns true when there is an active target. */
  hasTarget(): boolean {
    return _current !== null;
  },

  /**
   * Insert LaTeX at cursor position. Calls onChange with the new value and
   * schedules a requestAnimationFrame to restore focus + cursor position.
   */
  insert(latex: string): void {
    if (!_current) return;
    const { el, onChange } = _current;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + latex + el.value.slice(end);
    onChange(next);
    // Restore focus + position after React re-renders the textarea value
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + latex.length;
      el.setSelectionRange(pos, pos);
    });
  },

  /** Subscribe to target changes (for toolbar to re-render when target changes). */
  subscribe(fn: () => void): () => void {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter((l) => l !== fn); };
  },
};

function _notify(): void {
  for (const fn of _listeners) fn();
}
