import React, { useEffect, useState } from 'react';
import { MapPin, Settings, Tag, Trash2 } from 'lucide-react';
import {
  EasyfyCoupon,
  EasyfyCouponType,
  EasyfyShippingZone,
  EasyfyStoreSettings,
  formatCurrency,
} from '@pos-mandob/shared';
import {
  useAdminEasyfyCoupons,
  useAdminEasyfySettings,
  useAdminEasyfyShippingZones,
  useDeleteEasyfyCoupon,
  useDeleteEasyfyShippingZone,
  useSaveEasyfyCoupon,
  useSaveEasyfyShippingZone,
  useUpdateEasyfySettings,
} from '../../../../hooks/useAdminEasyfy';
import { useConfirm } from '../../../context/ConfirmContext';
import { useToast } from '../../../context/ToastContext';
import { Badge, Button, Card, DataTable, Input, Select, Textarea } from '../../ui';
import { COUPON_TYPE_LABEL } from './easyfyUiMeta';

export const AdminEasyfyConfigTab: React.FC = () => {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [subTab, setSubTab] = useState<'settings' | 'zones' | 'coupons'>('settings');

  // Store Settings state
  const { data: settingsData } = useAdminEasyfySettings();
  const updateSettingsMutation = useUpdateEasyfySettings();
  const [settingsForm, setSettingsForm] = useState<Partial<EasyfyStoreSettings>>({});

  useEffect(() => {
    if (settingsData) setSettingsForm(settingsData);
  }, [settingsData]);

  // Shipping Zones state
  const { data: zones = [] } = useAdminEasyfyShippingZones();
  const saveZoneMutation = useSaveEasyfyShippingZone();
  const deleteZoneMutation = useDeleteEasyfyShippingZone();
  const [zoneEditId, setZoneEditId] = useState<number | undefined>(undefined);
  const [zoneName, setZoneName] = useState<string>('');
  const [zoneFee, setZoneFee] = useState<string>('50');
  const [zoneThreshold, setZoneThreshold] = useState<string>('');
  const [zoneDays, setZoneDays] = useState<string>('1-3 أيام');
  const [zoneActive, setZoneActive] = useState<boolean>(true);

  // Coupons state
  const { data: coupons = [] } = useAdminEasyfyCoupons();
  const saveCouponMutation = useSaveEasyfyCoupon();
  const deleteCouponMutation = useDeleteEasyfyCoupon();
  const [couponEditId, setCouponEditId] = useState<number | undefined>(undefined);
  const [couponCode, setCouponCode] = useState<string>('');
  const [couponType, setCouponType] = useState<EasyfyCouponType>(EasyfyCouponType.PERCENTAGE);
  const [couponValue, setCouponValue] = useState<string>('10');
  const [couponMinOrder, setCouponMinOrder] = useState<string>('');
  const [couponMaxDisc, setCouponMaxDisc] = useState<string>('');
  const [couponMaxUses, setCouponMaxUses] = useState<string>('');
  const [couponPerAcc, setCouponPerAcc] = useState<string>('1');
  const [couponExpires, setCouponExpires] = useState<string>('');
  const [couponActive, setCouponActive] = useState<boolean>(true);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettingsMutation.mutateAsync({
        ...settingsForm,
        default_shipping_fee: Number(settingsForm.default_shipping_fee ?? 0),
        free_shipping_threshold:
          settingsForm.free_shipping_threshold === null ||
          settingsForm.free_shipping_threshold === undefined ||
          String(settingsForm.free_shipping_threshold) === ''
            ? null
            : Number(settingsForm.free_shipping_threshold),
      });
      toast.success('تم حفظ إعدادات المتجر والدفع بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ الإعدادات');
    }
  };

  const resetZoneForm = () => {
    setZoneEditId(undefined);
    setZoneName('');
    setZoneFee('50');
    setZoneThreshold('');
    setZoneDays('1-3 أيام');
    setZoneActive(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName.trim()) {
      toast.error('يرجى إدخال اسم المحافظة أو المنطقة.');
      return;
    }
    try {
      await saveZoneMutation.mutateAsync({
        id: zoneEditId,
        governorate_name: zoneName.trim(),
        shipping_fee: Number(zoneFee || 0),
        free_shipping_threshold: zoneThreshold ? Number(zoneThreshold) : null,
        estimated_days: zoneDays || null,
        is_active: zoneActive,
      });
      resetZoneForm();
      toast.success('تم حفظ منطقة الشحن بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ منطقة الشحن');
    }
  };

  const handleDeleteZone = async (zone: EasyfyShippingZone) => {
    const ok = await confirm({
      title: 'حذف منطقة شحن',
      message: `هل تريد حذف منطقة "${zone.governorate_name}"؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteZoneMutation.mutateAsync(zone.id);
      toast.success('تم حذف منطقة الشحن.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حذف منطقة الشحن');
    }
  };

  const resetCouponForm = () => {
    setCouponEditId(undefined);
    setCouponCode('');
    setCouponType(EasyfyCouponType.PERCENTAGE);
    setCouponValue('10');
    setCouponMinOrder('');
    setCouponMaxDisc('');
    setCouponMaxUses('');
    setCouponPerAcc('1');
    setCouponExpires('');
    setCouponActive(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) {
      toast.error('يرجى إدخال كود الخصم.');
      return;
    }
    try {
      await saveCouponMutation.mutateAsync({
        id: couponEditId,
        code: couponCode.trim().toUpperCase(),
        discount_type: couponType,
        discount_value: Number(couponValue || 0),
        min_order_amount: couponMinOrder ? Number(couponMinOrder) : null,
        max_discount_amount: couponMaxDisc ? Number(couponMaxDisc) : null,
        max_uses: couponMaxUses ? Number(couponMaxUses) : null,
        max_uses_per_account: couponPerAcc ? Number(couponPerAcc) : null,
        expires_at: couponExpires || null,
        is_active: couponActive,
      });
      resetCouponForm();
      toast.success('تم حفظ الكوبون بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ الكوبون');
    }
  };

  const handleDeleteCoupon = async (coupon: EasyfyCoupon) => {
    const ok = await confirm({
      title: 'حذف كوبون',
      message: `هل تريد حذف الكوبون "${coupon.code}"؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteCouponMutation.mutateAsync(coupon.id);
      toast.success('تم حذف الكوبون.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حذف الكوبون');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant={subTab === 'settings' ? 'primary' : 'secondary'}
          leftIcon={<Settings className="w-4 h-4" />}
          onClick={() => setSubTab('settings')}
        >
          إعدادات الدفع والتنبيهات
        </Button>
        <Button
          size="sm"
          variant={subTab === 'zones' ? 'primary' : 'secondary'}
          leftIcon={<MapPin className="w-4 h-4" />}
          onClick={() => setSubTab('zones')}
        >
          مناطق وأسعار الشحن ({zones.length})
        </Button>
        <Button
          size="sm"
          variant={subTab === 'coupons' ? 'primary' : 'secondary'}
          leftIcon={<Tag className="w-4 h-4" />}
          onClick={() => setSubTab('coupons')}
        >
          كوبونات الخصم ({coupons.length})
        </Button>
      </div>

      {subTab === 'settings' && (
        <Card className="p-5">
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-canvas p-4 rounded-xl border border-line text-xs font-bold text-ink">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settingsForm.store_enabled)}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, store_enabled: e.target.checked }))}
                />
                <span>فتح المتجر للعملاء</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settingsForm.cod_enabled)}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, cod_enabled: e.target.checked }))}
                />
                <span>تفعيل الدفع عند الاستلام</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settingsForm.instapay_enabled)}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, instapay_enabled: e.target.checked }))}
                />
                <span>تفعيل InstaPay</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settingsForm.vodafone_cash_enabled)}
                  onChange={(e) =>
                    setSettingsForm((p) => ({ ...p, vodafone_cash_enabled: e.target.checked }))
                  }
                />
                <span>تفعيل فودافون كاش</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="عنوان InstaPay (Handle / IPA)"
                placeholder="easyfy@instapay"
                value={settingsForm.instapay_handle ?? ''}
                onChange={(e) => setSettingsForm((p) => ({ ...p, instapay_handle: e.target.value }))}
              />
              <Input
                label="اسم المستلم على InstaPay"
                value={settingsForm.instapay_name ?? ''}
                onChange={(e) => setSettingsForm((p) => ({ ...p, instapay_name: e.target.value }))}
              />
              <Input
                label="رقم محفظة فودافون كاش"
                placeholder="010xxxxxxxx"
                value={settingsForm.vodafone_cash_number ?? ''}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, vodafone_cash_number: e.target.value }))
                }
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                label="رسوم الشحن الافتراضية (ج.م)"
                value={String(settingsForm.default_shipping_fee ?? 50)}
                onChange={(e) =>
                  setSettingsForm((p) => ({
                    ...p,
                    default_shipping_fee: Number(e.target.value),
                  }))
                }
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                label="حد الشحن المجاني العام (اتركه فارغاً للإلغاء)"
                value={settingsForm.free_shipping_threshold ?? ''}
                onChange={(e) =>
                  setSettingsForm((p) => ({
                    ...p,
                    free_shipping_threshold: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
              <Input
                label="بريد تنبيه الطلبات الجديدة (SMTP)"
                type="email"
                placeholder="orders@easyfy.cloud"
                value={settingsForm.admin_notification_email ?? ''}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, admin_notification_email: e.target.value }))
                }
              />
              <Input
                label="رقم واتساب الدعم المباشر"
                placeholder="2010xxxxxxxx"
                value={settingsForm.support_whatsapp ?? ''}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, support_whatsapp: e.target.value }))
                }
              />
            </div>

            <Textarea
              label="تذييل الفواتير وتأكيد الطلبات"
              rows={2}
              value={settingsForm.invoice_footer ?? ''}
              onChange={(e) => setSettingsForm((p) => ({ ...p, invoice_footer: e.target.value }))}
            />

            <Button type="submit" isLoading={updateSettingsMutation.isPending}>
              حفظ الإعدادات
            </Button>
          </form>
        </Card>
      )}

      {subTab === 'zones' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="p-4 space-y-4">
            <h3 className="font-black text-sm text-ink">
              {zoneEditId ? 'تعديل منطقة شحن' : 'إضافة منطقة شحن'}
            </h3>
            <form onSubmit={handleSaveZone} className="space-y-3">
              <Input
                label="اسم المحافظة / المنطقة"
                required
                placeholder="القاهرة والجيزة"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                label="رسوم الشحن (ج.م)"
                value={zoneFee}
                onChange={(e) => setZoneFee(e.target.value)}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                label="حد الشحن المجاني للمنطقة (اختياري)"
                value={zoneThreshold}
                onChange={(e) => setZoneThreshold(e.target.value)}
              />
              <Input
                label="مدة التوصيل المتوقعة"
                placeholder="1-2 أيام"
                value={zoneDays}
                onChange={(e) => setZoneDays(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input type="checkbox" checked={zoneActive} onChange={(e) => setZoneActive(e.target.checked)} />
                <span>منطقة مفعلة</span>
              </label>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" isLoading={saveZoneMutation.isPending}>
                  {zoneEditId ? 'حفظ التعديل' : 'إضافة المنطقة'}
                </Button>
                {zoneEditId && (
                  <Button type="button" size="sm" variant="secondary" onClick={resetZoneForm}>
                    إلغاء
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <div className="lg:col-span-2">
            <DataTable>
              <thead className="bg-surface-2 text-xs text-muted font-extrabold">
                <tr>
                  <th className="px-4 py-3">المنطقة</th>
                  <th className="px-4 py-3">تكلفة الشحن</th>
                  <th className="px-4 py-3">الشحن المجاني</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {zones.map((z) => (
                  <tr key={z.id}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink">{z.governorate_name}</p>
                      {z.estimated_days && <p className="text-[11px] text-muted">{z.estimated_days}</p>}
                    </td>
                    <td className="px-4 py-3 font-bold text-ink tabular-nums">
                      {formatCurrency(z.shipping_fee)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted tabular-nums">
                      {z.free_shipping_threshold ? formatCurrency(z.free_shipping_threshold) : 'الحد العام'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={z.is_active ? 'ok' : 'neutral'}>{z.is_active ? 'مفعل' : 'معطل'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setZoneEditId(z.id);
                            setZoneName(z.governorate_name);
                            setZoneFee(String(z.shipping_fee));
                            setZoneThreshold(z.free_shipping_threshold ? String(z.free_shipping_threshold) : '');
                            setZoneDays(z.estimated_days ?? '');
                            setZoneActive(z.is_active);
                          }}
                        >
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteZone(z)}
                          leftIcon={<Trash2 className="w-3.5 h-3.5 text-bad" />}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}

      {subTab === 'coupons' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="p-4 space-y-4">
            <h3 className="font-black text-sm text-ink">
              {couponEditId ? 'تعديل كوبون' : 'إنشاء كوبون خصم'}
            </h3>
            <form onSubmit={handleSaveCoupon} className="space-y-3">
              <Input
                label="كود الخصم"
                required
                placeholder="WELCOME10"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              />
              <Select
                label="نوع الخصم"
                value={couponType}
                onChange={(e) => setCouponType(e.target.value as EasyfyCouponType)}
                options={[
                  { value: EasyfyCouponType.PERCENTAGE, label: 'نسبة مئوية (%)' },
                  { value: EasyfyCouponType.FIXED, label: 'مبلغ ثابت (ج.م)' },
                  { value: EasyfyCouponType.FREE_SHIPPING, label: 'شحن مجاني' },
                ]}
              />
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                label="قيمة الخصم"
                value={couponValue}
                onChange={(e) => setCouponValue(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="0"
                  label="أقل طلب"
                  value={couponMinOrder}
                  onChange={(e) => setCouponMinOrder(e.target.value)}
                />
                <Input
                  type="number"
                  min="0"
                  label="أقصى خصم"
                  value={couponMaxDisc}
                  onChange={(e) => setCouponMaxDisc(e.target.value)}
                />
                <Input
                  type="number"
                  min="1"
                  label="الحد العام"
                  value={couponMaxUses}
                  onChange={(e) => setCouponMaxUses(e.target.value)}
                />
                <Input
                  type="number"
                  min="1"
                  label="لكل متجر"
                  value={couponPerAcc}
                  onChange={(e) => setCouponPerAcc(e.target.value)}
                />
              </div>
              <Input
                type="date"
                label="تاريخ الانتهاء (اختياري)"
                value={couponExpires}
                onChange={(e) => setCouponExpires(e.target.value)}
              />
              <label className="flex items-center gap-2 text-xs font-bold text-ink cursor-pointer">
                <input type="checkbox" checked={couponActive} onChange={(e) => setCouponActive(e.target.checked)} />
                <span>كوبون نشط</span>
              </label>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" isLoading={saveCouponMutation.isPending}>
                  {couponEditId ? 'حفظ التعديل' : 'إنشاء الكوبون'}
                </Button>
                {couponEditId && (
                  <Button type="button" size="sm" variant="secondary" onClick={resetCouponForm}>
                    إلغاء
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <div className="lg:col-span-2">
            <DataTable>
              <thead className="bg-surface-2 text-xs text-muted font-extrabold">
                <tr>
                  <th className="px-4 py-3">الكود</th>
                  <th className="px-4 py-3">النوع والقيمة</th>
                  <th className="px-4 py-3">الاستخدام</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-black text-brand-ink">{c.code}</td>
                    <td className="px-4 py-3 text-xs font-bold text-ink">
                      {COUPON_TYPE_LABEL[c.discount_type] || c.discount_type} — {c.discount_value}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted tabular-nums">
                      {c.used_count} / {c.max_uses ?? '∞'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={c.is_active ? 'ok' : 'neutral'}>{c.is_active ? 'نشط' : 'معطل'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-left">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setCouponEditId(c.id);
                            setCouponCode(c.code);
                            setCouponType(c.discount_type as EasyfyCouponType);
                            setCouponValue(String(c.discount_value));
                            setCouponMinOrder(c.min_order_amount ? String(c.min_order_amount) : '');
                            setCouponMaxDisc(c.max_discount_amount ? String(c.max_discount_amount) : '');
                            setCouponMaxUses(c.max_uses ? String(c.max_uses) : '');
                            setCouponPerAcc(c.max_uses_per_account ? String(c.max_uses_per_account) : '');
                            setCouponExpires(c.expires_at ? c.expires_at.slice(0, 10) : '');
                            setCouponActive(c.is_active);
                          }}
                        >
                          تعديل
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCoupon(c)}
                          leftIcon={<Trash2 className="w-3.5 h-3.5 text-bad" />}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        </div>
      )}
    </div>
  );
};
