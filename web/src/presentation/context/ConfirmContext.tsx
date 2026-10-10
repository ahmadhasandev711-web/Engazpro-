import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ message: '' });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      if (typeof opts === 'string') {
        setOptions({
          title: 'تأكيد الإجراء',
          message: opts,
          type: 'warning',
          confirmText: 'تأكيد',
          cancelText: 'إلغاء',
        });
      } else {
        setOptions({
          title: opts.title || (opts.type === 'danger' ? 'تأكيد الحذف' : 'تأكيد الإجراء'),
          message: opts.message,
          confirmText: opts.confirmText || 'تأكيد',
          cancelText: opts.cancelText || 'إلغاء',
          type: opts.type || 'warning',
        });
      }
      setIsOpen(true);
    });
  }, []);

  const handleClose = useCallback((result: boolean) => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  // Keyboard accessibility: Escape to cancel, Enter to confirm when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleClose(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Auto-focus confirm button
    setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const type = options.type || 'warning';

  const typeStyles = {
    danger: {
      icon: <AlertTriangle className="w-6 h-6 text-rose-600" />,
      iconBg: 'bg-rose-100 border-rose-200',
      confirmBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
    },
    warning: {
      icon: <AlertCircle className="w-6 h-6 text-amber-600" />,
      iconBg: 'bg-amber-100 border-amber-200',
      confirmBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
    },
    info: {
      icon: <Info className="w-6 h-6 text-primary-600" />,
      iconBg: 'bg-primary-100 border-primary-200',
      confirmBtn: 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-600/20',
    },
  }[type];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200 p-6 space-y-4"
            role="dialog"
            aria-modal="true"
          >
            {/* Icon & Title */}
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border ${typeStyles.iconBg}`}
              >
                {typeStyles.icon}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-base font-black text-slate-900 leading-tight">
                  {options.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed whitespace-pre-line">
                  {options.message}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                {options.cancelText}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => handleClose(true)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-md transition-all active:scale-98 ${typeStyles.confirmBtn}`}
              >
                {options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmContextType => {
  const context = useContext(ConfirmContext);
  if (!context) {
    // Fallback gracefully to window.confirm if outside provider
    return {
      confirm: async (opts) => {
        const msg = typeof opts === 'string' ? opts : opts.message;
        return window.confirm(msg);
      },
    };
  }
  return context;
};
