import { AppDialog } from "./AppDialog";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
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
  return (
    <AppDialog
      title={title}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className="btn btn-sm"
            onClick={onConfirm}
            disabled={busy}
            style={destructive ? { color: "#fff", background: "var(--build-err)", border: "none" } : undefined}
          >
            {busy ? "Trabajando..." : confirmLabel}
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
