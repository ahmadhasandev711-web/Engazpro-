import React, { useId } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5 text-right" dir="rtl">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-ink select-none">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute right-3.5 flex items-center pointer-events-none text-muted">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error)}
            className={cn(
              'w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-panel text-ink border border-line rounded-xl outline-none transition-colors placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-50 disabled:bg-surface-2',
              leftIcon && 'pr-10',
              rightIcon && 'pl-10',
              error && 'border-bad focus:border-bad focus:ring-bad',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-muted">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-bad font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-muted">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
