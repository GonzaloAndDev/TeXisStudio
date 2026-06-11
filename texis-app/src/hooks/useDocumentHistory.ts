import { useCallback, useReducer, useRef } from "react";

const MAX_HISTORY = 50;

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface DocumentHistory<T> {
  doc: T;
  push: (next: T) => void;
  /** Undoes the last change. Returns the restored doc, or undefined if nothing to undo. */
  undo: () => T | undefined;
  /** Redoes the next change. Returns the restored doc, or undefined if nothing to redo. */
  redo: () => T | undefined;
  reset: (initial: T) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useDocumentHistory<T>(initial: T): DocumentHistory<T> {
  const stateRef = useRef<HistoryState<T>>({ past: [], present: initial, future: [] });
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  const push = useCallback((next: T) => {
    const s = stateRef.current;
    stateRef.current = {
      past: [...s.past.slice(-MAX_HISTORY + 1), s.present],
      present: next,
      future: [],
    };
    forceRender();
  }, []);

  const undo = useCallback((): T | undefined => {
    const s = stateRef.current;
    if (s.past.length === 0) return undefined;
    const previous = s.past[s.past.length - 1];
    stateRef.current = {
      past: s.past.slice(0, -1),
      present: previous,
      future: [s.present, ...s.future],
    };
    forceRender();
    return previous;
  }, []);

  const redo = useCallback((): T | undefined => {
    const s = stateRef.current;
    if (s.future.length === 0) return undefined;
    const next = s.future[0];
    stateRef.current = {
      past: [...s.past, s.present],
      present: next,
      future: s.future.slice(1),
    };
    forceRender();
    return next;
  }, []);

  const reset = useCallback((initial: T) => {
    stateRef.current = { past: [], present: initial, future: [] };
    forceRender();
  }, []);

  const s = stateRef.current;
  return {
    doc: s.present,
    push,
    undo,
    redo,
    reset,
    canUndo: s.past.length > 0,
    canRedo: s.future.length > 0,
  };
}
