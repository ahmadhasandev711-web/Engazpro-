import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Database,
  Calendar,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  MessageCircle,
  Smartphone,
  Send,
  Store,
  Save,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../../data/store/useAuthStore';
import { apiClient } from '../../data/api/client';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate } from '@pos-mandob/shared';
import { MobileFilterChips, FilterChipOption } from '../components/mobile/MobileFilterChips';
import { Badge, Button, Card, Input, PageHeader } from '../components/ui';

interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

const FeedbackBanner: React.FC<{ feedback: FeedbackState | null }> = ({ feedback }) => {
  if (!feedback) return null;
  const isOk = feedback.type === 'success';
  return (
    <div
      className={clsx(
        'p-3.5 rounded-xl border flex items-center gap-2.5 text-xs sm:text-sm font-bold',
        isOk ? 'bg-ok-soft border-ok/30 text-ok' : 'bg-bad-soft border-bad/30 text-bad'
      )}
    >
      {isOk ? (
        <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-bad shrink-0" />
      )}
      <span>{feedback.message}</span>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const { user, activateSubscriptionCode, fetchMe } = useAuthStore();
  const { isOwnerOrAdmin } = usePermissions();
  const [activationCode, setActivationCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Store Identity & Currency state
  const [storeData, setStoreData] = useState({
    business_name: '',
    store_phone: '',
    store_address: '',
    currency: 'ج.م',
    max_discount_percent: '100',
    allow_negative_branch_stock: false,
  });
  const [loadingStore, setLoadingStore] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [storeFeedback, setStoreFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    const loadStoreIdentity = async () => {
      setLoadingStore(true);
      try {
        const res = await apiClient.get('/settings/store-identity');
        if (res.data?.success && res.data?.data) {
          setStoreData({
            business_name: res.data.data.business_name || '',
            store_phone: res.data.data.store_phone || '',
            store_address: res.data.data.store_address || '',
            currency: res.data.data.currency || 'ج.م',
            max_discount_percent: String(res.data.data.max_discount_percent ?? 100),
            allow_negative_branch_stock: Boolean(res.data.data.allow_negative_branch_stock),
          });
        }
      } catch (err) {
        console.error('Failed to load store identity', err);
      } finally {
        setLoadingStore(false);
      }
    };
    loadStoreIdentity();
  }, []);

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOrAdmin) return;
    setSavingStore(true);
    setStoreFeedback(null);
    try {
      const res = await apiClient.put('/settings/store-identity', storeData);
      if (res.data?.success) {
        setStoreFeedback({ type: 'success', message: 'تم حفظ بيانات المنشأة والعملة بنجاح' });
        await fetchMe();
      }
    } catch (err: any) {
      setStoreFeedback({
        type: 'error',
        message: err.response?.data?.message || 'فشل حفظ بيانات المنشأة',
      });
    } finally {
      setSavingStore(false);
    }
  };

  const subscription = user?.subscription;
  const isSubscriptionValid = subscription?.is_valid ?? true;
  const daysRemaining = subscription?.days_remaining ?? 365;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationCode.trim()) {
      setFeedback({ type: 'error', message: 'يُرجى كتابة أو لصق كود التفعيل أولاً' });
      return;
    }

    setIsActivating(true);
    setFeedback(null);
    const result = await activateSubscriptionCode(activationCode.trim());
    setIsActivating(false);

    if (result.success) {
      setFeedback({ type: 'success', message: result.message });
      setActivationCode('');
    } else {
      setFeedback({ type: 'error', message: result.message });
    }
  };

  // Change Password state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<FeedbackState | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.new_password_confirmation) {
      setPasswordFeedback({ type: 'error', message: 'يرجى ملء جميع حقول كلمة المرور' });
      return;
    }
    if (passwordForm.new_password.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف' });
      return;
    }
    if (passwordForm.new_password !== passwordForm.new_password_confirmation) {
      setPasswordFeedback({ type: 'error', message: 'تأكيد كلمة المرور الجديدة غير متطابق' });
      return;
    }

    setIsChangingPassword(true);
    setPasswordFeedback(null);
    try {
      const res = await apiClient.post('/auth/change-password', passwordForm);
      if (res.data?.success) {
        setPasswordFeedback({ type: 'success', message: res.data.message || 'تم تغيير كلمة المرور بنجاح' });
        setPasswordForm({
          current_password: '',
          new_password: '',
          new_password_confirmation: '',
        });
      }
    } catch (err: any) {
      setPasswordFeedback({
        type: 'error',
        message: err.response?.data?.message || 'تعذر تغيير كلمة المرور. يرجى التأكد من كلمة المرور الحالية',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  type SettingsSection = 'ALL' | 'STORE' | 'SUBSCRIPTION' | 'SECURITY' | 'BACKUP';
  const [activeSection, setActiveSection] = useState<SettingsSection>('ALL');

  const settingsFilterChips: FilterChipOption<SettingsSection>[] = [
    { id: 'ALL', label: 'الكل' },
    { id: 'STORE', label: 'هوية المنشأة', icon: Store },
    { id: 'SUBSCRIPTION', label: 'الاشتراك والكود', icon: ShieldCheck },
    { id: 'SECURITY', label: 'الأمان وكلمة المرور', icon: Lock },
    { id: 'BACKUP', label: 'النسخ الاحتياطي', icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="الإعدادات وتفعيل الاشتراك"
        description="بيانات الحساب، حالة الاشتراك السنوي، وتفعيل الباقات الآمنة"
        className="mb-0"
      />

      {/* Mobile Filter Chips */}
      <div className="md:hidden w-full overflow-hidden">
        <MobileFilterChips
          options={settingsFilterChips}
          selectedId={activeSection}
          onSelect={(id) => setActiveSection(id)}
        />
      </div>

      <FeedbackBanner feedback={feedback} />

      {/* Store Identity & Currency Card */}
      <Card
        className={clsx(
          'space-y-5',
          activeSection !== 'ALL' && activeSection !== 'STORE' && 'hidden md:block'
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-info-soft text-info flex items-center justify-center shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-ink">هوية المنشأة التجارية والعملة</h3>
              <p className="text-xs text-muted">
                اسم المتجر، رقم الهاتف، العنوان المطبوع على الفواتير والإيصالات الحرارية، ورمز العملة
              </p>
            </div>
          </div>
          {!isOwnerOrAdmin && (
            <Badge tone="warn">للعرض فقط (صلاحية الإدارة)</Badge>
          )}
        </div>

        <FeedbackBanner feedback={storeFeedback} />

        <form onSubmit={handleSaveStore} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="اسم المنشأة / المحل التجاري *"
              type="text"
              required
              disabled={!isOwnerOrAdmin || loadingStore}
              value={storeData.business_name}
              onChange={(e) => setStoreData({ ...storeData, business_name: e.target.value })}
              placeholder="مثال: براند فاشون للملابس"
              helperText="يظهر بخط بارز في ترويسة الفاتورة والإيصال الحراري"
            />

            <div>
              <label className="text-xs font-bold text-ink block mb-1.5">
                رمز العملة المعتمد <span className="text-bad">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  required
                  disabled={!isOwnerOrAdmin || loadingStore}
                  value={storeData.currency}
                  onChange={(e) => setStoreData({ ...storeData, currency: e.target.value })}
                  placeholder="ج.م"
                  className="flex-1 min-w-[100px] min-h-[44px] bg-panel border border-line rounded-xl px-3.5 py-2.5 text-ink text-sm font-bold focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-60"
                />
                {['ج.م', 'ر.س', 'د.إ', '$'].map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    disabled={!isOwnerOrAdmin}
                    onClick={() => setStoreData({ ...storeData, currency: curr })}
                    className={clsx(
                      'min-h-[44px] min-w-[44px] px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer disabled:opacity-60',
                      storeData.currency === curr
                        ? 'bg-brand border-brand text-on-brand'
                        : 'bg-surface-2 border-line text-muted hover:text-ink'
                    )}
                  >
                    {curr}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted mt-1.5">يُطبع بجوار كافة الأسعار والمجاميع في نقاط البيع والفواتير</p>
            </div>

            <Input
              label="هاتف المنشأة المطبوع"
              type="text"
              disabled={!isOwnerOrAdmin || loadingStore}
              value={storeData.store_phone}
              onChange={(e) => setStoreData({ ...storeData, store_phone: e.target.value })}
              placeholder="010XXXXXXXX"
              dir="ltr"
              className="text-right tabular-nums"
            />

            <Input
              label="عنوان المنشأة أو الفرع"
              type="text"
              disabled={!isOwnerOrAdmin || loadingStore}
              value={storeData.store_address}
              onChange={(e) => setStoreData({ ...storeData, store_address: e.target.value })}
              placeholder="مثال: القاهرة - المعادي - شارع 9"
            />

            <div>
              <label className="text-xs font-bold text-ink block mb-1.5">
                أقصى نسبة خصم لموظفي البيع
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  disabled={!isOwnerOrAdmin || loadingStore}
                  value={storeData.max_discount_percent}
                  onChange={(e) => setStoreData({ ...storeData, max_discount_percent: e.target.value })}
                  placeholder="100"
                  className="w-full min-h-[44px] bg-panel border border-line rounded-xl px-3.5 py-2.5 pl-10 text-ink text-sm font-bold tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-60"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">%</span>
              </div>
              <p className="text-xs text-muted mt-1.5">
                100 يعني بلا سقف. أصغر قيمة تمنع الكاشير والمندوب من تجاوزها (الإدارة والمديرون متجاوزون دائماً)
              </p>
            </div>

            <div className="flex flex-col justify-start">
              <label className="text-xs font-bold text-ink block mb-1.5">
                البيع على المكشوف
              </label>
              <div className="min-h-[44px] flex items-center bg-surface-2/60 border border-line rounded-xl px-3.5 py-2.5">
                <label className="inline-flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isOwnerOrAdmin || loadingStore}
                    checked={storeData.allow_negative_branch_stock}
                    onChange={(e) =>
                      setStoreData({ ...storeData, allow_negative_branch_stock: e.target.checked })
                    }
                    className="rounded border-line-2 text-brand focus:ring-brand w-4 h-4 cursor-pointer accent-brand"
                  />
                  <span className="text-xs font-bold text-ink">
                    السماح بنزول رصيد الفرع بالسالب
                  </span>
                </label>
              </div>
              <p className="text-xs text-muted mt-1.5">
                عند التفعيل، يُسمح بالبيع حتى لو رصيد الفرع غير كافٍ وتُوسم الحركة بـ [بيع على المكشوف].
              </p>
            </div>
          </div>

          {isOwnerOrAdmin && (
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={savingStore}
                disabled={savingStore || loadingStore}
                leftIcon={<Save className="w-4 h-4" />}
              >
                حفظ بيانات المنشأة
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* Subscription Section Container */}
      <div
        className={clsx(
          'space-y-6',
          activeSection !== 'ALL' && activeSection !== 'SUBSCRIPTION' && 'hidden md:block'
        )}
      >
        {/* Subscription Status Card */}
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-ok-soft text-ok flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-ink">الاشتراك السنوي - إنجاز برو</h3>
                <p className="text-xs text-muted">خطة المنظومة السحابية وإدارة المبيعات الشاملة</p>
              </div>
            </div>
            <Badge tone={isSubscriptionValid ? 'ok' : 'bad'} dot className="px-3.5 py-1.5">
              {isSubscriptionValid ? 'نشط ومفعل' : 'منتهي الصلاحية'}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 text-sm border-t border-line">
            <div className="flex items-center gap-2 text-muted">
              <Calendar className="w-4 h-4 text-muted" />
              <span>
                تاريخ نهاية الاشتراك:{' '}
                <strong className="text-ink tabular-nums">
                  {subscription?.end_date ? formatDate(subscription.end_date) : 'غير محدد'}
                </strong>
              </span>
            </div>
            <div className="text-left sm:text-right font-bold text-ok tabular-nums">
              {isSubscriptionValid
                ? `متبقي ${daysRemaining} يوم في خطتك`
                : 'يرجى تجديد الاشتراك لاستئناف كافة العمليات'}
            </div>
          </div>
        </Card>

        {/* Activation Code Redemption Card */}
        <Card className="bg-surface-2/80 border-2 border-warn/30 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warn-soft text-warn flex items-center justify-center border border-warn/30 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-ink">تفعيل أو تجديد الاشتراك بكود آمن</h3>
              <p className="text-xs text-muted">
                أدخل كود التفعيل المرسل إليك عبر واتساب لتجديد حسابك لمدة سنة كاملة
              </p>
            </div>
          </div>

          <form onSubmit={handleActivate} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                placeholder="مثال: KASH-XXXX-XXXX-XXXX"
                className="w-full min-h-[44px] bg-panel border border-line rounded-xl px-4 py-3 text-ink placeholder:text-muted text-sm tabular-nums tracking-widest focus:outline-none focus:border-warn focus:ring-1 focus:ring-warn"
                dir="ltr"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isActivating}
              disabled={isActivating || !activationCode.trim()}
              leftIcon={<Send className="w-4 h-4" />}
            >
              تفعيل الكود الآن
            </Button>
          </form>

          {/* Payment Methods & WhatsApp Contact Instructions */}
          <div className="pt-4 border-t border-line grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-panel p-3.5 rounded-xl border border-line space-y-2">
              <div className="flex items-center gap-2 text-warn font-bold">
                <Smartphone className="w-4 h-4" />
                <span>طرق الدفع والتحويل المعتمدة:</span>
              </div>
              <ul className="space-y-1 text-muted">
                <li>
                  • <strong>فودافون كاش / اتصالات / أورنج:</strong>{' '}
                  <span className="tabular-nums font-bold text-ink" dir="ltr">
                    01125030642
                  </span>
                </li>
                <li>
                  • <strong>إنستاباي (InstaPay):</strong>{' '}
                  <span className="tabular-nums font-bold text-ink" dir="ltr">
                    01125030642
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-panel p-3.5 rounded-xl border border-line flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center gap-2 text-ok font-bold mb-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>استلام كود التفعيل فوراً:</span>
                </div>
                <p className="text-muted">
                  بعد إتمام التحويل، أرسل صورة الإشعار عبر واتساب لاستلام كود التفعيل الخاص بك في ثوانٍ.
                </p>
              </div>
              <a
                href="https://wa.me/201125030642?text=مرحباً،%20قمت%20بتحويل%20رسوم%20اشتراك%20إنجاز%20برو%20وأريد%20كود%20التفعيل"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-ok-soft hover:bg-ok-soft/80 text-ok border border-ok/30 font-bold py-2 px-3 rounded-xl transition-colors text-xs"
              >
                <MessageCircle className="w-4 h-4" />
                تواصل عبر واتساب للتجديد
              </a>
            </div>
          </div>
        </Card>

        {/* Account Info Card */}
        <Card className="space-y-4">
          <h3 className="font-bold text-base text-ink">بيانات الحساب الشخصي</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted block">الاسم:</span>
              <span className="font-bold text-ink">{user?.name || 'غير مسجل'}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">رقم الهاتف:</span>
              <span className="font-bold text-ink tabular-nums" dir="ltr">
                {user?.phone || 'غير مسجل'}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted block">البريد الإلكتروني:</span>
              <span className="font-bold text-ink">{user?.email || 'لا يوجد بريد مسجل'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Change Password Card */}
      <Card
        className={clsx(
          'space-y-5',
          activeSection !== 'ALL' && activeSection !== 'SECURITY' && 'hidden md:block'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-warn-soft text-warn flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-ink">أمان الحساب وتغيير كلمة المرور</h3>
            <p className="text-xs text-muted">قم بتحديث كلمة المرور لحماية حسابك وبيانات متجرك</p>
          </div>
        </div>

        <FeedbackBanner feedback={passwordFeedback} />

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-ink block mb-1.5">
                كلمة المرور الحالية <span className="text-bad">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] bg-panel border border-line rounded-xl px-3.5 py-2.5 pl-11 text-ink text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label="إظهار أو إخفاء كلمة المرور الحالية"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center absolute left-1 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1.5">
                كلمة المرور الجديدة <span className="text-bad">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="6 أحرف أو أكثر"
                  className="w-full min-h-[44px] bg-panel border border-line rounded-xl px-3.5 py-2.5 pl-11 text-ink text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label="إظهار أو إخفاء كلمة المرور الجديدة"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center absolute left-1 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1.5">
                تأكيد كلمة المرور الجديدة <span className="text-bad">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={passwordForm.new_password_confirmation}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, new_password_confirmation: e.target.value })
                  }
                  placeholder="أعد كتابة الكلمة"
                  className="w-full min-h-[44px] bg-panel border border-line rounded-xl px-3.5 py-2.5 pl-11 text-ink text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="إظهار أو إخفاء تأكيد كلمة المرور"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center absolute left-1 top-1/2 -translate-y-1/2 text-muted hover:text-ink cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isChangingPassword}
              disabled={isChangingPassword}
              leftIcon={<Lock className="w-4 h-4" />}
            >
              تحديث كلمة المرور
            </Button>
          </div>
        </form>
      </Card>

      {/* Backup Card */}
      <Card
        className={clsx(
          'space-y-4',
          activeSection !== 'ALL' && activeSection !== 'BACKUP' && 'hidden md:block'
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-info-soft text-info flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-ink">النسخ الاحتياطي (Backup & Restore)</h3>
              <p className="text-xs text-muted">حفظ نسخة احتياطية من قاعدة البيانات لضمان أمان البيانات</p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="md">
            إنشاء نسخة احتياطية الآن
          </Button>
        </div>
        <p className="text-xs text-muted pt-2 border-t border-line">
          البيانات محفوظة ومؤمنة في قاعدة البيانات السحابية
        </p>
      </Card>
    </div>
  );
};
