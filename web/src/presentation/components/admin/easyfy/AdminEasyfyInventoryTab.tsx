import React, { useState } from 'react';
import { AlertTriangle, Boxes, PlusCircle, TrendingUp, X } from 'lucide-react';
import {
  EasyfyProductVariant,
  EasyfyStockMovementType,
  formatCurrency,
} from '@pos-mandob/shared';
import {
  useAdjustEasyfyStock,
  useAdminEasyfyDemandReport,
  useAdminEasyfyInventory,
} from '../../../../hooks/useAdminEasyfy';
import { useToast } from '../../../context/ToastContext';
import { Badge, Button, Card, DataTable, EmptyState, Input, Select } from '../../ui';
import { MOVEMENT_TYPE_META, STOCK_MODE_META } from './easyfyUiMeta';

export const AdminEasyfyInventoryTab: React.FC = () => {
  const toast = useToast();
  const { data: inventory, isLoading } = useAdminEasyfyInventory();
  const { data: demand } = useAdminEasyfyDemandReport();
  const adjustMutation = useAdjustEasyfyStock();

  const [selectedVariant, setSelectedVariant] = useState<EasyfyProductVariant | null>(null);
  const [adjustType, setAdjustType] = useState<EasyfyStockMovementType>(
    EasyfyStockMovementType.RESTOCK
  );
  const [qtyDelta, setQtyDelta] = useState<string>('10');
  const [unitCost, setUnitCost] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const openAdjustModal = (variant: EasyfyProductVariant) => {
    setSelectedVariant(variant);
    setAdjustType(EasyfyStockMovementType.RESTOCK);
    setQtyDelta('10');
    setUnitCost(variant.cost_price !== undefined ? String(variant.cost_price) : '');
    setNotes('');
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;
    const delta = Number(qtyDelta);
    if (!Number.isInteger(delta) || delta === 0) {
      toast.error('يرجى إدخال كمية صحيحة غير صفرية.');
      return;
    }
    try {
      await adjustMutation.mutateAsync({
        variantId: selectedVariant.id,
        type: adjustType,
        quantity_delta: delta,
        unit_cost: unitCost ? Number(unitCost) : undefined,
        notes: notes || undefined,
      });
      toast.success('تم تعديل المخزون وتسجيل الحركة بنجاح.');
      setSelectedVariant(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر تحديث المخزون');
    }
  };

  const variants = inventory?.variants ?? [];
  const lowCount = inventory?.low_stock_count ?? 0;
  const customDemand = demand?.unlimited_and_custom_demand ?? [];

  return (
    <div className="space-y-6">
      {lowCount > 0 && (
        <Card className="p-4 border-warn/30 bg-warn-soft/50 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-warn shrink-0" />
          <p className="text-sm font-bold text-ink">
            تنبيه: يوجد <span className="text-warn font-black">{lowCount}</span> أصناف بمخزون فعلي
            وصلت للحد الأدنى أو أقل وتحتاج إعادة توريد.
          </p>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Boxes className="w-5 h-5 text-brand" />
          <h3 className="font-black text-base text-ink">جرد المنتجات ذات المخزون الفعلي (TRACKED)</h3>
        </div>

        {isLoading ? (
          <div className="h-36 rounded-xl bg-surface-2 animate-pulse" />
        ) : variants.length === 0 ? (
          <EmptyState
            icon={<Boxes className="w-8 h-8 text-muted" />}
            title="لا توجد أصناف بمخزون فعلي بعد"
            description="المنتجات المضبوطة على نظام المخزون الفعلي ستظهر هنا لمتابعة الرصيد وحركات التوريد."
          />
        ) : (
          <DataTable>
            <thead className="bg-surface-2 text-xs text-muted font-extrabold">
              <tr>
                <th className="px-4 py-3">المنتج والمقاس</th>
                <th className="px-4 py-3">الرصيد الحالي</th>
                <th className="px-4 py-3">التكلفة / البيع</th>
                <th className="px-4 py-3">آخر الحركات</th>
                <th className="px-4 py-3 text-left">توريد / تسوية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {variants.map((v) => {
                const isLow = v.stock_quantity <= v.low_stock_threshold;
                return (
                  <tr key={v.id} className="hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink">{v.product?.name || `منتج #${v.product_id}`}</p>
                      <p className="text-xs text-muted">
                        {v.label} {v.sku ? `• ${v.sku}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={isLow ? 'bad' : 'ok'}>
                        {v.stock_quantity} (تنبيه: {v.low_stock_threshold})
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold">
                      <span className="text-muted">شراء: {formatCurrency(v.cost_price ?? 0)}</span>
                      <span className="mx-1.5 text-line-2">|</span>
                      <span className="text-ink">بيع: {formatCurrency(v.selling_price)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(v.stock_movements ?? []).map((m) => {
                          const meta = MOVEMENT_TYPE_META[m.type] ?? {
                            label: String(m.type),
                            tone: 'neutral' as const,
                          };
                          return (
                            <Badge key={m.id} tone={meta.tone}>
                              {meta.label}: {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                            </Badge>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                        onClick={() => openAdjustModal(v)}
                      >
                        تعديل الرصيد
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Card>

      {/* Demand Analytics for UNLIMITED & MADE_TO_ORDER */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-ok" />
          <div>
            <h3 className="font-black text-base text-ink">رادار الطلب على المنتجات بدون مخزون وحسب الطلب</h3>
            <p className="text-xs text-muted">
              يساعدك هذا التقرير في معرفة الأصناف التي يطلبها التجار بكثرة لتبدأ في تخزينها لاحقاً.
            </p>
          </div>
        </div>

        {customDemand.length === 0 ? (
          <p className="text-xs text-muted py-4 text-center bg-canvas rounded-xl border border-line">
            لا توجد طلبات مسجلة على المنتجات غير المخزنية أو المخصصة حتى الآن.
          </p>
        ) : (
          <DataTable>
            <thead className="bg-surface-2 text-xs text-muted font-extrabold">
              <tr>
                <th className="px-4 py-3">المنتج والمقاس</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">إجمالي الكمية المطلوبة</th>
                <th className="px-4 py-3">عدد الطلبات</th>
                <th className="px-4 py-3">الإيراد</th>
                <th className="px-4 py-3">صافي الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customDemand.map((row, idx) => {
                const modeMeta = STOCK_MODE_META[row.stock_mode] ?? {
                  label: String(row.stock_mode),
                  tone: 'neutral' as const,
                };
                return (
                  <tr key={`${row.variant_id ?? 'u'}-${idx}`}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink">{row.product_name}</p>
                      <p className="text-xs text-muted">{row.variant_label}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={modeMeta.tone}>{modeMeta.label}</Badge>
                    </td>
                    <td className="px-4 py-3 font-black text-brand tabular-nums">
                      {Number(row.total_qty)}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-ink tabular-nums">
                      {Number(row.orders_count)}
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-ink tabular-nums">
                      {formatCurrency(Number(row.total_revenue ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-xs font-black text-ok tabular-nums">
                      {formatCurrency(Number(row.total_profit ?? 0))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </Card>

      {selectedVariant && (
        <div
          className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedVariant(null)}
          dir="rtl"
        >
          <div
            className="w-full max-w-md bg-panel border border-line rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-base text-ink">
                تعديل مخزون: {selectedVariant.product?.name} ({selectedVariant.label})
              </h3>
              <button
                type="button"
                onClick={() => setSelectedVariant(null)}
                className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-muted hover:text-ink"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3">
              <Select
                label="نوع الحركة"
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as EasyfyStockMovementType)}
                options={[
                  { value: EasyfyStockMovementType.RESTOCK, label: 'توريد بضاعة (+)' },
                  { value: EasyfyStockMovementType.ADJUSTMENT, label: 'تسوية جرد (+ أو -)' },
                  { value: EasyfyStockMovementType.OPENING, label: 'رصيد افتتاحي (+)' },
                ]}
              />
              <Input
                type="number"
                required
                label="التغيير في الكمية (موجب للزيادة أو سالب للخصم)"
                value={qtyDelta}
                onChange={(e) => setQtyDelta(e.target.value)}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                label="سعر التكلفة المحدث (اختياري)"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
              <Input
                label="ملاحظات"
                placeholder="مثال: فاتورة شراء رقم 205"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setSelectedVariant(null)}>
                  إلغاء
                </Button>
                <Button type="submit" isLoading={adjustMutation.isPending}>
                  حفظ الحركة
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
