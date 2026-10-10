import React, { useState } from 'react';
import {
  Sparkles,
  PlusCircle,
  RefreshCw,
  Search,
  UserCheck,
  Copy,
  Check,
  Send,
  Ban,
} from 'lucide-react';
import { formatDate, LicenseKey } from '@pos-mandob/shared';
import clsx from 'clsx';

interface LicenseGeneratorTabProps {
  licenses: LicenseKey[];
  isLoading: boolean;
  totalLicenses: number;
  unusedCount: number;
  usedCount: number;
  revokedCount?: number;
  statusFilter: 'all' | 'unused' | 'used' | 'revoked';
  onStatusFilterChange: (s: 'all' | 'unused' | 'used' | 'revoked') => void;
  search: string;
  onSearchChange: (val: string) => void;
  onGenerate: (payload: { count: number; duration_days: number; notes: string }) => void;
  onRevokeLicense?: (licenseId: number) => void;
  isGenerating: boolean;
}

export const LicenseGeneratorTab: React.FC<LicenseGeneratorTabProps> = ({
  licenses,
  isLoading,
  totalLicenses,
  unusedCount,
  usedCount,
  revokedCount = 0,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  onGenerate,
  onRevokeLicense,
  isGenerating,
}) => {
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [durationDays, setDurationDays] = useState<number>(365);
  const [batchNotes, setBatchNotes] = useState<string>('اشتراك سنوي (فودافون كاش / إنستاباي)');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleSendWhatsApp = (code: string, duration: number) => {
    const text = encodeURIComponent(
      `مرحباً بك في نظام *إنجاز برو* لإدارة الحسابات والمبيعات! 🎉\n\n` +
      `🔑 كود تفعيل اشتراكك الخاص هو:\n` +
      `*${code}*\n\n` +
      `⏳ صالح لمدة: *${duration} يوم* (${duration >= 365 ? 'سنة كاملة' : `${duration} يوم`})\n\n` +
      `طريقة التفعيل:\n` +
      `1. افتح تطبيق إنجاز برو (الموبايل أو الويب).\n` +
      `2. ادخل على الإعدادات ⬅️ تفعيل الاشتراك.\n` +
      `3. الصق الكود واضغط تفعيل.\n\n` +
      `شكراً لثقتك بنا! ونتمنى لك عملاً موفقاً دائماً 🚀`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-8">
      {/* Generate New Codes Form Box */}
      <div className="bg-gradient-to-br from-emerald-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-800/60 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
              <Sparkles className="w-4 h-4" />
              <span>توليد فوري ومؤمن للأكواد</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black">توليد دفعة أكواد تفعيل جديدة (License Generator)</h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              يتم إنشاء أكواد رقمية مشفرة أحادية الاستخدام غير قابلة للتكرار أو التخمين.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Count */}
          <div>
            <label className="block text-xs font-semibold text-emerald-200 mb-2">عدد الأكواد المطلوبة</label>
            <select
              value={generateCount}
              onChange={(e) => setGenerateCount(Number(e.target.value))}
              className="w-full bg-slate-800/90 border border-emerald-700/60 rounded-xl px-4 py-3 text-sm text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value={1}>1 كود تفعيل فردي</option>
              <option value={5}>5 أكواد</option>
              <option value={10}>10 أكواد</option>
              <option value={20}>20 كود</option>
              <option value={50}>50 كود (دفعة توزيع)</option>
              <option value={100}>100 كود</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-semibold text-emerald-200 mb-2">مدة التفعيل والصلاحية</label>
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full bg-slate-800/90 border border-emerald-700/60 rounded-xl px-4 py-3 text-sm text-white font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value={365}>سنة كاملة (365 يوم) - الخطة القياسية</option>
              <option value={30}>شهر واحد (30 يوم)</option>
              <option value={90}>3 شهور (90 يوم)</option>
              <option value={180}>6 شهور (180 يوم)</option>
              <option value={730}>سنتين (730 يوم)</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-emerald-200 mb-2">بيان أو ملاحظة الدفعة</label>
            <input
              type="text"
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
              placeholder="مثال: فودافون كاش، عرض افتتاح..."
              className="w-full bg-slate-800/90 border border-emerald-700/60 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder:text-slate-500"
            />
          </div>

          {/* Submit Button */}
          <div className="flex items-end">
            <button
              onClick={() =>
                onGenerate({
                  count: generateCount,
                  duration_days: durationDays,
                  notes: batchNotes,
                })
              }
              disabled={isGenerating}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 px-4 rounded-xl transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <PlusCircle className="w-5 h-5" />
                  <span>توليد {generateCount} كود الآن ⚡</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* License Codes Table & Management */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-100 rounded-xl px-3 py-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث بكود التفعيل أو الملاحظات أو اسم المشترك..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-transparent border-none text-xs w-full focus:outline-none text-slate-800"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onStatusFilterChange('all')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              الكل ({totalLicenses})
            </button>
            <button
              onClick={() => onStatusFilterChange('unused')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                statusFilter === 'unused'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              )}
            >
              متاح للبيع 🟢 ({unusedCount})
            </button>
            <button
              onClick={() => onStatusFilterChange('used')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                statusFilter === 'used'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              )}
            >
              مستخدم 🔴 ({usedCount})
            </button>
            <button
              onClick={() => onStatusFilterChange('revoked')}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                statusFilter === 'revoked'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              )}
            >
              ملغي / محروق 🚫 ({revokedCount})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">كود التفعيل 🔑</th>
                <th className="px-6 py-4">المدة</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4">الدفعة / الملاحظات</th>
                <th className="px-6 py-4">تاريخ التوليد</th>
                <th className="px-6 py-4">بيانات التفعيل (العميل)</th>
                <th className="px-6 py-4 text-center">إجراءات سريعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    جاري تحميل الأكواد من السيرفر...
                  </td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                    لا توجد أكواد مطابقة لخيارات البحث الحالية
                  </td>
                </tr>
              ) : (
                licenses.map((license) => (
                  <tr key={license.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
                        {license.code}
                      </span>
                    </td>

                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {license.duration_days} يوم
                    </td>

                    <td className="px-6 py-4">
                      {license.is_revoked ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          <Ban className="w-3 h-3 text-amber-700" />
                          ملغي / محروق 🚫
                        </span>
                      ) : license.is_used ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <UserCheck className="w-3 h-3" />
                          مستخدم 🔴
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Sparkles className="w-3 h-3" />
                          متاح للبيع 🟢
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">
                      <div>{license.notes || 'لا توجد ملاحظات'}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{license.batch_reference}</div>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                      {formatDate(license.created_at)}
                    </td>

                    <td className="px-6 py-4 text-xs">
                      {license.is_used && (license.used_by_user || license.used_by) ? (
                        <div>
                          <div className="font-bold text-slate-900">
                            {(license.used_by_user || license.used_by)!.name}
                          </div>
                          <div className="text-slate-500 font-mono">
                            {(license.used_by_user || license.used_by)!.phone}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                            {formatDate(license.used_at || '')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleCopyCode(license.code)}
                          title="نسخ الكود"
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1 text-xs font-bold"
                        >
                          {copiedCode === license.code ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span className="text-emerald-700 text-[11px]">تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>

                        {!license.is_used && !license.is_revoked && (
                          <>
                            <button
                              onClick={() => handleSendWhatsApp(license.code, license.duration_days)}
                              title="إرسال للعميل عبر واتساب"
                              className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors flex items-center gap-1 text-xs font-bold"
                            >
                              <Send className="w-4 h-4" />
                              <span>واتساب</span>
                            </button>

                            {onRevokeLicense && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`هل أنت متأكد من رغبتك في إلغاء وحرق كود التفعيل (${license.code})؟ لن يتمكن أي عميل من استخدامه إطلاقاً.`)) {
                                    onRevokeLicense(license.id);
                                  }
                                }}
                                title="إلغاء وحرق الكود لمنع استخدامه نهائياً"
                                className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors flex items-center gap-1 text-xs font-bold border border-rose-200"
                              >
                                <Ban className="w-4 h-4 text-rose-600" />
                                <span>إلغاء</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
