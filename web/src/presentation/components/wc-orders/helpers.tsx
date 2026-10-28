import React from 'react';
import { Truck, Package, CheckCircle2 } from 'lucide-react';

export const cleanItemName = (name?: string): string => {
  if (!name) return '';
  return name.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
};

export const formatOrderDate = (order: any): string => {
  const dateStr = order?.order_date || order?.created_at;
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateStr);
  }
};

export const getStatusBadge = (status: string): React.ReactNode => {
  switch (status) {
    case 'PENDING_CONFIRMATION':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-50 text-amber-700 border border-amber-200">
          بانتظار التأكيد
        </span>
      );
    case 'CONFIRMED':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
          مؤكد وقيد التجهيز
        </span>
      );
    case 'DISPATCHED':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
          <Truck className="w-3 h-3" />
          مع المندوب
        </span>
      );
    case 'SHIPPED_VIA_COURIER':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
          <Package className="w-3 h-3" />
          مع شركة الشحن
        </span>
      );
    case 'DELIVERED':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          تم التسليم والتحصيل
        </span>
      );
    case 'RETURNED':
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
          مرتجع
        </span>
      );
    default:
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-700">
          {status}
        </span>
      );
  }
};
