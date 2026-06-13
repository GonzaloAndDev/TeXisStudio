export type WindowMode = "default" | "remember" | "maximized";

const WINDOW_SIZE_KEY = "tx-window-size";
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 760;

type StoredWindowSize = { width: number; height: number };

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function readStoredSize(): StoredWindowSize | null {
  try {
    const value = JSON.parse(localStorage.getItem(WINDOW_SIZE_KEY) ?? "null") as StoredWindowSize | null;
    if (!value || !Number.isFinite(value.width) || !Number.isFinite(value.height)) return null;
    return {
      width: Math.max(960, value.width),
      height: Math.max(600, value.height),
    };
  } catch {
    return null;
  }
}

export async function applyWindowMode(mode: WindowMode): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
  const appWindow = getCurrentWindow();

  try {
    if (mode === "maximized") {
      await appWindow.maximize();
    } else {
      if (await appWindow.isMaximized()) await appWindow.unmaximize();
      const size = mode === "remember" ? readStoredSize() : null;
      await appWindow.setSize(new LogicalSize(size?.width ?? DEFAULT_WIDTH, size?.height ?? DEFAULT_HEIGHT));
    }
  } finally {
    // The window is created hidden (visible:false) so the chosen mode is
    // applied before it appears — otherwise the OS shows it at the configured
    // size first and the maximize/resize visibly snaps back. Reveal it now
    // that it is sized. Guarded so a mid-session settings change doesn't refocus.
    try {
      if (!(await appWindow.isVisible())) {
        await appWindow.show();
        await appWindow.setFocus();
      }
    } catch {
      /* ignore — the Rust setup() fallback reveals the window if this fails */
    }
  }
}

export async function watchRememberedWindowSize(onCleanup: (cleanup: () => void) => void): Promise<void> {
  if (!isTauriRuntime()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const appWindow = getCurrentWindow();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unlisten = await appWindow.onResized(({ payload }) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (await appWindow.isMaximized()) return;
      const scale = await appWindow.scaleFactor();
      localStorage.setItem(WINDOW_SIZE_KEY, JSON.stringify({
        width: Math.round(payload.width / scale),
        height: Math.round(payload.height / scale),
      } satisfies StoredWindowSize));
    }, 250);
  });

  onCleanup(() => {
    if (timer) clearTimeout(timer);
    unlisten();
  });
}
