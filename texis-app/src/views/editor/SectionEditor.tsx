import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppDialog } from "../../components/AppDialog";
import { STATUS_CONFIG } from "./BlockEditors";
import type { ProjectSection, SectionPlacement, SectionStatus } from "../../types";

interface Props {
  section: ProjectSection;
  localizedTitle: (s: { id: string; element_id: string; title?: string }) => string;
  userMode: "basic" | "advanced";
  onSave: (patch: Partial<ProjectSection>) => void;
  onClose: () => void;
}

const PLACEMENT_OPTIONS: Array<{ value: SectionPlacement; key: string }> = [
  { value: "front_matter", key: "editor.placement_front" },
  { value: "body",         key: "editor.placement_body" },
  { value: "back_matter",  key: "editor.placement_back" },
  { value: "appendix",     key: "editor.placement_appendix" },
];

export function SectionEditor({ section, localizedTitle, userMode, onSave, onClose }: Props) {
  const { t } = useTranslation();

  const [title,     setTitle]     = useState(section.title ?? "");
  const [status,    setStatus]    = useState<SectionStatus>(section.status ?? "draft");
  const [notes,     setNotes]     = useState(section.notes ?? "");
  const [placement, setPlacement] = useState<SectionPlacement>(section.placement);
  const [enabled,   setEnabled]   = useState(section.enabled);

  function handleSave() {
    onSave({
      title:     title.trim() || undefined,
      status,
      notes:     notes.trim() || undefined,
      placement,
      enabled,
    });
    onClose();
  }

  return (
    <AppDialog
      title={t("editor.tree_edit_details")}
      subtitle={localizedTitle(section)}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-sm" onClick={handleSave}>
            {t("editor.tree_edit_save")}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Título ────────────────────────────────────────────── */}
        <EditorField label={t("editor.tree_edit_field_title")}>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
            placeholder={localizedTitle(section)}
            style={{ width: "100%", fontSize: "var(--fs-sm)" }}
          />
        </EditorField>

        {/* ── Estado editorial ──────────────────────────────────── */}
        <EditorField label={t("editor.tree_edit_field_status")}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(Object.entries(STATUS_CONFIG) as [SectionStatus, typeof STATUS_CONFIG[SectionStatus]][]).map(([s, cfg]) => (
              <button
                key={s}
                type="button"
                className={`btn btn-sm ${status === s ? "btn-accent" : "btn-ghost"}`}
                style={{ padding: "4px 12px", fontSize: "var(--fs-xs)" }}
                onClick={() => setStatus(s)}
              >
                <span
                  aria-hidden
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: cfg.color, display: "inline-block", marginRight: 5,
                  }}
                />
                {t(cfg.labelKey as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </EditorField>

        {/* ── Visible ──────────────────────────────────────────── */}
        <EditorField label={t("editor.tree_edit_field_visible")}>
          <Toggle checked={enabled} onChange={setEnabled} />
        </EditorField>

        {/* ── Notas internas ───────────────────────────────────── */}
        <EditorField label={t("editor.tree_edit_field_notes")} hint={t("editor.tree_edit_field_notes_hint")}>
          <textarea
            className="input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("editor.tree_edit_notes_ph")}
            style={{
              width: "100%", fontSize: "var(--fs-sm)",
              resize: "vertical", fontFamily: "inherit", lineHeight: 1.55,
            }}
          />
        </EditorField>

        {/* ── Avanzado ─────────────────────────────────────────── */}
        {userMode === "advanced" && (
          <>
            <div style={{
              borderTop: "1px solid var(--border-subtle)", paddingTop: 16,
              fontSize: "var(--fs-xs)", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--fg-faint)",
            }}>
              {t("editor.tree_edit_advanced_section")}
            </div>

            <EditorField label={t("editor.tree_edit_field_placement")}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PLACEMENT_OPTIONS.map(({ value, key }) => (
                  <button
                    key={value}
                    type="button"
                    className={`btn btn-sm ${placement === value ? "btn-accent" : "btn-ghost"}`}
                    style={{ padding: "4px 12px", fontSize: "var(--fs-xs)" }}
                    onClick={() => setPlacement(value)}
                  >
                    {t(key as Parameters<typeof t>[0])}
                  </button>
                ))}
              </div>
            </EditorField>

            {section.required && (
              <div style={{
                padding: "8px 12px", background: "var(--bg-hover)",
                borderRadius: "var(--r-sm)", fontSize: "var(--fs-xs)",
                color: "var(--fg-muted)", lineHeight: 1.5,
              }}>
                {t("editor.tree_edit_required_info")}
              </div>
            )}
          </>
        )}
      </div>
    </AppDialog>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function EditorField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600, color: "var(--fg-muted)" }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: "var(--fg-faint)", marginLeft: 6 }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="tx-unstyled-button"
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? "var(--accent-deep)" : "var(--border-firm)",
        position: "relative", transition: "background 0.15s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2,
        left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        transition: "left 0.15s",
      }} />
    </button>
  );
}
