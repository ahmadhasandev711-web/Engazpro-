import React from 'react';
import { Truck, Package, CheckCircle2, Headphones } from 'lucide-react';
import { Badge } from '../ui/Badge';

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

export const getCallConfirmedBadge = (order: any): React.ReactNode => {
  if (order?.call_confirmed_at) {
    const by = order.call_confirmed_by ? ` (${order.call_confirmed_by})` : '';
    return (
      <Badge tone="brand" className="font-bold">
        <Headphones className="w-3 h-3" />
        <span>تم التأكيد من الكول سنتر{by}</span>
      </Badge>
    );
  }

  // Check if call was attempted with no answer
  if (order?.call_status === 'NO_ANSWER' || order?.call_result === 'no_answer') {
    return (
      <Badge tone="warn" className="font-bold">
        <Headphones className="w-3 h-3" />
        <span>ما ردّش</span>
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" className="font-bold">
      <Headphones className="w-3 h-3 opacity-60" />
      <span>لسه ما اتكلمش</span>
    </Badge>
  );
};

export const getStatusBadge = (status: string): React.ReactNode => {
  switch (status) {
    case 'PENDING_CONFIRMATION':
      return (
        <Badge tone="warn" className="font-black">
          بانتظار التأكيد
        </Badge>
      );
    case 'CONFIRMED':
      return (
        <Badge tone="brand" className="font-black">
          مؤكد وقيد التجهيز
        </Badge>
      );
    case 'PREPARING':
      return (
        <Badge tone="brand" className="font-black">
          قيد التجهيز
        </Badge>
      );
    case 'DISPATCHED':
      return (
        <Badge tone="info" className="font-black">
          <Truck className="w-3 h-3" />
          مع المندوب
        </Badge>
      );
    case 'SHIPPED_VIA_COURIER':
      return (
        <Badge tone="info" className="font-black">
          <Package className="w-3 h-3" />
          مع شركة الشحن
        </Badge>
      );
    case 'DELIVERED':
      return (
        <Badge tone="ok" className="font-black">
          <CheckCircle2 className="w-3 h-3" />
          تم التسليم والتحصيل
        </Badge>
      );
    case 'PARTIALLY_DELIVERED':
      return (
        <Badge tone="warn" className="font-black">
          تسليم جزئي
        </Badge>
      );
    case 'RETURNED':
      return (
        <Badge tone="bad" className="font-black">
          مرتجع
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge tone="bad" className="font-black">
          ملغي
        </Badge>
      );
    default:
      return (
        <Badge tone="neutral" className="font-black">
          {status}
        </Badge>
      );
  }
};

export type StageStatus = 'done' | 'now' | 'todo' | 'bad' | 'warn';

export interface OrderStage {
  id: 'store' | 'call' | 'branch' | 'delivery';
  label: string;
  sublabel?: string;
  status: StageStatus;
}

/**
 * Calculates the 4-stage lifecycle timeline for WooCommerce orders.
 *
 * Lifecycle Stages:
 * 1. store: وصل من المتجر (order_date / created_at)
 * 2. call: اتأكد من الكول سنتر (call_confirmed_at / call_confirmed_by)
 * 3. branch: اختيار الفرع والتأكيد (branch_id / branch / status)
 * 4. delivery: التجهيز والتسليم (mandob / courier_name / tracking_number)
 *
 * State Rules & Terminal Flows:
 * - CANCELLED: The active stage where cancellation halted progress is marked 'bad' ("اتلغى"), subsequent stages 'todo'.
 * - RETURNED: The delivery stage is marked 'bad' ("مرتجع"), earlier stages remain 'done'.
 * - PARTIALLY_DELIVERED: The delivery stage is marked 'warn' ("اتسلّم جزئي"), earlier stages remain 'done'.
 * - DELIVERED: All 4 stages are completed and marked 'done' (ok).
 */
export function calculateOrderStages(order: any): OrderStage[] {
  if (!order) return [];

  const orderDateFormatted = formatOrderDate(order);
  const isCancelled = order.status === 'CANCELLED';
  const isReturned = order.status === 'RETURNED';
  const isPartial = order.status === 'PARTIALLY_DELIVERED';
  const isDelivered = order.status === 'DELIVERED';
  const isDispatched = order.status === 'DISPATCHED' || order.status === 'SHIPPED_VIA_COURIER';
  const isConfirmed = order.status === 'CONFIRMED' || order.status === 'PREPARING' || isDispatched || isDelivered || isReturned || isPartial;

  // Stage 1: Store Arrival (always arrived)
  const stageStore: OrderStage = {
    id: 'store',
    label: 'وصل من المتجر',
    sublabel: orderDateFormatted || undefined,
    status: 'done',
  };

  // Stage 2: Call Center Confirmation
  let stageCall: OrderStage;
  if (order.call_confirmed_at) {
    const by = order.call_confirmed_by ? `بواسطة ${order.call_confirmed_by}` : 'تم التأكيد هاتفياً';
    stageCall = {
      id: 'call',
      label: 'اتأكد من الكول سنتر',
      sublabel: by,
      status: 'done',
    };
  } else if (isCancelled && !isConfirmed) {
    stageCall = {
      id: 'call',
      label: 'مكالمة التأكيد',
      sublabel: 'اتلغى قبل التأكيد',
      status: 'bad',
    };
  } else if (isConfirmed) {
    // If order was confirmed directly without recording call
    stageCall = {
      id: 'call',
      label: 'الكول سنتر',
      sublabel: 'تأكيد مباشر',
      status: 'done',
    };
  } else {
    stageCall = {
      id: 'call',
      label: 'اتأكد من الكول سنتر',
      sublabel: 'بانتظار الاتصال بالعميل',
      status: 'now',
    };
  }

  // Stage 3: Branch Selection & Stock Reservation
  let stageBranch: OrderStage;
  if (isCancelled && isConfirmed && !isDispatched) {
    stageBranch = {
      id: 'branch',
      label: 'تحديد الفرع والتأكيد',
      sublabel: order.branch?.name ? `أُلغي في ${order.branch.name}` : 'اتلغى',
      status: 'bad',
    };
  } else if (isConfirmed && order.branch?.name) {
    stageBranch = {
      id: 'branch',
      label: 'اختيار الفرع والتأكيد',
      sublabel: order.branch.name,
      status: 'done',
    };
  } else if (isConfirmed) {
    stageBranch = {
      id: 'branch',
      label: 'اختيار الفرع والتأكيد',
      sublabel: 'تم التأكيد',
      status: 'done',
    };
  } else if (!isCancelled && order.call_confirmed_at) {
    stageBranch = {
      id: 'branch',
      label: 'اختيار الفرع والتأكيد',
      sublabel: 'جاهز لاختيار الفرع',
      status: 'now',
    };
  } else {
    stageBranch = {
      id: 'branch',
      label: 'اختيار الفرع والتأكيد',
      sublabel: 'بانتظار تأكيد الكول سنتر',
      status: 'todo',
    };
  }

  // Stage 4: Preparing & Delivery
  let stageDelivery: OrderStage;
  if (isCancelled && (isDispatched || isConfirmed)) {
    stageDelivery = {
      id: 'delivery',
      label: 'التجهيز والتسليم',
      sublabel: 'اتلغى أثناء الشحن',
      status: 'bad',
    };
  } else if (isReturned) {
    stageDelivery = {
      id: 'delivery',
      label: 'التجهيز والتسليم',
      sublabel: 'مرتجع',
      status: 'bad',
    };
  } else if (isPartial) {
    stageDelivery = {
      id: 'delivery',
      label: 'التجهيز والتسليم',
      sublabel: 'اتسلّم جزئي',
      status: 'warn',
    };
  } else if (isDelivered) {
    stageDelivery = {
      id: 'delivery',
      label: 'التجهيز والتسليم',
      sublabel: 'تم التسليم بنجاح',
      status: 'done',
    };
  } else if (order.status === 'SHIPPED_VIA_COURIER') {
    const courier = order.courier_name ? `شركة ${order.courier_name}` : 'شركة الشحن';
    stageDelivery = {
      id: 'delivery',
      label: 'التجهيز والتسليم',
      sublabel: `مع ${courier}`,
      status: 'now',
    };
  } else if (order.status === 'DISPATCHED') {
    const mandob = order.mandob?.name ? `المندوب ${order.mandob.name}` : 'المندوب';
    stageDelivery = {
      id: 'delivery',
      label: 'التجهيز والتسليم',
      sublabel: `في الطريق مع ${mandob}`,
      status: 'now',
    };
  } else if (order.status === 'CONFIRMED' || order.status === 'PREPARING') {
    stageDelivery = {
      id: 'delivery',
      label: 'التجهيز والتسليم',
      sublabel: 'قيد التجهيز بالمخزن',
      status: 'now',
    };
  } else {
    stageDelivery = {
      id: 'delivery',
      label: 'التجهيز والتسليم',
      sublabel: 'بانتظار حجز المخزون',
      status: 'todo',
    };
  }

  return [stageStore, stageCall, stageBranch, stageDelivery];
}
