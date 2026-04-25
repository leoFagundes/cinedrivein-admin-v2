"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiAlertTriangle,
  FiInfo,
  FiX,
} from "react-icons/fi";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<
  ToastType,
  { icon: ReactNode; color: string; bg: string; border: string }
> = {
  success: {
    icon: <FiCheckCircle size={18} />,
    color: "var(--color-success)",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.25)",
  },
  error: {
    icon: <FiAlertCircle size={18} />,
    color: "var(--color-error)",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
  },
  warning: {
    icon: <FiAlertTriangle size={18} />,
    color: "var(--color-warning)",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
  },
  info: {
    icon: <FiInfo size={18} />,
    color: "var(--color-primary)",
    bg: "var(--color-primary-light)",
    border: "rgba(0,136,194,0.25)",
  },
};

let nextId = 0;
const DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, type, title, message }]);
      setTimeout(() => dismiss(id), DURATION);
    },
    [dismiss],
  );

  const success = useCallback(
    (t: string, m?: string) => toast("success", t, m),
    [toast],
  );
  const error = useCallback(
    (t: string, m?: string) => toast("error", t, m),
    [toast],
  );
  const warning = useCallback(
    (t: string, m?: string) => toast("warning", t, m),
    [toast],
  );
  const info = useCallback(
    (t: string, m?: string) => toast("info", t, m),
    [toast],
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}

      {/* Toast container */}
      <div
        className="fixed bottom-5 right-5 z-101 flex flex-col gap-2 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const s = STYLES[t.type];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-[var(--radius-lg)] shadow-lg min-w-64 max-w-sm animate-in"
              style={{
                backgroundColor: "var(--color-bg-surface)",
                border: `1px solid ${s.border}`,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              <span className="mt-0.5 flex-shrink-0" style={{ color: s.color }}>
                {s.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {t.title}
                </p>
                {t.message && (
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {t.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="flex-shrink-0 mt-0.5 cursor-pointer transition-opacity hover:opacity-60"
                style={{ color: "var(--color-text-muted)" }}
                aria-label="Fechar"
              >
                <FiX size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
