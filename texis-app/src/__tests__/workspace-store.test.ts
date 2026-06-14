import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore } from "../stores/workspace";

function reset() {
  useWorkspaceStore.getState().reset();
}

describe("workspace store", () => {
  beforeEach(reset);

  it("initial state is empty", () => {
    const s = useWorkspaceStore.getState();
    expect(s.openFiles).toEqual([]);
    expect(s.activeFile).toBeNull();
    expect(s.zoomLevel).toBe(1);
    expect(s.lastBuildSummary).toBeNull();
  });

  it("addOpenFile appends unique files", () => {
    const { addOpenFile } = useWorkspaceStore.getState();
    addOpenFile("/project/intro.tex");
    addOpenFile("/project/methods.tex");
    addOpenFile("/project/intro.tex"); // duplicate → ignored
    expect(useWorkspaceStore.getState().openFiles).toEqual([
      "/project/intro.tex",
      "/project/methods.tex",
    ]);
  });

  it("removeOpenFile removes file and clears activeFile when it matches", () => {
    const store = useWorkspaceStore.getState();
    store.addOpenFile("/project/intro.tex");
    store.setActiveFile("/project/intro.tex");
    store.removeOpenFile("/project/intro.tex");
    const s = useWorkspaceStore.getState();
    expect(s.openFiles).toEqual([]);
    expect(s.activeFile).toBeNull();
  });

  it("removeOpenFile keeps activeFile when it does not match", () => {
    const store = useWorkspaceStore.getState();
    store.addOpenFile("/project/intro.tex");
    store.addOpenFile("/project/methods.tex");
    store.setActiveFile("/project/methods.tex");
    store.removeOpenFile("/project/intro.tex");
    expect(useWorkspaceStore.getState().activeFile).toBe("/project/methods.tex");
  });

  it("setZoomLevel updates zoom", () => {
    useWorkspaceStore.getState().setZoomLevel(1.5);
    expect(useWorkspaceStore.getState().zoomLevel).toBe(1.5);
  });

  it("setCursorPosition stores position per file", () => {
    const { setCursorPosition, getCursorPosition } = useWorkspaceStore.getState();
    setCursorPosition("intro.tex", { line: 10, column: 5 });
    setCursorPosition("methods.tex", { line: 3, column: 0 });
    expect(getCursorPosition("intro.tex")).toEqual({ line: 10, column: 5 });
    expect(getCursorPosition("methods.tex")).toEqual({ line: 3, column: 0 });
    expect(getCursorPosition("nonexistent.tex")).toBeUndefined();
  });

  it("setCursorPosition overwrites previous value", () => {
    const { setCursorPosition, getCursorPosition } = useWorkspaceStore.getState();
    setCursorPosition("main.tex", { line: 1, column: 0 });
    setCursorPosition("main.tex", { line: 42, column: 7 });
    expect(getCursorPosition("main.tex")).toEqual({ line: 42, column: 7 });
  });

  it("setLastBuildSummary stores build result", () => {
    useWorkspaceStore.getState().setLastBuildSummary({
      success: true,
      pdf_path: "/project/build/main.pdf",
      duration_ms: 3200,
    });
    expect(useWorkspaceStore.getState().lastBuildSummary?.success).toBe(true);
  });

  it("reset restores initial state", () => {
    const store = useWorkspaceStore.getState();
    store.addOpenFile("/project/intro.tex");
    store.setZoomLevel(2);
    store.setCursorPosition("intro.tex", { line: 5, column: 2 });
    store.reset();
    const s = useWorkspaceStore.getState();
    expect(s.openFiles).toEqual([]);
    expect(s.zoomLevel).toBe(1);
    expect(s.cursorPositions).toEqual({});
  });

  it("setOpenFiles replaces the list entirely", () => {
    const store = useWorkspaceStore.getState();
    store.addOpenFile("/a.tex");
    store.setOpenFiles(["/b.tex", "/c.tex"]);
    expect(useWorkspaceStore.getState().openFiles).toEqual(["/b.tex", "/c.tex"]);
  });
});
