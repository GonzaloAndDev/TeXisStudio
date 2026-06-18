/**
 * useMathField — contrato único de "campo de matemáticas" compartido por
 * TODOS los puntos de entrada de LaTeX (bloque inline de ecuaciones, filas del
 * editor del plugin, campos expr/cond de los bloques cases).
 *
 * Centraliza el modelo sticky-target (ver mathInsertManager) y la navegación
 * Tab/Shift+Tab entre cajas `{}` vacías, de modo que el comportamiento sea
 * idéntico en todos lados: foco registra, blur solo oculta el legend, el
 * desmontaje libera, y Tab salta a la siguiente caja.
 *
 * Devuelve un `ref` para asignar al <textarea>/<input> y los handlers listos
 * para repartir con spread: `<textarea ref={ref} {...handlers} />`.
 */

import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { mathInsertManager, findNextEmptySlot, findPrevEmptySlot, type MathField } from "./mathInsertManager";

export interface UseMathFieldResult<T extends MathField> {
  ref: React.RefObject<T>;
  handlers: {
    onFocus: () => void;
    onBlur: () => void;
    onKeyDown: (e: ReactKeyboardEvent<T>) => void;
  };
}

interface Options {
  /** Si true, enfoca el campo al montar (p. ej. fila recién agregada). */
  autoFocusOnMount?: boolean;
  /**
   * Si true (default), Tab/Shift+Tab navega entre cajas `{}` vacías. Cuando no
   * hay caja adelante, deja pasar el Tab para salir del campo con el teclado.
   */
  slotTab?: boolean;
}

export function useMathField<T extends MathField = HTMLTextAreaElement>(
  onChange: (v: string) => void,
  opts: Options = {},
): UseMathFieldResult<T> {
  const { autoFocusOnMount = false, slotTab = true } = opts;
  const ref = useRef<T>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const register = () => {
    if (ref.current) mathInsertManager.register(ref.current, (v) => onChangeRef.current(v), "equation");
  };

  // Foco → registrar como target sticky. Cleanup en UNMOUNT (no en blur):
  // así el target sigue apuntando aquí aunque el foco se vaya a un botón de
  // la paleta, y solo se libera cuando el campo deja de existir.
  useEffect(() => {
    const el = ref.current;
    if (autoFocusOnMount && el) {
      el.focus();
      // Registrar TAMBIÉN de forma directa: si el elemento ya estaba enfocado
      // (remonte de StrictMode, o un foco que no re-dispara onFocus), el evento
      // de foco no vuelve a llegar y el target quedaría sin registrar pese a
      // tener el cursor dentro. El register directo lo garantiza.
      register();
    }
    return () => { if (el) mathInsertManager.unregister(el); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFocus = register;

  // Blur solo oculta el legend de slots; el target sigue sticky.
  const onBlur = () => {
    mathInsertManager.clearActiveInsertion();
  };

  const onKeyDown = (e: ReactKeyboardEvent<T>) => {
    if (!slotTab || e.key !== "Tab") return;
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionEnd ?? 0;
    // Tab hacia adelante mira estrictamente más allá de la selección, para
    // que un cursor dentro de una caja avance a la SIGUIENTE, no se quede.
    const target = e.shiftKey
      ? findPrevEmptySlot(el.value, pos)
      : findNextEmptySlot(el.value, pos + 1);
    if (target !== null) {
      e.preventDefault();
      el.setSelectionRange(target, target);
    }
  };

  return { ref, handlers: { onFocus, onBlur, onKeyDown } };
}
