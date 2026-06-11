import { useTranslation } from "react-i18next";
import { HelpLink } from "../help/HelpLink";
import type { HelpSection } from "../../stores/help";

interface Props {
  children: React.ReactNode;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRestore?: () => void;
  helpTopic?: HelpSection;
}

export function VisualEditorShell({
  children,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRestore,
  helpTopic = "figures",
}: Props) {
  const { t } = useTranslation();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <button
          className="btn btn-ghost btn-icon"
          onClick={onUndo}
          disabled={!canUndo}
          title={t("visual_editor.undo")}
          style={{ fontSize: 13, padding: "2px 6px" }}
        >
          ↩
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={onRedo}
          disabled={!canRedo}
          title={t("visual_editor.redo")}
          style={{ fontSize: 13, padding: "2px 6px" }}
        >
          ↪
        </button>
        {onRestore && (
          <>
            <div style={{ width: 1, height: 14, background: "var(--border-subtle)", margin: "0 2px" }} />
            <button
              className="btn btn-ghost btn-sm"
              onClick={onRestore}
              title={t("visual_editor.restore_title")}
              style={{ fontSize: "var(--fs-xs)", padding: "2px 8px" }}
            >
              {t("visual_editor.restore_btn")}
            </button>
          </>
        )}
        <div style={{ flex: 1 }} />
        <HelpLink topic={helpTopic} />
      </div>

      {/* Editor content */}
      {children}
    </div>
  );
}
