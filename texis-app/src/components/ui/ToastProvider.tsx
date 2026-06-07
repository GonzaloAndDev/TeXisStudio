import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastAPI {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

const TYPE_COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "var(--build-ok-tint)", border: "var(--build-ok)", icon: "✓" },
  error:   { bg: "var(--build-err-tint)", border: "var(--build-err)", icon: "✕" },
  warning: { bg: "var(--build-warn-tint)", border: "var(--build-warn)", icon: "!" },
  info:    { bg: "var(--accent-tint)", border: "var(--accent-soft)", icon: "i" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const c = TYPE_COLORS[toast.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 14px",
        borderRadius: "var(--r-lg)",
        background: c.bg,
        border: `1px solid ${c.border}`,
        boxShadow: "var(--shadow-pop)",
        maxWidth: 360,
        fontSize: "var(--fs-sm)",
        color: "var(--fg-strong)",
        animation: "tx-toast-in .18s ease",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: "var(--fs-xs)",
          color: c.border,
          flexShrink: 0,
          marginTop: 1,
          width: 14,
          textAlign: "center",
        }}
      >
        {c.icon}
      </span>
      <span style={{ flex: 1, lineHeight: 1.5 }}>{toast.message}</span>
      <button
        type="button"
        aria-label="Cerrar notificación"
        onClick={() => onDismiss(toast.id)}
        style={{
          background: "transparent",
          border: 0,
          cursor: "pointer",
          padding: 0,
          color: "var(--fg-muted)",
          fontSize: 14,
          lineHeight: 1,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => {
      const next = [...prev, { id, type, message, duration }];
      return next.length > 5 ? next.slice(next.length - 5) : next;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const api: ToastAPI = {
    success: (msg, dur) => addToast("success", msg, dur),
    error:   (msg, dur) => addToast("error", msg, dur ?? 6000),
    warning: (msg, dur) => addToast("warning", msg, dur),
    info:    (msg, dur) => addToast("info", msg, dur),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <>
        <style>{`
          @keyframes tx-toast-in {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes tx-toast-in { from { opacity: 0; } to { opacity: 1; } }
          }
        `}</style>
        <div
          aria-label="Notificaciones"
          style={{
            position: "fixed",
            bottom: 40,
            right: 20,
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            pointerEvents: toasts.length ? "auto" : "none",
          }}
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      </>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
