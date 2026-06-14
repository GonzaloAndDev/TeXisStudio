import { useEffect, useRef, useState } from "react";
import { useWorkspaceStore } from "../stores/workspace";
import { api } from "../lib/tauri";

export function useWorkspaceAutoSave(projectPath: string | null) {
  const openFiles = useWorkspaceStore((s) => s.openFiles);
  const activeFile = useWorkspaceStore((s) => s.activeFile);
  const zoomLevel = useWorkspaceStore((s) => s.zoomLevel);
  const cursorPositions = useWorkspaceStore((s) => s.cursorPositions);
  const lastBuildSummary = useWorkspaceStore((s) => s.lastBuildSummary);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hydratedProjectPath, setHydratedProjectPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHydratedProjectPath(null);

    if (!projectPath) {
      useWorkspaceStore.getState().reset();
      return;
    }

    api.loadWorkspaceState(projectPath)
      .then((state) => {
        if (cancelled) return;
        useWorkspaceStore.getState().hydrate({
          openFiles: state.open_files,
          activeFile: state.active_file,
          zoomLevel: state.zoom_level,
          cursorPositions: state.cursor_positions,
          lastBuildSummary: state.last_build_summary
            ? {
                success: state.last_build_summary.success,
                pdf_path: state.last_build_summary.pdf_path ?? undefined,
                duration_ms: state.last_build_summary.duration_ms ?? undefined,
              }
            : null,
        });
        setHydratedProjectPath(projectPath);
      })
      .catch((e) => {
        if (cancelled) return;
        console.warn("[workspace] restore failed:", e);
        useWorkspaceStore.getState().reset();
      });

    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  useEffect(() => {
    if (!projectPath || hydratedProjectPath !== projectPath) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      api.saveWorkspaceState(projectPath, {
        openFiles,
        activeFile,
        zoomLevel,
        cursorPositions,
        lastBuildSummary,
      }).catch((e) => {
        console.warn("[workspace] auto-save failed:", e);
      });
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [projectPath, hydratedProjectPath, openFiles, activeFile, zoomLevel, cursorPositions, lastBuildSummary]);
}
