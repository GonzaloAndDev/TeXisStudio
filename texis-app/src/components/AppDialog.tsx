import type { ReactNode } from "react";
import { IconX } from "./Icons";

export function AppDialog({
  title,
  subtitle,
  children,
  footer,
  width = 520,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width,
          maxWidth: "100%",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-base)",
          border: "1px solid var(--border-firm)",
          borderRadius: "var(--r-lg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--fg-strong)" }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5, marginTop: 3 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flexShrink: 0 }} aria-label="Cerrar">
            <IconX size={12} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 20 }} className="scroll">
          {children}
        </div>
        {footer && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              background: "var(--bg-panel)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
