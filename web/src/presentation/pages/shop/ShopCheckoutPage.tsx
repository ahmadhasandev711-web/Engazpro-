import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  CreditCard,
  MapPin,
  Plus,
  ShoppingCart,
  Tag,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  EasyfyPaymentMethod,
  EasyfyStoreAddress,
  formatCurrency,
} from '@pos-mandob/shared';
import { useAuthStore } from '../../../data/store/useAuthStore';
import {
  useCheckoutEasyfyOrder,
  useDeleteEasyfyAddress,
  useEasyfyAddresses,
  useEasyfyCart,
  useEasyfyCheckoutPreview,
  useEasyfyStorefront,
  useSaveEasyfyAddress,
} from '../../../hooks/useEasyfyShop';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../utils/cn';
import { ShopTopBar } from '../../components/shop/ShopTopBar';
import { Badge, Button, Card, EmptyState, Input, Select, Textarea } from '../../components/ui';

function generateIdempKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `esf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const ShopCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { confirm } = useConfirm();
  const user = useAuthStore((s) => s.user);

  const { data: storefront } = useEasyfyStorefront();
  const { data: cart, isLoading: isLoadingCart } = useEasyfyCart();
  const { data: addresses = [] } = useEasyfyAddresses();

  const saveAddressMutation = useSaveEasyfyAddress();
  const deleteAddressMutation = useDeleteEasyfyAddress();
  const checkoutMutation = useCheckoutEasyfyOrder();

  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [shippingZoneId, setShippingZoneId] = useState<number | null>(null);
  const [governorate, setGovernorate] = useState<string>('');
  const [shippingAddress, setShippingAddress] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');

  const [showNewAddressForm, setShowNewAddressForm] = useState<boolean>(false);
  const [newAddrLabel, setNewAddrLabel] = useState<string>('');
  const [newAddrIsDefault, setNewAddrIsDefault] = useState<boolean>(true);

  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');

  const [paymentMethod, setPaymentMethod] = useState<EasyfyPaymentMethod>(
    EasyfyPaymentMethod.CASH_ON_DELIVERY
  );
  const [transferReference, setTransferReference] = useState<string>('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempKey());

  const settings = storefront?.settings;
  const zones = storefront?.shipping_zones ?? [];
  const hasItems = (cart?.items ?? []).length > 0;

  useEffect(() => {
    setIdempotencyKey(generateIdempKey());
  }, [cart?.items_count, cart?.subtotal]);

  useEffect(() => {
    if (!paymentProof) {
      setProofPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(paymentProof);
    setProofPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [paymentProof]);

  // Select default available payment method on settings load
  useEffect(() => {
    if (!settings) return;
    if (settings.cod_enabled) setPaymentMethod(EasyfyPaymentMethod.CASH_ON_DELIVERY);
    else if (settings.instapay_enabled) setPaymentMethod(EasyfyPaymentMethod.INSTAPAY);
    else if (settings.vodafone_cash_enabled) setPaymentMethod(EasyfyPaymentMethod.VODAFONE_CASH);
  }, [settings]);

  const applyAddress = (addr: EasyfyStoreAddress) => {
    setSelectedAddressId(addr.id);
    setRecipientName(addr.recipient_name);
    setRecipientPhone(addr.recipient_phone);
    setShippingZoneId(addr.shipping_zone_id ?? null);
    setGovernorate(addr.governorate);
    setShippingAddress(addr.address_line);
  };

  // Prefill from default address or user identity
  useEffect(() => {
    if (selectedAddressId || recipientName) return;
    const def = addresses.find((a) => a.is_default) ?? addresses[0];
    if (def) {
      applyAddress(def);
      return;
    }
    if (user) {
      setRecipientName(user.name || '');
      setRecipientPhone(user.phone || '');
      if (user.store_identity?.store_address) {
        setShippingAddress(user.store_identity.store_address);
      }
    }
    if (zones.length > 0 && !shippingZoneId) {
      setShippingZoneId(zones[0].id);
      setGovernorate(zones[0].governorate_name);
    }
  }, [addresses, user, zones, selectedAddressId, recipientName, shippingZoneId]);

  const {
    data: preview,
    error: previewError,
    isFetching: isPreviewFetching,
  } = useEasyfyCheckoutPreview(shippingZoneId, appliedCoupon, hasItems);

  useEffect(() => {
    if (previewError && appliedCoupon) {
      const msg = (previewError as any)?.response?.data?.message || 'كود الخصم غير صالح';
      toast.error(msg);
      setAppliedCoupon('');
    }
  }, [previewError, appliedCoupon, toast]);

  const handleZoneChange = (rawId: string) => {
    const id = rawId ? Number(rawId) : null;
    setShippingZoneId(id);
    const found = zones.find((z) => z.id === id);
    if (found) setGovernorate(found.governorate_name);
  };

  const handleSaveNewAddress = async () => {
    if (!newAddrLabel.trim() || !recipientName.trim() || !recipientPhone.trim() || !governorate.trim() || !shippingAddress.trim()) {
      toast.error('يرجى استكمال اسم العنوان والمستلم والهاتف والمحافظة والعنوان بالتفصيل.');
      return;
    }
    try {
      const created = await saveAddressMutation.mutateAsync({
        label: newAddrLabel.trim(),
        recipient_name: recipientName.trim(),
        recipient_phone: recipientPhone.trim(),
        shipping_zone_id: shippingZoneId,
        governorate: governorate.trim(),
        address_line: shippingAddress.trim(),
        is_default: newAddrIsDefault,
      });
      setSelectedAddressId(created.id);
      setNewAddrLabel('');
      setShowNewAddressForm(false);
      toast.success('تم حفظ العنوان في دفتر عناوين متجرك.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ العنوان');
    }
  };

  const handleDeleteAddress = async (addr: EasyfyStoreAddress) => {
    const ok = await confirm({
      title: 'حذف عنوان',
      message: `هل تريد حذف العنوان المحفوظ "${addr.label}"؟`,
      confirmText: 'حذف',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteAddressMutation.mutateAsync(addr.id);
      if (selectedAddressId === addr.id) setSelectedAddressId(null);
      toast.success('تم حذف العنوان.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حذف العنوان');
    }
  };

  const copyText = (val: string) => {
    if (!val) return;
    navigator.clipboard?.writeText(val);
    toast.success('تم النسخ للحافظة.');
  };

  const availableMethods = useMemo(() => {
    const list: Array<{ id: EasyfyPaymentMethod; title: string; subtitle: string }> = [];
    if (settings?.cod_enabled ?? true) {
      list.push({
        id: EasyfyPaymentMethod.CASH_ON_DELIVERY,
        title: 'الدفع عند الاستلام (COD)',
        subtitle: 'ادفع نقداً للمندوب عند استلام شحنة المستلزمات',
      });
    }
    if (settings?.instapay_enabled) {
      list.push({
        id: EasyfyPaymentMethod.INSTAPAY,
        title: 'تحويل إنستاباي (InstaPay)',
        subtitle: 'حوّل عبر InstaPay وارفع صورة الإيصال والرقم المرجعي',
      });
    }
    if (settings?.vodafone_cash_enabled) {
      list.push({
        id: EasyfyPaymentMethod.VODAFONE_CASH,
        title: 'فودافون كاش (Vodafone Cash)',
        subtitle: 'حوّل للمحفظة وارفع سكرين شوت التحويل والرقم المرجعي',
      });
    }
    return list;
  }, [settings]);

  const requiresProof =
    paymentMethod === EasyfyPaymentMethod.INSTAPAY ||
    paymentMethod === EasyfyPaymentMethod.VODAFONE_CASH;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !recipientPhone.trim() || !governorate.trim() || !shippingAddress.trim()) {
      toast.error('يرجى إدخال كافة بيانات التوصيل المطلوبة.');
      return;
    }
    if (requiresProof && (!transferReference.trim() || !paymentProof)) {
      toast.error('يرجى إدخال الرقم المرجعي للتحويل ورفع صورة الإيصال.');
      return;
    }
    try {
      const order = await checkoutMutation.mutateAsync({
        recipient_name: recipientName.trim(),
        recipient_phone: recipientPhone.trim(),
        shipping_zone_id: shippingZoneId,
        governorate: governorate.trim(),
        shipping_address: shippingAddress.trim(),
        customer_notes: customerNotes.trim() || null,
        coupon_code: appliedCoupon || null,
        payment_method: paymentMethod,
        transfer_reference: requiresProof ? transferReference.trim() : null,
        payment_proof: requiresProof ? paymentProof : null,
        idempotency_key: idempotencyKey,
      });
      toast.success(`تم تسجيل طلبك رقم (${order.order_number}) بنجاح!`);
      navigate(`/shop/orders/${order.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر تأكيد الطلب، يرجى المحاولة مجدداً');
    }
  };

  if (!isLoadingCart && !hasItems) {
    return (
      <div className="space-y-5" dir="rtl">
        <ShopTopBar />
        <EmptyState
          icon={<ShoppingCart className="w-9 h-9 text-muted" />}
          title="السلة فارغة"
          description="أضف منتجات من المتجر أولاً لإتمام عملية الشراء."
          action={
            <Button size="sm" onClick={() => navigate('/shop')}>
              العودة للكتالوج
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <ShopTopBar />

      <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-5">
          {/* Saved Store Addresses */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand" />
                <h2 className="font-black text-base text-ink">عنوان التوصيل والفروع المحفوظة</h2>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowNewAddressForm((v) => !v)}
              >
                {showNewAddressForm ? 'إخفاء نموذج الحفظ' : 'حفظ العنوان الحالي كعنوان جديد'}
              </Button>
            </div>

            {addresses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {addresses.map((addr) => {
                  const isSel = selectedAddressId === addr.id;
                  return (
                    <div
                      key={addr.id}
                      onClick={() => applyAddress(addr)}
                      className={cn(
                        'p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-2',
                        isSel
                          ? 'bg-brand-soft/60 border-brand shadow-2xs'
                          : 'bg-canvas border-line hover:border-brand/40'
                      )}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-xs text-ink">{addr.label}</span>
                          {addr.is_default && <Badge tone="ok">افتراضي</Badge>}
                        </div>
                        <p className="text-xs text-muted truncate">
                          {addr.governorate} — {addr.address_line}
                        </p>
                        <p className="text-[11px] text-muted">{addr.recipient_phone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleDeleteAddress(addr);
                        }}
                        className="p-1.5 rounded-lg hover:bg-bad-soft text-bad shrink-0"
                        aria-label="حذف العنوان"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <Input
                label="اسم المستلم"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
              <Input
                label="رقم هاتف التواصل"
                required
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
              {zones.length > 0 ? (
                <Select
                  label="منطقة الشحن / المحافظة"
                  value={shippingZoneId ?? ''}
                  onChange={(e) => handleZoneChange(e.target.value)}
                  options={[
                    { value: '', label: 'اختر المنطقة...' },
                    ...zones.map((z) => ({
                      value: String(z.id),
                      label: `${z.governorate_name} (${formatCurrency(z.shipping_fee)})`,
                    })),
                  ]}
                />
              ) : (
                <Input
                  label="المحافظة"
                  required
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                />
              )}
              <Input
                label="اسم المحافظة المحدد"
                required
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
              />
            </div>

            <Textarea
              label="عنوان التوصيل بالتفصيل"
              required
              rows={2}
              placeholder="الحي، الشارع، رقم العقار، أقرب علامة مميزة..."
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
            />

            {showNewAddressForm && (
              <div className="p-3.5 rounded-xl border border-brand/25 bg-brand-soft/30 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <Input
                    label="اسم العنوان للحفظ السريع"
                    placeholder="مثال: فرع مدينة نصر / المخزن الرئيسي"
                    value={newAddrLabel}
                    onChange={(e) => setNewAddrLabel(e.target.value)}
                  />
                  <label className="flex items-center gap-2 text-xs font-bold text-ink pb-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAddrIsDefault}
                      onChange={(e) => setNewAddrIsDefault(e.target.checked)}
                    />
                    <span>تعيين كعنوان افتراضي</span>
                  </label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  isLoading={saveAddressMutation.isPending}
                  onClick={handleSaveNewAddress}
                >
                  حفظ في عناوين المتجر
                </Button>
              </div>
            )}

            <Textarea
              label="ملاحظات إضافية على الطلب (اختياري)"
              rows={2}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
            />
          </Card>

          {/* Payment Method & Transfer Proof */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-brand" />
              <h2 className="font-black text-base text-ink">وسيلة الدفع</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {availableMethods.map((m) => {
                const selected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={cn(
                      'p-3.5 rounded-xl border text-right transition-all space-y-1',
                      selected
                        ? 'bg-brand-soft border-brand shadow-xs'
                        : 'bg-canvas border-line hover:border-brand/40'
                    )}
                  >
                    <p className="font-black text-xs sm:text-sm text-ink">{m.title}</p>
                    <p className="text-[11px] text-muted leading-snug">{m.subtitle}</p>
                  </button>
                );
              })}
            </div>

            {requiresProof && (
              <div className="p-4 rounded-xl border border-brand/25 bg-canvas space-y-4">
                {paymentMethod === EasyfyPaymentMethod.INSTAPAY && (
                  <div className="flex items-center justify-between gap-3 flex-wrap bg-brand-soft/60 p-3 rounded-xl border border-brand/20">
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-muted">حوّل المبلغ إلى حساب InstaPay:</p>
                      <p className="font-black text-sm text-brand-ink">
                        {settings?.instapay_handle || 'غير مضاف بعد'}
                      </p>
                      {settings?.instapay_name && (
                        <p className="text-ink font-bold">الاسم: {settings.instapay_name}</p>
                      )}
                    </div>
                    {settings?.instapay_handle && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        leftIcon={<Copy className="w-3.5 h-3.5" />}
                        onClick={() => copyText(settings.instapay_handle)}
                      >
                        نسخ
                      </Button>
                    )}
                  </div>
                )}

                {paymentMethod === EasyfyPaymentMethod.VODAFONE_CASH && (
                  <div className="flex items-center justify-between gap-3 flex-wrap bg-brand-soft/60 p-3 rounded-xl border border-brand/20">
                    <div className="text-xs space-y-0.5">
                      <p className="font-bold text-muted">حوّل المبلغ إلى محفظة فودافون كاش:</p>
                      <p className="font-black text-sm text-brand-ink tabular-nums">
                        {settings?.vodafone_cash_number || 'غير مضاف بعد'}
                      </p>
                    </div>
                    {settings?.vodafone_cash_number && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        leftIcon={<Copy className="w-3.5 h-3.5" />}
                        onClick={() => copyText(settings.vodafone_cash_number)}
                      >
                        نسخ
                      </Button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <Input
                    label="الرقم المرجعي للتحويل / رقم المحول منه"
                    required
                    placeholder="مثال: 48291044 أو رقم محفظتك"
                    value={transferReference}
                    onChange={(e) => setTransferReference(e.target.value)}
                  />
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-ink">صورة سكرين شوت التحويل *</p>
                    <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-dashed border-line-2 bg-panel hover:border-brand cursor-pointer">
                      <span className="text-xs font-bold text-ink flex items-center gap-2 truncate">
                        <Upload className="w-4 h-4 text-brand shrink-0" />
                        <span className="truncate">
                          {paymentProof ? paymentProof.name : 'اختر صورة الإيصال (حتى 5MB)'}
                        </span>
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => setPaymentProof(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {proofPreviewUrl && (
                      <img
                        src={proofPreviewUrl}
                        alt="معاينة الإيصال"
                        className="mt-2 h-24 rounded-xl border border-line object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Order Summary Sidebar */}
        <Card className="p-5 lg:col-span-4 space-y-4 sticky top-20">
          <h2 className="font-black text-base text-ink border-b border-line pb-3">مراجعة الطلب</h2>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {(cart?.items ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-ink truncate">{item.product_name}</p>
                  <p className="text-muted truncate">
                    {item.variant_label} × {item.quantity}
                  </p>
                </div>
                <span className="font-black text-ink tabular-nums shrink-0">
                  {formatCurrency(item.line_total)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-line space-y-2">
            <div className="flex gap-2 items-end">
              <Input
                label="كود الخصم (اختياري)"
                leftIcon={<Tag className="w-4 h-4" />}
                placeholder="WELCOME10"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                isLoading={isPreviewFetching}
                onClick={() => setAppliedCoupon(couponInput.trim().toUpperCase())}
              >
                تطبيق
              </Button>
            </div>
            {preview?.coupon_code && (
              <div className="flex items-center justify-between text-xs bg-ok-soft text-ok px-3 py-1.5 rounded-lg font-bold">
                <span>تم تفعيل الكوبون: {preview.coupon_code}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon('');
                    setCouponInput('');
                  }}
                  className="underline"
                >
                  إلغاء
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-line space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted font-bold">إجمالي المنتجات</span>
              <span className="font-bold text-ink tabular-nums">
                {formatCurrency(preview?.subtotal ?? cart?.subtotal ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted font-bold flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                <span>الشحن</span>
              </span>
              <span className="font-bold text-ink tabular-nums">
                {(preview?.shipping_fee ?? 0) === 0 && preview
                  ? 'مجاني'
                  : formatCurrency(preview?.shipping_fee ?? 0)}
              </span>
            </div>
            {(preview?.discount_amount ?? 0) > 0 && (
              <div className="flex items-center justify-between text-ok">
                <span className="font-bold">الخصم</span>
                <span className="font-black tabular-nums">
                  - {formatCurrency(preview?.discount_amount ?? 0)}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-line flex items-center justify-between text-base">
              <span className="font-black text-ink">الإجمالي المستحق</span>
              <span className="font-black text-brand tabular-nums">
                {formatCurrency(preview?.total_amount ?? cart?.subtotal ?? 0)}
              </span>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            isLoading={checkoutMutation.isPending}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            تأكيد وإرسال الطلب
          </Button>
        </Card>
      </form>
    </div>
  );
};
