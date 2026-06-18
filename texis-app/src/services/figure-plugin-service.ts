import { invokeTauri as invoke } from "../lib/tauri";
import { PLUGIN_REGISTRY, buildLatexInputBlock, setPluginLocale } from "@texisstudio/plugins";
import type { VisualDiagramPlugin, VisualFigureResult, PluginCategory, UserLevel, EditorType } from "@texisstudio/plugins";
import type { PluginFigureBlock } from "../types";
import i18n from "../i18n";
import { useSettingsStore } from "../stores/settings";

// ── Plugin catalog (lazy-instantiated) ────────────────────────────

// We cache both the plugin instance AND the catalog entry (userLevel / editorType)
// indexed by pluginId, so callers like listPlugins() and getPluginInfo() don't have
// to re-instantiate every plugin in PLUGIN_REGISTRY just to find the entry — that
// was O(N²) per call.
type CachedPlugin = {
  instance: VisualDiagramPlugin;
  entry: typeof PLUGIN_REGISTRY[number];
};

let _instances: Map<string, CachedPlugin> | null = null;
let _instancesLocale: string | null = null;

function getInstances(): Map<string, CachedPlugin> {
  const locale = i18n.resolvedLanguage || i18n.language || "es";
  if (!_instances || _instancesLocale !== locale) {
    setPluginLocale(locale);
    _instances = new Map();
    _instancesLocale = locale;
    for (const entry of PLUGIN_REGISTRY) {
      try {
        const instance = new entry.plugin();
        _instances.set(instance.pluginId, { instance, entry });
      } catch (e) {
        console.warn(`[FigurePlugins] Failed to instantiate ${entry.plugin.name}:`, e);
      }
    }
  }
  return _instances;
}

function getInstance(pluginId: string): VisualDiagramPlugin | undefined {
  return getInstances().get(pluginId)?.instance;
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
  return Array.from(getInstances().values()).map(({ instance: p, entry }) => ({
    pluginId: p.pluginId,
    displayName: p.displayName,
    description: p.description,
    category: p.category,
    qualityLevel: p.qualityLevel,
    userLevel: entry.userLevel,
    editorType: entry.editorType,
    requiredPackages: p.requiredPackages,
    scopeWarning: p.scopeWarning,
  }));
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

/**
 * Generates a high-entropy figure id used as both the filesystem folder name
 * (texisstudio-assets/figures/{figureId}/) and the LaTeX reference label.
 *
 * The previous implementation was `fig_${5-digit random}` which only had ~90 000
 * possible values — by the birthday paradox a collision becomes likely after a
 * few hundred figures across a project's lifetime, and a collision corrupts the
 * older figure's assets on disk. We now use 12 hex chars from crypto.randomUUID
 * (≈ 7×10¹⁴ combinations) so collisions are effectively impossible. Falls back
 * to a timestamp-plus-random scheme on the (rare) platforms without randomUUID.
 */
function figureId(): string {
  let token: string;
  try {
    token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  } catch {
    token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  return `fig_${token}`;
}

/** Calls plugin.create() in the browser (no disk access), then persists via Tauri. */
export async function createPluginFigure(
  pluginId: string,
  projectPath: string,
  caption?: string,
  label?: string,
): Promise<PluginFigureBlock> {
  const plugin = getInstance(pluginId);
  if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

  const result = await plugin.create();
  const fid = figureId();

  // If BasePlugin populated sourceJson, use it; otherwise stringify the result
  const sourceJson = result.sourceJson ?? JSON.stringify({ pluginId, engineId: result.engineId });

  const finalCaption = caption ?? result.latexBlock.match(/\\caption\{([^}]+)\}/)?.[1] ?? plugin.displayName;
  const finalLabel = label ?? result.latexBlock.match(/\\label\{([^}]+)\}/)?.[1] ?? `fig:${fid}`;

  // Persist to disk via Tauri. output.tex must hold the bare figure body
  // (texContent), which latexBlock references via \input — never the wrapper.
  await invoke("save_plugin_figure", {
    projectPath,
    figureId: fid,
    latexTex: result.texContent,
    sourceJson,
    requiredPackages: [...result.requiredPackages],
    pluginId,
    caption: finalCaption,
    label: finalLabel,
    warnings: result.warnings,
    manualEdit: false, // generated from source — body matches the visual model
  });

  // Fire-and-forget: generate preview.pdf for inline block rendering
  invoke("compile_snippet_preview", { projectPath, figureId: fid, backend: useSettingsStore.getState().latexPrimaryBackend }).catch(() => {});

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
  const cached = getInstances().get(pluginId);
  if (!cached) return undefined;
  const { instance: p, entry } = cached;
  return {
    pluginId: p.pluginId,
    displayName: p.displayName,
    description: p.description,
    category: p.category,
    qualityLevel: p.qualityLevel,
    userLevel: entry.userLevel,
    editorType: entry.editorType,
    requiredPackages: p.requiredPackages,
    scopeWarning: p.scopeWarning,
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

  // Meta-only edit: the figure body (output.tex) is unchanged, so we pass an
  // empty latexTex to tell the backend to leave output.tex untouched and only
  // refresh the manifest (caption/label).
  await invoke("save_plugin_figure", {
    projectPath,
    figureId: block.figureId,
    latexTex: "",
    sourceJson: block.sourceJson,
    requiredPackages: block.requiredPackages,
    pluginId: block.pluginId,
    caption,
    label,
    warnings: block.warnings,
  });

  return { ...block, caption, label, latexBlock: newLatexBlock };
}

/** Overwrites the figure body (output.tex) with hand-edited LaTeX, keeping
 *  the rest of the figure metadata intact. Used by the manual-edit view.
 *  Note: regenerating the figure from the visual editor will replace this. */
export async function writePluginFigureTex(
  block: PluginFigureBlock,
  projectPath: string,
  latexTex: string,
): Promise<void> {
  await invoke("save_plugin_figure", {
    projectPath,
    figureId: block.figureId,
    latexTex,
    sourceJson: block.sourceJson,
    requiredPackages: block.requiredPackages,
    pluginId: block.pluginId,
    caption: block.caption,
    label: block.label,
    warnings: block.warnings,
    manualEdit: true, // body diverges from source.json — flag it for the visual editor
  });
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
  const plugin = getInstance(block.pluginId);
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
    latexTex: result.texContent,
    sourceJson: newSourceJson,
    requiredPackages: [...result.requiredPackages],
    pluginId: block.pluginId,
    caption: finalCaption,
    label: finalLabel,
    warnings: result.warnings,
    manualEdit: false, // regenerated from source — body matches the visual model
  });

  // Fire-and-forget: regenerate preview.pdf so inline block preview stays fresh
  invoke("compile_snippet_preview", { projectPath, figureId: block.figureId, backend: useSettingsStore.getState().latexPrimaryBackend }).catch(() => {});

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
  const plugin = getInstance(block.pluginId);
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
    latexTex: result.texContent,
    sourceJson: newSourceJson,
    requiredPackages: [...result.requiredPackages],
    pluginId: block.pluginId,
    caption: finalCaption,
    label: finalLabel,
    warnings: result.warnings,
    manualEdit: false, // regenerated from source — body matches the visual model
  });

  // Fire-and-forget: regenerate preview.pdf so inline block preview stays fresh
  invoke("compile_snippet_preview", { projectPath, figureId: block.figureId, backend: useSettingsStore.getState().latexPrimaryBackend }).catch(() => {});

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
