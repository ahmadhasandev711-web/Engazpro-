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

  const statusBorderMap = {
    emerald: 'border-r-4 border-r-emerald-500',
    amber: 'border-r-4 border-r-amber-500',
    rose: 'border-r-4 border-r-rose-500',
    indigo: 'border-r-4 border-r-indigo-500',
    purple: 'border-r-4 border-r-purple-500',
    slate: 'border-r-4 border-r-slate-400',
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
        'bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs transition-all relative overflow-hidden',
        statusColor && statusBorderMap[statusColor],
        onClick && 'active:scale-[0.99] cursor-pointer hover:border-slate-300',
        className
      )}
      dir="rtl"
    >
      {children}
    </div>
  );
};
