import React, { useId, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Input } from '../ui';

export interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  labelAction?: React.ReactNode;
  error?: string;
}

/** Accessible password input built over design-system Input with 44px visibility toggle. */
export const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label = 'كلمة المرور', labelAction, error, id, className, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5 text-right" dir="rtl">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={inputId} className="block text-xs font-bold text-ink select-none">
            {label}
          </label>
          {labelAction}
        </div>

        <div className="relative flex items-center">
          <Input
            ref={ref}
            id={inputId}
            type={showPassword ? 'text' : 'password'}
            leftIcon={<Lock className="w-4 h-4" />}
            aria-invalid={Boolean(error)}
            className={cn(
              'pl-12',
              error && 'border-bad focus:border-bad focus:ring-bad',
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            className="absolute left-0.5 inset-y-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-ink rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && <p className="text-xs text-bad font-medium">{error}</p>}
      </div>
    );
  }
);

PasswordField.displayName = 'PasswordField';
