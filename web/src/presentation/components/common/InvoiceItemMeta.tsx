import React from 'react';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

interface InvoiceItemMetaProps {
  variantName?: string | null;
  batchNumber?: string | null;
  unitName?: string | null;
  mode?: 'badge' | 'inline';
  className?: string;
}

export const InvoiceItemMeta: React.FC<InvoiceItemMetaProps> = ({
  variantName,
  batchNumber,
  unitName,
  mode = 'badge',
  className,
}) => {
  if (!variantName && !batchNumber && !unitName) {
    return null;
  }

  if (mode === 'inline') {
    const parts = [
      variantName || null,
      batchNumber ? `تشغيلة: ${batchNumber}` : null,
      unitName || null,
    ].filter(Boolean);

    return (
      <div className={cn('text-2xs text-muted font-medium leading-snug', className)}>
        {parts.join(' • ')}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 mt-1', className)}>
      {variantName && (
        <Badge tone="info" className="text-[11px]">
          {variantName}
        </Badge>
      )}
      {batchNumber && (
        <Badge tone="warn" className="text-[11px] tabular-nums">
          تشغيلة: {batchNumber}
        </Badge>
      )}
      {unitName && (
        <Badge tone="neutral" className="text-[11px]">
          {unitName}
        </Badge>
      )}
    </div>
  );
};
