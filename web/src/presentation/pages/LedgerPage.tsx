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
  Share2,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { formatCurrency, formatDate } from '@pos-mandob/shared';

import { DateRangeFilter } from '../components/common/DateRangeFilter';
import { PaginationBar } from '../components/common/PaginationBar';
import { useAuthStore } from '../../data/store/useAuthStore';
import { webShareService, formatLedgerStatementWhatsAppText } from '../../infrastructure/pwa/webShareService';
import { useToast } from '../context/ToastContext';
import { LedgerEntryMobileCard } from '../components/mobile/LedgerEntryMobileCard';
import { Badge, Button, Card, DataTable, EmptyState, PageHeader } from '../components/ui';

export const LedgerPage: React.FC = () => {
  const { partyId } = useParams<{ partyId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const user = useAuthStore((s) => s.user);
  const storeIdentity = user?.store_identity;
  const storeName = storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'متجر EBMS';
  const storePhone = storeIdentity?.store_phone || user?.phone;
  const storeAddress = storeIdentity?.store_address;

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['ledger', user?.id, partyId, fromDate, toDate, page],
    queryFn: async () => {
      const res = await apiClient.get(`/ledger/${partyId}`, {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          page,
        },
      });
      return res.data?.data;
    },
    enabled: !!partyId,
    placeholderData: (prev) => prev,
  });

  const party = data?.party;
  const summary = data?.summary;
  const entries: any[] = data?.entries || [];
  const pagination = data?.pagination || data?.meta;
  const openingBalance = data?.summary?.opening_balance ?? data?.opening_balance ?? 0;

  const isCustomer = party?.type === 'CUSTOMER';
  const isCourier = party?.type === 'COURIER';
  const partyTypeLabel = isCustomer ? 'عميل' : isCourier ? 'شركة شحن' : 'مورد';

  const handleShareLedgerWhatsApp = async () => {
    if (!data) return;
    const text = formatLedgerStatementWhatsAppText(
      data,
      {
        storeName,
        storePhone,
        currencySymbol: storeIdentity?.currency || 'ج.م',
      },
      { fromDate: fromDate || undefined, toDate: toDate || undefined }
    );
    await webShareService.shareInvoice({
      title: `كشف حساب ${party?.name || 'طرف التعامل'} - ${storeName}`,
      text,
      phone: party?.phone || undefined,
    });
  };

  return (
    <div className="space-y-3 sm:space-y-6" dir="rtl">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <PageHeader
          title={`كشف حساب: ${party?.name || 'طرف التعامل'}`}
          description={
            isCustomer
              ? 'كشف حساب تفصيلي للعميل ومتابعة المديونية'
              : isCourier
              ? 'كشف حساب تفصيلي لشركة الشحن ومتابعة التحصيلات والمستحقات'
              : 'كشف حساب تفصيلي للمورد ومتابعة المستحقات'
          }
          className="mb-0"
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                size="md"
                leftIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => navigate(-1)}
                title="رجوع"
                className="text-xs font-bold"
              >
                رجوع
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                leftIcon={<Download className="w-4 h-4 text-ok" />}
                onClick={async () => {
                  if (!data) return;
                  try {
                    const { exportLedgerToExcel } = await import('../utils/excelExport');
                    exportLedgerToExcel(data, party?.name || 'كشف_حساب');
                  } catch (err) {
                    console.error('Excel load failed:', err);
                    toast.error('تعذر تحميل أداة Excel، تأكد من الاتصال وحاول مرة أخرى');
                  }
                }}
                disabled={!data || entries.length === 0}
                className="text-xs font-bold"
                title="تصدير كشف الحساب إلى Excel"
              >
                تصدير Excel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                leftIcon={<Share2 className="w-4 h-4 text-ok" />}
                onClick={handleShareLedgerWhatsApp}
                disabled={!data}
                className="bg-ok-soft text-ok border-ok/30 hover:bg-ok-soft/80 text-xs font-bold"
                title="مشاركة ملخص كشف الحساب عبر واتساب"
              >
                إرسال واتساب
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                leftIcon={<Printer className="w-4 h-4" />}
                onClick={() => window.print()}
                className="text-xs font-bold"
              >
                طباعة كشف الحساب
              </Button>
            </>
          }
        />
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <Card className="md:hidden p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => navigate(-1)}
            className="px-3 shrink-0"
            title="رجوع"
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-ink truncate">
                {party?.name || 'كشف حساب'}
              </h2>
              <Badge tone="neutral" className="text-[10px] shrink-0">
                {partyTypeLabel}
              </Badge>
            </div>
            {party?.phone && (
              <p className="text-[11px] text-muted tabular-nums flex items-center gap-1 truncate" dir="ltr">
                <Phone className="w-3 h-3 text-muted" />
                {party.phone}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleShareLedgerWhatsApp}
            disabled={!data}
            className="px-2.5 bg-ok-soft text-ok border-ok/30"
            title="إرسال كشف الحساب عبر واتساب"
            aria-label="إرسال كشف الحساب عبر واتساب"
          >
            <Share2 className="w-4 h-4" />
          </Button>
          <div className="text-left">
            <span className="text-[10px] text-muted block font-medium">الرصيد الصافي</span>
            <span
              className={`text-sm font-black tabular-nums ${
                (party?.current_balance || 0) > 0
                  ? (isCustomer || isCourier)
                    ? 'text-ok'
                    : 'text-bad'
                  : 'text-ink'
              }`}
              dir="ltr"
            >
              {formatCurrency(party?.current_balance || 0)}
            </span>
          </div>
        </div>
      </Card>

      {/* Desktop Party Info Card (hidden on mobile to save vertical space) */}
      {party && (
        <Card className="hidden md:flex p-5 flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-soft text-brand border border-brand/20 flex items-center justify-center font-bold text-lg">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-ink">{party.name}</h3>
                <Badge tone="neutral">{partyTypeLabel}</Badge>
              </div>
              {party.phone && (
                <p className="text-xs text-muted flex items-center gap-1 mt-0.5 tabular-nums" dir="ltr">
                  <Phone className="w-3.5 h-3.5 text-muted" />
                  {party.phone}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-left">
              <p className="text-xs text-muted font-medium">
                {isCourier
                  ? (party.current_balance > 0
                      ? 'صافي مطلوب توريده من الشركة'
                      : party.current_balance < 0
                      ? 'صافي مستحق لشركة الشحن'
                      : 'الحساب متزن ومسوى بالكامل')
                  : 'الرصيد الحالي المستحق'}
              </p>
              <p
                className={`text-2xl font-black tabular-nums ${
                  party.current_balance > 0
                    ? isCustomer
                      ? 'text-ok'
                      : isCourier
                      ? 'text-warn'
                      : 'text-bad'
                    : party.current_balance < 0
                    ? isCourier
                      ? 'text-bad'
                      : 'text-ok'
                    : 'text-ink'
                }`}
                dir="ltr"
              >
                {formatCurrency(party.current_balance)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Mobile 3-Column Compact Summary Strip (md:hidden) */}
      <Card className="md:hidden grid grid-cols-3 gap-2 p-2.5 text-center">
        <div className="bg-bad-soft p-2 rounded-xl border border-bad/20">
          <span className="text-[10px] font-bold text-bad block">مدين (+)</span>
          <span className="text-xs font-black text-bad tabular-nums block mt-0.5" dir="ltr">
            {formatCurrency(summary?.total_debit || 0)}
          </span>
        </div>
        <div className="bg-ok-soft p-2 rounded-xl border border-ok/20">
          <span className="text-[10px] font-bold text-ok block">دائن (-)</span>
          <span className="text-xs font-black text-ok tabular-nums block mt-0.5" dir="ltr">
            {formatCurrency(summary?.total_credit || 0)}
          </span>
        </div>
        <div className="bg-surface-2 p-2 rounded-xl border border-line">
          <span className="text-[10px] font-bold text-muted block">الختامي</span>
          <span className="text-xs font-black text-brand tabular-nums block mt-0.5" dir="ltr">
            {formatCurrency(summary?.current_balance || 0)}
          </span>
        </div>
      </Card>

      {/* Date Filter */}
      <Card className="p-2.5 sm:p-4 w-full min-w-0 max-w-full overflow-hidden">
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          defaultPreset="all"
          onChange={(from, to) => {
            setFromDate(from);
            setToDate(to);
            setPage(1);
          }}
        />
      </Card>

      {/* Desktop Summary Cards */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold">
              {isCourier ? 'إجمالي التحصيلات والعهد (مدين)' : 'إجمالي المدين (عليه)'}
            </span>
            <ArrowUpRight className="w-4 h-4 text-bad" />
          </div>
          <p className="text-2xl font-black text-bad tabular-nums" dir="ltr">
            {formatCurrency(summary?.total_debit || 0)}
          </p>
        </Card>

        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold">
              {isCourier ? 'إجمالي التوريدات وأتعاب الشحن (دائن)' : 'إجمالي الدائن (له)'}
            </span>
            <ArrowDownLeft className="w-4 h-4 text-ok" />
          </div>
          <p className="text-2xl font-black text-ok tabular-nums" dir="ltr">
            {formatCurrency(summary?.total_credit || 0)}
          </p>
        </Card>

        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-bold">
              {isCourier
                ? ((summary?.current_balance || 0) > 0
                    ? 'صافي مطلوب توريده من الشركة'
                    : (summary?.current_balance || 0) < 0
                    ? 'صافي مستحق لشركة الشحن'
                    : 'الحساب متزن ومسوى (0.00 ج.م)')
                : 'الرصيد الختامي'}
            </span>
            <TrendingUp className="w-4 h-4 text-brand" />
          </div>
          <p className="text-2xl font-black text-brand tabular-nums" dir="ltr">
            {formatCurrency(summary?.current_balance || 0)}
          </p>
        </Card>
      </div>

      {/* Entries Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-line flex items-center justify-between">
          <h3 className="font-bold text-sm text-ink">سجل القيود والحركات المتتالية</h3>
          <span className="text-xs text-muted">{entries.length} حركة مسجلة</span>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-sm text-muted font-medium">جاري تحميل كشف الحساب...</div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="لا توجد حركات مسجلة في هذه الفترة"
            description="يتم تسجيل القيود تلقائياً عند إجراء فواتير بيع أو شراء أو سندات قبض ودفع."
            className="border-0 rounded-none py-16"
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <DataTable tableClassName="text-xs" className="border-0 rounded-none shadow-none">
                <thead className="bg-surface-2 text-muted font-bold border-b border-line">
                  <tr>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">نوع العملية / البيان</th>
                    <th className="py-3 px-4 text-bad">مدين (+)</th>
                    <th className="py-3 px-4 text-ok">دائن (-)</th>
                    <th className="py-3 px-4">الرصيد بعد الحركة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {/* سطر رصيد ما قبله في أول الجدول */}
                  <tr className="bg-surface-2 font-bold text-ink">
                    <td className="py-2.5 px-4 text-muted">
                      {fromDate ? formatDate(fromDate) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-brand">
                      رصيد ما قبله (افتتاحي الصفحة)
                    </td>
                    <td className="py-2.5 px-4 text-muted">—</td>
                    <td className="py-2.5 px-4 text-muted">—</td>
                    <td className="py-2.5 px-4 font-black text-brand">
                      {formatCurrency(openingBalance)}
                    </td>
                  </tr>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-surface-2/60 transition-colors">
                      <td className="py-3 px-4 text-muted">
                        {formatDate(entry.date)}
                      </td>
                      <td className="py-3 px-4 font-bold text-ink">
                        {entry.description}
                      </td>
                      <td className="py-3 px-4 text-bad font-bold">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </td>
                      <td className="py-3 px-4 text-ok font-bold">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </td>
                      <td className="py-3 px-4 font-black text-ink">
                        {formatCurrency(entry.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>

            {/* Mobile Transaction Cards View (md:hidden) */}
            <div className="md:hidden p-3 space-y-2.5 bg-surface-2">
              <div className="bg-panel border border-line rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="font-bold text-ink">رصيد ما قبله (افتتاحي الصفحة):</span>
                <span className="font-black tabular-nums text-brand">{formatCurrency(openingBalance)}</span>
              </div>
              {entries.map((entry) => (
                <LedgerEntryMobileCard key={entry.id} entry={entry} />
              ))}
            </div>

            <PaginationBar
              currentPage={pagination?.current_page || page}
              lastPage={pagination?.last_page || 1}
              total={pagination?.total || entries.length}
              perPage={pagination?.per_page || 100}
              onPageChange={(newPage) => setPage(newPage)}
              isFetching={isFetching}
              itemLabel="حركة"
            />
          </>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* Dedicated Corporate Printable Ledger Sheet (A4 Print-Only)                */}
      {/* ========================================================================= */}
      <div className="print-only printable-area font-sans text-ink leading-relaxed text-xs" dir="rtl">
        {/* Store Letterhead */}
        <div className="border-b-2 border-ink pb-4 mb-5 flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-black text-ink">{storeName}</h1>
            <p className="text-xs font-bold text-muted">نظام إدارة نقاط البيع والحسابات</p>
            {storePhone && <p className="text-[11px] text-muted tabular-nums">الهاتف: {storePhone}</p>}
            {storeAddress && <p className="text-[11px] text-muted">{storeAddress}</p>}
          </div>

          <div className="text-left space-y-1">
            <div className="inline-block bg-brand text-on-brand font-black px-3 py-1 rounded text-sm">
              كشف حساب رسمي: {party?.name}
            </div>
            <p className="text-xs font-bold text-ink">
              نوع الحساب: {partyTypeLabel}
            </p>
            {party?.phone && (
              <p className="text-[11px] text-muted tabular-nums" dir="ltr">
                الهاتف: {party.phone}
              </p>
            )}
            <p className="text-[11px] text-muted tabular-nums">
              الفترة: من {fromDate || 'البداية'} إلى {toDate || 'اليوم'}
            </p>
            <p className="text-[10px] text-muted tabular-nums">
              تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')}
            </p>
          </div>
        </div>

        {/* Financial Summary Box */}
        <div className="grid grid-cols-4 gap-3 p-3 bg-surface-2 border border-line rounded mb-5 text-center">
          <div>
            <span className="text-[10px] text-muted block font-bold">
              {isCourier ? 'إجمالي التحصيلات (مدين +)' : 'إجمالي المدين (+)'}
            </span>
            <span className="text-sm font-black text-bad tabular-nums">
              {formatCurrency(summary?.total_debit || 0)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted block font-bold">
              {isCourier ? 'إجمالي التوريدات والأتعاب (دائن -)' : 'إجمالي الدائن (-)'}
            </span>
            <span className="text-sm font-black text-ok tabular-nums">
              {formatCurrency(summary?.total_credit || 0)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted block font-bold">صافي الرصيد الختامي</span>
            <span className="text-sm font-black text-ink tabular-nums">
              {formatCurrency(summary?.current_balance || 0)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted block font-bold">الحالة المالية</span>
            <span className="text-xs font-black text-ink">
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
        <table className="w-full text-right border-collapse border border-line text-xs">
          <thead>
            <tr className="bg-surface-2 text-ink font-black border-b border-line">
              <th className="p-2 border border-line text-center w-10">م</th>
              <th className="p-2 border border-line w-28">التاريخ</th>
              <th className="p-2 border border-line">البيان / نوع الحركة</th>
              <th className="p-2 border border-line text-center text-bad w-28">مدين (+)</th>
              <th className="p-2 border border-line text-center text-ok w-28">دائن (-)</th>
              <th className="p-2 border border-line text-center w-28">الرصيد بعد الحركة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((entry, idx) => (
              <tr key={entry.id} className="border-b border-line">
                <td className="p-2 border border-line text-center tabular-nums">{idx + 1}</td>
                <td className="p-2 border border-line tabular-nums text-muted">{formatDate(entry.date)}</td>
                <td className="p-2 border border-line font-bold text-ink">{entry.description}</td>
                <td className="p-2 border border-line text-center tabular-nums font-bold text-bad">
                  {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                </td>
                <td className="p-2 border border-line text-center tabular-nums font-bold text-ok">
                  {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                </td>
                <td className="p-2 border border-line text-center tabular-nums font-black text-ink">
                  {formatCurrency(entry.balance_after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="mt-10 pt-4 border-t-2 border-line grid grid-cols-2 gap-8 text-center">
          <div className="space-y-8">
            <p className="font-bold text-xs">توقيع مسؤول الحسابات / الإدارة المالية</p>
            <div className="border-b border-dotted border-line w-48 mx-auto"></div>
          </div>
          <div className="space-y-8">
            <p className="font-bold text-xs">توقيع واعتماد الطرف الثاني ({partyTypeLabel})</p>
            <div className="border-b border-dotted border-line w-48 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
