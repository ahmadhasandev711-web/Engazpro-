import React from 'react';
import { cn } from '../../utils/cn';

export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  tableClassName?: string;
}

export const DataTable: React.FC<DataTableProps> = ({
  className,
  tableClassName,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'w-full overflow-x-auto border border-line rounded-xl bg-panel shadow-2xs transition-colors',
        className
      )}
      {...props}
    >
      <table className={cn('w-full text-right text-sm border-collapse', tableClassName)} dir="rtl">
        {children}
      </table>
    </div>
  );
};
