/**
 * Routes to the correct visual editor based on the engineId embedded in
 * a figure's sourceJson.  Returns null for engines that have no visual editor
 * (advanced / external-bridge plugins).
 *
 * The outer FigureEditModal is responsible for persisting and regenerating
 * after the user accepts changes.
 */
import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GraphNodeEditor } from "./GraphNodeEditor";
import { PGFPlotsEditor } from "./PGFPlotsEditor";
import { MatrixEditor } from "./MatrixEditor";
import { GanttEditor } from "./GanttEditor";
import { TableDataEditor } from "./TableDataEditor";
import { TreeEditor } from "./TreeEditor";
import type { GraphNodeDocument } from "../../types-engines";
import type { PGFPlotsDocument } from "../../types-engines";
import type { MatrixDocument } from "../../types-engines";
import type { TimelineGanttDocument } from "../../types-engines";
import type { TableDataDocument } from "../../types-engines";
import type { TreeForestDocument } from "../../types-engines";

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
    if (typeof parsed === "object" && parsed !== null && "engineId" in parsed) return parsed as ParsedSource;
    if (typeof parsed === "object" && parsed !== null && "data" in parsed) {
      const inner = (parsed as { data: unknown }).data;
      if (typeof inner === "object" && inner !== null && "engineId" in inner) return inner as ParsedSource;
    }
    return null;
  } catch {
    return null;
  }
}

function wrap(doc: unknown, originalRaw: string): string {
  try {
    const outer = JSON.parse(originalRaw);
    if ("data" in outer) return JSON.stringify({ ...outer, data: doc });
  } catch { /* fallback */ }
  return JSON.stringify(doc);
}

export function VisualEditorRouter({ sourceJson, onSourceChange }: Props) {
  const { t } = useTranslation();

  const parsed = useMemo(() => parseSource(sourceJson), [sourceJson]);

  const handleChange = useCallback((updatedDoc: unknown) => {
    onSourceChange(wrap(updatedDoc, sourceJson));
  }, [sourceJson, onSourceChange]);

  if (!parsed) {
    return (
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", padding: "8px 0" }}>
        {t("visual_editor.no_source")}
      </div>
    );
  }

  const doc = ("data" in parsed ? (parsed as { data: unknown }).data : parsed) as Record<string, unknown>;
  const engineId = parsed.engineId as string;

  switch (engineId) {
    case "graph-node-engine":
      return <GraphNodeEditor doc={doc as unknown as GraphNodeDocument} onChange={(d) => handleChange(d)} />;

    case "pgfplots-engine":
      return <PGFPlotsEditor doc={doc as unknown as PGFPlotsDocument} onChange={(d) => handleChange(d)} />;

    case "math-engine":
      if ((doc as { mode?: string }).mode === "matrix") {
        return <MatrixEditor doc={doc as unknown as MatrixDocument} onChange={(d) => handleChange(d)} />;
      }
      return (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", padding: "8px 0" }}>
          {t("visual_editor.math_advanced_hint")}
        </div>
      );

    case "timeline-gantt-engine":
      return <GanttEditor doc={doc as unknown as TimelineGanttDocument} onChange={(d) => handleChange(d)} />;

    case "table-data-engine":
      return <TableDataEditor doc={doc as unknown as TableDataDocument} onChange={(d) => handleChange(d)} />;

    case "tree-forest-engine":
      return <TreeEditor doc={doc as unknown as TreeForestDocument} onChange={(d) => handleChange(d)} />;

    default:
      return (
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", padding: "8px 0" }}>
          {t("visual_editor.engine_no_editor", { engineId })}
        </div>
      );
  }
}

/**
 * Returns true when the given sourceJson has a registered visual editor
 * AND the plugin's editorType is not "advanced" or "external-bridge".
 *
 * @param sourceJson  The raw sourceJson from the figure block.
 * @param editorType  The plugin's editorType from the registry (optional).
 *                    If "advanced" or "external-bridge", always returns false.
 */
export function hasVisualEditor(
  sourceJson: string | undefined,
  editorType?: string,
): boolean {
  if (!sourceJson) return false;
  if (editorType === "advanced" || editorType === "external-bridge") return false;

  const parsed = parseSource(sourceJson);
  if (!parsed) return false;
  const engineId = parsed.engineId as string;

  const SUPPORTED_ENGINES = [
    "graph-node-engine",
    "pgfplots-engine",
    "math-engine",
    "timeline-gantt-engine",
    "table-data-engine",
    "tree-forest-engine",
  ];
  if (!SUPPORTED_ENGINES.includes(engineId)) return false;

  // math-engine only has a visual editor for "matrix" mode
  if (engineId === "math-engine") {
    const doc = ("data" in parsed ? (parsed as { data: unknown }).data : parsed) as { mode?: string };
    return doc.mode === "matrix";
  }

  return true;
}
