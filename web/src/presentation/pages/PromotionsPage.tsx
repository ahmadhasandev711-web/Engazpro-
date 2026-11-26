import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Percent,
  Gift,
  Sparkles,
  Calendar,
  AlertCircle,
  X,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { EcommercePlatform, Promotion, PromotionType, PromotionDiscountType, formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { useAuthStore } from '../../data/store/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useBranchScope } from '../../hooks/useBranchScope';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, StatCard } from '../components/ui';

interface PromoFormState {
  name: string;
  code: string;
  type: PromotionType;
  discount_type: PromotionDiscountType;
  discount_value: string | number;
  buy_quantity: string | number;
  get_quantity: string | number;
  branch_id: string;
  category_id: string;
  min_order_amount: string | number;
  max_discount_amount: string | number;
  max_uses: string | number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  sync_to_ecommerce: boolean;
}

const DEFAULT_FORM: PromoFormState = {
  name: '',
  code: '',
  type: PromotionType.COUPON,
  discount_type: PromotionDiscountType.PERCENTAGE,
  discount_value: 10,
  buy_quantity: 2,
  get_quantity: 1,
  branch_id: '',
  category_id: '',
  min_order_amount: 0,
  max_discount_amount: '',
  max_uses: '',
  starts_at: '',
  ends_at: '',
  is_active: true,
  sync_to_ecommerce: true,
};

const getSyncBadge = (promo: Promotion): { label: string; tone: 'ok' | 'bad' | 'neutral' } => {
  if (promo.sync_error) {
    return { label: 'خطأ مزامنة', tone: 'bad' };
  }
  if (promo.wc_coupon_id) {
    return { label: 'متزامن مع WooCommerce', tone: 'ok' };
  }
  if (promo.shopify_discount_id) {
    return { label: 'متزامن مع Shopify', tone: 'ok' };
  }
  return { label: 'محلي فقط', tone: 'neutral' };
};

const getPromoTypeLabel = (type: string): string => {
  switch (type) {
    case PromotionType.COUPON:
      return 'كوبون خصم';
    case PromotionType.BUY_X_GET_Y:
      return 'اشتري X واحصل على Y';
    default:
      return 'خصم تلقائي';
  }
};

export const PromotionsPage: React.FC = () => {
  const { confirm } = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const { isOwnerOrAdmin, isManager } = usePermissions();
  const { hasGlobalBranchAccess, lockedBranchId } = useBranchScope();
  const canManage = isOwnerOrAdmin || isManager;

  const [typeFilter, setTypeFilter] = useState<'ALL' | PromotionType>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromoFormState>(DEFAULT_FORM);

  const { data: promos = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ['promotions', user?.id],
    queryFn: async () => {
      const res = await apiClient.get('/promotions');
      return res.data?.data || [];
    },
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ['branches', user?.id],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data?.data || [];
    },
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const res = await apiClient.get('/categories');
      return res.data?.data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: PromoFormState) => {
      const body = {
        ...payload,
        code: payload.type === PromotionType.COUPON ? payload.code.trim().toUpperCase() : null,
        discount_value: Number(payload.discount_value) || 0,
        buy_quantity: payload.type === PromotionType.BUY_X_GET_Y ? Number(payload.buy_quantity) || 1 : null,
        get_quantity: payload.type === PromotionType.BUY_X_GET_Y ? Number(payload.get_quantity) || 1 : null,
        branch_id: payload.branch_id ? Number(payload.branch_id) : null,
        category_id: payload.category_id ? Number(payload.category_id) : null,
        min_order_amount: Number(payload.min_order_amount) || 0,
        max_discount_amount: payload.max_discount_amount !== '' ? Number(payload.max_discount_amount) : null,
        max_uses: payload.max_uses !== '' ? Number(payload.max_uses) : null,
        starts_at: payload.starts_at || null,
        ends_at: payload.ends_at || null,
      };
      return editingPromo ? apiClient.put(`/promotions/${editingPromo.id}`, body) : apiClient.post('/promotions', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success(editingPromo ? 'تم تحديث العرض بنجاح' : 'تم إنشاء العرض بنجاح');
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'تعذر حفظ بيانات العرض');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (promo: Promotion) => {
      return apiClient.put(`/promotions/${promo.id}`, {
        name: promo.name,
        code: promo.code,
        type: promo.type,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        buy_quantity: promo.buy_quantity,
        get_quantity: promo.get_quantity,
        branch_id: promo.branch_id,
        category_id: promo.category_id,
        min_order_amount: promo.min_order_amount,
        max_discount_amount: promo.max_discount_amount,
        max_uses: promo.max_uses,
        starts_at: promo.starts_at,
        ends_at: promo.ends_at,
        is_active: !promo.is_active,
        sync_to_ecommerce: promo.sync_to_ecommerce ?? true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiClient.delete(`/promotions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success('تم حذف العرض بنجاح');
    },
  });

  const pullStorePromotionsMutation = useMutation({
    mutationFn: async () => {
      const endpoint =
        user?.active_ecommerce_platform === EcommercePlatform.SHOPIFY
          ? '/shopify/sync-promotions'
          : '/woocommerce/sync-coupons';
      return apiClient.post(endpoint);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      toast.success(res.data?.message || 'تمت مزامنة كوبونات وعروض المتجر بنجاح');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'تعذر سحب كوبونات المتجر الإلكتروني');
    },
  });

  const openCreateModal = () => {
    setEditingPromo(null);
    setFormError(null);
    setFormData({
      ...DEFAULT_FORM,
      branch_id: !hasGlobalBranchAccess && lockedBranchId ? String(lockedBranchId) : '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormError(null);
    setFormData({
      name: promo.name,
      code: promo.code || '',
      type: promo.type as PromotionType,
      discount_type: promo.discount_type as PromotionDiscountType,
      discount_value: promo.discount_value,
      buy_quantity: promo.buy_quantity ?? 2,
      get_quantity: promo.get_quantity ?? 1,
      branch_id: promo.branch_id ? String(promo.branch_id) : '',
      category_id: promo.category_id ? String(promo.category_id) : '',
      min_order_amount: promo.min_order_amount ?? 0,
      max_discount_amount: promo.max_discount_amount ?? '',
      max_uses: promo.max_uses ?? '',
      starts_at: promo.starts_at || '',
      ends_at: promo.ends_at || '',
      is_active: promo.is_active,
      sync_to_ecommerce: promo.sync_to_ecommerce ?? true,
    });
    setIsModalOpen(true);
  };

  const filteredPromos = useMemo(
    () => (typeFilter === 'ALL' ? promos : promos.filter((p) => p.type === typeFilter)),
    [promos, typeFilter]
  );

  const activeCount = promos.filter((p) => p.is_active).length;
  const couponsCount = promos.filter((p) => p.type === PromotionType.COUPON).length;
  const totalUses = promos.reduce((acc, p) => acc + (p.used_count || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="العروض والكوبونات التلقائية"
        description="إدارة أكواد الخصم (Promo Codes)، عروض الكميات (Buy X Get Y)، والخصومات التلقائية المربوطة بسلة الكاشير والمرتجعات"
        badge={<Badge tone="brand">{promos.length} عرض</Badge>}
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {user?.active_ecommerce_platform && user.active_ecommerce_platform !== EcommercePlatform.EASYORDERS && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  isLoading={pullStorePromotionsMutation.isPending}
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                  onClick={() => pullStorePromotionsMutation.mutate()}
                >
                  سحب كوبونات المتجر
                </Button>
              )}
              <Button type="button" variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>
                إضافة عرض / كوبون جديد
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="إجمالي العروض" value={String(promos.length)} icon={<Tag className="w-4 h-4" />} />
        <StatCard label="العروض النشطة الآن" value={String(activeCount)} icon={<CheckCircle2 className="w-4 h-4 text-ok" />} />
        <StatCard label="كوبونات الخصم" value={String(couponsCount)} icon={<Percent className="w-4 h-4 text-brand" />} />
        <StatCard label="مرات الاستخدام" value={String(totalUses)} icon={<Sparkles className="w-4 h-4 text-warn" />} />
      </div>

      {user?.active_ecommerce_platform === EcommercePlatform.EASYORDERS && (
        <div className="p-3.5 rounded-2xl border bg-info-soft border-info/30 text-info text-xs font-bold">
          ملاحظة: كوبونات متجر EasyOrders تُدار مباشرة من لوحة EasyOrders (لعدم وجود API عام للكوبونات)، ويتم استيراد قيمة الخصم تلقائياً مع كل أوردر.
        </div>
      )}

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'ALL', label: 'الكل' },
            { id: PromotionType.COUPON, label: 'كوبونات الخصم' },
            { id: PromotionType.BUY_X_GET_Y, label: 'اشتري X واحصل على Y' },
            { id: PromotionType.CART_AUTO, label: 'خصومات تلقائية' },
          ].map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={typeFilter === tab.id ? 'primary' : 'secondary'}
              onClick={() => setTypeFilter(tab.id as any)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted">جاري تحميل العروض...</div>
        ) : filteredPromos.length === 0 ? (
          <EmptyState
            icon={<Gift className="w-8 h-8" />}
            title="لا توجد عروض مسجلة"
            description="أنشئ كوبون خصم أو عرض كميات ليتم تطبيقه آلياً داخل الكاشير مع حماية أسعار المرتجع."
            action={
              canManage ? (
                <Button type="button" variant="primary" size="md" onClick={openCreateModal} leftIcon={<Plus className="w-4 h-4" />}>
                  إنشاء أول عرض
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPromos.map((promo) => {
              const syncBadge = getSyncBadge(promo);
              return (
              <Card key={promo.id} className="p-4 space-y-3 border border-line bg-surface-2/40 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-black text-ink text-sm truncate">{promo.name}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <Badge tone="brand">{getPromoTypeLabel(promo.type)}</Badge>
                        {promo.code && (
                          <Badge tone="info" className="font-mono">
                            {promo.code}
                          </Badge>
                        )}
                        <Badge tone={promo.is_active ? 'ok' : 'bad'}>
                          {promo.is_active ? 'نشط' : 'متوقف'}
                        </Badge>
                        <Badge tone={syncBadge.tone}>{syncBadge.label}</Badge>
                      </div>
                    </div>
                  </div>
                  {promo.sync_error && (
                    <div className="p-2 rounded-xl bg-bad-soft/70 border border-bad/25 text-bad text-[11px] font-bold">
                      {promo.sync_error}
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-panel border border-line text-xs space-y-1">
                    {promo.type === PromotionType.BUY_X_GET_Y ? (
                      <p className="font-bold text-ink">
                        اشتري <span className="text-brand">{promo.buy_quantity}</span> واحصل على{' '}
                        <span className="text-brand">{promo.get_quantity}</span> بخصم{' '}
                        <span className="text-ok">{promo.discount_value}%</span>
                      </p>
                    ) : (
                      <p className="font-bold text-ink">
                        قيمة الخصم:{' '}
                        <span className="text-ok">
                          {promo.discount_type === PromotionDiscountType.PERCENTAGE
                            ? `${promo.discount_value}%`
                            : formatCurrency(promo.discount_value)}
                        </span>
                        {promo.max_discount_amount ? ` (بحد أقصى ${formatCurrency(promo.max_discount_amount)})` : ''}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                      <span>الفرع: {promo.branch_name || 'كل الفروع'}</span>
                      {promo.category_name && <span>التصنيف: {promo.category_name}</span>}
                      {promo.min_order_amount > 0 && <span>حد أدنى: {formatCurrency(promo.min_order_amount)}</span>}
                    </div>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-muted pt-1 border-t border-line/60">
                      <span>
                        الاستخدام: {promo.used_count} {promo.max_uses ? `/ ${promo.max_uses}` : '(مفتوح)'}
                      </span>
                      {(promo.starts_at || promo.ends_at) && (
                        <span className="flex items-center gap-1 tabular-nums">
                          <Calendar className="w-3 h-3" />
                          {promo.starts_at || 'الآن'} ← {promo.ends_at || 'مفتوح'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-line">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMutation.mutate(promo)}
                      leftIcon={promo.is_active ? <XCircle className="w-3.5 h-3.5 text-warn" /> : <CheckCircle2 className="w-3.5 h-3.5 text-ok" />}
                    >
                      {promo.is_active ? 'إيقاف' : 'تفعيل'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEditModal(promo)} leftIcon={<Edit2 className="w-3.5 h-3.5" />}>
                      تعديل
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-bad"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'حذف العرض',
                          message: `هل تريد حذف "${promo.name}"؟ لن تتأثر الفواتير المسجلة سابقاً.`,
                          type: 'danger',
                        });
                        if (ok) deleteMutation.mutate(promo.id);
                      }}
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      حذف
                    </Button>
                  </div>
                )}
              </Card>
              );
            })}
          </div>
        )}
      </Card>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm">
          <div className="bg-panel rounded-3xl border border-line shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-2">
              <h3 className="font-black text-ink text-base">{editingPromo ? 'تعديل العرض الترويجي' : 'إنشاء عرض أو كوبون جديد'}</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 text-muted hover:text-ink rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFormError(null);
                saveMutation.mutate(formData);
              }}
              className="p-6 space-y-4 overflow-y-auto"
            >
              {formError && (
                <div className="p-3 bg-bad-soft text-bad text-xs rounded-xl border border-bad/30 flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <Input
                label="اسم العرض *"
                required
                placeholder="مثال: خصم الصيف 20% أو عرض القطعتين والثالثة مجاناً"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="نوع العرض *"
                  value={formData.type}
                  onChange={(e) => {
                    const nextType = e.target.value as PromotionType;
                    setFormData({
                      ...formData,
                      type: nextType,
                      discount_type: nextType === PromotionType.BUY_X_GET_Y ? PromotionDiscountType.PERCENTAGE : formData.discount_type,
                      discount_value: nextType === PromotionType.BUY_X_GET_Y ? 100 : formData.discount_value,
                    });
                  }}
                >
                  <option value={PromotionType.COUPON}>كوبون خصم (Promo Code)</option>
                  <option value={PromotionType.BUY_X_GET_Y}>عرض كميات (اشتري X واحصل على Y)</option>
                  <option value={PromotionType.CART_AUTO}>خصم تلقائي (أوكازيون)</option>
                </Select>

                {formData.type === PromotionType.COUPON && (
                  <Input
                    label="كود الكوبون *"
                    required
                    placeholder="SUMMER20"
                    dir="ltr"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  />
                )}
              </div>

              {formData.type === PromotionType.BUY_X_GET_Y && (
                <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-surface-2 border border-line">
                  <Input
                    label="اشتري كمية"
                    type="number"
                    min="1"
                    required
                    value={formData.buy_quantity}
                    onChange={(e) => setFormData({ ...formData, buy_quantity: e.target.value })}
                  />
                  <Input
                    label="احصل على كمية"
                    type="number"
                    min="1"
                    required
                    value={formData.get_quantity}
                    onChange={(e) => setFormData({ ...formData, get_quantity: e.target.value })}
                  />
                  <Input
                    label="خصم المكافأة (%)"
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  />
                </div>
              )}

              {formData.type !== PromotionType.BUY_X_GET_Y && (
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="نوع الخصم"
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as PromotionDiscountType })}
                  >
                    <option value={PromotionDiscountType.PERCENTAGE}>نسبة مئوية (%)</option>
                    <option value={PromotionDiscountType.FIXED_AMOUNT}>مبلغ ثابت (ج.م)</option>
                  </Select>
                  <Input
                    label={formData.discount_type === PromotionDiscountType.PERCENTAGE ? 'نسبة الخصم (%)' : 'قيمة الخصم (ج.م)'}
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="الفرع المطبق به"
                  disabled={!hasGlobalBranchAccess && Boolean(lockedBranchId)}
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                >
                  <option value="">كل فروع المؤسسة</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>

                <Select
                  label="التصنيف المشمول (اختياري)"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                >
                  <option value="">كل التصنيفات</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="حد أدنى للفاتورة"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.min_order_amount}
                  onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                />
                <Input
                  label="أقصى خصم (ج.م)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="مفتوح"
                  value={formData.max_discount_amount}
                  onChange={(e) => setFormData({ ...formData, max_discount_amount: e.target.value })}
                />
                <Input
                  label="أقصى استخدامات"
                  type="number"
                  min="1"
                  placeholder="مفتوح"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="تاريخ البداية" type="date" value={formData.starts_at} onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })} />
                <Input label="تاريخ الانتهاء" type="date" value={formData.ends_at} onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })} />
              </div>

              {user?.active_ecommerce_platform && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-2 border border-line text-xs font-bold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.sync_to_ecommerce}
                    onChange={(e) => setFormData({ ...formData, sync_to_ecommerce: e.target.checked })}
                    className="w-4 h-4 accent-brand rounded cursor-pointer"
                  />
                  <Globe className="w-4 h-4 text-brand shrink-0" />
                  <span>مزامنة العرض مع المتجر الإلكتروني المتصل</span>
                </label>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <Button type="button" variant="ghost" size="md" onClick={() => setIsModalOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" variant="primary" size="md" isLoading={saveMutation.isPending}>
                  {editingPromo ? 'حفظ التعديلات' : 'إنشاء العرض'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
