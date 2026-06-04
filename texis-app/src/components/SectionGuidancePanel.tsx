import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../stores/settings";

export function SectionGuidancePanel({ guidance }: { guidance?: string }) {
  const { t } = useTranslation();
  const { userMode } = useSettingsStore();
  const [open, setOpen] = useState(userMode === "basic");

  useEffect(() => {
    if (userMode === "basic") setOpen(true);
  }, [userMode]);

  if (!guidance) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--bg-subtle)",
          border: "1px solid var(--bg-paper-edge)",
          borderRadius: "var(--r-sm)",
          padding: "5px 10px",
          fontSize: "var(--fs-xs)",
          color: "var(--fg-muted)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}
      >
        <span style={{ fontSize: 12 }}>{open ? "▾" : "▸"}</span>
        {t("editor.section_guidance_label")}
      </button>
      {open && (
        <div
          style={{
            marginTop: 6,
            padding: "10px 14px",
            background: "var(--bg-subtle)",
            border: "1px solid var(--bg-paper-edge)",
            borderRadius: "var(--r-sm)",
            fontSize: "var(--fs-sm)",
            color: "var(--fg-muted)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {guidance}
        </div>
      )}
    </div>
  );
}
