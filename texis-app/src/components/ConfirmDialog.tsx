import { useTranslation } from "react-i18next";
import { AppDialog } from "./AppDialog";

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const resolvedConfirm = confirmLabel ?? t("common.confirm");
  const resolvedCancel = cancelLabel ?? t("common.cancel");

  return (
    <AppDialog
      title={title}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            {resolvedCancel}
          </button>
          <button
            className="btn btn-sm"
            onClick={onConfirm}
            disabled={busy}
            style={destructive ? { color: "#fff", background: "var(--build-err)", border: "none" } : undefined}
          >
            {busy ? t("common.working") : resolvedConfirm}
          </button>
        </>
      }
    >
      <div style={{ fontSize: "var(--fs-sm)", color: "var(--fg-default)", lineHeight: 1.65 }}>
        {message}
      </div>
    </AppDialog>
  );
}
