// VisualBlockEditor: formulario + SVG preview para todos los tipos de VisualBlock.
// El usuario NUNCA ve LaTeX — configura parámetros y ve el resultado en tiempo real.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  FlowNode, TimelineEvent, VisualBlock, VisualConfig,
  VisualKind, VennSet,
} from "../../types";
import { VISUAL_PRESETS as PRESETS } from "../../types";
import { IconX } from "../../components/Icons";

// ── Colores disponibles ───────────────────────────────────────────
const COLORS = [
  { id: "red",    labelKey: "visual.color_red",    bg: "#E74C3C", text: "#fff" },
  { id: "blue",   labelKey: "visual.color_blue",   bg: "#3498DB", text: "#fff" },
  { id: "green",  labelKey: "visual.color_green",  bg: "#27AE60", text: "#fff" },
  { id: "purple", labelKey: "visual.color_purple", bg: "#9B59B6", text: "#fff" },
  { id: "orange", labelKey: "visual.color_orange", bg: "#E67E22", text: "#fff" },
  { id: "teal",   labelKey: "visual.color_teal",   bg: "#1ABC9C", text: "#fff" },
];

// ── Tipos de visuales con metadatos ──────────────────────────────
const VISUAL_KINDS: { kind: VisualKind; icon: string; labelKey: string; descKey: string }[] = [
  { kind: "venn_euler",     icon: "⬤⬤", labelKey: "visual.kind_venn", descKey: "visual.kind_venn_desc" },
  { kind: "flow_diagram",   icon: "→",   labelKey: "visual.kind_flow", descKey: "visual.kind_flow_desc" },
  { kind: "timeline",       icon: "──",  labelKey: "visual.kind_timeline", descKey: "visual.kind_timeline_desc" },
  { kind: "chem_reaction",  icon: "⇌",   labelKey: "visual.kind_chem_reaction", descKey: "visual.kind_chem_reaction_desc" },
  { kind: "molecule",       icon: "⬡",   labelKey: "visual.kind_molecule", descKey: "visual.kind_molecule_desc" },
  { kind: "circuit",        icon: "⚡",  labelKey: "visual.kind_circuit", descKey: "visual.kind_circuit_desc" },
  { kind: "feynman",        icon: "∿",   labelKey: "visual.kind_feynman", descKey: "visual.kind_feynman_desc" },
  { kind: "bio_pathway",    icon: "⟳",   labelKey: "visual.kind_bio_pathway", descKey: "visual.kind_bio_pathway_desc" },
  { kind: "music_fragment", icon: "♩",   labelKey: "visual.kind_music", descKey: "visual.kind_music_desc" },
];

// ── Defaults por tipo ─────────────────────────────────────────────
function defaultConfig(kind: VisualKind): VisualConfig {
  switch (kind) {
    case "venn_euler":    return { kind, sets: [{ label: "Conjunto A", color: "red" }, { label: "Conjunto B", color: "blue" }, { label: "Conjunto C", color: "green" }], intersections: {} };
    case "flow_diagram":  return { kind, nodes: [{ id: "start", label: "Inicio", shape: "rounded" }, { id: "process", label: "Proceso", shape: "rect" }, { id: "end", label: "Fin", shape: "rounded" }], edges: [], orientation: "vertical" };
    case "timeline":      return { kind, events: [{ date: "2020", title: "Evento 1" }, { date: "2022", title: "Evento 2" }, { date: "2024", title: "Evento 3" }], orientation: "horizontal", accent_color: "blue" };
    case "chem_reaction": return { kind, equation: "H2 + O2 -> H2O", reaction_type: "forward", display_mode: true };
    case "molecule":      return { kind, preset: "benzene", scale: 1.0 };
    case "circuit":       return { kind, preset: "rc_series", component_values: { R: "1\\,k\\Omega", C: "10\\,\\mu F", V: "5\\,V" } };
    case "feynman":       return { kind, preset: "compton" };
    case "bio_pathway":   return { kind, preset: "krebs_cycle", show_cofactors: true };
    case "music_fragment":return { kind, abc_notation: "X:1\nT:Escala Do mayor\nM:4/4\nK:C\nCDEFGABC'|", try_musixtex: true };
  }
}

// ── Componente principal ──────────────────────────────────────────

export function VisualBlockEditor({
  block, onChange, onBlur,
}: {
  block: VisualBlock;
  onChange: (updates: Partial<VisualBlock>) => void;
  onBlur?: () => void;
}) {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} onBlur={onBlur}>
      {/* Selector de tipo (solo si es nuevo / se puede cambiar) */}
      <KindBanner kind={block.config.kind} />

      {/* Caption y label */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>{t("block_editor.caption_with_latex_name")}</label>
          <input type="text" value={block.caption}
            onChange={e => onChange({ caption: e.target.value })}
            placeholder={t("visual.caption_placeholder")}
            style={inputStyle} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>{t("visual.label_ref")}</label>
          <input type="text" value={block.label}
            onChange={e => onChange({ label: e.target.value })}
            placeholder="fig:mi-diagrama"
            style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12 }} />
        </div>
      </div>

      {/* Previsualización SVG */}
      <div style={{
        border: "1px solid var(--border-soft)", borderRadius: "var(--r-md)",
        background: "var(--bg-paper)", padding: 16,
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: 180, overflow: "hidden",
      }}>
        <VisualPreview config={block.config} />
      </div>

      {/* Editor específico por tipo */}
      <ConfigEditor config={block.config} onChange={cfg => onChange({ config: cfg })} />

      {/* Override avanzado */}
      <button className="btn btn-ghost btn-sm" onClick={() => setShowAdvanced(v => !v)}
        style={{ fontSize: "var(--fs-xs)", alignSelf: "flex-start", color: "var(--fg-faint)" }}>
        {showAdvanced ? t("visual.hide_advanced_latex") : t("visual.show_advanced_latex")}
      </button>
      {showAdvanced && (
        <AdvancedOverridePanel block={block} onChange={onChange} />
      )}
    </div>
  );
}

// ── Selector de tipo de diagrama ──────────────────────────────────

export function VisualKindSelector({ onSelect }: { onSelect: (kind: VisualKind) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {t("visual.kind_selector_title")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {VISUAL_KINDS.map(({ kind, icon, labelKey, descKey }) => (
          <button key={kind} onClick={() => onSelect(kind)}
            style={{
              padding: "10px 12px", borderRadius: "var(--r-md)",
              border: "1px solid var(--border-firm)", background: "var(--bg-panel)",
              cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 4,
              transition: "border-color 0.15s, background 0.15s",
            }}
            className="tx-card-action"
          >
            <span style={{ fontSize: 22 }}>{icon}</span>
            <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>{t(labelKey)}</span>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", lineHeight: 1.4 }}>{t(descKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Banner del tipo activo ────────────────────────────────────────

function KindBanner({ kind }: { kind: VisualKind }) {
  const { t } = useTranslation();
  const meta = VISUAL_KINDS.find(k => k.kind === kind);
  if (!meta) return null;
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "center",
      padding: "8px 12px", borderRadius: "var(--r-sm)",
      background: "var(--accent-tint)", border: "1px solid var(--accent-soft)",
    }}>
      <span style={{ fontSize: 20 }}>{meta.icon}</span>
      <div>
        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--accent-deep)" }}>{t(meta.labelKey)}</div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>{t(meta.descKey)}</div>
      </div>
    </div>
  );
}

// ── Editor de configuración por tipo ─────────────────────────────

function ConfigEditor({ config, onChange }: { config: VisualConfig; onChange: (c: VisualConfig) => void }) {
  switch (config.kind) {
    case "venn_euler":    return <VennEditor    config={config} onChange={onChange} />;
    case "flow_diagram":  return <FlowEditor    config={config} onChange={onChange} />;
    case "timeline":      return <TimelineEditor config={config} onChange={onChange} />;
    case "chem_reaction": return <ChemReactionEditor config={config} onChange={onChange} />;
    case "molecule":      return <MoleculeEditor config={config} onChange={onChange} />;
    case "circuit":       return <PresetEditor   config={config} onChange={onChange} presets={[...PRESETS.circuit]} kindLabel="circuito" />;
    case "feynman":       return <PresetEditor   config={config} onChange={onChange} presets={[...PRESETS.feynman]} kindLabel="diagrama" />;
    case "bio_pathway":   return <BioPathwayEditor config={config} onChange={onChange} />;
    case "music_fragment":return <MusicEditor   config={config} onChange={onChange} />;
    default:              return null;
  }
}

// ── Editor Venn ───────────────────────────────────────────────────

function VennEditor({ config, onChange }: { config: Extract<VisualConfig, { kind: "venn_euler" }>; onChange: (c: VisualConfig) => void }) {
  const { t } = useTranslation();
  const sets = config.sets ?? [];

  function updateSet(i: number, patch: Partial<VennSet>) {
    const newSets = sets.map((s, j) => j === i ? { ...s, ...patch } : s);
    onChange({ ...config, sets: newSets });
  }
  function addSet() {
    if (sets.length >= 4) return;
    const colors = ["red","blue","green","purple"];
    onChange({ ...config, sets: [...sets, { label: t("visual.default_set", { letter: String.fromCharCode(65+sets.length) }), color: colors[sets.length] ?? "teal" }] });
  }
  function removeSet(i: number) {
    onChange({ ...config, sets: sets.filter((_, j) => j !== i) });
  }
  function setIntersection(key: string, value: string) {
    onChange({ ...config, intersections: { ...config.intersections, [key]: value } });
  }

  // Claves de intersecciones según número de conjuntos
  const interKeys = sets.length === 2 ? [["01","A ∩ B"]]
    : sets.length >= 3 ? [["01","A ∩ B"],["02","A ∩ C"],["12","B ∩ C"],["012","A ∩ B ∩ C"]]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionLabel label={t("visual.sets")} />
      {sets.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ColorPicker value={s.color} onChange={color => updateSet(i, { color })} />
          <input type="text" value={s.label} placeholder={t("visual.default_set", { letter: String.fromCharCode(65+i) })}
            onChange={e => updateSet(i, { label: e.target.value })}
            style={{ ...inputStyle, flex: 1 }} />
          {sets.length > 2 && (
            <button className="btn btn-ghost btn-icon" onClick={() => removeSet(i)}>
              <IconX size={11} />
            </button>
          )}
        </div>
      ))}
      {sets.length < 4 && (
        <button className="btn btn-ghost btn-sm" onClick={addSet}
          style={{ alignSelf: "flex-start", fontSize: "var(--fs-xs)" }}>
          + {t("visual.add_set")}
        </button>
      )}

      {interKeys.length > 0 && (
        <>
          <SectionLabel label={t("visual.intersection_labels_optional")} />
          {interKeys.map(([key, label]) => (
            <div key={key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", width: 60, flexShrink: 0 }}>{label}</span>
              <input type="text" value={config.intersections?.[key] ?? ""}
                onChange={e => setIntersection(key, e.target.value)}
                placeholder={t("visual.label_placeholder")}
                style={{ ...inputStyle, flex: 1 }} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Editor Flow ───────────────────────────────────────────────────

function FlowEditor({ config, onChange }: { config: Extract<VisualConfig, { kind: "flow_diagram" }>; onChange: (c: VisualConfig) => void }) {
  const { t } = useTranslation();
  const nodes = config.nodes ?? [];

  function addNode() {
    const id = `n${Date.now()}`;
    onChange({ ...config, nodes: [...nodes, { id, label: t("visual.new_node"), shape: "rect", color: "blue" }] });
  }
  function updateNode(i: number, patch: Partial<FlowNode>) {
    onChange({ ...config, nodes: nodes.map((n, j) => j === i ? { ...n, ...patch } : n) });
  }
  function removeNode(i: number) {
    const removedId = nodes[i].id;
    onChange({
      ...config,
      nodes: nodes.filter((_, j) => j !== i),
      edges: (config.edges ?? []).filter(e => e.from !== removedId && e.to !== removedId),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>{t("visual.orientation")}</label>
          <select value={config.orientation ?? "vertical"} onChange={e => onChange({ ...config, orientation: e.target.value })} style={inputStyle}>
            <option value="vertical">{t("visual.vertical")} (↓)</option>
            <option value="horizontal">{t("visual.horizontal")} (→)</option>
          </select>
        </div>
      </div>
      <SectionLabel label={t("visual.flow_nodes")} />
      {nodes.map((n, i) => (
        <div key={n.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", width: 18, textAlign: "center" }}>{i+1}</span>
          <input type="text" value={n.label} onChange={e => updateNode(i, { label: e.target.value })}
            placeholder={t("visual.node_label_placeholder")} style={{ ...inputStyle, flex: 2 }} />
          <select value={n.shape ?? "rect"} onChange={e => updateNode(i, { shape: e.target.value })}
            style={{ ...inputStyle, flex: 1 }}>
            <option value="rect">{t("visual.shape_rect")}</option>
            <option value="diamond">{t("visual.shape_diamond")}</option>
            <option value="circle">{t("visual.shape_circle")}</option>
            <option value="rounded">{t("visual.shape_rounded")}</option>
          </select>
          <button className="btn btn-ghost btn-icon" onClick={() => removeNode(i)}><IconX size={11} /></button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={addNode}
        style={{ alignSelf: "flex-start", fontSize: "var(--fs-xs)" }}>
        + {t("visual.add_node")}
      </button>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
        {t("visual.flow_hint")}
      </div>
    </div>
  );
}

// ── Editor Timeline ───────────────────────────────────────────────

function TimelineEditor({ config, onChange }: { config: Extract<VisualConfig, { kind: "timeline" }>; onChange: (c: VisualConfig) => void }) {
  const { t } = useTranslation();
  const events = config.events ?? [];

  function addEvent() {
    onChange({ ...config, events: [...events, { date: "", title: t("visual.new_event"), description: "" }] });
  }
  function updateEvent(i: number, patch: Partial<TimelineEvent>) {
    onChange({ ...config, events: events.map((e, j) => j === i ? { ...e, ...patch } : e) });
  }
  function removeEvent(i: number) {
    onChange({ ...config, events: events.filter((_, j) => j !== i) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>{t("visual.orientation")}</label>
          <select value={config.orientation ?? "horizontal"} onChange={e => onChange({ ...config, orientation: e.target.value })} style={inputStyle}>
            <option value="horizontal">{t("visual.horizontal")} (→)</option>
            <option value="vertical">{t("visual.vertical")} (↓)</option>
          </select>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>{t("visual.color")}</label>
          <ColorPicker value={config.accent_color ?? "blue"} onChange={accent_color => onChange({ ...config, accent_color })} />
        </div>
      </div>
      <SectionLabel label={t("visual.events")} />
      {events.map((ev, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", background: "var(--bg-surface)", padding: "8px", borderRadius: "var(--r-sm)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" value={ev.date} onChange={e => updateEvent(i, { date: e.target.value })}
                placeholder={t("visual.date_placeholder")} style={{ ...inputStyle, width: 100, flexShrink: 0 }} />
              <input type="text" value={ev.title} onChange={e => updateEvent(i, { title: e.target.value })}
                placeholder={t("visual.event_title_placeholder")} style={{ ...inputStyle, flex: 1 }} />
            </div>
            <input type="text" value={ev.description ?? ""} onChange={e => updateEvent(i, { description: e.target.value })}
              placeholder={t("visual.event_description_placeholder")} style={{ ...inputStyle, fontSize: 12 }} />
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => removeEvent(i)}><IconX size={11} /></button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={addEvent}
        style={{ alignSelf: "flex-start", fontSize: "var(--fs-xs)" }}>
        + {t("visual.add_event")}
      </button>
    </div>
  );
}

// ── Editor Reacción Química ───────────────────────────────────────

function ChemReactionEditor({ config, onChange }: { config: Extract<VisualConfig, { kind: "chem_reaction" }>; onChange: (c: VisualConfig) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={labelStyle}>{t("visual.chemical_equation")} <span style={{ fontWeight: 400, color: "var(--fg-faint)" }}>({t("visual.mhchem_notation")})</span></label>
        <input type="text" value={config.equation}
          onChange={e => onChange({ ...config, equation: e.target.value })}
          placeholder="H2 + O2 -> H2O  |  N2 + 3H2 <=> 2NH3  |  CaCO3 -> CaO + CO2 ^"
          style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 13 }} />
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
          {t("visual.chemical_syntax_hint")}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={labelStyle}>{t("visual.catalyst_condition")}</label>
          <input type="text" value={config.catalyst ?? ""} onChange={e => onChange({ ...config, catalyst: e.target.value || undefined })}
            placeholder="Fe, Δ, hν, H⁺…" style={inputStyle} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={labelStyle}>{t("visual.lower_condition")}</label>
          <input type="text" value={config.conditions ?? ""} onChange={e => onChange({ ...config, conditions: e.target.value || undefined })}
            placeholder="400°C, 200 atm…" style={inputStyle} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>{t("visual.type")}</label>
          <select value={config.reaction_type ?? "forward"} onChange={e => onChange({ ...config, reaction_type: e.target.value })} style={inputStyle}>
            <option value="forward">→ {t("visual.reaction_forward")}</option>
            <option value="equilibrium">⇌ {t("visual.reaction_equilibrium")}</option>
            <option value="resonance">↔ {t("visual.reaction_resonance")}</option>
            <option value="backward">← {t("visual.reaction_backward")}</option>
          </select>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>{t("visual.mode")}</label>
          <select value={config.display_mode ? "display" : "inline"} onChange={e => onChange({ ...config, display_mode: e.target.value === "display" })} style={inputStyle}>
            <option value="display">{t("visual.display_block")}</option>
            <option value="inline">{t("visual.inline_paragraph")}</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Editor Molécula ───────────────────────────────────────────────

function MoleculeEditor({ config, onChange }: { config: Extract<VisualConfig, { kind: "molecule" }>; onChange: (c: VisualConfig) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"preset" | "custom">(config.chemfig_formula ? "custom" : "preset");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 0, borderRadius: "var(--r-sm)", overflow: "hidden", border: "1px solid var(--border-firm)" }}>
        {(["preset","custom"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{ flex: 1, padding: "6px", fontSize: "var(--fs-xs)", fontWeight: mode === m ? 600 : 400,
              background: mode === m ? "var(--accent-tint)" : "var(--bg-panel)", color: mode === m ? "var(--accent-deep)" : "var(--fg-muted)", border: "none", cursor: "pointer" }}>
            {m === "preset" ? t("visual.preset_mode") : t("visual.chemfig_formula_mode")}
          </button>
        ))}
      </div>
      {mode === "preset" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {PRESETS.molecule.map(p => (
            <button key={p.id} onClick={() => onChange({ ...config, preset: p.id, chemfig_formula: undefined })}
              style={{
                padding: "8px 10px", borderRadius: "var(--r-sm)",
                border: `1px solid ${config.preset === p.id ? "var(--accent)" : "var(--border-firm)"}`,
                background: config.preset === p.id ? "var(--accent-tint)" : "var(--bg-panel)",
                color: config.preset === p.id ? "var(--accent-deep)" : "var(--fg-default)",
                fontSize: "var(--fs-xs)", cursor: "pointer", textAlign: "left",
              }}>
              {p.name}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>{t("visual.chemfig_formula")}</label>
          <input type="text" value={config.chemfig_formula ?? ""}
            onChange={e => onChange({ ...config, chemfig_formula: e.target.value || undefined, preset: undefined })}
            placeholder={t("visual.chemfig_placeholder")}
            style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12 }} />
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)" }}>
            {t("visual.chemfig_hint")}
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={labelStyle}>{t("visual.scale")} — {config.scale?.toFixed(1) ?? "1.0"}×</label>
        <input type="range" min={0.5} max={2.0} step={0.1} value={config.scale ?? 1.0}
          onChange={e => onChange({ ...config, scale: parseFloat(e.target.value) })}
          style={{ accentColor: "var(--accent)" }} />
      </div>
    </div>
  );
}

// ── Editor genérico de presets ────────────────────────────────────

function PresetEditor<C extends { kind: VisualKind; preset: string }>({
  config, onChange, presets, kindLabel,
}: { config: C; onChange: (c: VisualConfig) => void; presets: { id: string; name: string }[]; kindLabel: string }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionLabel label={t("visual.preset_type", { kind: kindLabel })} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {presets.map(p => (
          <button key={p.id} onClick={() => onChange({ ...config, preset: p.id } as VisualConfig)}
            style={{
              padding: "10px 14px", borderRadius: "var(--r-sm)", textAlign: "left",
              border: `1px solid ${config.preset === p.id ? "var(--accent)" : "var(--border-firm)"}`,
              background: config.preset === p.id ? "var(--accent-tint)" : "var(--bg-panel)",
              color: config.preset === p.id ? "var(--accent-deep)" : "var(--fg-default)",
              fontSize: "var(--fs-sm)", cursor: "pointer",
            }}>
            {config.preset === p.id && "✓ "}{p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Editor Bio Pathway ────────────────────────────────────────────

function BioPathwayEditor({ config, onChange }: { config: Extract<VisualConfig, { kind: "bio_pathway" }>; onChange: (c: VisualConfig) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <PresetEditor config={config} onChange={onChange} presets={[...PRESETS.bio_pathway]} kindLabel={t("visual.bio_pathway_lower")} />
      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
        <input type="checkbox" checked={config.show_cofactors !== false}
          onChange={e => onChange({ ...config, show_cofactors: e.target.checked })}
          style={{ accentColor: "var(--accent)" }} />
        <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)" }}>
          {t("visual.show_cofactors")}
        </span>
      </label>
    </div>
  );
}

// ── Editor Música ─────────────────────────────────────────────────

function MusicEditor({ config, onChange }: { config: Extract<VisualConfig, { kind: "music_fragment" }>; onChange: (c: VisualConfig) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--accent-tint)", border: "1px solid var(--accent-soft)", fontSize: "var(--fs-xs)", color: "var(--accent-deep)", lineHeight: 1.5 }}>
        💡 {t("visual.abc_hint")} <code>X:1 | T:{t("editor.meta_title")} | M:4/4 | K:C | CDEFGABC|</code>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={labelStyle}>{t("visual.abc_notation")}</label>
        <textarea value={config.abc_notation}
          onChange={e => onChange({ ...config, abc_notation: e.target.value })}
          rows={5}
          placeholder={"X:1\nT:Escala de Do mayor\nM:4/4\nK:C\nCDEFGABC'|\n"}
          style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 12, resize: "vertical" }} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={labelStyle}>{t("visual.instrument_caption")}</label>
          <input type="text" value={config.instrument ?? ""} onChange={e => onChange({ ...config, instrument: e.target.value || undefined })}
            placeholder={t("visual.instrument_placeholder")} style={inputStyle} />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", flexShrink: 0 }}>
          <input type="checkbox" checked={config.try_musixtex !== false}
            onChange={e => onChange({ ...config, try_musixtex: e.target.checked })}
            style={{ accentColor: "var(--accent)" }} />
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>{t("visual.generate_with_musixtex")}</span>
        </label>
      </div>
    </div>
  );
}

// ── Override avanzado ─────────────────────────────────────────────

function AdvancedOverridePanel({ block, onChange }: { block: VisualBlock; onChange: (u: Partial<VisualBlock>) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: "var(--bg-sunken)", borderRadius: "var(--r-sm)", border: "1px solid var(--border-firm)" }}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5 }}>
        <strong>{t("visual.advanced_mode")}</strong> — {t("visual.advanced_mode_body")}
      </div>
      <textarea rows={6}
        value={block.advanced_latex_override ?? ""}
        onChange={e => onChange({ advanced_latex_override: e.target.value || undefined })}
        placeholder={t("visual.advanced_placeholder")}
        style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: 11, resize: "vertical" }} />
      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
        <input type="checkbox" checked={!!block.advanced_override_confirmed}
          onChange={e => onChange({ advanced_override_confirmed: e.target.checked })}
          style={{ accentColor: "var(--accent)" }} />
        <span style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)" }}>
          {t("visual.use_override")}
        </span>
      </label>
    </div>
  );
}

// ── SVG Preview ───────────────────────────────────────────────────

function VisualPreview({ config }: { config: VisualConfig }) {
  const { t } = useTranslation();
  switch (config.kind) {
    case "venn_euler":    return <VennSVG    config={config} />;
    case "flow_diagram":  return <FlowSVG    config={config} />;
    case "timeline":      return <TimelineSVG config={config} />;
    case "chem_reaction": return <ChemReactionPreview config={config} />;
    case "molecule":      return <MoleculePreview config={config} />;
    case "circuit":       return <GenericPreview icon="⚡" label={PRESETS.circuit.find(p => p.id === config.preset)?.name ?? config.preset} />;
    case "feynman":       return <GenericPreview icon="∿" label={PRESETS.feynman.find(p => p.id === config.preset)?.name ?? config.preset} />;
    case "bio_pathway":   return <GenericPreview icon="⟳" label={PRESETS.bio_pathway.find(p => p.id === config.preset)?.name ?? config.preset} />;
    case "music_fragment":return <GenericPreview icon="♩" label={t("visual.music_renders_on_compile")} />;
    default:              return <GenericPreview icon="📊" label={t("visual.preview_unavailable")} />;
  }
}

function GenericPreview({ icon, label }: { icon: string; label: string }) {
  const { t } = useTranslation();
  return (
    <div style={{ textAlign: "center", color: "var(--fg-faint)", display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
      <span style={{ fontSize: 40 }}>{icon}</span>
      <span style={{ fontSize: "var(--fs-xs)", maxWidth: 200, lineHeight: 1.4 }}>{label}</span>
      <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t("visual.preview_available_on_compile")}</span>
    </div>
  );
}

// ── SVG Venn ──────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  red: "#E74C3C", blue: "#3498DB", green: "#27AE60",
  purple: "#9B59B6", orange: "#E67E22", teal: "#1ABC9C",
};
function toColor(c: string) { return COLOR_MAP[c] ?? c; }

function VennSVG({ config }: { config: Extract<VisualConfig, { kind: "venn_euler" }> }) {
  const sets = config.sets ?? [];
  const W = 260, H = 180, cx = W/2, cy = H/2, r = 65;
  const n = Math.min(sets.length, 4);

  if (n === 2) {
    const c0 = toColor(sets[0]?.color ?? "red");
    const c1 = toColor(sets[1]?.color ?? "blue");
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%" }}>
        <circle cx={cx-35} cy={cy} r={r} fill={c0} fillOpacity={0.3} stroke={c0} strokeWidth={1.5} />
        <circle cx={cx+35} cy={cy} r={r} fill={c1} fillOpacity={0.3} stroke={c1} strokeWidth={1.5} />
        <text x={cx-70} y={cy} textAnchor="middle" fontSize={11} fontWeight="bold" fill={c0}>{sets[0]?.label}</text>
        <text x={cx+70} y={cy} textAnchor="middle" fontSize={11} fontWeight="bold" fill={c1}>{sets[1]?.label}</text>
        <text x={cx} y={cy+4} textAnchor="middle" fontSize={9} fill="#555">{config.intersections?.["01"] ?? ""}</text>
      </svg>
    );
  }

  // 3 sets
  const pos3 = [ [cx, cy-45], [cx-40, cy+25], [cx+40, cy+25] ];
  const colors3 = sets.slice(0,3).map(s => toColor(s?.color ?? "blue"));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%" }}>
      {pos3.map(([x,y], i) => (
        <circle key={i} cx={x} cy={y} r={r*0.85} fill={colors3[i]} fillOpacity={0.28} stroke={colors3[i]} strokeWidth={1.5} />
      ))}
      <text x={cx}    y={16}    textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors3[0]}>{sets[0]?.label}</text>
      <text x={cx-80} y={cy+50} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors3[1]}>{sets[1]?.label}</text>
      <text x={cx+80} y={cy+50} textAnchor="middle" fontSize={10} fontWeight="bold" fill={colors3[2]}>{sets[2]?.label}</text>
      <text x={cx}    y={cy+4}  textAnchor="middle" fontSize={8} fill="#444">{config.intersections?.["012"] ?? ""}</text>
    </svg>
  );
}

// ── SVG Flow ──────────────────────────────────────────────────────

function FlowSVG({ config }: { config: Extract<VisualConfig, { kind: "flow_diagram" }> }) {
  const nodes = config.nodes ?? [];
  const vertical = config.orientation !== "horizontal";
  const nodeW = 90, nodeH = 28, gap = 50;
  const W = vertical ? 200 : nodes.length * (nodeW + gap) + 20;
  const H = vertical ? nodes.length * (nodeH + gap) + 20 : 120;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%", maxHeight: 200 }}>
      {nodes.map((n, i) => {
        const x = vertical ? W/2 - nodeW/2 : 10 + i * (nodeW + gap);
        const y = vertical ? 10 + i * (nodeH + gap) : H/2 - nodeH/2;
        const color = "#3498DB";
        return (
          <g key={n.id}>
            {n.shape === "diamond" ? (
              <polygon points={`${x+nodeW/2},${y} ${x+nodeW},${y+nodeH/2} ${x+nodeW/2},${y+nodeH} ${x},${y+nodeH/2}`}
                fill="#FFF3CD" stroke="#E67E22" strokeWidth={1.2} />
            ) : (
              <rect x={x} y={y} width={nodeW} height={nodeH} rx={n.shape === "rounded" ? 10 : 4}
                fill="#D6EAF8" stroke={color} strokeWidth={1.2} />
            )}
            <text x={x+nodeW/2} y={y+nodeH/2+4} textAnchor="middle" fontSize={9} fill="#1A252F">{n.label.slice(0,15)}</text>
            {i > 0 && (
              vertical
                ? <line x1={x+nodeW/2} y1={y-(gap)} x2={x+nodeW/2} y2={y} stroke={color} strokeWidth={1.2} markerEnd="url(#arrow)" />
                : <line x1={x-gap} y1={H/2} x2={x} y2={H/2} stroke={color} strokeWidth={1.2} markerEnd="url(#arrow)" />
            )}
          </g>
        );
      })}
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#3498DB" />
        </marker>
      </defs>
    </svg>
  );
}

// ── SVG Timeline ──────────────────────────────────────────────────

function TimelineSVG({ config }: { config: Extract<VisualConfig, { kind: "timeline" }> }) {
  const { t } = useTranslation();
  const events = config.events ?? [];
  const color = toColor(config.accent_color ?? "blue");
  const W = 280, H = 100;
  if (events.length === 0) return <GenericPreview icon="──" label={t("visual.add_events")} />;
  const step = (W - 30) / Math.max(events.length, 1);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ maxWidth: "100%" }}>
      <line x1={15} y1={H/2} x2={W-15} y2={H/2} stroke={color} strokeWidth={2} />
      <polygon points={`${W-10},${H/2-4} ${W},${H/2} ${W-10},${H/2+4}`} fill={color} />
      {events.map((ev, i) => {
        const x = 15 + i * step + step/2;
        const above = i % 2 === 0;
        return (
          <g key={i}>
            <circle cx={x} cy={H/2} r={4} fill={color} />
            <line x1={x} y1={above ? H/2-4 : H/2+4} x2={x} y2={above ? H/2-18 : H/2+18} stroke={color} strokeWidth={1} />
            <text x={x} y={above ? H/2-22 : H/2+26} textAnchor="middle" fontSize={8} fontWeight="bold" fill={color}>{ev.title.slice(0,12)}</text>
            <text x={x} y={above ? H/2-12 : H/2+35} textAnchor="middle" fontSize={7} fill="#888">{ev.date}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Preview Reacción ──────────────────────────────────────────────

function ChemReactionPreview({ config }: { config: Extract<VisualConfig, { kind: "chem_reaction" }> }) {
  const { t } = useTranslation();
  const arrow = config.reaction_type === "equilibrium" ? "⇌"
    : config.reaction_type === "resonance" ? "↔"
    : config.reaction_type === "backward" ? "←" : "→";
  // Mostrar la ecuación limpia sin notación mhchem
  const eq = config.equation
    .replace("->", ` ${arrow} `).replace("<=>", ` ${arrow} `).replace("<->", ` ${arrow} `);
  return (
    <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--fg-strong)", padding: 16, background: "var(--bg-surface)", borderRadius: "var(--r-sm)", border: "1px solid var(--border-subtle)", maxWidth: "100%", wordBreak: "break-all" }}>
      {eq || t("visual.empty_equation")}
      {(config.catalyst || config.conditions) && (
        <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 4 }}>
          {config.catalyst ? `↑ ${config.catalyst}` : ""} {config.conditions ? `↓ ${config.conditions}` : ""}
        </div>
      )}
    </div>
  );
}

// ── Preview Molécula ──────────────────────────────────────────────

function MoleculePreview({ config }: { config: Extract<VisualConfig, { kind: "molecule" }> }) {
  const { t } = useTranslation();
  const preset = PRESETS.molecule.find(p => p.id === config.preset);
  const icons: Record<string, string> = {
    benzene: "⬡", water: "💧", co2: "🌫", ethanol: "🍷", glucose: "🍬",
    aspirin: "💊", nacl: "🧂", methane: "⛽",
  };
  const icon = config.preset ? (icons[config.preset] ?? "⚗️") : "⚗️";
  const name = preset?.name ?? config.chemfig_formula ?? t("visual.custom_molecule");
  return (
    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 44 }}>{icon}</span>
      <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--fg-strong)" }}>{name}</span>
      <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t("visual.molecule_compile_hint")}</span>
    </div>
  );
}

// ── Utilidades UI ─────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {COLORS.map(c => (
        <button key={c.id} title={t(c.labelKey)} onClick={() => onChange(c.id)}
          style={{
            width: 22, height: 22, borderRadius: "50%", background: c.bg, border: `2px solid ${value === c.id ? "#fff" : "transparent"}`,
            outline: value === c.id ? `2px solid ${c.bg}` : "none",
            cursor: "pointer", flexShrink: 0,
          }} />
      ))}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-faint)", marginTop: 4 }}>
      {label}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "var(--fs-xs)", color: "var(--fg-muted)", fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: "6px 8px", borderRadius: "var(--r-sm)",
  border: "1px solid var(--border-firm)", background: "var(--bg-surface)",
  color: "var(--fg-strong)", fontSize: "var(--fs-sm)", outline: "none", width: "100%", boxSizing: "border-box",
};

// ── Exports adicionales ───────────────────────────────────────────

export { defaultConfig };
