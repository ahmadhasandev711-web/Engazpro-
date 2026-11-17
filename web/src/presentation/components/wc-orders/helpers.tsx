import React from 'react';
import { Truck, Package, CheckCircle2, Headphones, Clock } from 'lucide-react';
import {
  EcommercePlatform,
  OnlineOrderCallStatus,
  OrderCancelReason,
  WcOrderStatus,
  WcPaymentStatus,
} from '@pos-mandob/shared';
import { Badge } from '../ui/Badge';

export const CANCEL_REASON_OPTIONS: Array<{ value: OrderCancelReason; label: string }> = [
  { value: OrderCancelReason.CUSTOMER_REJECTED, label: 'الزبون رفض / ألغى الطلب' },
  { value: OrderCancelReason.WRONG_NUMBER, label: 'رقم غلط / تعذر الوصول' },
  { value: OrderCancelReason.DUPLICATE_ORDER, label: 'طلب مكرر' },
  { value: OrderCancelReason.NO_ANSWER, label: 'لم يرد بعد عدة محاولات' },
  { value: OrderCancelReason.OTHER, label: 'سبب آخر' },
];

export const getCancelReasonLabel = (reason?: string | null): string => {
  const matched = CANCEL_REASON_OPTIONS.find((opt) => opt.value === reason);
  return matched ? matched.label : reason ? String(reason) : 'ملغي من الكول سنتر';
};

export const normalizePhoneDigits = (phone?: string | null): string => {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('01') && digits.length === 11) {
    digits = `2${digits}`;
  }
  return digits;
};

export const buildTelUrl = (phone?: string | null): string | null => {
  if (!phone) return null;
  const cleaned = phone.trim().replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : null;
};

export const buildWhatsAppUrl = (phone?: string | null, message?: string): string | null => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;
  return message ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : `https://wa.me/${digits}`;
};

export const buildDefaultOrderWhatsAppMessage = (order: any): string =>
  `مرحباً ${order?.customer_name || 'عميلنا العزيز'}، نود تأكيد طلبك رقم ${getOrderDisplayRef(order)} من متجرنا.`;

export const getOrderDisplayRef = (order: any): string => {
  if (!order) return '';
  if (order.display_reference) return String(order.display_reference);
  if (order.external_order_number) return String(order.external_order_number);
  if (order.external_order_id) return `#${order.external_order_id}`;
  return order.wc_order_id ? `#${order.wc_order_id}` : `#${order.id ?? ''}`;
};

export const getOrderPlatformLabel = (order: any): string => {
  if (order?.platform === EcommercePlatform.SHOPIFY) return 'شوبيفاي';
  if (order?.platform === EcommercePlatform.WOOCOMMERCE) return 'ووكومرس';
  return 'المتجر';
};

export const isOrderPrepaid = (order: any): boolean => {
  if (!order) return false;
  const method = order.payment_method_label ?? order.wc_payment_method;
  return order.payment_status === WcPaymentStatus.PAID_ONLINE || (Boolean(method) && method !== 'cod');
};

export const cleanItemName = (name?: string): string => {
  if (!name) return '';
  return name.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
};

export const formatOrderDate = (order: any): string => {
  return formatShortDateTime(order?.order_date || order?.created_at);
};

export const formatShortDateTime = (dateStr?: string | null): string => {
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
        <span>تم التأكيد{by}</span>
      </Badge>
    );
  }

  const attempts = Number(order?.call_attempts_count || 0);
  const attemptsSuffix = attempts > 0 ? ` (${attempts})` : '';

  if (order?.call_status === OnlineOrderCallStatus.CALLBACK_SCHEDULED) {
    const scheduled = order.call_scheduled_at ? ` · ${formatShortDateTime(order.call_scheduled_at)}` : '';
    return (
      <Badge tone="info" className="font-bold">
        <Clock className="w-3 h-3" />
        <span>مؤجل{attemptsSuffix}{scheduled}</span>
      </Badge>
    );
  }

  if (order?.call_status === OnlineOrderCallStatus.NO_ANSWER || order?.call_result === 'no_answer') {
    return (
      <Badge tone="warn" className="font-bold">
        <Headphones className="w-3 h-3" />
        <span>ما ردّش{attemptsSuffix}</span>
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
    case WcOrderStatus.PENDING_CONFIRMATION:
      return (
        <Badge tone="warn" className="font-black">
          بانتظار التأكيد
        </Badge>
      );
    case WcOrderStatus.CONFIRMED:
      return (
        <Badge tone="brand" className="font-black">
          مؤكد وقيد التجهيز
        </Badge>
      );
    case WcOrderStatus.PREPARING:
      return (
        <Badge tone="brand" className="font-black">
          قيد التجهيز
        </Badge>
      );
    case WcOrderStatus.DISPATCHED:
      return (
        <Badge tone="info" className="font-black">
          <Truck className="w-3 h-3" />
          مع المندوب
        </Badge>
      );
    case WcOrderStatus.SHIPPED_VIA_COURIER:
      return (
        <Badge tone="info" className="font-black">
          <Package className="w-3 h-3" />
          مع شركة الشحن
        </Badge>
      );
    case WcOrderStatus.DELIVERED:
      return (
        <Badge tone="ok" className="font-black">
          <CheckCircle2 className="w-3 h-3" />
          تم التسليم والتحصيل
        </Badge>
      );
    case WcOrderStatus.PARTIALLY_DELIVERED:
      return (
        <Badge tone="warn" className="font-black">
          تسليم جزئي
        </Badge>
      );
    case WcOrderStatus.RETURNED:
      return (
        <Badge tone="bad" className="font-black">
          مرتجع
        </Badge>
      );
    case WcOrderStatus.CANCELLED:
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
  const isCancelled = order.status === WcOrderStatus.CANCELLED;
  const isReturned = order.status === WcOrderStatus.RETURNED;
  const isPartial = order.status === WcOrderStatus.PARTIALLY_DELIVERED;
  const isDelivered = order.status === WcOrderStatus.DELIVERED;
  const isDispatched = order.status === WcOrderStatus.DISPATCHED || order.status === WcOrderStatus.SHIPPED_VIA_COURIER;
  const isConfirmed = order.status === WcOrderStatus.CONFIRMED || order.status === WcOrderStatus.PREPARING || isDispatched || isDelivered || isReturned || isPartial;

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
      label: 'ملغي من الكول سنتر',
      sublabel: order.cancel_reason ? getCancelReasonLabel(order.cancel_reason) : 'اتلغى قبل التأكيد',
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
  } else if (order.call_status === OnlineOrderCallStatus.CALLBACK_SCHEDULED) {
    const at = order.call_scheduled_at ? formatShortDateTime(order.call_scheduled_at) : '';
    const attempts = Number(order.call_attempts_count || 0);
    stageCall = {
      id: 'call',
      label: 'مؤجل للمتابعة',
      sublabel: `${attempts ? `محاولة ${attempts}` : 'متابعة'}${at ? ` · ${at}` : ''}`,
      status: 'warn',
    };
  } else if (order.call_status === OnlineOrderCallStatus.NO_ANSWER) {
    const attempts = Number(order.call_attempts_count || 0);
    const agent = order.last_call_attempt_by ? ` · ${order.last_call_attempt_by}` : '';
    stageCall = {
      id: 'call',
      label: 'ما ردّش',
      sublabel: `${attempts} محاولات${agent}`,
      status: 'warn',
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
  } else if (order.status === WcOrderStatus.SHIPPED_VIA_COURIER) {
    const courier = order.courier_name ? `شركة ${order.courier_name}` : 'شركة الشحن';
    stageDelivery = {
      id: 'delivery',
      label: 'التجهيز والتسليم',
      sublabel: `مع ${courier}`,
      status: 'now',
    };
  } else if (order.status === WcOrderStatus.DISPATCHED) {
    const mandob = order.mandob?.name ? `المندوب ${order.mandob.name}` : 'المندوب';
    stageDelivery = {
      id: 'delivery',
      label: 'التجهيز والتسليم',
      sublabel: `في الطريق مع ${mandob}`,
      status: 'now',
    };
  } else if (order.status === WcOrderStatus.CONFIRMED || order.status === WcOrderStatus.PREPARING) {
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
