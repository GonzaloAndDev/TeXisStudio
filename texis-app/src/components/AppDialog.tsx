import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { lockScroll } from "../lib/scrollLock";
import { isTopmostDialog, popDialog, pushDialog } from "../lib/dialogStack";
import { IconX } from "./Icons";

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function trapFocus(container: HTMLElement, e: KeyboardEvent) {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.key === "Tab") {
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
}

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
  const { t } = useTranslation();
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement;
    // Register with the dialog stack so Escape / focus only act on the
    // topmost modal. Without this, opening a ConfirmDialog inside an
    // AppDialog and pressing Esc closed BOTH because each listener fired.
    const stackId = pushDialog();

    // Move focus into dialog
    const container = containerRef.current;
    if (container) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      first ? first.focus() : container.focus();
    }

    function onKeyDown(e: KeyboardEvent) {
      // Topmost-only: a deeper dialog above us owns the keyboard until it closes.
      if (!isTopmostDialog(stackId)) return;
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (containerRef.current) trapFocus(containerRef.current, e);
    }

    document.addEventListener("keydown", onKeyDown);
    const unlockScroll = lockScroll();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockScroll();
      popDialog(stackId);
      // Restore focus to trigger — guard against the trigger having been
      // unmounted while we were open (calling .focus() on a detached node
      // is a silent no-op that leaves the page focus on <body>).
      const trigger = triggerRef.current as HTMLElement | null;
      if (trigger && typeof trigger.focus === "function" && trigger.isConnected) {
        trigger.focus();
      }
    };
  }, [onClose]);

  return (
    <div
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          width,
          maxWidth: "100%",
          maxHeight: "86vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-firm)",
          borderRadius: "var(--r-lg)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
          overflow: "hidden",
          outline: "none",
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
            <div id={titleId} style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--fg-strong)" }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--fg-muted)", lineHeight: 1.5, marginTop: 3 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flexShrink: 0 }} aria-label={t("common.close")}>
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
