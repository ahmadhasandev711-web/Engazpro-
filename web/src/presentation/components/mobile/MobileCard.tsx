import React from 'react';
import clsx from 'clsx';
import { useHaptic } from '../../hooks/useHaptic';

interface MobileCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  statusColor?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate' | 'purple';
}

/**
 * Presentation Layer - MobileCard
 * Unified container component for mobile list items (orders, products, invoices, couriers).
 */
export const MobileCard: React.FC<MobileCardProps> = ({
  children,
  onClick,
  className = '',
  statusColor,
}) => {
  const { selection } = useHaptic();

  const statusBorderMap: Record<NonNullable<MobileCardProps['statusColor']>, string> = {
    emerald: 'border-r-4 border-r-ok',
    amber: 'border-r-4 border-r-warn',
    rose: 'border-r-4 border-r-bad',
    indigo: 'border-r-4 border-r-info',
    purple: 'border-r-4 border-r-brand',
    slate: 'border-r-4 border-r-line-2',
  };

  const handleClick = () => {
    if (onClick) {
      selection();
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'bg-panel text-ink rounded-2xl p-4 border border-line shadow-xs transition-all relative overflow-hidden',
        statusColor && statusBorderMap[statusColor],
        onClick && 'active:scale-[0.99] cursor-pointer hover:border-line-2',
        className
      )}
      dir="rtl"
    >
      {children}
    </div>
  );
};
