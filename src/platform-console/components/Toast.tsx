// Minimal toast — single slot, auto-dismiss, no library. Used by
// modals to confirm success/failure without blocking the UI.

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components";

export type ToastTone = "brand" | "info" | "warn" | "danger";

interface ToastState {
  message: React.ReactNode;
  tone: ToastTone;
  id: number;
}

interface ToastContextValue {
  show: (message: React.ReactNode, tone?: ToastTone, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: React.ReactNode, tone: ToastTone = "brand", durationMs = 4500) => {
    const id = Date.now() + Math.random();
    setToast({ message, tone, id });
    setTimeout(() => {
      setToast((current) => (current && current.id === id ? null : current));
    }, durationMs);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={`pc-toast ${toast.tone === "brand" ? "" : toast.tone}`} role="status">
            <Icon
              name={
                toast.tone === "danger"
                  ? "x-circle"
                  : toast.tone === "warn"
                    ? "alert-triangle"
                    : toast.tone === "info"
                      ? "activity"
                      : "check-circle-2"
              }
              size={14}
            />
            <span>{toast.message}</span>
            <button
              type="button"
              className="pc-modal-close"
              style={{ marginLeft: 8 }}
              onClick={() => setToast(null)}
              aria-label="Fechar"
            >
              <Icon name="x" size={12} />
            </button>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Don't throw — let consumers fall back to console.log if no provider
    return {
      show: (msg: React.ReactNode) => {
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.warn("[platform-console] toast without provider:", msg);
        }
      },
    };
  }
  return ctx;
}

// Auto-dismiss helper hook (rarely needed)
export function useDismissOnUnmount(ms: number, cb: () => void) {
  useEffect(() => {
    const t = setTimeout(cb, ms);
    return () => clearTimeout(t);
  }, [ms, cb]);
}
