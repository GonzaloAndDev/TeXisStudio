// Thin wrapper around tauri-plugin-updater.
// Returns a plain result so callers don't need to import the plugin directly.

export interface UpdateCheckResult {
  available: boolean;
  version?: string;
  body?: string;
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return { available: false };
    return {
      available: update.available,
      version: update.version,
      body: update.body ?? undefined,
    };
  } catch (e) {
    // Running in browser / dev without Tauri — silently fail
    if (String(e).includes("not found") || String(e).includes("invoke")) {
      return { available: false };
    }
    throw e;
  }
}
