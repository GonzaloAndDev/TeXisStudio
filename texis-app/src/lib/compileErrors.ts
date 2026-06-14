/**
 * Detects whether a thrown value represents a user-initiated cancellation of a
 * long-running backend operation (compile, export, postflight). The backend
 * may emit Spanish or English depending on the active locale, so we look at
 * multiple stems instead of a single keyword match.
 *
 * Examples of values it returns `true` for:
 *   - "Error: operation cancelled"
 *   - "Compilación cancelada por el usuario"
 *   - "AbortError"
 *   - "Process aborted"
 */
export function isCancellationError(e: unknown): boolean {
  const s = String(e).toLowerCase();
  return s.includes("cancel") || s.includes("aborted") || s.includes("abort");
}
