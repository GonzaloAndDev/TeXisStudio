/**
 * Routes to the correct visual editor based on the engineId embedded in
 * a figure's sourceJson.  Returns null for engines that have no visual editor
 * (advanced / external-bridge plugins).
 *
 * The outer FigureEditModal is responsible for persisting and regenerating
 * after the user accepts changes.
 */
import { useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { HelpLink } from "../help/HelpLink";
import { UiErrorBoundary } from "../ui/UiErrorBoundary";
import { VisualEditorShell } from "./VisualEditorShell";
import { useDocumentHistory } from "../../hooks/useDocumentHistory";
import { getEditorMetadata } from "@texisstudio/plugins";
import "@texisstudio/plugins/engines/metadata-init.js";
import { GraphNodeEditor } from "./GraphNodeEditor";
import { PGFPlotsEditor } from "./PGFPlotsEditor";
import { MatrixEditor } from "./MatrixEditor";
import { GanttEditor } from "./GanttEditor";
import { TableDataEditor } from "./TableDataEditor";
import { TreeEditor } from "./TreeEditor";
import { ChemistryEditor } from "./ChemistryEditor";
import { CircuitEditor } from "./CircuitEditor";
import { TikzShapeEditor } from "./TikzShapeEditor";
import type { GraphNodeDocument } from "../../types-engines";
import type { PGFPlotsDocument } from "../../types-engines";
import type { MatrixDocument } from "../../types-engines";
import type { TimelineGanttDocument } from "../../types-engines";
import type { TableDataDocument } from "../../types-engines";
import type { TreeForestDocument } from "../../types-engines";
import type { ChemEngineDocument } from "../../types-engines";
import type { CircuiTikZDocument } from "../../types-engines";
import type { TikzShapeDocument } from "../../types-engines";
import type { HelpSection } from "../../stores/help";

interface Props {
  /** The raw JSON string stored alongside the figure (block.sourceJson). */
  sourceJson: string;
  /** Called whenever the user makes a change. Receives updated JSON string. */
  onSourceChange: (updatedJson: string) => void;
}

type ParsedSource = {
  engineId: string;
  data: unknown;
} | {
  engineId: string;
  [key: string]: unknown;
};

function parseSource(raw: string): ParsedSource | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && typeof (parsed as Record<string, unknown>).engineId === "string") {
      return parsed as ParsedSource;
    }
    if (typeof parsed === "object" && parsed !== null && "data" in parsed) {
      const inner = (parsed as { data: unknown }).data;
      if (typeof inner === "object" && inner !== null && typeof (inner as Record<string, unknown>).engineId === "string") {
        return inner as ParsedSource;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function wrap(doc: unknown, originalRaw: string): string {
  try {
    const outer = JSON.parse(originalRaw);
    if (typeof outer === "object" && outer !== null && "data" in outer) {
      return JSON.stringify({ ...outer, data: doc });
    }
  } catch { /* fallback to bare doc */ }
  return JSON.stringify(doc);
}

function extractDoc(parsed: ParsedSource): Record<string, unknown> {
  const raw = "data" in parsed ? (parsed as { data: unknown }).data : parsed;
  return (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
}


const FALLBACK_HELP_TOPIC: HelpSection = "figures";

/**
 * Public component: routes to the right editor with a guard against malformed
 * documents. Wraps the router's actual output in a UiErrorBoundary so a bad
 * cast or runtime error inside a specific editor doesn't crash the parent
 * modal — the user sees a friendly fallback and can still cancel/restore.
 *
 * The boundary's `key` is bound to engineId+doc identity so editing past a
 * caught error attempts a re-render once the input changes; if the new input
 * is also bad, the boundary catches again.
 */
export function VisualEditorRouter(props: Props) {
  const { t } = useTranslation();
  const parsedKey = useMemo(() => {
    const p = parseSource(props.sourceJson);
    return p ? `${p.engineId}-${props.sourceJson.length}` : "no-source";
  }, [props.sourceJson]);
  return (
    <UiErrorBoundary
      key={parsedKey}
      fallback={
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--build-warn)", padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
          {t("visual_editor.crash_fallback")}
          <HelpLink topic="figures" />
        </div>
      }
    >
      <VisualEditorRouterInner {...props} />
    </UiErrorBoundary>
  );
}

function VisualEditorRouterInner({ sourceJson, onSourceChange }: Props) {
  const { t } = useTranslation();

  const parsed = useMemo(() => parseSource(sourceJson), [sourceJson]);

  const initialDoc = useMemo(() => parsed ? extractDoc(parsed) : {}, [parsed]);
  const history = useDocumentHistory<unknown>(initialDoc);

  // Sync history when sourceJson changes externally (e.g. tab switch in FigureEditModal)
  const lastEmittedRef = useRef<string>("");
  useEffect(() => {
    if (sourceJson === lastEmittedRef.current) return;
    const p = parseSource(sourceJson);
    if (!p) return;
    history.reset(extractDoc(p));
  }, [sourceJson]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((updatedDoc: unknown) => {
    history.push(updatedDoc);
    const json = wrap(updatedDoc, sourceJson);
    lastEmittedRef.current = json;
    onSourceChange(json);
  }, [history, sourceJson, onSourceChange]);

  const handleUndo = useCallback(() => {
    const prev = history.undo();
    if (prev === undefined) return;
    const json = wrap(prev, sourceJson);
    lastEmittedRef.current = json;
    onSourceChange(json);
  }, [history, sourceJson, onSourceChange]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (next === undefined) return;
    const json = wrap(next, sourceJson);
    lastEmittedRef.current = json;
    onSourceChange(json);
  }, [history, sourceJson, onSourceChange]);

  if (!parsed) {
    return (
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
        {t("visual_editor.no_source")}
        <HelpLink topic="figures" />
      </div>
    );
  }

  const doc = history.doc as Record<string, unknown>;
  const engineId = parsed.engineId as string;
  const meta = getEditorMetadata(engineId);
  const helpTopic = meta?.helpTopic ?? FALLBACK_HELP_TOPIC;
  const defaultDoc = meta?.defaultDoc?.();
  const technicalFields = meta?.technicalFields ?? [];

  const handleRestore = defaultDoc ? () => {
    handleChange(defaultDoc);
    history.reset(defaultDoc);
  } : undefined;

  const technicalValues = Object.fromEntries(
    technicalFields.map((f) => [f.key, String(doc[f.key] ?? "")])
  );

  const handleTechnicalFieldChange = (key: string, value: string) => {
    handleChange({ ...doc, [key]: value });
  };

  const shellProps = {
    canUndo: history.canUndo, canRedo: history.canRedo,
    onUndo: handleUndo, onRedo: handleRedo,
    onRestore: handleRestore, helpTopic,
    technicalFields, technicalValues,
    onTechnicalFieldChange: technicalFields.length > 0 ? handleTechnicalFieldChange : undefined,
  };

  switch (engineId) {
    case "graph-node-engine":
      return (
        <VisualEditorShell {...shellProps}>
          <GraphNodeEditor doc={doc as unknown as GraphNodeDocument} onChange={handleChange} />
        </VisualEditorShell>
      );

    case "pgfplots-engine":
      return (
        <VisualEditorShell {...shellProps}>
          <PGFPlotsEditor doc={doc as unknown as PGFPlotsDocument} onChange={handleChange} />
        </VisualEditorShell>
      );

    case "math-engine":
      if ((doc as { mode?: string }).mode === "matrix") {
        return (
          <VisualEditorShell {...shellProps} helpTopic="latex">
            <MatrixEditor doc={doc as unknown as MatrixDocument} onChange={handleChange} />
          </VisualEditorShell>
        );
      }
      return (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
          {t("visual_editor.math_advanced_hint")}
          <HelpLink topic="latex" />
        </div>
      );

    case "timeline-gantt-engine":
      return (
        <VisualEditorShell {...shellProps}>
          <GanttEditor doc={doc as unknown as TimelineGanttDocument} onChange={handleChange} />
        </VisualEditorShell>
      );

    case "table-data-engine":
      return (
        <VisualEditorShell {...shellProps}>
          <TableDataEditor doc={doc as unknown as TableDataDocument} onChange={handleChange} />
        </VisualEditorShell>
      );

    case "tree-forest-engine":
      return (
        <VisualEditorShell {...shellProps}>
          <TreeEditor doc={doc as unknown as TreeForestDocument} onChange={handleChange} />
        </VisualEditorShell>
      );

    case "chemistry-engine":
      return (
        <VisualEditorShell {...shellProps}>
          <ChemistryEditor doc={doc as unknown as ChemEngineDocument} onChange={handleChange} />
        </VisualEditorShell>
      );

    case "circuitikz-engine":
      return (
        <VisualEditorShell {...shellProps}>
          <CircuitEditor doc={doc as unknown as CircuiTikZDocument} onChange={handleChange} />
        </VisualEditorShell>
      );

    case "tikz-shape-engine":
      return (
        <VisualEditorShell {...shellProps}>
          <TikzShapeEditor doc={doc as unknown as TikzShapeDocument} onChange={handleChange} />
        </VisualEditorShell>
      );

    default:
      return (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", padding: "8px 0", display: "flex", alignItems: "center", gap: 8 }}>
          {t("visual_editor.engine_no_editor", { engineId })}
          <HelpLink topic="figures" />
        </div>
      );
  }
}

/**
 * Returns true when the given sourceJson has a registered visual editor
 * AND the plugin's editorType is not "advanced" or "external-bridge".
 */
export function hasVisualEditor(
  sourceJson: string | undefined,
  editorType?: string,
): boolean {
  if (!sourceJson) return false;
  if (editorType === "advanced" || editorType === "external-bridge") return false;

  const parsed = parseSource(sourceJson);
  if (!parsed) return false;
  const engineId = parsed.engineId; // garantizado string por parseSource

  const VISUAL_EDITOR_ENGINES = new Set([
    "graph-node-engine",
    "pgfplots-engine",
    "math-engine",
    "timeline-gantt-engine",
    "table-data-engine",
    "tree-forest-engine",
    "chemistry-engine",
    "circuitikz-engine",
    "tikz-shape-engine",
  ]);
  if (!VISUAL_EDITOR_ENGINES.has(engineId)) return false;

  if (engineId === "math-engine") {
    const doc = ("data" in parsed ? (parsed as { data: unknown }).data : parsed) as { mode?: string };
    return doc.mode === "matrix";
  }

  return true;
}
