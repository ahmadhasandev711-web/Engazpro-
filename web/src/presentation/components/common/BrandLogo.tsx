import React from 'react';
import { cn } from '../../utils/cn';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showArabic?: boolean;
  showIcon?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { icon: 'w-7 h-7 rounded-lg', text: 'text-base', ar: 'text-2xs' },
  md: { icon: 'w-8 h-8 rounded-xl', text: 'text-lg sm:text-xl', ar: 'text-xs' },
  lg: { icon: 'w-10 h-10 rounded-xl', text: 'text-2xl sm:text-3xl', ar: 'text-xs' },
} as const;

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showArabic = true,
  showIcon = true,
  className,
}) => {
  const s = SIZE_MAP[size];

  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      {showIcon && (
        <img
          src="/icons/icon-192.svg"
          alt="Easyfy"
          className={cn('shrink-0 shadow-xs object-contain', s.icon)}
        />
      )}
      <span className={cn('font-black tracking-tight text-ink font-sans flex items-center', s.text)} dir="ltr">
        Easyfy<span className="text-brand">.</span>
      </span>
      {showArabic && (
        <span className={cn('font-bold text-muted border-r border-line pr-2 mr-0.5', s.ar)}>
          إدارة الأعمال
        </span>
      )}
    </span>
  );
};
