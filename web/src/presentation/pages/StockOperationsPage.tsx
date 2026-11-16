import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Package,
  SlidersHorizontal,
  History,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { formatCurrency, LowStockAlertItem, StockAdjustmentMode } from '@pos-mandob/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../data/store/useAuthStore';
import { useStockAlerts, useStockMovements, useAdjustStockMutation } from '../../hooks/useStockOperations';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, StatCard, Tabs } from '../components/ui';
import { PaginationBar } from '../components/common/PaginationBar';

type TabKey = 'alerts' | 'adjust' | 'movements';

const SOURCE_LABELS: Record<string, string> = {
  SALE: 'بيع',
  PURCHASE: 'شراء',
  SALE_RETURN: 'مرتجع بيع',
  PURCHASE_RETURN: 'مرتجع شراء',
  ADJUSTMENT: 'تسوية جرد / تالف',
  INITIAL: 'رصيد افتتاحي',
  TRANSFER_IN: 'تحويل وارد',
  TRANSFER_OUT: 'تحويل صادر',
};

export const StockOperationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isManager } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<TabKey>('alerts');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Shared branches & products for dropdowns
  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      const d = res.data?.data;
      return Array.isArray(d) ? d : (d?.data || []);
    },
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['products-compact'],
    queryFn: async () => {
      const res = await apiClient.get('/products', { params: { per_page: 100 } });
      const d = res.data?.data;
      return Array.isArray(d) ? d : (d?.data || []);
    },
  });

  // Tab 1: Alerts state
  const [alertBranchId, setAlertBranchId] = useState<number | ''>('');
  const [alertStatus, setAlertStatus] = useState('ALL');
  const [alertSearch, setAlertSearch] = useState('');
  const [selectedAlerts, setSelectedAlerts] = useState<Record<number, number>>({});

  const { data: alertsData, isLoading: isAlertsLoading } = useStockAlerts(
    { branch_id: alertBranchId, status: alertStatus, search: alertSearch },
    activeTab === 'alerts'
  );

  // Tab 2: Adjustment form state
  const defaultBranch = useMemo(() => (isManager && user?.branch_id ? user.branch_id : branches[0]?.id || ''), [isManager, user?.branch_id, branches]);
  const [adjBranchId, setAdjBranchId] = useState<number | ''>('');
  const [adjProductId, setAdjProductId] = useState<number | ''>('');
  const [adjVariantId, setAdjVariantId] = useState<number | ''>('');
  const [adjMode, setAdjMode] = useState<StockAdjustmentMode>('SET_ACTUAL');
  const [adjQty, setAdjQty] = useState<string>('0');
  const [adjReason, setAdjReason] = useState<string>('جرد فعلي');
  const [adjNotes, setAdjNotes] = useState<string>('');
  const adjustMutation = useAdjustStockMutation();

  const selectedProduct = useMemo(() => products.find((p: any) => p.id === Number(adjProductId)), [products, adjProductId]);

  // Tab 3: Movements filter state
  const [movBranchId, setMovBranchId] = useState<number | ''>('');
  const [movSourceType, setMovSourceType] = useState('');
  const [movSearch, setMovSearch] = useState('');
  const [movPage, setMovPage] = useState(1);

  const { data: movRes, isLoading: isMovLoading } = useStockMovements(
    { branch_id: movBranchId, source_type: movSourceType, search: movSearch, page: movPage },
    activeTab === 'movements'
  );

  const notify = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  const toggleAlertSelect = (item: LowStockAlertItem) => {
    setSelectedAlerts((prev) => {
      const next = { ...prev };
      if (next[item.branch_stock_id] !== undefined) {
        delete next[item.branch_stock_id];
      } else {
        next[item.branch_stock_id] = item.suggested_reorder_qty;
      }
      return next;
    });
  };

  const handleCreatePurchaseFromAlerts = () => {
    const chosen = (alertsData?.low_stock_items || []).filter((i) => selectedAlerts[i.branch_stock_id] !== undefined);
    if (chosen.length === 0) {
      notify('error', 'يرجى تحديد صنف واحد على الأقل لإدراجه في فاتورة الشراء.');
      return;
    }

    const prefillItems = chosen.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name || 'صنف',
      product_variant_id: item.product_variant_id ?? undefined,
      variant_name: item.variant_name ?? undefined,
      unit_name: item.unit || 'قطعة',
      quantity: Math.max(1, selectedAlerts[item.branch_stock_id] || item.suggested_reorder_qty),
      unit_price: item.last_purchase_price || 0,
    }));

    navigate('/purchases/new', {
      state: {
        prefillItems,
        branch_id: chosen[0].branch_id,
        party_id: chosen.find((c) => c.last_supplier_id)?.last_supplier_id ?? null,
      },
    });
  };

  const handleSubmitAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    const branchId = Number(adjBranchId || defaultBranch);
    if (!branchId || !adjProductId || !adjReason.trim()) {
      notify('error', 'يرجى اختيار الفرع والصنف وكتابة سبب التسوية.');
      return;
    }

    adjustMutation.mutate(
      {
        branch_id: branchId,
        product_id: Number(adjProductId),
        product_variant_id: adjVariantId ? Number(adjVariantId) : null,
        mode: adjMode,
        quantity: Number(adjQty || 0),
        reason: adjReason.trim(),
        notes: adjNotes.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          notify('success', res.data?.message || 'تمت تسوية المخزون بنجاح');
          setAdjNotes('');
        },
        onError: (err: any) => notify('error', err.response?.data?.message || 'فشل اعتماد التسوية'),
      }
    );
  };

  const lowItems = alertsData?.low_stock_items || [];
  const expBatches = alertsData?.expiring_batches || [];
  const summary = alertsData?.summary;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      <PageHeader
        title="العمليات المخزنية والنواقص"
        description="متابعة نواقص الفروع وإعادة الطلب السريع، تسوية الجرد والتالف، وسجل حركات المخزون التفصيلي"
      />

      {feedback && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold ${feedback.type === 'success' ? 'bg-ok-soft border-ok/20 text-ok' : 'bg-bad-soft border-bad/20 text-bad'}`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <Tabs
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as TabKey)}
        tabs={[
          { id: 'alerts', label: 'تنبيهات النواقص والصلاحية', icon: <AlertTriangle className="w-4 h-4" />, count: summary?.total_alerts },
          { id: 'adjust', label: 'تسوية الجرد والتالف', icon: <SlidersHorizontal className="w-4 h-4" /> },
          { id: 'movements', label: 'دفتر حركات المخزون', icon: <History className="w-4 h-4" /> },
        ]}
      />

      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="أصناف نفد رصيدها (صفر)" value={summary?.out_of_stock_count ?? 0} tone={(summary?.out_of_stock_count ?? 0) > 0 ? 'bad' : 'neutral'} />
            <StatCard label="أصناف تحت حد الطلب" value={summary?.low_stock_count ?? 0} tone={(summary?.low_stock_count ?? 0) > 0 ? 'warn' : 'neutral'} />
            <StatCard label="تشغيلات قريبة الانتهاء / منتهية" value={summary?.expiring_batches_count ?? 0} tone={(summary?.expiring_batches_count ?? 0) > 0 ? 'warn' : 'neutral'} />
          </div>

          <Card className="p-4 flex flex-col sm:flex-row gap-3 items-end justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
              <Input label="بحث بالصنف أو الكود" value={alertSearch} onChange={(e) => setAlertSearch(e.target.value)} placeholder="اسم الصنف..." />
              <Select
                label="الحالة"
                value={alertStatus}
                onChange={(e) => setAlertStatus(e.target.value)}
                options={[
                  { value: 'ALL', label: 'كل التنبيهات' },
                  { value: 'OUT_OF_STOCK', label: 'نفد بالكامل (صفر)' },
                  { value: 'LOW_STOCK', label: 'تحت حد الطلب' },
                ]}
              />
              {!isManager && (
                <Select
                  label="الفرع"
                  value={alertBranchId}
                  onChange={(e) => setAlertBranchId(e.target.value ? Number(e.target.value) : '')}
                  options={[{ value: '', label: 'كافة الفروع' }, ...branches.map((b: any) => ({ value: b.id, label: b.name }))]}
                />
              )}
            </div>
            <Button
              variant="primary"
              disabled={Object.keys(selectedAlerts).length === 0}
              onClick={handleCreatePurchaseFromAlerts}
              leftIcon={<ShoppingCart className="w-4 h-4" />}
            >
              إنشاء فاتورة شراء ({Object.keys(selectedAlerts).length})
            </Button>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-black text-ink">أصناف تحت حد الطلب والمقترح شرائه</h3>
            {isAlertsLoading ? (
              <div className="py-10 text-center text-xs text-muted">جاري فحص أرصدة الفروع...</div>
            ) : lowItems.length === 0 ? (
              <EmptyState icon={<Package className="w-6 h-6 text-ok" />} title="ممتاز! لا توجد نواقص مخزون حالياً" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="py-2 px-2">اختيار</th>
                      <th className="py-2 px-2">الصنف / المتغير</th>
                      <th className="py-2 px-2">الفرع</th>
                      <th className="py-2 px-2 text-center">الرصيد الحالي</th>
                      <th className="py-2 px-2 text-center">حد الطلب</th>
                      <th className="py-2 px-2">آخر مورد / آخر سعر</th>
                      <th className="py-2 px-2 text-center">كمية إعادة الطلب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowItems.map((item) => {
                      const isChecked = selectedAlerts[item.branch_stock_id] !== undefined;
                      return (
                        <tr key={item.branch_stock_id} className="border-b border-line/60 hover:bg-surface-2/40">
                          <td className="py-2.5 px-2">
                            <input type="checkbox" checked={isChecked} onChange={() => toggleAlertSelect(item)} />
                          </td>
                          <td className="py-2.5 px-2 font-bold text-ink">
                            {item.product_name} {item.variant_name && <span className="text-muted">({item.variant_name})</span>}
                          </td>
                          <td className="py-2.5 px-2 text-muted">{item.branch_name}</td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            <Badge tone={item.is_out_of_stock ? 'bad' : 'warn'}>{item.quantity}</Badge>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-muted">{item.min_quantity}</td>
                          <td className="py-2.5 px-2">
                            <div className="font-bold text-ink">{item.last_supplier_name || '—'}</div>
                            <div className="text-[11px] font-mono text-muted" dir="ltr">{formatCurrency(item.last_purchase_price)}</div>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min={1}
                              value={isChecked ? selectedAlerts[item.branch_stock_id] : item.suggested_reorder_qty}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value || 1));
                                setSelectedAlerts((prev) => ({ ...prev, [item.branch_stock_id]: val }));
                              }}
                              className="w-20 px-2 py-1 text-center rounded-lg border border-line bg-canvas text-ink font-mono"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {expBatches.length > 0 && (
            <Card className="p-5 space-y-3">
              <h3 className="text-sm font-black text-ink flex items-center gap-2">
                <Clock className="w-4 h-4 text-warn" /> تشغيلات قريبة من انتهاء الصلاحية أو منتهية ({expBatches.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="py-2 px-2">الصنف</th>
                      <th className="py-2 px-2">رقم التشغيلة</th>
                      <th className="py-2 px-2">تاريخ الانتهاء</th>
                      <th className="py-2 px-2 text-center">الكمية المتبقية</th>
                      <th className="py-2 px-2 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expBatches.map((b) => (
                      <tr key={b.batch_id} className="border-b border-line/60">
                        <td className="py-2 px-2 font-bold text-ink">{b.product_name} {b.variant_name ? `(${b.variant_name})` : ''}</td>
                        <td className="py-2 px-2 font-mono">{b.batch_number}</td>
                        <td className="py-2 px-2 font-mono">{b.expiry_date}</td>
                        <td className="py-2 px-2 text-center font-mono font-bold">{b.quantity}</td>
                        <td className="py-2 px-2 text-center">
                          <Badge tone={b.is_expired ? 'bad' : 'warn'}>{b.is_expired ? 'منتهية الصلاحية' : `متبقي ${b.days_remaining} يوم`}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'adjust' && (
        <Card className="p-6 max-w-2xl">
          <form onSubmit={handleSubmitAdjust} className="space-y-4">
            <h3 className="text-base font-black text-ink">تسوية جرد فعلي أو خصم تالف / هالك</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="الفرع / المخزن"
                value={adjBranchId || defaultBranch}
                disabled={isManager && Boolean(user?.branch_id)}
                onChange={(e) => setAdjBranchId(e.target.value ? Number(e.target.value) : '')}
                options={branches.map((b: any) => ({ value: b.id, label: b.name }))}
              />
              <Select
                label="الصنف"
                value={adjProductId}
                onChange={(e) => {
                  setAdjProductId(e.target.value ? Number(e.target.value) : '');
                  setAdjVariantId('');
                }}
                options={[{ value: '', label: 'اختر الصنف...' }, ...products.map((p: any) => ({ value: p.id, label: `${p.name} (رصيد: ${p.quantity})` }))]}
              />
            </div>

            {selectedProduct?.variants && selectedProduct.variants.length > 0 && (
              <Select
                label="المتغير"
                value={adjVariantId}
                onChange={(e) => setAdjVariantId(e.target.value ? Number(e.target.value) : '')}
                options={[
                  { value: '', label: 'اختر المتغير...' },
                  ...selectedProduct.variants.map((v: any) => ({ value: v.id, label: `${v.name} (${v.quantity})` })),
                ]}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="نوع التسوية"
                value={adjMode}
                onChange={(e) => setAdjMode(e.target.value as StockAdjustmentMode)}
                options={[
                  { value: 'SET_ACTUAL', label: 'اعتماد الرصيد الفعلي (جرد)' },
                  { value: 'INCREASE', label: 'زيادة رصيد (فائض)' },
                  { value: 'DECREASE', label: 'خصم رصيد (تالف / هالك / عجز)' },
                ]}
              />
              <Input label={adjMode === 'SET_ACTUAL' ? 'الرصيد الفعلي الموجود بالفرع' : 'كمية التسوية'} type="number" step="0.01" min="0" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} />
            </div>

            <Input label="سبب التسوية (مطلوب للتوثيق)" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="مثال: جرد نهاية الشهر / كسر أثناء الشحن" />
            <Input label="ملاحظات إضافية (اختياري)" value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)} />

            <Button type="submit" variant="primary" isLoading={adjustMutation.isPending}>
              اعتماد التسوية وتحديث الأرصدة
            </Button>
          </form>
        </Card>
      )}

      {activeTab === 'movements' && (
        <div className="space-y-4">
          <Card className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="بحث بالصنف أو الملاحظات" value={movSearch} onChange={(e) => { setMovSearch(e.target.value); setMovPage(1); }} placeholder="اسم الصنف أو السبب..." />
            <Select
              label="مصدر الحركة"
              value={movSourceType}
              onChange={(e) => { setMovSourceType(e.target.value); setMovPage(1); }}
              options={[
                { value: '', label: 'كافة المصادر' },
                { value: 'SALE', label: 'بيع' },
                { value: 'PURCHASE', label: 'شراء' },
                { value: 'ADJUSTMENT', label: 'تسوية جرد / تالف' },
                { value: 'TRANSFER_IN', label: 'تحويل وارد' },
                { value: 'TRANSFER_OUT', label: 'تحويل صادر' },
                { value: 'INITIAL', label: 'رصيد افتتاحي' },
              ]}
            />
            {!isManager && (
              <Select
                label="الفرع"
                value={movBranchId}
                onChange={(e) => { setMovBranchId(e.target.value ? Number(e.target.value) : ''); setMovPage(1); }}
                options={[{ value: '', label: 'كافة الفروع' }, ...branches.map((b: any) => ({ value: b.id, label: b.name }))]}
              />
            )}
          </Card>

          <Card className="p-5 space-y-4">
            {isMovLoading ? (
              <div className="py-10 text-center text-xs text-muted">جاري تحميل حركات المخزون...</div>
            ) : !movRes?.data || movRes.data.length === 0 ? (
              <EmptyState icon={<History className="w-6 h-6 text-muted" />} title="لا توجد حركات مطابقة" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th className="py-2 px-2">التاريخ</th>
                        <th className="py-2 px-2">الصنف</th>
                        <th className="py-2 px-2">الفرع</th>
                        <th className="py-2 px-2">النوع والمصدر</th>
                        <th className="py-2 px-2 text-center">الكمية</th>
                        <th className="py-2 px-2 text-center">الرصيد بعد</th>
                        <th className="py-2 px-2">البيان / السبب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movRes.data.map((m) => (
                        <tr key={m.id} className="border-b border-line/60">
                          <td className="py-2 px-2 font-mono text-muted">{m.created_at ? new Date(m.created_at).toLocaleDateString('ar-EG') : '—'}</td>
                          <td className="py-2 px-2 font-bold text-ink">{m.product_name} {m.variant_name ? `(${m.variant_name})` : ''}</td>
                          <td className="py-2 px-2 text-muted">{m.branch_name || '—'}</td>
                          <td className="py-2 px-2">
                            <Badge tone={m.type === 'IN' ? 'ok' : 'warn'}>{m.type === 'IN' ? 'وارد +' : 'منصرف −'}</Badge>{' '}
                            <span className="text-[11px] text-muted">{SOURCE_LABELS[m.source_type] || m.source_type}</span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold">{m.quantity}</td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-brand-ink">{m.balance_after}</td>
                          <td className="py-2 px-2 text-muted">{m.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {movRes.meta && (
                  <PaginationBar
                    currentPage={movRes.meta.current_page}
                    lastPage={movRes.meta.last_page}
                    total={movRes.meta.total}
                    perPage={movRes.meta.per_page}
                    onPageChange={setMovPage}
                  />
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
