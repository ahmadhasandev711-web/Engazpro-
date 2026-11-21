import React, { useEffect, useState } from 'react';
import { X, Store, Globe, LogIn, Trash2, Wifi, Save, RefreshCw } from 'lucide-react';
import {
  useStoreManageDetails,
  useUpdateMerchantProfile,
  useConfigureStoreWooCommerce,
  useConfigureStoreShopify,
  useRemoveStoreEcommerce,
  useTestStoreEcommerce,
} from '../../../hooks/useAdmin';
import { normalizeStoreCodeInput } from '../../../platform/storeCodeStorage';
import { useConfirm } from '../../context/ConfirmContext';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Input, Select } from '../ui';

interface StoreManageModalProps {
  userId: number | null;
  onClose: () => void;
  onImpersonate: (userId: number) => void;
  isImpersonating?: boolean;
}

export const StoreManageModal: React.FC<StoreManageModalProps> = ({
  userId,
  onClose,
  onImpersonate,
  isImpersonating,
}) => {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { data, isLoading } = useStoreManageDetails(userId);
  const updateProfile = useUpdateMerchantProfile();
  const saveWoo = useConfigureStoreWooCommerce();
  const saveShopify = useConfigureStoreShopify();
  const removeEcommerce = useRemoveStoreEcommerce();
  const testEcommerce = useTestStoreEcommerce();

  const [section, setSection] = useState<'profile' | 'woo' | 'shopify'>('profile');

  const [profileForm, setProfileForm] = useState({
    store_code: '',
    name: '',
    business_name: '',
    phone: '',
    email: '',
    plan: 'TRIAL',
  });

  const [wooForm, setWooForm] = useState({
    store_url: '',
    consumer_key: '',
    consumer_secret: '',
    webhook_secret: '',
    online_branch_id: '',
    auto_sync_stock: true,
    auto_sync_prices: true,
    auto_sync_promotions: true,
    is_active: true,
  });

  const [shopifyForm, setShopifyForm] = useState({
    shop_domain: '',
    access_token: '',
    client_id: '',
    client_secret: '',
    webhook_secret: '',
    online_branch_id: '',
    auto_sync_stock: true,
    auto_sync_prices: true,
    auto_sync_promotions: true,
    is_active: true,
  });

  useEffect(() => {
    if (!data) return;
    setProfileForm({
      store_code: data.owner.store_code || '',
      name: data.owner.name || '',
      business_name: data.owner.business_name || '',
      phone: data.owner.phone || '',
      email: data.owner.email || '',
      plan: data.owner.subscription?.plan || 'TRIAL',
    });

    if (data.woocommerce) {
      setWooForm({
        store_url: data.woocommerce.store_url || '',
        consumer_key: '',
        consumer_secret: '',
        webhook_secret: '',
        online_branch_id: data.woocommerce.online_branch_id ? String(data.woocommerce.online_branch_id) : '',
        auto_sync_stock: data.woocommerce.auto_sync_stock,
        auto_sync_prices: data.woocommerce.auto_sync_prices,
        auto_sync_promotions: data.woocommerce.auto_sync_promotions,
        is_active: data.woocommerce.is_active,
      });
    } else {
      setWooForm({
        store_url: '',
        consumer_key: '',
        consumer_secret: '',
        webhook_secret: '',
        online_branch_id: '',
        auto_sync_stock: true,
        auto_sync_prices: true,
        auto_sync_promotions: true,
        is_active: true,
      });
    }

    if (data.shopify) {
      setShopifyForm({
        shop_domain: data.shopify.shop_domain || '',
        access_token: '',
        client_id: '',
        client_secret: '',
        webhook_secret: '',
        online_branch_id: data.shopify.online_branch_id ? String(data.shopify.online_branch_id) : '',
        auto_sync_stock: data.shopify.auto_sync_stock,
        auto_sync_prices: data.shopify.auto_sync_prices,
        auto_sync_promotions: data.shopify.auto_sync_promotions,
        is_active: data.shopify.is_active,
      });
    } else {
      setShopifyForm({
        shop_domain: '',
        access_token: '',
        client_id: '',
        client_secret: '',
        webhook_secret: '',
        online_branch_id: '',
        auto_sync_stock: true,
        auto_sync_prices: true,
        auto_sync_promotions: true,
        is_active: true,
      });
    }
  }, [data]);

  if (!userId) return null;

  const branchOptions = [
    { value: '', label: 'الفرع الرئيسي الافتراضي' },
    ...(data?.branches || []).map((b) => ({ value: String(b.id), label: `${b.name} (${b.code})` })),
  ];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await updateProfile.mutateAsync({
        userId,
        payload: {
          store_code: profileForm.store_code || undefined,
          name: profileForm.name,
          business_name: profileForm.business_name || undefined,
          phone: profileForm.phone,
          email: profileForm.email || undefined,
          plan: profileForm.plan,
        },
      });
      toast.success(res.message || 'تم تحديث بيانات المتجر بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ بيانات المتجر');
    }
  };

  const handleSaveWoo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await saveWoo.mutateAsync({
        userId,
        payload: {
          store_url: wooForm.store_url,
          consumer_key: wooForm.consumer_key || undefined,
          consumer_secret: wooForm.consumer_secret || undefined,
          webhook_secret: wooForm.webhook_secret || undefined,
          online_branch_id: wooForm.online_branch_id ? Number(wooForm.online_branch_id) : null,
          auto_sync_stock: wooForm.auto_sync_stock,
          auto_sync_prices: wooForm.auto_sync_prices,
          auto_sync_promotions: wooForm.auto_sync_promotions,
          is_active: wooForm.is_active,
        },
      });
      toast.success(res.message || 'تم حفظ ربط WooCommerce بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ ربط WooCommerce');
    }
  };

  const handleSaveShopify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await saveShopify.mutateAsync({
        userId,
        payload: {
          shop_domain: shopifyForm.shop_domain,
          access_token: shopifyForm.access_token || undefined,
          client_id: shopifyForm.client_id || undefined,
          client_secret: shopifyForm.client_secret || undefined,
          webhook_secret: shopifyForm.webhook_secret || undefined,
          online_branch_id: shopifyForm.online_branch_id ? Number(shopifyForm.online_branch_id) : null,
          auto_sync_stock: shopifyForm.auto_sync_stock,
          auto_sync_prices: shopifyForm.auto_sync_prices,
          auto_sync_promotions: shopifyForm.auto_sync_promotions,
          is_active: shopifyForm.is_active,
        },
      });
      toast.success(res.message || 'تم حفظ ربط Shopify بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ ربط Shopify');
    }
  };

  const handleRemovePlatform = async (platform: 'woocommerce' | 'shopify') => {
    const ok = await confirm({
      title: `إزالة ربط ${platform === 'shopify' ? 'Shopify' : 'WooCommerce'}`,
      message: 'هل تريد إزالة بيانات الربط الحالية من هذا المتجر؟',
      confirmText: 'تأكيد الإزالة',
      type: 'danger',
    });
    if (!ok) return;
    try {
      const res = await removeEcommerce.mutateAsync({ userId, platform, disableAddon: false });
      toast.success(res.message || 'تمت إزالة المتجر الإلكتروني بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر إزالة المتجر');
    }
  };

  const handleTest = async () => {
    try {
      const res = await testEcommerce.mutateAsync(userId);
      toast.success(res.message || 'الاتصال سليم 100%');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل الاتصال بالمتجر الإلكتروني');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-panel rounded-2xl max-w-3xl w-full shadow-2xl border border-line overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 sm:p-5 bg-surface-2 border-b border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-ink truncate">
                تحكم كامل في المتجر: {data?.owner.name || '...'}
              </h3>
              <p className="text-xs text-muted truncate">تعديل البيانات، الباقة، المتاجر الإلكترونية (Shopify / WordPress)، أو الدخول كدعم فني.</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="إغلاق" className="min-h-[44px] min-w-[44px]">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between gap-3 flex-wrap bg-panel">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant={section === 'profile' ? 'primary' : 'secondary'} onClick={() => setSection('profile')}>
              بيانات المتجر والخطة
            </Button>
            <Button size="sm" variant={section === 'woo' ? 'primary' : 'secondary'} onClick={() => setSection('woo')} leftIcon={<Globe className="w-3.5 h-3.5" />}>
              WooCommerce / WordPress
              {data?.woocommerce?.is_active && <Badge tone="ok" className="mr-1">نشط</Badge>}
            </Button>
            <Button size="sm" variant={section === 'shopify' ? 'primary' : 'secondary'} onClick={() => setSection('shopify')} leftIcon={<Globe className="w-3.5 h-3.5" />}>
              Shopify
              {data?.shopify?.is_active && <Badge tone="ok" className="mr-1">نشط</Badge>}
            </Button>
          </div>

          <Button
            size="sm"
            variant="secondary"
            disabled={isImpersonating || isLoading}
            onClick={() => onImpersonate(userId)}
            leftIcon={<LogIn className="w-4 h-4 text-brand" />}
          >
            دخول لإدارة المتجر
          </Button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {isLoading ? (
            <div className="py-12 text-center text-muted">
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-brand" />
              <p className="text-xs font-bold">جاري تحميل إعدادات المتجر...</p>
            </div>
          ) : section === 'profile' ? (
            <form onSubmit={handleSaveProfile} autoComplete="off" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="معرّف المتجر الفريد (store_code)"
                  name="merchant_store_code"
                  dir="ltr"
                  autoComplete="off"
                  value={profileForm.store_code}
                  onChange={(e) => setProfileForm({ ...profileForm, store_code: normalizeStoreCodeInput(e.target.value) })}
                  className="font-mono text-right"
                />
                <Input label="اسم صاحب المتجر" name="merchant_owner_name" autoComplete="off" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} required />
                <Input label="الاسم التجاري للمنشأة" name="merchant_business_name" autoComplete="off" value={profileForm.business_name} onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })} />
                <Input label="رقم الهاتف" name="merchant_phone" dir="ltr" autoComplete="off" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} required />
                <Input label="البريد الإلكتروني (لـ OTP)" name="merchant_email" type="email" dir="ltr" autoComplete="off" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
              </div>

              <Select
                label="نوع الخطة المسجلة"
                value={profileForm.plan}
                onChange={(e) => setProfileForm({ ...profileForm, plan: e.target.value })}
                options={[
                  { value: 'TRIAL', label: 'فترة تجريبية (TRIAL)' },
                  { value: 'BASIC', label: 'الباقة الأساسية (BASIC)' },
                  { value: 'PRO_ECOMMERCE', label: 'الباقة الاحترافية (PRO_ECOMMERCE)' },
                  { value: 'ANNUAL', label: 'سنوية (ANNUAL)' },
                ]}
              />

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" isLoading={updateProfile.isPending} leftIcon={<Save className="w-4 h-4" />}>
                  حفظ تعديلات المتجر
                </Button>
              </div>
            </form>
          ) : section === 'woo' ? (
            <form onSubmit={handleSaveWoo} autoComplete="off" className="space-y-4">
              <Input label="رابط متجر WooCommerce *" name="merchant_woo_url" dir="ltr" autoComplete="off" placeholder="https://example-store.com" value={wooForm.store_url} onChange={(e) => setWooForm({ ...wooForm, store_url: e.target.value })} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Consumer Key" name="merchant_woo_consumer_key" dir="ltr" autoComplete="off" placeholder={data?.woocommerce?.has_credentials ? 'اتركه فارغاً للإبقاء على الحالي' : 'ck_...'} value={wooForm.consumer_key} onChange={(e) => setWooForm({ ...wooForm, consumer_key: e.target.value })} />
                <Input label="Consumer Secret" name="merchant_woo_consumer_secret" dir="ltr" type="password" autoComplete="new-password" placeholder={data?.woocommerce?.has_credentials ? 'اتركه فارغاً للإبقاء على الحالي' : 'cs_...'} value={wooForm.consumer_secret} onChange={(e) => setWooForm({ ...wooForm, consumer_secret: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Webhook Secret (اختياري)" name="merchant_woo_webhook_secret" dir="ltr" autoComplete="off" value={wooForm.webhook_secret} onChange={(e) => setWooForm({ ...wooForm, webhook_secret: e.target.value })} />
                <Select label="فرع سحب/مزامنة الأونلاين" value={wooForm.online_branch_id} onChange={(e) => setWooForm({ ...wooForm, online_branch_id: e.target.value })} options={branchOptions} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold pt-1">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={wooForm.is_active} onChange={(e) => setWooForm({ ...wooForm, is_active: e.target.checked })} /> تفعيل الربط</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={wooForm.auto_sync_stock} onChange={(e) => setWooForm({ ...wooForm, auto_sync_stock: e.target.checked })} /> مزامنة المخزون</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={wooForm.auto_sync_prices} onChange={(e) => setWooForm({ ...wooForm, auto_sync_prices: e.target.checked })} /> مزامنة الأسعار</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={wooForm.auto_sync_promotions} onChange={(e) => setWooForm({ ...wooForm, auto_sync_promotions: e.target.checked })} /> مزامنة الكوبونات</label>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {data?.woocommerce && (
                    <>
                      <Button type="button" size="sm" variant="secondary" onClick={handleTest} isLoading={testEcommerce.isPending} leftIcon={<Wifi className="w-3.5 h-3.5 text-ok" />}>
                        اختبار الربط
                      </Button>
                      <Button type="button" size="sm" variant="danger" onClick={() => handleRemovePlatform('woocommerce')} isLoading={removeEcommerce.isPending} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
                        إزالة الربط
                      </Button>
                    </>
                  )}
                </div>
                <Button type="submit" variant="primary" isLoading={saveWoo.isPending} leftIcon={<Save className="w-4 h-4" />}>
                  حفظ وتفعيل WooCommerce
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveShopify} autoComplete="off" className="space-y-4">
              <Input label="دومين متجر Shopify *" name="merchant_shopify_domain" dir="ltr" autoComplete="off" placeholder="brand-name.myshopify.com" value={shopifyForm.shop_domain} onChange={(e) => setShopifyForm({ ...shopifyForm, shop_domain: e.target.value })} required />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Admin API Access Token" name="merchant_shopify_access_token" dir="ltr" type="password" autoComplete="new-password" placeholder={data?.shopify?.has_token ? 'اتركه فارغاً للإبقاء على الحالي' : 'shpat_...'} value={shopifyForm.access_token} onChange={(e) => setShopifyForm({ ...shopifyForm, access_token: e.target.value })} />
                <Input label="Webhook Secret (اختياري)" name="merchant_shopify_webhook_secret" dir="ltr" autoComplete="off" value={shopifyForm.webhook_secret} onChange={(e) => setShopifyForm({ ...shopifyForm, webhook_secret: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Client ID (اختياري)" name="merchant_shopify_client_id" dir="ltr" autoComplete="off" value={shopifyForm.client_id} onChange={(e) => setShopifyForm({ ...shopifyForm, client_id: e.target.value })} />
                <Select label="فرع سحب/مزامنة الأونلاين" value={shopifyForm.online_branch_id} onChange={(e) => setShopifyForm({ ...shopifyForm, online_branch_id: e.target.value })} options={branchOptions} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold pt-1">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={shopifyForm.is_active} onChange={(e) => setShopifyForm({ ...shopifyForm, is_active: e.target.checked })} /> تفعيل الربط</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={shopifyForm.auto_sync_stock} onChange={(e) => setShopifyForm({ ...shopifyForm, auto_sync_stock: e.target.checked })} /> مزامنة المخزون</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={shopifyForm.auto_sync_prices} onChange={(e) => setShopifyForm({ ...shopifyForm, auto_sync_prices: e.target.checked })} /> مزامنة الأسعار</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={shopifyForm.auto_sync_promotions} onChange={(e) => setShopifyForm({ ...shopifyForm, auto_sync_promotions: e.target.checked })} /> مزامنة الكوبونات</label>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {data?.shopify && (
                    <>
                      <Button type="button" size="sm" variant="secondary" onClick={handleTest} isLoading={testEcommerce.isPending} leftIcon={<Wifi className="w-3.5 h-3.5 text-ok" />}>
                        اختبار الربط
                      </Button>
                      <Button type="button" size="sm" variant="danger" onClick={() => handleRemovePlatform('shopify')} isLoading={removeEcommerce.isPending} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
                        إزالة الربط
                      </Button>
                    </>
                  )}
                </div>
                <Button type="submit" variant="primary" isLoading={saveShopify.isPending} leftIcon={<Save className="w-4 h-4" />}>
                  حفظ وتفعيل Shopify
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
