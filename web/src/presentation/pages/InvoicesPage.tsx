import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Plus,
  Search,
  Trash2,
  Eye,
  AlertCircle,
  RotateCcw,
  Download,
  X,
  Printer,
  Calendar,
  User,
  CreditCard,
  UserCheck,
  Edit2,
  Save,
  Share2,
} from 'lucide-react';
import { InvoiceType, formatCurrency, getPaymentMethodLabel } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { REFERENCE_QUERY_OPTIONS } from '../../data/api/queryPresets';
import { InvoiceItemMeta } from '../components/common/InvoiceItemMeta';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePermissions } from '../../hooks/usePermissions';
import { DateRangeFilter, calculatePresetDates } from '../components/common/DateRangeFilter';
import { PaginationBar } from '../components/common/PaginationBar';
import { PosReceiptModal } from '../components/pos/PosReceiptModal';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { InvoiceMobileCard } from '../components/mobile/InvoiceMobileCard';
import { nativeBackButton } from '../../platform/nativeBackButton';
import { useAuthStore } from '../../data/store/useAuthStore';
import { webShareService, formatInvoiceWhatsAppText } from '../../infrastructure/pwa/webShareService';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from '../components/ui';

export const InvoicesPage: React.FC = () => {
  const { confirm } = useConfirm();
  const toast = useToast();
  const location = useLocation();
  const queryClient = useQueryClient();

  const isSaleReturn = location.pathname.includes('/sales/returns');
  const isPurchaseReturn = location.pathname.includes('/purchases/returns');
  const isPurchase = location.pathname.includes('/purchases') && !isPurchaseReturn;
  const isReturn = isSaleReturn || isPurchaseReturn;

  let invoiceType = InvoiceType.SALE;
  let pageTitle = 'فواتير المبيعات';
  let pageSub = 'سجل فواتير البيع للعملاء والنقدية';
  let newLink = '/sales/new';
  let newBtnText = 'فاتورة بيع جديدة';

  if (isSaleReturn) {
    invoiceType = InvoiceType.SALE_RETURN;
    pageTitle = 'مرتجعات المبيعات';
    pageSub = 'سجل بضائع المبيعات المرتجعة وتأثيرها على المخزون وحسابات العملاء';
    newLink = '/sales/returns/new';
    newBtnText = 'مرتجع مبيعات جديد';
  } else if (isPurchaseReturn) {
    invoiceType = InvoiceType.PURCHASE_RETURN;
    pageTitle = 'مرتجعات المشتريات';
    pageSub = 'سجل بضائع المشتريات المرتجعة للموردين وتأثيرها على المخزون ومستحقاتهم';
    newLink = '/purchases/returns/new';
    newBtnText = 'مرتجع مشتريات جديد';
  } else if (isPurchase) {
    invoiceType = InvoiceType.PURCHASE;
    pageTitle = 'فواتير المشتريات';
    pageSub = 'سجل المشتريات من الموردين وتأثيرها على المخزون';
    newLink = '/purchases/new';
    newBtnText = 'فاتورة شراء جديدة';
  }

  const { canDeleteInvoice, isOwnerOrAdmin, isManager, canEditInvoiceSalesperson } = usePermissions();
  const initialDates = calculatePresetDates('today');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(initialDates.from);
  const [toDate, setToDate] = useState<string>(initialDates.to);
  const [page, setPage] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isEditingSalesperson, setIsEditingSalesperson] = useState(false);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>('');

  // Reset page when route changes
  useEffect(() => {
    setPage(1);
  }, [invoiceType]);

  const { data: employeesData } = useQuery({
    queryKey: ['employees-filter'],
    queryFn: async () => {
      const res = await apiClient.get('/employees');
      return res.data?.data || [];
    },
    enabled: isOwnerOrAdmin || isManager,
    ...REFERENCE_QUERY_OPTIONS,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', invoiceType, debouncedSearch, selectedEmployeeId, fromDate, toDate, page],
    queryFn: async () => {
      const res = await apiClient.get('/invoices', {
        params: {
          type: invoiceType,
          search: debouncedSearch || undefined,
          created_by: selectedEmployeeId || undefined,
          date_from: fromDate || undefined,
          date_to: toDate || undefined,
          page,
        },
      });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const invoices = data?.data || [];
  const meta = data?.meta;
  const totalInvoicesAmount =
    data?.summary?.total_amount ??
    invoices.reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0);

  // Query for single invoice details
  const { data: invoiceDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['invoice-details', selectedInvoiceId],
    queryFn: async () => {
      if (!selectedInvoiceId) return null;
      const res = await apiClient.get(`/invoices/${selectedInvoiceId}`);
      return res.data.data;
    },
    enabled: !!selectedInvoiceId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (selectedInvoiceId) setSelectedInvoiceId(null);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'تعذر إلغاء المستند');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  useEffect(() => {
    if (invoiceDetails) {
      setSelectedSalespersonId(
        invoiceDetails.salesperson_id
          ? String(invoiceDetails.salesperson_id)
          : invoiceDetails.created_by
            ? String(invoiceDetails.created_by)
            : ''
      );
      setIsEditingSalesperson(false);
    }
  }, [invoiceDetails]);

  // Hardware Back Button integration
  useEffect(() => {
    if (isReceiptModalOpen) {
      return nativeBackButton.register(() => {
        setIsReceiptModalOpen(false);
        return true;
      });
    }
  }, [isReceiptModalOpen]);

  useEffect(() => {
    if (selectedInvoiceId && !isReceiptModalOpen) {
      return nativeBackButton.register(() => {
        setSelectedInvoiceId(null);
        return true;
      });
    }
  }, [selectedInvoiceId, isReceiptModalOpen]);

  const updateSalespersonMutation = useMutation({
    mutationFn: async ({ invoiceId, salespersonId }: { invoiceId: number; salespersonId: number | null }) => {
      return apiClient.patch(`/invoices/${invoiceId}/salesperson`, {
        salesperson_id: salespersonId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-details', selectedInvoiceId] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      setIsEditingSalesperson(false);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'تعذر تعديل مسؤول المبيعات في الفاتورة');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const user = useAuthStore((state) => state.user);

  const handleDelete = async (id: number, number: string) => {
    const ok = await confirm({
      title: 'تأكيد إلغاء الفاتورة',
      message: `هل أنت متأكد من إلغاء ${number}؟ هذا الإجراء سيقوم بعكس حركات المخزون والقيود المحاسبية المرتبطة به.`,
      type: 'danger',
    });
    if (ok) {
      deleteMutation.mutate(id);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = async () => {
    try {
      const { exportInvoicesToExcel } = await import('../utils/excelExport');
      exportInvoicesToExcel(invoices, pageTitle);
    } catch (err) {
      console.error('Excel load failed:', err);
      toast.error('تعذر تحميل أداة Excel، تأكد من الاتصال وحاول مرة أخرى');
    }
  };

  const handleShareWhatsApp = async () => {
    if (!invoiceDetails) return;
    const storeIdentity = user?.store_identity;
    const storeName =
      storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'المتجر';
    const storePhone = storeIdentity?.store_phone || user?.phone;
    const currencySymbol = storeIdentity?.currency || 'ج.م';
    const text = formatInvoiceWhatsAppText(invoiceDetails, {
      storeName,
      storePhone,
      currencySymbol,
    });
    const invoiceNo = invoiceDetails.invoice_number || `#${invoiceDetails.id}`;
    const customerPhone =
      invoiceDetails.party?.phone ||
      (invoiceDetails as any).party_phone ||
      (invoiceDetails as any).customer_phone;

    await webShareService.shareInvoice({
      title: `فاتورة ${invoiceNo} - ${storeName}`,
      text,
      phone: customerPhone,
    });
  };

  const mobileHeroTone = isReturn
    ? 'bg-warn text-on-brand'
    : isPurchase
      ? 'bg-info text-on-brand'
      : 'bg-ok text-on-brand';

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Desktop Header (hidden on mobile) */}
      <PageHeader
        title={pageTitle}
        description={pageSub}
        badge={isReturn ? <Badge tone="warn">مرتجع</Badge> : undefined}
        className="hidden md:flex mb-0"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleExportExcel}
              disabled={invoices.length === 0}
              leftIcon={<Download className="w-4 h-4 text-ok" />}
              title={`تصدير ${pageTitle} إلى Excel`}
              className="text-xs font-bold"
            >
              تصدير Excel
            </Button>
            {!isReturn && (
              <Link
                to={isPurchase ? '/purchases/returns' : '/sales/returns'}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] bg-surface-2 hover:bg-line text-ink border border-line px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-muted" />
                سجل المرتجعات
              </Link>
            )}
            <Link
              to={newLink}
              className={`inline-flex items-center justify-center gap-2 min-h-[44px] ${
                isReturn ? 'bg-warn text-on-brand' : 'bg-brand text-on-brand'
              } hover:opacity-95 px-4 py-2.5 rounded-xl text-sm font-bold shadow-xs transition-colors`}
            >
              <Plus className="w-4 h-4" />
              {newBtnText}
            </Link>
          </>
        }
      />

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className={`md:hidden ${mobileHeroTone} rounded-2xl p-3.5 shadow-md flex items-center justify-between gap-2`}>
        <div>
          <div className="flex items-center gap-1 text-[11px] font-bold opacity-90">
            <Receipt className="w-3.5 h-3.5" />
            <span className="tabular-nums">
              {pageTitle} ({meta?.total ?? invoices.length})
            </span>
          </div>
          <h3 className="text-xl font-black mt-0.5 tracking-tight tabular-nums">
            {formatCurrency(totalInvoicesAmount)}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleExportExcel}
            disabled={invoices.length === 0}
            className="min-w-[44px] px-2.5 bg-canvas/20 hover:bg-canvas/30 text-on-brand"
            title={`تصدير ${pageTitle} إلى Excel`}
          >
            <Download className="w-4 h-4" />
          </Button>
          {!isReturn && (
            <Link
              to={isPurchase ? '/purchases/returns' : '/sales/returns'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center bg-canvas/20 hover:bg-canvas/30 text-on-brand rounded-xl transition-colors"
              title="سجل المرتجعات"
            >
              <RotateCcw className="w-4 h-4" />
            </Link>
          )}
          <Link
            to={newLink}
            className="min-h-[44px] px-3 py-2 bg-panel text-ink hover:bg-surface-2 rounded-xl font-black text-xs shadow-xs inline-flex items-center gap-1 active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4 text-ok" />
            <span>{isReturn ? 'مرتجع' : 'جديد'}</span>
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-bad-soft border border-bad/30 text-bad text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-bad flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search & Filters */}
      <Card className="p-3 sm:p-4 flex flex-col gap-2.5 w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="البحث برقم المستند أو اسم الطرف..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="w-5 h-5" />}
            />
          </div>

          {(isOwnerOrAdmin || isManager) && (
            <div className="sm:w-56">
              <Select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">جميع الموظفين (الكل)</option>
                {employeesData?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} (
                    {emp.role === 'SALES'
                      ? 'بائع / سيلز'
                      : emp.role === 'MANDOB'
                        ? 'مندوب'
                        : emp.role === 'CASHIER'
                          ? 'كاشير'
                          : emp.role === 'MANAGER'
                            ? 'مدير'
                            : 'مشرف'}
                    )
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Date Range Filter Bar */}
        <div className="pt-2 border-t border-line w-full min-w-0 max-w-full overflow-hidden">
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            defaultPreset="today"
            onChange={(from, to) => {
              setFromDate(from);
              setToDate(to);
              setPage(1);
            }}
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 sm:p-0 flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-muted font-medium flex-1">جاري التحميل...</div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-6 h-6" />}
            title="لا توجد سجلات مسجلة"
            description="انقر فوق زر الإضافة بالأعلى لإنشاء مستند جديد وحفظه في الحسابات والمخزون."
            className="border-0 rounded-none flex-1 py-16"
          />
        ) : (
          <>
            {/* Desktop & Tablet Table (md and above) */}
            <DataTable
              className="hidden md:block flex-1 border-0 rounded-none shadow-none"
              tableClassName="min-w-[750px]"
            >
              <thead className="bg-surface-2 text-muted text-xs font-bold border-b border-line">
                <tr>
                  <th className="py-3.5 px-4">رقم المستند</th>
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4">الطرف</th>
                  {(isOwnerOrAdmin || isManager) && (
                    <th className="py-3.5 px-4">مسؤول البيع / المنشئ</th>
                  )}
                  <th className="py-3.5 px-4">الإجمالي</th>
                  <th className="py-3.5 px-4">{isReturn ? 'المسترد نقداً' : 'المدفوع'}</th>
                  <th className="py-3.5 px-4">{isReturn ? 'المخصوم من الحساب' : 'الباقي'}</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {invoices.map((inv: any) => (
                  <tr
                    key={inv.id}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className="hover:bg-surface-2/60 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 tabular-nums font-bold text-brand">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3.5 px-4 text-muted tabular-nums text-xs">{inv.date}</td>
                    <td className="py-3.5 px-4 font-bold text-ink">
                      {inv.party_name || 'نقدي (بدون حساب)'}
                    </td>
                    {(isOwnerOrAdmin || isManager) && (
                      <td className="py-3.5 px-4 text-xs">
                        {inv.salesperson_name || inv.created_by_name ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-ink">
                              {inv.salesperson_name || inv.created_by_name}
                            </span>
                            <span className="text-[11px] text-muted font-medium">
                              {inv.salesperson_role
                                ? inv.salesperson_role === 'SALES'
                                  ? 'بائع / سيلز'
                                  : inv.salesperson_role === 'MANDOB'
                                    ? 'مندوب مبيعات'
                                    : inv.salesperson_role === 'CASHIER'
                                      ? 'كاشير'
                                      : inv.salesperson_role === 'MANAGER'
                                        ? 'مدير'
                                        : inv.salesperson_role
                                : inv.created_by_role === 'MANDOB'
                                  ? 'مندوب مبيعات'
                                  : inv.created_by_role === 'CASHIER'
                                    ? 'كاشير'
                                    : inv.created_by_role === 'SALES'
                                      ? 'بائع / سيلز'
                                      : inv.created_by_role === 'MANAGER'
                                        ? 'مدير'
                                        : inv.created_by_role === 'SUPERVISOR'
                                          ? 'مشرف'
                                          : 'المالك'}
                            </span>
                            {inv.salesperson_name &&
                              inv.created_by_name &&
                              inv.salesperson_name !== inv.created_by_name && (
                                <span className="text-[11px] text-muted">
                                  منشئ: {inv.created_by_name}
                                </span>
                              )}
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    )}
                    <td
                      className={`py-3.5 px-4 font-black tabular-nums ${
                        isReturn ? 'text-bad' : 'text-ok'
                      }`}
                    >
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="py-3.5 px-4 text-muted font-medium tabular-nums">
                      {formatCurrency(inv.paid_amount)}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      {inv.due_amount > 0 ? (
                        <span className="text-bad font-bold">{formatCurrency(inv.due_amount)}</span>
                      ) : (
                        <span className="text-muted">0.00</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="md"
                          onClick={() => {
                            setSelectedInvoiceId(inv.id);
                            setIsReceiptModalOpen(true);
                          }}
                          className="text-muted hover:text-ok px-2.5"
                          title="طباعة إيصال كاشير حراري (80mm)"
                        >
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="md"
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className="text-muted hover:text-brand px-2.5"
                          title="عرض تفاصيل الفاتورة"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canDeleteInvoice && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            onClick={() => handleDelete(inv.id, inv.invoice_number)}
                            className="text-muted hover:text-bad px-2.5"
                            title="إلغاء المستند"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            {/* Mobile Touch-Friendly Cards (md:hidden) */}
            <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-3 bg-surface-2/50">
              {invoices.map((inv: any) => (
                <InvoiceMobileCard
                  key={inv.id}
                  invoice={inv}
                  isReturn={isReturn}
                  isOwnerOrAdmin={isOwnerOrAdmin}
                  isManager={isManager}
                  canDeleteInvoice={canDeleteInvoice}
                  onSelectInvoice={(id) => setSelectedInvoiceId(id)}
                  onPrintReceipt={(id) => {
                    setSelectedInvoiceId(id);
                    setIsReceiptModalOpen(true);
                  }}
                  onDeleteInvoice={(id, num) => handleDelete(id, num)}
                />
              ))}
            </div>

            <PaginationBar
              currentPage={meta?.current_page || page}
              lastPage={meta?.last_page || 1}
              total={meta?.total || invoices.length}
              perPage={meta?.per_page || 20}
              onPageChange={(newPage) => setPage(newPage)}
              itemLabel="فاتورة"
            />
          </>
        )}
      </Card>

      {/* Invoice Details Modal - Responsive Bottom Sheet on Mobile */}
      {selectedInvoiceId && (
        <div
          className={`fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150 ${
            isReceiptModalOpen ? 'print:hidden' : ''
          }`}
        >
          <div className="bg-panel text-ink rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-line animate-in slide-in-from-bottom sm:zoom-in duration-200">
            {/* Sheet Handle for Mobile */}
            <div className="w-12 h-1.5 bg-line-2 rounded-full mx-auto mt-3 mb-1 sm:hidden no-print" />

            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-surface-2 border-b border-line text-ink flex items-center justify-between no-print">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-soft rounded-xl">
                  <Receipt className="w-6 h-6 text-brand" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black tabular-nums">
                      {invoiceDetails?.invoice_number || 'جاري التحميل...'}
                    </h3>
                    {invoiceDetails?.type && (
                      <Badge tone="brand">
                        {invoiceDetails.type === 'SALE'
                          ? 'فاتورة بيع'
                          : invoiceDetails.type === 'PURCHASE'
                            ? 'فاتورة شراء'
                            : invoiceDetails.type === 'SALE_RETURN'
                              ? 'مرتجع بيع'
                              : 'مرتجع شراء'}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    تفاصيل بنود الفاتورة والمدفوعات والمخزون
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setSelectedInvoiceId(null)}
                className="text-muted hover:text-ink px-2.5"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Body */}
            <div
              className={`p-6 overflow-y-auto flex-1 space-y-6 ${
                isReceiptModalOpen ? 'print:hidden' : 'printable-area'
              }`}
            >
              {/* Print Header for Physical Printouts (paper tokens) */}
              <div className="hidden print:block border-b-2 border-paper-ink pb-3 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black text-paper-ink">
                      {invoiceDetails?.type === 'SALE' ? 'فاتورة ضريبية مبسطة (مبيعات)' :
                       invoiceDetails?.type === 'PURCHASE' ? 'فاتورة مشتريات' :
                       invoiceDetails?.type === 'SALE_RETURN' ? 'إشعار دائن (مرتجع مبيعات)' : 'مرتجع مشتريات'}
                    </h2>
                    <p className="text-sm font-mono font-bold text-paper-muted mt-0.5">
                      رقم الفاتورة: {invoiceDetails?.invoice_number}
                    </p>
                  </div>
                  <div className="text-left font-mono text-xs text-paper-muted">
                    <div>التاريخ: {invoiceDetails?.date}</div>
                    {(invoiceDetails?.wc_order_id || invoiceDetails?.shopify_order_id) && (
                      <div>
                        طلب المتجر: #
                        {invoiceDetails.wc_order_id || invoiceDetails.shopify_order_id}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {isDetailsLoading || !invoiceDetails ? (
                <div className="text-center py-12 text-muted font-medium">
                  جاري جلب تفاصيل الفاتورة...
                </div>
              ) : (
                <>
                  {/* Meta Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-surface-2 rounded-2xl border border-line text-xs">
                    <div className="space-y-1">
                      <span className="text-muted flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5" /> التاريخ
                      </span>
                      <p className="font-bold text-ink tabular-nums">{invoiceDetails.date}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted flex items-center gap-1 font-medium">
                        <User className="w-3.5 h-3.5" /> الطرف
                      </span>
                      <p className="font-bold text-ink">
                        {invoiceDetails.party_name || 'نقدي (بدون حساب)'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted flex items-center gap-1 font-medium">
                        <CreditCard className="w-3.5 h-3.5" /> طريقة الدفع
                      </span>
                      <p className="font-bold text-ink">
                        {getPaymentMethodLabel(invoiceDetails.payment_method)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-muted flex items-center gap-1 font-medium">
                        <User className="w-3.5 h-3.5 text-brand" /> المنشئ / المحرر
                      </span>
                      <p className="font-bold text-ink">
                        {invoiceDetails.created_by_name || 'المالك'}
                        {invoiceDetails.created_by_role && (
                          <span className="block text-[11px] text-muted font-normal">
                            {invoiceDetails.created_by_role === 'MANDOB'
                              ? 'مندوب مبيعات'
                              : invoiceDetails.created_by_role === 'CASHIER'
                                ? 'كاشير'
                                : invoiceDetails.created_by_role === 'MANAGER'
                                  ? 'مدير الفرع'
                                  : invoiceDetails.created_by_role === 'SUPERVISOR'
                                    ? 'مشرف'
                                    : 'صاحب العمل'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Salesperson Attribution & Reassignment Card (Only for SALE and SALE_RETURN) */}
                  {(invoiceDetails.type === 'SALE' || invoiceDetails.type === 'SALE_RETURN') && (
                    <div className="p-4 bg-info-soft/40 rounded-2xl border border-info/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-info-soft text-info rounded-xl flex-shrink-0">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-muted font-medium block text-[11px]">
                            مسؤول المبيعات المعتمد (لحساب العمولات والأرباح):
                          </span>
                          {!isEditingSalesperson ? (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="font-black text-ink text-sm">
                                {invoiceDetails.salesperson_name ||
                                  invoiceDetails.created_by_name ||
                                  'المالك / المنشئ'}
                              </span>
                              {invoiceDetails.salesperson_role ? (
                                <Badge tone="info" className="text-[11px]">
                                  {invoiceDetails.salesperson_role === 'SALES'
                                    ? 'بائع / سيلز'
                                    : invoiceDetails.salesperson_role === 'MANDOB'
                                      ? 'مندوب مبيعات'
                                      : invoiceDetails.salesperson_role === 'CASHIER'
                                        ? 'كاشير'
                                        : invoiceDetails.salesperson_role === 'MANAGER'
                                          ? 'مدير'
                                          : invoiceDetails.salesperson_role}
                                </Badge>
                              ) : (
                                invoiceDetails.created_by_role && (
                                  <Badge tone="neutral" className="text-[11px]">
                                    {invoiceDetails.created_by_role === 'MANDOB'
                                      ? 'مندوب'
                                      : invoiceDetails.created_by_role === 'CASHIER'
                                        ? 'كاشير'
                                        : invoiceDetails.created_by_role === 'SALES'
                                          ? 'بائع / سيلز'
                                          : invoiceDetails.created_by_role === 'MANAGER'
                                            ? 'مدير'
                                            : 'المنشئ'}
                                  </Badge>
                                )
                              )}
                              {!invoiceDetails.salesperson_id && invoiceDetails.created_by_name && (
                                <span className="text-[11px] text-muted font-normal">
                                  (تلقائياً حسب منشئ الفاتورة)
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1 sm:w-64">
                              <Select
                                value={selectedSalespersonId}
                                onChange={(e) => setSelectedSalespersonId(e.target.value)}
                              >
                                <option value="">-- تلقائياً (المنشئ / بدون تحديد) --</option>
                                {employeesData?.map((emp: any) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name} (
                                    {emp.role === 'SALES'
                                      ? 'بائع / سيلز'
                                      : emp.role === 'MANDOB'
                                        ? 'مندوب'
                                        : emp.role === 'CASHIER'
                                          ? 'كاشير'
                                          : emp.role === 'MANAGER'
                                            ? 'مدير'
                                            : 'مشرف'}
                                    )
                                  </option>
                                ))}
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>

                      {canEditInvoiceSalesperson && (
                        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                          {isEditingSalesperson ? (
                            <>
                              <Button
                                type="button"
                                variant="primary"
                                size="md"
                                onClick={() => {
                                  updateSalespersonMutation.mutate({
                                    invoiceId: invoiceDetails.id,
                                    salespersonId: selectedSalespersonId
                                      ? Number(selectedSalespersonId)
                                      : null,
                                  });
                                }}
                                disabled={updateSalespersonMutation.isPending}
                                leftIcon={<Save className="w-3.5 h-3.5" />}
                                className="text-xs font-bold"
                              >
                                {updateSalespersonMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="md"
                                onClick={() => setIsEditingSalesperson(false)}
                                className="text-xs font-bold"
                              >
                                إلغاء
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="secondary"
                              size="md"
                              onClick={() => {
                                setSelectedSalespersonId(
                                  invoiceDetails.salesperson_id
                                    ? String(invoiceDetails.salesperson_id)
                                    : invoiceDetails.created_by
                                      ? String(invoiceDetails.created_by)
                                      : ''
                                );
                                setIsEditingSalesperson(true);
                              }}
                              leftIcon={<Edit2 className="w-3.5 h-3.5 text-info" />}
                              className="text-info border-info/30 bg-info-soft hover:bg-info-soft/80 text-xs font-bold"
                              title="تعديل مسؤول البيع لتصحيح عمولة الموظف"
                            >
                              تعديل مسؤول البيع
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items Table */}
                  <div>
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                      بنود الفاتورة
                    </h4>
                    <DataTable>
                      <thead className="bg-surface-2 text-muted font-bold border-b border-line text-xs">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">اسم الصنف</th>
                          <th className="py-2.5 px-3 text-center">الكمية</th>
                          <th className="py-2.5 px-3 text-left">السعر</th>
                          <th className="py-2.5 px-3 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-xs">
                        {invoiceDetails.items?.map((item: any, idx: number) => (
                          <tr key={item.id || idx} className="hover:bg-surface-2/50">
                            <td className="py-2.5 px-3 tabular-nums text-muted">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-ink">
                              <div>{item.product_name}</div>
                              <InvoiceItemMeta
                                variantName={item.variant_name}
                                batchNumber={item.batch_number}
                                unitName={item.unit_name}
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold tabular-nums">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-left tabular-nums">
                              {formatCurrency(item.unit_price)}
                            </td>
                            <td className="py-2.5 px-3 text-left font-bold tabular-nums text-ink">
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </div>

                  {/* Financial Summary */}
                  <div className="bg-surface-2 p-4 rounded-2xl border border-line space-y-2 text-sm">
                    <div className="flex justify-between text-muted text-xs">
                      <span>الإجمالي الفرعي:</span>
                      <span className="tabular-nums font-bold text-ink">
                        {formatCurrency(invoiceDetails.subtotal)}
                      </span>
                    </div>
                    {invoiceDetails.discount > 0 && (
                      <div className="flex justify-between text-bad text-xs">
                        <span>الخصم:</span>
                        <span className="tabular-nums font-bold">
                          - {formatCurrency(invoiceDetails.discount)}
                        </span>
                      </div>
                    )}
                    {Number(invoiceDetails.shipping_amount) > 0 && (
                      <div className="flex justify-between text-info text-xs font-medium">
                        <span>خدمة التوصيل / الشحن:</span>
                        <span className="tabular-nums font-bold">
                          + {formatCurrency(invoiceDetails.shipping_amount)}
                        </span>
                      </div>
                    )}
                    {invoiceDetails.tax > 0 && (
                      <div className="flex justify-between text-muted text-xs">
                        <span>الضريبة:</span>
                        <span className="tabular-nums font-bold text-ink">
                          + {formatCurrency(invoiceDetails.tax)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-black text-ink pt-2 border-t border-line">
                      <span>الصافي الإجمالي:</span>
                      <span className="text-brand tabular-nums">
                        {formatCurrency(invoiceDetails.total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-ok pt-1">
                      <span>المدفوع:</span>
                      <span className="tabular-nums">{formatCurrency(invoiceDetails.paid_amount)}</span>
                    </div>
                    {invoiceDetails.due_amount > 0 && (
                      <div className="flex justify-between text-xs font-black text-bad">
                        <span>المتبقي (آجل):</span>
                        <span className="tabular-nums">{formatCurrency(invoiceDetails.due_amount)}</span>
                      </div>
                    )}
                  </div>

                  {invoiceDetails.notes && (
                    <div className="p-3 bg-warn-soft rounded-xl border border-warn/30 text-xs text-ink">
                      <span className="font-bold text-warn">ملاحظات: </span>
                      {invoiceDetails.notes}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-2 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 no-print">
              <div className="flex flex-wrap items-stretch sm:items-center gap-2 flex-1">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => setIsReceiptModalOpen(true)}
                  leftIcon={<Printer className="w-4 h-4" />}
                  className="bg-ok text-on-brand hover:opacity-95 text-xs font-bold"
                >
                  طباعة إيصال كاشير (حراري 80mm)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleShareWhatsApp}
                  leftIcon={<Share2 className="w-3.5 h-3.5 text-ok" />}
                  className="bg-ok-soft text-ok border-ok/30 hover:bg-ok-soft/80 text-xs font-bold"
                  title="مشاركة الفاتورة عبر واتساب"
                >
                  إرسال واتساب
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handlePrint}
                  leftIcon={<Printer className="w-3.5 h-3.5 text-muted" />}
                  className="text-xs font-bold"
                >
                  طباعة تقرير (A4)
                </Button>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setSelectedInvoiceId(null)}
                className="text-xs font-bold"
              >
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cashier Thermal Receipt Modal */}
      {invoiceDetails && (
        <PosReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          invoice={invoiceDetails}
        />
      )}
    </div>
  );
};
