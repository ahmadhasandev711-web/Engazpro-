import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Button } from '../components/ui';

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
      icon: <AlertTriangle className="w-6 h-6 text-bad" />,
      iconBg: 'bg-bad-soft border-bad/25',
      variant: 'danger' as const,
      confirmClass: '',
    },
    warning: {
      icon: <AlertCircle className="w-6 h-6 text-warn" />,
      iconBg: 'bg-warn-soft border-warn/25',
      variant: 'primary' as const,
      confirmClass: 'bg-warn hover:bg-warn/90 text-on-brand',
    },
    info: {
      icon: <Info className="w-6 h-6 text-brand" />,
      iconBg: 'bg-brand-soft border-brand/25',
      variant: 'primary' as const,
      confirmClass: '',
    },
  }[type];

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          dir="rtl"
        >
          <div
            className="bg-panel text-ink rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-line animate-in zoom-in-95 duration-200 p-6 space-y-4"
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
                <h3 className="text-base font-black text-ink leading-tight">
                  {options.title}
                </h3>
                <p className="text-xs text-muted mt-1 leading-relaxed whitespace-pre-line">
                  {options.message}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => handleClose(false)}
                className="text-xs font-bold"
              >
                {options.cancelText}
              </Button>
              <Button
                ref={confirmButtonRef}
                type="button"
                variant={typeStyles.variant}
                size="md"
                onClick={() => handleClose(true)}
                className={`text-xs font-black shadow-md ${typeStyles.confirmClass}`}
              >
                {options.confirmText}
              </Button>
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
