import { useEffect } from "react";
import { isTopmostDialog, popDialog, pushDialog } from "../lib/dialogStack";

/**
 * Wires Escape-to-close + dialog-stack participation for an inline modal that
 * doesn't go through `AppDialog`. Use this when you already have your own
 * overlay/panel markup but still want the standard topmost-only Esc behavior.
 *
 * Pass `open === false` to disable the listener (the hook also handles the
 * stack push/pop lifecycle automatically when `open` flips).
 *
 * The hook is intentionally minimal — it does NOT trap focus, scroll-lock,
 * or restore focus. For full-fledged modal semantics use `AppDialog`. For
 * existing legacy inline modals this hook gives consistent Esc handling and
 * prevents the multi-modal "Esc closes everything" bug without a refactor.
 */
export function useDialogEscape(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    const stackId = pushDialog();
    function onKeyDown(e: KeyboardEvent) {
      if (!isTopmostDialog(stackId)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      popDialog(stackId);
    };
  }, [open, onClose]);
}
