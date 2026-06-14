import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "../stores/workspace";
import { api } from "../lib/tauri";

export function useWorkspaceAutoSave(projectPath: string | null) {
  const openFiles = useWorkspaceStore((s) => s.openFiles);
  const activeFile = useWorkspaceStore((s) => s.activeFile);
  const zoomLevel = useWorkspaceStore((s) => s.zoomLevel);
  const cursorPositions = useWorkspaceStore((s) => s.cursorPositions);
  const lastBuildSummary = useWorkspaceStore((s) => s.lastBuildSummary);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!projectPath) return;

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
  }, [projectPath, openFiles, activeFile, zoomLevel, cursorPositions, lastBuildSummary]);
}
