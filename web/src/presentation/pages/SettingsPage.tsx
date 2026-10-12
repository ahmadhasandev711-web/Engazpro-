import React, { useState, useEffect } from 'react';
import { ShieldCheck, Database, Calendar, CheckCircle2, AlertCircle, KeyRound, MessageCircle, Smartphone, Send, Store, Save, Lock, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../../data/store/useAuthStore';
import { apiClient } from '../../data/api/client';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate } from '@pos-mandob/shared';
import { MobileFilterChips, FilterChipOption } from '../components/mobile/MobileFilterChips';

export const SettingsPage: React.FC = () => {
  const { user, activateSubscriptionCode, fetchMe } = useAuthStore();
  const { isOwnerOrAdmin } = usePermissions();
  const [activationCode, setActivationCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Store Identity & Currency state
  const [storeData, setStoreData] = useState({
    business_name: '',
    store_phone: '',
    store_address: '',
    currency: 'ج.م',
  });
  const [loadingStore, setLoadingStore] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [storeFeedback, setStoreFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
        setStoreFeedback({ type: 'success', message: 'تم حفظ بيانات المنشأة والعملة بنجاح ✅' });
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
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
        setPasswordFeedback({ type: 'success', message: res.data.message || 'تم تغيير كلمة المرور بنجاح ✅' });
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
      <div>
        <h2 className="text-xl font-bold text-slate-900">الإعدادات وتفعيل الاشتراك</h2>
        <p className="text-sm text-slate-500">بيانات الحساب، حالة الاشتراك السنوي، وتفعيل الباقات الآمنة</p>
      </div>

      {/* Mobile Filter Chips */}
      <div className="md:hidden w-full overflow-hidden">
        <MobileFilterChips
          options={settingsFilterChips}
          selectedId={activeSection}
          onSelect={(id) => setActiveSection(id)}
        />
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-medium ${feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Store Identity & Currency Card */}
      <div className={clsx("bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5", activeSection !== 'ALL' && activeSection !== 'STORE' && 'hidden md:block')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">هوية المنشأة التجارية والعملة</h3>
              <p className="text-xs text-slate-500">اسم المتجر، رقم الهاتف، العنوان المطبوع على الفواتير والإيصالات الحرارية، ورمز العملة</p>
            </div>
          </div>
          {!isOwnerOrAdmin && (
            <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
              للعرض فقط (صلاحية الإدارة)
            </span>
          )}
        </div>

        {storeFeedback && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
              storeFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {storeFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{storeFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveStore} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                اسم المنشأة / المحل التجاري <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  disabled={!isOwnerOrAdmin || loadingStore}
                  value={storeData.business_name}
                  onChange={(e) => setStoreData({ ...storeData, business_name: e.target.value })}
                  placeholder="مثال: براند فاشون للملابس"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-60"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">يظهر بخط بارز في ترويسة الفاتورة والإيصال الحراري</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                رمز العملة المعتمد <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  disabled={!isOwnerOrAdmin || loadingStore}
                  value={storeData.currency}
                  onChange={(e) => setStoreData({ ...storeData, currency: e.target.value })}
                  placeholder="ج.م"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm font-bold focus:outline-none focus:border-blue-500 disabled:opacity-60"
                />
                {['ج.م', 'ر.س', 'د.إ', '$'].map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    disabled={!isOwnerOrAdmin}
                    onClick={() => setStoreData({ ...storeData, currency: curr })}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                      storeData.currency === curr
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">يُطبع بجوار كافة الأسعار والمجاميع في نقاط البيع والفواتير</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                هاتف المنشأة المطبوع
              </label>
              <input
                type="text"
                disabled={!isOwnerOrAdmin || loadingStore}
                value={storeData.store_phone}
                onChange={(e) => setStoreData({ ...storeData, store_phone: e.target.value })}
                placeholder="010XXXXXXXX"
                dir="ltr"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-60 text-right"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                عنوان المنشأة أو الفرع
              </label>
              <input
                type="text"
                disabled={!isOwnerOrAdmin || loadingStore}
                value={storeData.store_address}
                onChange={(e) => setStoreData({ ...storeData, store_address: e.target.value })}
                placeholder="مثال: القاهرة - المعادي - شارع 9"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-60"
              />
            </div>
          </div>

          {isOwnerOrAdmin && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingStore || loadingStore}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{savingStore ? 'جاري الحفظ...' : 'حفظ بيانات المنشأة'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Subscription Section Container */}
      <div className={clsx("space-y-6", activeSection !== 'ALL' && activeSection !== 'SUBSCRIPTION' && 'hidden md:block')}>
        {/* Subscription Status Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">الاشتراك السنوي - إنجاز برو</h3>
              <p className="text-xs text-slate-500">خطة المنظومة السحابية وإدارة المبيعات الشاملة</p>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-3.5 py-1.5 rounded-full ${isSubscriptionValid
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-rose-100 text-rose-800'
              }`}
          >
            {isSubscriptionValid ? 'نشط ومفعل 🟢' : 'منتهي الصلاحية 🔴'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 text-sm border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>
              تاريخ نهاية الاشتراك:{' '}
              <strong className="text-slate-800">{subscription?.end_date ? formatDate(subscription.end_date) : 'غير محدد'}</strong>
            </span>
          </div>
          <div className="text-left sm:text-right font-bold text-emerald-700">
            {isSubscriptionValid ? `متبقي ${daysRemaining} يوم في خطتك` : 'يرجى تجديد الاشتراك لاستئناف كافة العمليات'}
          </div>
        </div>
      </div>

      {/* Activation Code Redemption Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">تفعيل أو تجديد الاشتراك بكود آمن</h3>
            <p className="text-xs text-slate-300">أدخل كود التفعيل المرسل إليك عبر واتساب لتجديد حسابك لمدة سنة كاملة</p>
          </div>
        </div>

        <form onSubmit={handleActivate} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={activationCode}
              onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
              placeholder="مثال: KASH-XXXX-XXXX-XXXX"
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm font-mono tracking-widest focus:outline-none focus:border-amber-400"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={isActivating || !activationCode.trim()}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Send className={`w-4 h-4 ${isActivating ? 'animate-spin' : ''}`} />
            {isActivating ? 'جاري التحقق...' : 'تفعيل الكود الآن 🚀'}
          </button>
        </form>

        {/* Payment Methods & WhatsApp Contact Instructions */}
        <div className="pt-4 border-t border-slate-700/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Smartphone className="w-4 h-4" />
              <span>طرق الدفع والتحويل المعتمدة:</span>
            </div>
            <ul className="space-y-1 text-slate-300">
              <li>• <strong>فودافون كاش / اتصالات / أورنج:</strong> <span className="font-mono text-white" dir="ltr">01125030642</span></li>
              <li>• <strong>إنستاباي (InstaPay):</strong> <span className="font-mono text-white" dir="ltr">01125030642</span></li>
            </ul>
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                <MessageCircle className="w-4 h-4" />
                <span>استلام كود التفعيل فوراً:</span>
              </div>
              <p className="text-slate-300">بعد إتمام التحويل، أرسل صورة الإشعار عبر واتساب لاستلام كود التفعيل الخاص بك في ثوانٍ.</p>
            </div>
            <a
              href="https://wa.me/201125030642?text=مرحباً،%20قمت%20بتحويل%20رسوم%20اشتراك%20إنجاز%20برو%20وأريد%20كود%20التفعيل"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              تواصل عبر واتساب للتجديد
            </a>
          </div>
        </div>
      </div>

      {/* Account Info Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-base text-slate-900">بيانات الحساب الشخصي</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-400 block">الاسم:</span>
            <span className="font-medium text-slate-800">{user?.name || 'غير مسجل'}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">رقم الهاتف:</span>
            <span className="font-medium text-slate-800" dir="ltr">{user?.phone || 'غير مسجل'}</span>
          </div>
          <div>
            <span className="text-xs text-slate-400 block">البريد الإلكتروني:</span>
            <span className="font-medium text-slate-800">{user?.email || 'لا يوجد بريد مسجل'}</span>
          </div>
        </div>
      </div>
      </div>

      {/* Change Password Card */}
      <div className={clsx("bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5", activeSection !== 'ALL' && activeSection !== 'SECURITY' && 'hidden md:block')}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900">أمان الحساب وتغيير كلمة المرور</h3>
            <p className="text-xs text-slate-500">قم بتحديث كلمة المرور لحماية حسابك وبيانات متجرك</p>
          </div>
        </div>

        {passwordFeedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-bold ${
              passwordFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {passwordFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{passwordFeedback.message}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                كلمة المرور الحالية <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-amber-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                كلمة المرور الجديدة <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  placeholder="6 أحرف أو أكثر"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-amber-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                تأكيد كلمة المرور الجديدة <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={passwordForm.new_password_confirmation}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirmation: e.target.value })}
                  placeholder="أعد كتابة الكلمة"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-amber-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>{isChangingPassword ? 'جاري التحديث...' : 'تحديث كلمة المرور 🔐'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Backup Card */}
      <div className={clsx("bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4", activeSection !== 'ALL' && activeSection !== 'BACKUP' && 'hidden md:block')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">النسخ الاحتياطي (Backup & Restore)</h3>
              <p className="text-xs text-slate-500">حفظ نسخة احتياطية من قاعدة البيانات لضمان أمان البيانات</p>
            </div>
          </div>
          <button className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors">
            إنشاء نسخة احتياطية الآن
          </button>
        </div>
        <p className="text-xs text-slate-500 pt-2 border-t border-slate-100">
          البيانات محفوظة ومؤمنة في قاعدة البيانات السحابية
        </p>
      </div>
    </div>
  );
};
