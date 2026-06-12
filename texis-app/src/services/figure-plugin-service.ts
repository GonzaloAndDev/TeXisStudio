import { invoke } from "@tauri-apps/api/core";
import { PLUGIN_REGISTRY, buildLatexInputBlock, setPluginLocale } from "@texisstudio/plugins";
import type { VisualDiagramPlugin, VisualFigureResult, PluginCategory, UserLevel, EditorType } from "@texisstudio/plugins";
import type { PluginFigureBlock } from "../types";
import i18n from "../i18n";

// ── Plugin catalog (lazy-instantiated) ────────────────────────────

let _instances: Map<string, VisualDiagramPlugin> | null = null;
let _instancesLocale: string | null = null;

function getInstances(): Map<string, VisualDiagramPlugin> {
  const locale = i18n.resolvedLanguage || i18n.language || "es";
  if (!_instances || _instancesLocale !== locale) {
    setPluginLocale(locale);
    _instances = new Map();
    _instancesLocale = locale;
    for (const entry of PLUGIN_REGISTRY) {
      try {
        const instance = new entry.plugin();
        _instances.set(instance.pluginId, instance);
      } catch (e) {
        console.warn(`[FigurePlugins] Failed to instantiate ${entry.plugin.name}:`, e);
      }
    }
  }
  return _instances;
}

export interface PluginInfo {
  pluginId: string;
  displayName: string;
  description: string;
  category: PluginCategory;
  qualityLevel: string;
  userLevel: UserLevel;
  editorType: EditorType;
  requiredPackages: readonly string[];
  scopeWarning?: string;
}

/** Returns metadata for all available plugins, grouped by category. */
export function listPlugins(): PluginInfo[] {
  return Array.from(getInstances().values()).map((p) => {
    const entry = PLUGIN_REGISTRY.find((e) => {
      try { return new e.plugin().pluginId === p.pluginId; } catch { return false; }
    });
    return {
      pluginId: p.pluginId,
      displayName: p.displayName,
      description: p.description,
      category: p.category,
      qualityLevel: p.qualityLevel,
      userLevel: entry?.userLevel ?? "intermediate",
      editorType: entry?.editorType ?? "advanced",
      requiredPackages: p.requiredPackages,
      scopeWarning: p.scopeWarning,
    };
  });
}

export function groupPluginsByCategory(plugins: PluginInfo[]): Map<PluginCategory, PluginInfo[]> {
  const map = new Map<PluginCategory, PluginInfo[]>();
  for (const p of plugins) {
    const list = map.get(p.category) ?? [];
    list.push(p);
    map.set(p.category, list);
  }
  return map;
}

// ── Figure creation & editing ──────────────────────────────────────

function figureId(): string {
  const n = Math.floor(Math.random() * 90000) + 10000;
  return `fig_${n}`;
}

/** Calls plugin.create() in the browser (no disk access), then persists via Tauri. */
export async function createPluginFigure(
  pluginId: string,
  projectPath: string,
  caption?: string,
  label?: string,
): Promise<PluginFigureBlock> {
  const plugin = getInstances().get(pluginId);
  if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

  const result = await plugin.create();
  const fid = figureId();

  // If BasePlugin populated sourceJson, use it; otherwise stringify the result
  const sourceJson = result.sourceJson ?? JSON.stringify({ pluginId, engineId: result.engineId });

  const finalCaption = caption ?? result.latexBlock.match(/\\caption\{([^}]+)\}/)?.[1] ?? plugin.displayName;
  const finalLabel = label ?? result.latexBlock.match(/\\label\{([^}]+)\}/)?.[1] ?? `fig:${fid}`;

  // Persist to disk via Tauri
  await invoke("save_plugin_figure", {
    projectPath,
    figureId: fid,
    latexTex: result.latexBlock,
    sourceJson,
    requiredPackages: [...result.requiredPackages],
    pluginId,
    caption: finalCaption,
    label: finalLabel,
    warnings: result.warnings,
  });

  // Fire-and-forget: generate preview.pdf for inline block rendering
  invoke("compile_snippet_preview", { projectPath, figureId: fid }).catch(() => {});

  return {
    type: "plugin_figure",
    id: crypto.randomUUID(),
    figureId: fid,
    pluginId,
    latexBlock: result.latexBlock,
    caption: finalCaption,
    label: finalLabel,
    requiredPackages: [...result.requiredPackages],
    sourceJson,
    warnings: result.warnings,
  };
}

/** Returns display metadata for a single plugin — used by the edit modal. */
export function getPluginInfo(pluginId: string): PluginInfo | undefined {
  const plugin = getInstances().get(pluginId);
  if (!plugin) return undefined;
  const entry = PLUGIN_REGISTRY.find((e) => {
    try { return new e.plugin().pluginId === pluginId; } catch { return false; }
  });
  return {
    pluginId: plugin.pluginId,
    displayName: plugin.displayName,
    description: plugin.description,
    category: plugin.category,
    qualityLevel: plugin.qualityLevel,
    userLevel: entry?.userLevel ?? "intermediate",
    editorType: entry?.editorType ?? "advanced",
    requiredPackages: plugin.requiredPackages,
    scopeWarning: plugin.scopeWarning,
  };
}

/** Updates caption/label without re-running the engine.
 *  Rebuilds the latexBlock from the stored source path, then saves metadata. */
export async function updatePluginFigureMeta(
  block: PluginFigureBlock,
  caption: string,
  label: string,
  projectPath: string,
): Promise<PluginFigureBlock> {
  const texPath = `texisstudio-assets/figures/${block.figureId}/output.tex`;
  const newLatexBlock = buildLatexInputBlock({ figureId: block.figureId, inputPath: texPath, caption, label });

  await invoke("save_plugin_figure", {
    projectPath,
    figureId: block.figureId,
    latexTex: newLatexBlock,
    sourceJson: block.sourceJson,
    requiredPackages: block.requiredPackages,
    pluginId: block.pluginId,
    caption,
    label,
    warnings: block.warnings,
  });

  return { ...block, caption, label, latexBlock: newLatexBlock };
}

/** Deletes all disk assets for a plugin figure. Called before removing a block. */
export async function deletePluginFigureAssets(
  block: PluginFigureBlock,
  projectPath: string,
): Promise<void> {
  try {
    await invoke("delete_plugin_figure", { projectPath, figureId: block.figureId });
  } catch {
    // Non-fatal: assets might already be gone, block still gets removed from section
  }
}

/**
 * Re-generates a figure from an already-edited sourceJson document.
 * Used by visual editors: the editor mutates the doc in memory and passes
 * the updated JSON here, bypassing the disk-load step.
 */
export async function editPluginFigureWithSource(
  block: PluginFigureBlock,
  editedSourceJson: string,
  projectPath: string,
  caption?: string,
  label?: string,
): Promise<PluginFigureBlock> {
  const plugin = getInstances().get(block.pluginId);
  if (!plugin) throw new Error(`Plugin not found: ${block.pluginId}`);

  let result: VisualFigureResult;
  if (plugin.editWithSource) {
    result = await plugin.editWithSource(
      block.figureId,
      editedSourceJson,
      caption ?? block.caption,
      label ?? block.label,
    );
  } else {
    result = await plugin.edit(block.figureId);
  }

  const newSourceJson = result.sourceJson ?? editedSourceJson;
  const finalCaption  = caption ?? block.caption;
  const finalLabel    = label ?? block.label;

  await invoke("save_plugin_figure", {
    projectPath,
    figureId: block.figureId,
    latexTex: result.latexBlock,
    sourceJson: newSourceJson,
    requiredPackages: [...result.requiredPackages],
    pluginId: block.pluginId,
    caption: finalCaption,
    label: finalLabel,
    warnings: result.warnings,
  });

  // Fire-and-forget: regenerate preview.pdf so inline block preview stays fresh
  invoke("compile_snippet_preview", { projectPath, figureId: block.figureId }).catch(() => {});

  return {
    ...block,
    latexBlock: result.latexBlock,
    caption: finalCaption,
    label: finalLabel,
    requiredPackages: [...result.requiredPackages],
    sourceJson: newSourceJson,
    warnings: result.warnings,
  };
}

/** Re-edits a figure by loading its source from disk and calling editWithSource. */
export async function editPluginFigure(
  block: PluginFigureBlock,
  projectPath: string,
  caption?: string,
  label?: string,
): Promise<PluginFigureBlock> {
  const plugin = getInstances().get(block.pluginId);
  if (!plugin) throw new Error(`Plugin not found: ${block.pluginId}`);

  // Load source from disk (or use what's in the block if disk call fails)
  let sourceJson = block.sourceJson;
  try {
    const loaded = await invoke<{ sourceJson: string }>("load_figure_source", {
      projectPath,
      figureId: block.figureId,
    });
    sourceJson = loaded.sourceJson;
  } catch {
    // Fallback to in-block sourceJson
  }

  let result: VisualFigureResult;
  if (plugin.editWithSource) {
    result = await plugin.editWithSource(block.figureId, sourceJson, caption ?? block.caption, label ?? block.label);
  } else {
    // Pre-refactor plugin — falls back to create() but preserves figureId
    result = await plugin.edit(block.figureId);
  }

  const newSourceJson = result.sourceJson ?? sourceJson;
  const finalCaption = caption ?? block.caption;
  const finalLabel = label ?? block.label;

  await invoke("save_plugin_figure", {
    projectPath,
    figureId: block.figureId,
    latexTex: result.latexBlock,
    sourceJson: newSourceJson,
    requiredPackages: [...result.requiredPackages],
    pluginId: block.pluginId,
    caption: finalCaption,
    label: finalLabel,
    warnings: result.warnings,
  });

  // Fire-and-forget: regenerate preview.pdf so inline block preview stays fresh
  invoke("compile_snippet_preview", { projectPath, figureId: block.figureId }).catch(() => {});

  return {
    ...block,
    latexBlock: result.latexBlock,
    caption: finalCaption,
    label: finalLabel,
    requiredPackages: [...result.requiredPackages],
    sourceJson: newSourceJson,
    warnings: result.warnings,
  };
}
