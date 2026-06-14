import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppDialog } from "./AppDialog";
import { api } from "../lib/tauri";
import { useToast } from "./ui/ToastProvider";

interface Snapshot {
  filename: string;
  timestamp: string;
  label: string;
}

interface Props {
  projectPath: string;
  snapshots: Snapshot[];
  onClose: () => void;
  onRestored: (projectPath: string) => Promise<void>;
}

function formatSnapshotDate(timestamp: string): string {
  const ts = /^\d+$/.test(timestamp) ? parseInt(timestamp, 10) * 1000 : Date.parse(timestamp);
  if (isNaN(ts)) return timestamp;
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function CorruptProjectModal({ projectPath, snapshots, onClose, onRestored }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [restoring, setRestoring] = useState<string | null>(null);

  const handleRestore = useCallback(async (filename: string) => {
    setRestoring(filename);
    try {
      await api.restoreSnapshot(projectPath, filename);
      toast.success(t("home.corrupt_restored"));
      await onRestored(projectPath);
    } catch {
      toast.error(t("home.corrupt_restore_error"));
      setRestoring(null);
    }
  }, [projectPath, toast, t, onRestored]);

  const projectName = projectPath.split(/[\\/]/).pop() ?? projectPath;
  const displayedSnapshots = snapshots.slice(0, 5);

  return (
    <AppDialog
      title={t("home.corrupt_title")}
      subtitle={t("home.corrupt_subtitle", { project: projectName })}
      onClose={onClose}
      footer={
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          {t("home.corrupt_dismiss")}
        </button>
      }
    >
      {displayedSnapshots.length === 0 ? (
        <p style={{ fontSize: "var(--fs-sm)", color: "var(--fg-faint)", margin: 0 }}>
          {t("home.corrupt_no_snapshots")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayedSnapshots.map((snap) => (
            <div
              key={snap.filename}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, padding: "8px 12px",
                background: "var(--bg-surface)", borderRadius: "var(--r-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", fontWeight: 500 }}>
                  {formatSnapshotDate(snap.timestamp)}
                </div>
                {snap.label && (
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-faint)", marginTop: 2 }}>
                    {snap.label.replace(/-/g, " ")}
                  </div>
                )}
              </div>
              <button
                className="btn btn-accent btn-xs"
                disabled={restoring !== null}
                onClick={() => void handleRestore(snap.filename)}
                style={{ flexShrink: 0 }}
              >
                {restoring === snap.filename
                  ? t("home.corrupt_restoring")
                  : t("home.corrupt_restore")}
              </button>
            </div>
          ))}
        </div>
      )}
    </AppDialog>
  );
}
