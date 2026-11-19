import React from 'react';
import {
  Calendar,
  CreditCard,
  Edit2,
  Printer,
  Receipt,
  RotateCcw,
  Save,
  Share2,
  ShoppingBag,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { formatCurrency, getPaymentMethodLabel } from '@pos-mandob/shared';
import { InvoiceItemMeta } from '../common/InvoiceItemMeta';
import { PosReceiptModal } from '../pos/PosReceiptModal';
import { Badge, Button, DataTable, Select } from '../ui';

interface InvoiceDetailsModalProps {
  selectedInvoiceId: number | null;
  invoiceDetails: any;
  isDetailsLoading: boolean;
  isReceiptModalOpen: boolean;
  setIsReceiptModalOpen: (open: boolean) => void;
  onClose: () => void;
  canEditInvoiceSalesperson: boolean;
  isEditingSalesperson: boolean;
  setIsEditingSalesperson: (editing: boolean) => void;
  selectedSalespersonId: string;
  setSelectedSalespersonId: (id: string) => void;
  employeesData?: any[];
  isUpdatingSalesperson: boolean;
  onUpdateSalesperson: (invoiceId: number, salespersonId: number | null) => void;
  onShareWhatsApp: () => void;
  onPrint: () => void;
  onQuickReturn?: (invoiceDetails: any) => void;
  onQuickExchangePos?: (invoiceDetails: any) => void;
}

const getRoleLabel = (role?: string): string => {
  switch (role) {
    case 'MANDOB':
      return 'مندوب مبيعات';
    case 'CASHIER':
      return 'كاشير';
    case 'SALES':
      return 'بائع / سيلز';
    case 'MANAGER':
      return 'مدير الفرع';
    case 'SUPERVISOR':
      return 'مشرف';
    default:
      return 'صاحب العمل';
  }
};

export const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  selectedInvoiceId,
  invoiceDetails,
  isDetailsLoading,
  isReceiptModalOpen,
  setIsReceiptModalOpen,
  onClose,
  canEditInvoiceSalesperson,
  isEditingSalesperson,
  setIsEditingSalesperson,
  selectedSalespersonId,
  setSelectedSalespersonId,
  employeesData,
  isUpdatingSalesperson,
  onUpdateSalesperson,
  onShareWhatsApp,
  onPrint,
  onQuickReturn,
  onQuickExchangePos,
}) => {
  if (!selectedInvoiceId) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150 ${
          isReceiptModalOpen ? 'print:hidden' : ''
        }`}
      >
        <div className="bg-panel text-ink rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-line animate-in slide-in-from-bottom sm:zoom-in duration-200">
          <div className="w-12 h-1.5 bg-line-2 rounded-full mx-auto mt-3 mb-1 sm:hidden no-print" />

          {/* Modal Header */}
          <div className="p-5 sm:p-6 bg-surface-2 border-b border-line text-ink flex items-center justify-between no-print">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-soft rounded-xl">
                <Receipt className="w-6 h-6 text-brand" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black tabular-nums">
                    {invoiceDetails?.invoice_number || 'جاري التحميل...'}
                  </h3>
                  {invoiceDetails?.type && (
                    <Badge tone="brand">
                      {invoiceDetails.type === 'SALE'
                        ? 'فاتورة بيع'
                        : invoiceDetails.type === 'PURCHASE'
                          ? 'فاتورة شراء'
                          : invoiceDetails.type === 'SALE_RETURN'
                            ? 'مرتجع بيع'
                            : 'مرتجع شراء'}
                    </Badge>
                  )}
                  {(invoiceDetails?.type === 'SALE' || invoiceDetails?.type === 'PURCHASE') &&
                    invoiceDetails.return_status === 'FULL' && (
                      <Badge tone="bad">مرتجع بالكامل</Badge>
                    )}
                  {(invoiceDetails?.type === 'SALE' || invoiceDetails?.type === 'PURCHASE') &&
                    invoiceDetails.return_status === 'PARTIAL' && (
                      <Badge tone="warn" className="tabular-nums">
                        مرتجع جزئي ({formatCurrency(invoiceDetails.returned_total ?? 0)})
                      </Badge>
                    )}
                  {(invoiceDetails?.type === 'SALE_RETURN' || invoiceDetails?.type === 'PURCHASE_RETURN') &&
                    invoiceDetails.parent_invoice_number && (
                      <Badge tone="info" className="tabular-nums">
                        مرتبط بالفاتورة: {invoiceDetails.parent_invoice_number}
                      </Badge>
                    )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  تفاصيل بنود الفاتورة والمدفوعات والمخزون
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              className="text-muted hover:text-ink px-2.5"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Modal Body */}
          <div
            className={`p-6 overflow-y-auto flex-1 space-y-6 ${
              isReceiptModalOpen ? 'print:hidden' : 'printable-area'
            }`}
          >
            <div className="hidden print:block border-b-2 border-paper-ink pb-3 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-paper-ink">
                    {invoiceDetails?.type === 'SALE'
                      ? 'فاتورة ضريبية مبسطة (مبيعات)'
                      : invoiceDetails?.type === 'PURCHASE'
                        ? 'فاتورة مشتريات'
                        : invoiceDetails?.type === 'SALE_RETURN'
                          ? 'إشعار دائن (مرتجع مبيعات)'
                          : 'مرتجع مشتريات'}
                  </h2>
                  <p className="text-sm font-mono font-bold text-paper-muted mt-0.5">
                    رقم الفاتورة: {invoiceDetails?.invoice_number}
                  </p>
                </div>
                <div className="text-left font-mono text-xs text-paper-muted">
                  <div>التاريخ: {invoiceDetails?.date}</div>
                  {(invoiceDetails?.wc_order_id || invoiceDetails?.shopify_order_id) && (
                    <div>
                      طلب المتجر: #{invoiceDetails.wc_order_id || invoiceDetails.shopify_order_id}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isDetailsLoading || !invoiceDetails ? (
              <div className="text-center py-12 text-muted font-medium">
                جاري جلب تفاصيل الفاتورة...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-surface-2 rounded-2xl border border-line text-xs">
                  <div className="space-y-1">
                    <span className="text-muted flex items-center gap-1 font-medium">
                      <Calendar className="w-3.5 h-3.5" /> التاريخ
                    </span>
                    <p className="font-bold text-ink tabular-nums">{invoiceDetails.date}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted flex items-center gap-1 font-medium">
                      <User className="w-3.5 h-3.5" /> الطرف
                    </span>
                    <p className="font-bold text-ink">
                      {invoiceDetails.party_name || 'نقدي (بدون حساب)'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted flex items-center gap-1 font-medium">
                      <CreditCard className="w-3.5 h-3.5" /> طريقة الدفع
                    </span>
                    <p className="font-bold text-ink">
                      {getPaymentMethodLabel(invoiceDetails.payment_method)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted flex items-center gap-1 font-medium">
                      <User className="w-3.5 h-3.5 text-brand" /> المنشئ / المحرر
                    </span>
                    <p className="font-bold text-ink">
                      {invoiceDetails.created_by_name || 'المالك'}
                      {invoiceDetails.created_by_role && (
                        <span className="block text-[11px] text-muted font-normal">
                          {getRoleLabel(invoiceDetails.created_by_role)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {(invoiceDetails.type === 'SALE' || invoiceDetails.type === 'SALE_RETURN') && (
                  <div className="p-4 bg-info-soft/40 rounded-2xl border border-info/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-info-soft text-info rounded-xl flex-shrink-0">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-muted font-medium block text-[11px]">
                          مسؤول المبيعات المعتمد (لحساب العمولات والأرباح):
                        </span>
                        {!isEditingSalesperson ? (
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-black text-ink text-sm">
                              {invoiceDetails.salesperson_name ||
                                invoiceDetails.created_by_name ||
                                'المالك / المنشئ'}
                            </span>
                            {invoiceDetails.salesperson_role ? (
                              <Badge tone="info" className="text-[11px]">
                                {getRoleLabel(invoiceDetails.salesperson_role)}
                              </Badge>
                            ) : (
                              invoiceDetails.created_by_role && (
                                <Badge tone="neutral" className="text-[11px]">
                                  {getRoleLabel(invoiceDetails.created_by_role)}
                                </Badge>
                              )
                            )}
                            {!invoiceDetails.salesperson_id && invoiceDetails.created_by_name && (
                              <span className="text-[11px] text-muted font-normal">
                                (تلقائياً حسب منشئ الفاتورة)
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="mt-1 sm:w-64">
                            <Select
                              value={selectedSalespersonId}
                              onChange={(e) => setSelectedSalespersonId(e.target.value)}
                            >
                              <option value="">-- تلقائياً (المنشئ / بدون تحديد) --</option>
                              {employeesData?.map((emp: any) => (
                                <option key={emp.id} value={emp.id}>
                                  {emp.name} ({getRoleLabel(emp.role)})
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>

                    {canEditInvoiceSalesperson && (
                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                        {isEditingSalesperson ? (
                          <>
                            <Button
                              type="button"
                              variant="primary"
                              size="md"
                              onClick={() =>
                                onUpdateSalesperson(
                                  invoiceDetails.id,
                                  selectedSalespersonId ? Number(selectedSalespersonId) : null
                                )
                              }
                              disabled={isUpdatingSalesperson}
                              leftIcon={<Save className="w-3.5 h-3.5" />}
                              className="text-xs font-bold"
                            >
                              {isUpdatingSalesperson ? 'جاري الحفظ...' : 'حفظ'}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="md"
                              onClick={() => setIsEditingSalesperson(false)}
                              className="text-xs font-bold"
                            >
                              إلغاء
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => {
                              setSelectedSalespersonId(
                                invoiceDetails.salesperson_id
                                  ? String(invoiceDetails.salesperson_id)
                                  : invoiceDetails.created_by
                                    ? String(invoiceDetails.created_by)
                                    : ''
                              );
                              setIsEditingSalesperson(true);
                            }}
                            leftIcon={<Edit2 className="w-3.5 h-3.5 text-info" />}
                            className="text-info border-info/30 bg-info-soft hover:bg-info-soft/80 text-xs font-bold"
                            title="تعديل مسؤول البيع لتصحيح عمولة الموظف"
                          >
                            تعديل مسؤول البيع
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                    بنود الفاتورة
                  </h4>
                  <DataTable>
                    <thead className="bg-surface-2 text-muted font-bold border-b border-line text-xs">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">اسم الصنف</th>
                        <th className="py-2.5 px-3 text-center">الكمية</th>
                        <th className="py-2.5 px-3 text-left">السعر</th>
                        <th className="py-2.5 px-3 text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-xs">
                      {invoiceDetails.items?.map((item: any, idx: number) => (
                        <tr key={item.id || idx} className="hover:bg-surface-2/50">
                          <td className="py-2.5 px-3 tabular-nums text-muted">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold text-ink">
                            <div>{item.product_name}</div>
                            <InvoiceItemMeta
                              variantName={item.variant_name}
                              batchNumber={item.batch_number}
                              unitName={item.unit_name}
                            />
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-left tabular-nums">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="py-2.5 px-3 text-left font-bold tabular-nums text-ink">
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </div>

                <div className="bg-surface-2 p-4 rounded-2xl border border-line space-y-2 text-sm">
                  <div className="flex justify-between text-muted text-xs">
                    <span>الإجمالي الفرعي:</span>
                    <span className="tabular-nums font-bold text-ink">
                      {formatCurrency(invoiceDetails.subtotal)}
                    </span>
                  </div>
                  {invoiceDetails.discount > 0 && (
                    <div className="flex justify-between text-bad text-xs">
                      <span>الخصم:</span>
                      <span className="tabular-nums font-bold">
                        - {formatCurrency(invoiceDetails.discount)}
                      </span>
                    </div>
                  )}
                  {Number(invoiceDetails.shipping_amount) > 0 && (
                    <div className="flex justify-between text-info text-xs font-medium">
                      <span>خدمة التوصيل / الشحن:</span>
                      <span className="tabular-nums font-bold">
                        + {formatCurrency(invoiceDetails.shipping_amount)}
                      </span>
                    </div>
                  )}
                  {invoiceDetails.tax > 0 && (
                    <div className="flex justify-between text-muted text-xs">
                      <span>الضريبة:</span>
                      <span className="tabular-nums font-bold text-ink">
                        + {formatCurrency(invoiceDetails.tax)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-ink pt-2 border-t border-line">
                    <span>الصافي الإجمالي:</span>
                    <span className="text-brand tabular-nums">
                      {formatCurrency(invoiceDetails.total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-ok pt-1">
                    <span>المدفوع:</span>
                    <span className="tabular-nums">{formatCurrency(invoiceDetails.paid_amount)}</span>
                  </div>
                  {invoiceDetails.due_amount > 0 && (
                    <div className="flex justify-between text-xs font-black text-bad">
                      <span>المتبقي (آجل):</span>
                      <span className="tabular-nums">{formatCurrency(invoiceDetails.due_amount)}</span>
                    </div>
                  )}
                </div>

                {invoiceDetails.notes && (
                  <div className="p-3 bg-warn-soft rounded-xl border border-warn/30 text-xs text-ink">
                    <span className="font-bold text-warn">ملاحظات: </span>
                    {invoiceDetails.notes}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-surface-2 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 no-print">
            <div className="flex flex-wrap items-stretch sm:items-center gap-2 flex-1">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setIsReceiptModalOpen(true)}
                leftIcon={<Printer className="w-4 h-4" />}
                className="bg-ok text-on-brand hover:opacity-95 text-xs font-bold"
              >
                طباعة إيصال كاشير (حراري 80mm)
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onShareWhatsApp}
                leftIcon={<Share2 className="w-3.5 h-3.5 text-ok" />}
                className="bg-ok-soft text-ok border-ok/30 hover:bg-ok-soft/80 text-xs font-bold"
                title="مشاركة الفاتورة عبر واتساب"
              >
                إرسال واتساب
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onPrint}
                leftIcon={<Printer className="w-3.5 h-3.5 text-muted" />}
                className="text-xs font-bold"
              >
                طباعة تقرير (A4)
              </Button>
              {(invoiceDetails?.type === 'SALE' || invoiceDetails?.type === 'PURCHASE') &&
                invoiceDetails?.return_status !== 'FULL' &&
                onQuickReturn && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => onQuickReturn(invoiceDetails)}
                    leftIcon={<RotateCcw className="w-3.5 h-3.5 text-warn" />}
                    className="bg-warn-soft text-warn border-warn/30 hover:bg-warn-soft/80 text-xs font-bold"
                  >
                    عمل مرتجع
                  </Button>
                )}
              {invoiceDetails?.type === 'SALE_RETURN' && onQuickExchangePos && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => onQuickExchangePos(invoiceDetails)}
                  leftIcon={<ShoppingBag className="w-3.5 h-3.5 text-brand" />}
                  className="bg-brand-soft text-brand border-brand/30 hover:bg-brand-soft/80 text-xs font-bold"
                >
                  استبدال بالكاشير (POS)
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              className="text-xs font-bold"
            >
              إغلاق
            </Button>
          </div>
        </div>
      </div>

      {invoiceDetails && (
        <PosReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          invoice={invoiceDetails}
        />
      )}
    </>
  );
};
