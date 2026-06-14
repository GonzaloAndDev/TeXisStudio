/**
 * Module-level stack of currently-mounted modal dialogs. Used so global
 * keyboard handlers (Escape, focus restoration) only act on the topmost
 * dialog instead of firing on every mounted instance at once.
 *
 * The previous pattern attached a `keydown` listener on `document` per
 * dialog mount. With two nested modals (e.g., a ConfirmDialog inside an
 * AppDialog), pressing Esc closed BOTH because both listeners ran. Now
 * each dialog checks `isTopmostDialog(id)` before reacting; only the most
 * recently opened modal handles the event, mirroring native OS behavior.
 *
 * The stack is module-scoped (not React state) because:
 *   - It's not used for rendering — purely a lookup for handlers.
 *   - All dialogs in the app share one DOM root, so a singleton is correct.
 *   - Avoiding React state here keeps the API synchronous, which matters
 *     for the unmount cleanup path (popping must happen before the next
 *     dialog's mount effect reads the stack).
 */

const stack: string[] = [];
let nextId = 0;

/** Registers a new dialog as the topmost. Returns its id, used for `pop`. */
export function pushDialog(): string {
  const id = String(++nextId);
  stack.push(id);
  return id;
}

/** Removes a dialog from the stack. Idempotent. */
export function popDialog(id: string): void {
  const idx = stack.lastIndexOf(id);
  if (idx >= 0) stack.splice(idx, 1);
}

/** True if `id` is the most recently registered dialog still mounted. */
export function isTopmostDialog(id: string): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

/** Test-only hook to reset the stack between tests. */
export function _resetDialogStackForTests(): void {
  stack.length = 0;
  nextId = 0;
}
