import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: string;
}

/**
 * Presentation Layer - MobileBottomSheet Component
 * Conforms to SoC (GR-3) & GR-5 (Hardware-accelerated animations)
 * Provides native-like bottom sheet overlay for mobile viewports.
 */
export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  maxHeight = 'max-h-[92vh]',
}) => {
  // Lock body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop overlay */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Slide-up Container */}
      <div
        className={`relative z-10 bg-white rounded-t-[2rem] shadow-2xl ${maxHeight} flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250 border-t border-slate-200/80 pb-safe`}
      >
        {/* Pull Handle Bar */}
        <div className="w-full pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing" onClick={onClose}>
          <div className="w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Sheet Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-black text-sm text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sheet Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
};
