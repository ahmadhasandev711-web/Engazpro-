import {
  EasyfyCouponType,
  EasyfyOrderStatus,
  EasyfyPaymentMethod,
  EasyfyPaymentStatus,
  EasyfyStockMode,
  EasyfyStockMovementType,
} from '@pos-mandob/shared';
import type { BadgeTone } from '../../ui/Badge';

export const ORDER_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  [EasyfyOrderStatus.PENDING]: { label: 'قيد المراجعة', tone: 'warn' },
  [EasyfyOrderStatus.CONFIRMED]: { label: 'مؤكد', tone: 'info' },
  [EasyfyOrderStatus.PREPARING]: { label: 'قيد التجهيز', tone: 'brand' },
  [EasyfyOrderStatus.SHIPPED]: { label: 'تم الشحن', tone: 'info' },
  [EasyfyOrderStatus.DELIVERED]: { label: 'تم التسليم', tone: 'ok' },
  [EasyfyOrderStatus.CANCELLED]: { label: 'ملغي', tone: 'bad' },
};

export const ALLOWED_STATUS_TRANSITIONS: Record<string, EasyfyOrderStatus[]> = {
  [EasyfyOrderStatus.PENDING]: [EasyfyOrderStatus.CONFIRMED, EasyfyOrderStatus.PREPARING, EasyfyOrderStatus.CANCELLED],
  [EasyfyOrderStatus.CONFIRMED]: [EasyfyOrderStatus.PREPARING, EasyfyOrderStatus.SHIPPED, EasyfyOrderStatus.CANCELLED],
  [EasyfyOrderStatus.PREPARING]: [EasyfyOrderStatus.SHIPPED, EasyfyOrderStatus.CANCELLED],
  [EasyfyOrderStatus.SHIPPED]: [EasyfyOrderStatus.DELIVERED, EasyfyOrderStatus.CANCELLED],
  [EasyfyOrderStatus.DELIVERED]: [],
  [EasyfyOrderStatus.CANCELLED]: [],
};

export const PAYMENT_STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  [EasyfyPaymentStatus.NOT_REQUIRED]: { label: 'دفع عند الاستلام', tone: 'neutral' },
  [EasyfyPaymentStatus.PENDING_REVIEW]: { label: 'بانتظار مراجعة التحويل', tone: 'warn' },
  [EasyfyPaymentStatus.VERIFIED]: { label: 'تم تأكيد التحويل', tone: 'ok' },
  [EasyfyPaymentStatus.REJECTED]: { label: 'مرفوض - بانتظار إعادة الرفع', tone: 'bad' },
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  [EasyfyPaymentMethod.CASH_ON_DELIVERY]: 'الدفع عند الاستلام',
  [EasyfyPaymentMethod.INSTAPAY]: 'إنستاباي (InstaPay)',
  [EasyfyPaymentMethod.VODAFONE_CASH]: 'فودافون كاش',
};

export const STOCK_MODE_META: Record<string, { label: string; tone: BadgeTone }> = {
  [EasyfyStockMode.TRACKED]: { label: 'مخزون فعلي', tone: 'info' },
  [EasyfyStockMode.UNLIMITED]: { label: 'متاح بدون مخزون', tone: 'ok' },
  [EasyfyStockMode.MADE_TO_ORDER]: { label: 'حسب الطلب والطباعة', tone: 'brand' },
};

export const COUPON_TYPE_LABEL: Record<string, string> = {
  [EasyfyCouponType.PERCENTAGE]: 'نسبة مئوية (%)',
  [EasyfyCouponType.FIXED]: 'مبلغ ثابت (ج.م)',
  [EasyfyCouponType.FREE_SHIPPING]: 'شحن مجاني',
};

export const MOVEMENT_TYPE_META: Record<string, { label: string; tone: BadgeTone }> = {
  [EasyfyStockMovementType.OPENING]: { label: 'رصيد افتتاحي', tone: 'info' },
  [EasyfyStockMovementType.RESTOCK]: { label: 'توريد بضاعة', tone: 'ok' },
  [EasyfyStockMovementType.ORDER_DEDUCTION]: { label: 'خصم طلب', tone: 'brand' },
  [EasyfyStockMovementType.ORDER_CANCEL_RESTORE]: { label: 'مرتجع إلغاء طلب', tone: 'warn' },
  [EasyfyStockMovementType.ADJUSTMENT]: { label: 'جرد / تسوية', tone: 'neutral' },
};
