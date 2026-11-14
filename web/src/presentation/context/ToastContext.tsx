import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { Button } from '../components/ui';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
  };
}

const TOAST_STYLE_MAP: Record<
  ToastType,
  { container: string; iconBg: string; icon: React.ReactNode }
> = {
  success: {
    container: 'border-ok/35 bg-panel/95 text-ink',
    iconBg: 'bg-ok-soft text-ok',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  error: {
    container: 'border-bad/35 bg-panel/95 text-ink',
    iconBg: 'bg-bad-soft text-bad',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  info: {
    container: 'border-info/35 bg-panel/95 text-ink',
    iconBg: 'bg-info-soft text-info',
    icon: <Info className="w-4 h-4" />,
  },
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = { id, type, message };

      setToasts((prev) => [...prev.slice(-3), newToast]); // Keep max 4 toasts

      const timer = setTimeout(() => {
        removeToast(id);
      }, 4000);

      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  const toast = useMemo(
    () => ({
      success: (msg: string) => addToast('success', msg),
      error: (msg: string) => addToast('error', msg),
      info: (msg: string) => addToast('info', msg),
    }),
    [addToast]
  );

  const contextValue = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Floating Toast Container (RTL, above mobile bottom nav) */}
      <div
        dir="rtl"
        className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 left-3 sm:left-auto z-50 flex flex-col gap-2 max-w-sm sm:w-96 pointer-events-none"
      >
        {toasts.map((t) => {
          const styles = TOAST_STYLE_MAP[t.type];

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-2xl border shadow-lg backdrop-blur-md flex items-center gap-3 transition-all animate-in slide-in-from-bottom duration-200 ${styles.container}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${styles.iconBg}`}>
                {styles.icon}
              </div>
              <p className="text-xs font-bold leading-relaxed flex-1 select-text">{t.message}</p>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => removeToast(t.id)}
                aria-label="إغلاق التنبيه"
                className="px-2 text-muted hover:text-ink shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType['toast'] => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context.toast;
};
