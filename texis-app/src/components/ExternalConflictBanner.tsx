import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/tauri";
import { useToast } from "./ui/ToastProvider";

interface Conflict {
  file: string;
  kind: string;
}

interface Props {
  projectPath: string | null;
}

export function ExternalConflictBanner({ projectPath }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!projectPath) { setConflicts([]); return; }
    let cancelled = false;
    api.detectBuildConflicts(projectPath)
      .then((list) => { if (!cancelled) setConflicts(list); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [projectPath]);

  const dismiss = useCallback(() => setConflicts([]), []);

  const handleKeep = useCallback(() => {
    dismiss();
  }, [dismiss]);

  const handleRegenerate = useCallback(async () => {
    if (!projectPath) return;
    setBusy(true);
    try {
      await api.forceRegenerateBuild(projectPath);
      toast.success(t("editor.conflict_regenerated"));
      dismiss();
    } catch {
      toast.error(t("editor.conflict_error"));
    } finally {
      setBusy(false);
    }
  }, [projectPath, toast, t, dismiss]);

  const handleSaveCopy = useCallback(async (file: string) => {
    if (!projectPath) return;
    setBusy(true);
    try {
      const result = await api.saveExternalCopyAndRegenerate(projectPath, file);
      toast.success(t("editor.conflict_copy_saved", { name: result.copy_saved_as }));
      dismiss();
    } catch {
      toast.error(t("editor.conflict_error"));
    } finally {
      setBusy(false);
    }
  }, [projectPath, toast, t, dismiss]);

  if (conflicts.length === 0) return null;

  return (
    <div
      role="alert"
      style={{
        background: "var(--color-warn-subtle, #fef9c3)",
        borderBottom: "1px solid var(--color-warn, #ca8a04)",
        padding: "8px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {conflicts.map((c) => (
        <div key={c.file} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", flex: 1, minWidth: 200 }}>
            ⚠ {t("editor.conflict_body", { file: c.file })}
          </span>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              className="btn btn-ghost btn-xs"
              onClick={handleKeep}
              disabled={busy}
            >
              {t("editor.conflict_keep")}
            </button>
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => void handleSaveCopy(c.file)}
              disabled={busy}
            >
              {t("editor.conflict_save_copy")}
            </button>
            <button
              className="btn btn-xs"
              onClick={() => void handleRegenerate()}
              disabled={busy}
              style={{ background: "var(--color-warn)", color: "#000" }}
            >
              {t("editor.conflict_regenerate")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
