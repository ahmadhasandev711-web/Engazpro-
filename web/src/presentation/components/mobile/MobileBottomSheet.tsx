import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { nativeBackButton } from '../../../platform/nativeBackButton';
import { useHaptic } from '../../hooks/useHaptic';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: string; // e.g. 'max-h-[85vh]'
}

/**
 * Presentation Layer - MobileBottomSheet
 * Conforms to SoC (GR-3) & Hardware Back Button Integration
 * Smooth slide-up sheet designed for thumb ergonomics, dismissible via gesture, backdrop, or Android back button.
 */
export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = 'max-h-[85vh]',
}) => {
  const { selection } = useHaptic();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Register with Native Back Button stack when open
  useEffect(() => {
    if (!isOpen) return;

    const unregister = nativeBackButton.register(() => {
      onClose();
      return true; // handled
    });

    return () => {
      unregister();
    };
  }, [isOpen, onClose]);

  // Lock body scroll when bottom sheet is open
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
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-canvas/80 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-panel text-ink rounded-t-[2.2rem] shadow-2xl border-t border-line flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300 ${maxHeight} pb-[calc(1rem+env(safe-area-inset-bottom,0px))]`}
      >
        {/* Top Handle / Grab Bar */}
        <div className="w-full pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-line-2 rounded-full" />
        </div>

        {/* Header */}
        {(title || subtitle) && (
          <div className="px-5 py-3 flex items-center justify-between border-b border-line">
            <div>
              {title && (
                <h3 className="text-base font-black text-ink">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-muted mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                selection();
                onClose();
              }}
              aria-label="إغلاق"
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-muted hover:text-ink rounded-full hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
};
