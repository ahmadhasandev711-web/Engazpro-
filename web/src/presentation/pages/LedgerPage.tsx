import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Printer,
  ArrowRight,
  User,
  Phone,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Download,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { formatCurrency, formatDate } from '@pos-mandob/shared';
import { exportLedgerToExcel } from '../utils/excelExport';
import { DateRangeFilter } from '../components/common/DateRangeFilter';
import { useAuthStore } from '../../data/store/useAuthStore';
import { LedgerEntryMobileCard } from '../components/mobile/LedgerEntryMobileCard';

export const LedgerPage: React.FC = () => {
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const storeIdentity = user?.store_identity;
  const storeName = storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'متجر إنجاز برو';
  const storePhone = storeIdentity?.store_phone || user?.phone;
  const storeAddress = storeIdentity?.store_address;

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['ledger', partyId, fromDate, toDate],
    queryFn: async () => {
      const res = await apiClient.get(`/ledger/${partyId}`, {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      });
      return res.data?.data;
    },
    enabled: !!partyId,
  });

  const party = data?.party;
  const summary = data?.summary;
  const entries: any[] = data?.entries || [];

  const isCustomer = party?.type === 'CUSTOMER';
  const isCourier = party?.type === 'COURIER';
  const partyTypeLabel = isCustomer ? 'عميل' : isCourier ? 'شركة شحن' : 'مورد';

  return (
    <div className="space-y-3 sm:space-y-6" dir="rtl">
      {/* Desktop Header */}
      <div className="hidden md:flex sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              كشف حساب: {party?.name || 'طرف التعامل'}
            </h2>
            <p className="text-sm text-slate-500">
              {isCustomer
                ? 'كشف حساب تفصيلي للعميل ومتابعة المديونية'
                : isCourier
                ? 'كشف حساب تفصيلي لشركة الشحن ومتابعة التحصيلات والمستحقات'
                : 'كشف حساب تفصيلي للمورد ومتابعة المستحقات'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => data && exportLedgerToExcel(data, party?.name || 'كشف_حساب')}
            disabled={!data || entries.length === 0}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            title="تصدير كشف الحساب إلى Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            تصدير Excel
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            طباعة كشف الحساب
          </button>
        </div>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 active:bg-slate-200 shrink-0"
            title="رجوع"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 truncate">
                {party?.name || 'كشف حساب'}
              </h2>
              <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full shrink-0">
                {partyTypeLabel}
              </span>
            </div>
            {party?.phone && (
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-1 truncate" dir="ltr">
                <Phone className="w-3 h-3 text-slate-400" />
                {party.phone}
              </p>
            )}
          </div>
        </div>

        <div className="text-left shrink-0">
          <span className="text-[10px] text-slate-400 block font-medium">الرصيد الصافي</span>
          <span
            className={`text-sm font-black font-mono ${
              (party?.current_balance || 0) > 0
                ? (isCustomer || isCourier)
                  ? 'text-emerald-700'
                  : 'text-rose-700'
                : 'text-slate-700'
            }`}
            dir="ltr"
          >
            {formatCurrency(party?.current_balance || 0)}
          </span>
        </div>
      </div>

      {/* Desktop Party Info Card (hidden on mobile to save vertical space) */}
      {party && (
        <div className="hidden md:flex bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-lg">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">{party.name}</h3>
                <span className="text-[10px] font-black px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
                  {partyTypeLabel}
                </span>
              </div>
              {party.phone && (
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono" dir="ltr">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {party.phone}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-left">
              <p className="text-xs text-slate-400 font-medium">
                {isCourier
                  ? (party.current_balance > 0
                      ? 'صافي مطلوب توريده من الشركة'
                      : party.current_balance < 0
                      ? 'صافي مستحق لشركة الشحن'
                      : 'الحساب متزن ومسوى بالكامل')
                  : 'الرصيد الحالي المستحق'}
              </p>
              <p
                className={`text-2xl font-black font-mono ${
                  party.current_balance > 0
                    ? isCustomer
                      ? 'text-emerald-700'
                      : isCourier
                      ? 'text-amber-700'
                      : 'text-rose-700'
                    : party.current_balance < 0
                    ? isCourier
                      ? 'text-rose-700'
                      : 'text-emerald-700'
                    : 'text-slate-700'
                }`}
                dir="ltr"
              >
                {formatCurrency(party.current_balance)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile 3-Column Compact Summary Strip (md:hidden) */}
      <div className="md:hidden grid grid-cols-3 gap-2 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs text-center">
        <div className="bg-rose-50/70 p-2 rounded-xl border border-rose-100/80">
          <span className="text-[10px] font-bold text-rose-700 block">مدين (+)</span>
          <span className="text-xs font-black text-rose-800 font-mono block mt-0.5" dir="ltr">
            {formatCurrency(summary?.total_debit || 0)}
          </span>
        </div>
        <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-100/80">
          <span className="text-[10px] font-bold text-emerald-700 block">دائن (-)</span>
          <span className="text-xs font-black text-emerald-800 font-mono block mt-0.5" dir="ltr">
            {formatCurrency(summary?.total_credit || 0)}
          </span>
        </div>
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold text-slate-700 block">الختامي</span>
          <span className="text-xs font-black text-primary-700 font-mono block mt-0.5" dir="ltr">
            {formatCurrency(summary?.current_balance || 0)}
          </span>
        </div>
      </div>

      {/* Date Filter */}
      <div className="bg-white p-2.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs w-full min-w-0 max-w-full overflow-hidden">
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          defaultPreset="all"
          onChange={(from, to) => {
            setFromDate(from);
            setToDate(to);
          }}
        />
      </div>

      {/* Desktop Summary Cards */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">
              {isCourier ? 'إجمالي التحصيلات والعهد (مدين)' : 'إجمالي المدين (عليه)'}
            </span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-700 font-mono" dir="ltr">
            {formatCurrency(summary?.total_debit || 0)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">
              {isCourier ? 'إجمالي التوريدات وأتعاب الشحن (دائن)' : 'إجمالي الدائن (له)'}
            </span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 font-mono" dir="ltr">
            {formatCurrency(summary?.total_credit || 0)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">
              {isCourier
                ? ((summary?.current_balance || 0) > 0
                    ? 'صافي مطلوب توريده من الشركة'
                    : (summary?.current_balance || 0) < 0
                    ? 'صافي مستحق لشركة الشحن'
                    : 'الحساب متزن ومسوى (0.00 ج.م)')
                : 'الرصيد الختامي'}
            </span>
            <TrendingUp className="w-4 h-4 text-primary-600" />
          </div>
          <p className="text-2xl font-black text-primary-700 font-mono" dir="ltr">
            {formatCurrency(summary?.current_balance || 0)}
          </p>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">سجل القيود والحركات المتتالية</h3>
          <span className="text-xs text-slate-400">{entries.length} حركة مسجلة</span>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-sm text-slate-400 font-medium">جاري تحميل كشف الحساب...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">لا توجد حركات مسجلة في هذه الفترة</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              يتم تسجيل القيود تلقائياً عند إجراء فواتير بيع أو شراء أو سندات قبض ودفع.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">نوع العملية / البيان</th>
                    <th className="py-3 px-4 text-rose-700">مدين (+)</th>
                    <th className="py-3 px-4 text-emerald-700">دائن (-)</th>
                    <th className="py-3 px-4">الرصيد بعد الحركة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-600 font-sans">
                        {formatDate(entry.date)}
                      </td>
                      <td className="py-3 px-4 font-bold font-sans text-slate-900">
                        {entry.description}
                      </td>
                      <td className="py-3 px-4 text-rose-700 font-bold">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </td>
                      <td className="py-3 px-4 text-emerald-700 font-bold">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        {formatCurrency(entry.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Transaction Cards View (md:hidden) */}
            <div className="md:hidden p-3 space-y-2.5">
              {entries.map((entry) => (
                <LedgerEntryMobileCard key={entry.id} entry={entry} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Dedicated Corporate Printable Ledger Sheet (A4 Print-Only)                */}
      {/* ========================================================================= */}
      <div className="print-only printable-area font-sans text-slate-900 leading-relaxed text-xs" dir="rtl">
        {/* Store Letterhead */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-black text-slate-900">{storeName}</h1>
            <p className="text-xs font-bold text-slate-600">نظام إدارة نقاط البيع والحسابات</p>
            {storePhone && <p className="text-[11px] text-slate-500 font-mono">الهاتف: {storePhone}</p>}
            {storeAddress && <p className="text-[11px] text-slate-500">{storeAddress}</p>}
          </div>

          <div className="text-left space-y-1">
            <div className="inline-block bg-slate-900 text-white font-black px-3 py-1 rounded text-sm">
              كشف حساب رسمي: {party?.name}
            </div>
            <p className="text-xs font-bold text-slate-800">
              نوع الحساب: {partyTypeLabel}
            </p>
            {party?.phone && (
              <p className="text-[11px] text-slate-600 font-mono" dir="ltr">
                الهاتف: {party.phone}
              </p>
            )}
            <p className="text-[11px] text-slate-600 font-mono">
              الفترة: من {fromDate || 'البداية'} إلى {toDate || 'اليوم'}
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
            </p>
          </div>
        </div>

        {/* Financial Summary Box */}
        <div className="grid grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-300 rounded mb-5 text-center">
          <div>
            <span className="text-[10px] text-slate-500 block font-bold">
              {isCourier ? 'إجمالي التحصيلات (مدين +)' : 'إجمالي المدين (+)'}
            </span>
            <span className="text-sm font-black text-rose-700 font-mono">
              {formatCurrency(summary?.total_debit || 0)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-bold">
              {isCourier ? 'إجمالي التوريدات والأتعاب (دائن -)' : 'إجمالي الدائن (-)'}
            </span>
            <span className="text-sm font-black text-emerald-700 font-mono">
              {formatCurrency(summary?.total_credit || 0)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-bold">صافي الرصيد الختامي</span>
            <span className="text-sm font-black text-slate-900 font-mono">
              {formatCurrency(summary?.current_balance || 0)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block font-bold">الحالة المالية</span>
            <span className="text-xs font-black text-slate-800">
              {isCourier
                ? ((summary?.current_balance || 0) > 0
                    ? 'مطلوب توريده من الشركة'
                    : (summary?.current_balance || 0) < 0
                    ? 'مستحق لشركة الشحن'
                    : 'الحساب مسوى بالكامل')
                : ((summary?.current_balance || 0) > 0
                    ? 'مديونية مستحقة'
                    : 'الحساب مسوى')}
            </span>
          </div>
        </div>

        {/* Transactions Table */}
        <table className="w-full text-right border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-300">
              <th className="p-2 border border-slate-300 text-center w-10">م</th>
              <th className="p-2 border border-slate-300 w-28">التاريخ</th>
              <th className="p-2 border border-slate-300">البيان / نوع الحركة</th>
              <th className="p-2 border border-slate-300 text-center text-rose-800 w-28">مدين (+)</th>
              <th className="p-2 border border-slate-300 text-center text-emerald-800 w-28">دائن (-)</th>
              <th className="p-2 border border-slate-300 text-center w-28">الرصيد بعد الحركة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {entries.map((entry, idx) => (
              <tr key={entry.id} className="border-b border-slate-200">
                <td className="p-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                <td className="p-2 border border-slate-300 font-mono text-slate-700">{formatDate(entry.date)}</td>
                <td className="p-2 border border-slate-300 font-bold text-slate-900">{entry.description}</td>
                <td className="p-2 border border-slate-300 text-center font-mono font-bold text-rose-700">
                  {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                </td>
                <td className="p-2 border border-slate-300 text-center font-mono font-bold text-emerald-700">
                  {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                </td>
                <td className="p-2 border border-slate-300 text-center font-mono font-black text-slate-900">
                  {formatCurrency(entry.balance_after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="mt-10 pt-4 border-t-2 border-slate-400 grid grid-cols-2 gap-8 text-center">
          <div className="space-y-8">
            <p className="font-bold text-xs">توقيع مسؤول الحسابات / الإدارة المالية</p>
            <div className="border-b border-dotted border-slate-400 w-48 mx-auto"></div>
          </div>
          <div className="space-y-8">
            <p className="font-bold text-xs">توقيع واعتماد الطرف الثاني ({partyTypeLabel})</p>
            <div className="border-b border-dotted border-slate-400 w-48 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
