import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "../ConfirmDialog";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

interface QueuedRequest {
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Single global confirm dialog with a FIFO queue.
 *
 * Original implementation kept one resolver in a ref and overwrote it on
 * every call — concurrent confirms (rare but real: two effects firing on the
 * same tick, or a user double-clicking two destructive buttons) left the
 * first Promise unresolved forever, causing whatever awaited it to hang.
 *
 * We queue requests instead: only one dialog is rendered at a time and the
 * next request opens once the current one resolves. Callers are guaranteed
 * to get exactly one boolean — including `false` if the provider unmounts
 * while their request is still pending.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<QueuedRequest | null>(null);
  const queueRef = useRef<QueuedRequest[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Resolve everything pending so awaiters never leak. Treat as "no".
      if (current) current.resolve(false);
      for (const req of queueRef.current) req.resolve(false);
      queueRef.current = [];
    };
    // We intentionally don't put `current` in deps — this cleanup is only
    // meant for the provider's final unmount, not for transitions between
    // requests. The closure-captured `current` is good enough there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm: ConfirmFn = useCallback((opts) => {
    return new Promise<boolean>((resolve) => {
      if (!mountedRef.current) { resolve(false); return; }
      const req: QueuedRequest = { opts, resolve };
      // If no dialog is currently shown, show this one immediately;
      // otherwise enqueue and wait for our turn.
      setCurrent((prev) => {
        if (prev) {
          queueRef.current.push(req);
          return prev;
        }
        return req;
      });
    });
  }, []);

  function finish(result: boolean) {
    setCurrent((prev) => {
      prev?.resolve(result);
      const nextReq = queueRef.current.shift();
      return nextReq ?? null;
    });
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current && (
        <ConfirmDialog
          title={current.opts.title}
          message={current.opts.message}
          confirmLabel={current.opts.confirmLabel}
          cancelLabel={current.opts.cancelLabel}
          destructive={current.opts.destructive}
          onConfirm={() => finish(true)}
          onClose={() => finish(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
  return ctx;
}
