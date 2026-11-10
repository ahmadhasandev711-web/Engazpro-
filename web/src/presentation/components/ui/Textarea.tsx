import React, { useId } from 'react';
import { cn } from '../../utils/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className, id, rows = 3, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;

    return (
      <div className="w-full space-y-1.5 text-right" dir="rtl">
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-bold text-ink select-none">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          aria-invalid={Boolean(error)}
          className={cn(
            'w-full px-3.5 py-2.5 text-sm bg-panel text-ink border border-line rounded-xl outline-none transition-colors placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-50 disabled:bg-surface-2 resize-y',
            error && 'border-bad focus:border-bad focus:ring-bad',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-bad font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-muted">{helperText}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
