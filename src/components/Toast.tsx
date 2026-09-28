import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { Icon } from "./icons";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, message }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[90] space-y-2 max-w-md w-full px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl shadow-lift px-4 py-3 flex items-start gap-3 animate-slideup ${
              toast.type === "success" ? "bg-oksoft text-ok" :
              toast.type === "error" ? "bg-corsoft text-cor" :
              "bg-skysoft text-sky"
            }`}
          >
            <Icon
              name={toast.type === "success" ? "check" : toast.type === "error" ? "alert" : "star"}
              className="w-5 h-5 shrink-0 mt-0.5"
              strokeWidth={2.2}
            />
            <p className="text-[0.85rem] font-semibold flex-1">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
