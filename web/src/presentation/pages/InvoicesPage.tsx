import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Plus,
  Search,
  Trash2,
  Eye,
  AlertCircle,
  RotateCcw,
  ArrowLeftRight,
  Download,
  Printer,
} from 'lucide-react';
import { InvoiceType, formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { REFERENCE_QUERY_OPTIONS } from '../../data/api/queryPresets';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePermissions } from '../../hooks/usePermissions';
import { DateRangeFilter, calculatePresetDates } from '../components/common/DateRangeFilter';
import { PaginationBar } from '../components/common/PaginationBar';
import { InvoiceDetailsModal } from '../components/invoice/InvoiceDetailsModal';
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
  const navigate = useNavigate();
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
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(initialDates.from);
  const [toDate, setToDate] = useState<string>(initialDates.to);
  const [page, setPage] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isEditingSalesperson, setIsEditingSalesperson] = useState(false);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState<string>('');

  const user = useAuthStore((state) => state.user);

  // Reset page when route changes
  useEffect(() => {
    setPage(1);
  }, [invoiceType]);

  const { data: employeesData } = useQuery({
    queryKey: ['employees-filter', user?.id],
    queryFn: async () => {
      const res = await apiClient.get('/employees');
      return res.data?.data || [];
    },
    enabled: isOwnerOrAdmin || isManager,
    ...REFERENCE_QUERY_OPTIONS,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', user?.id, invoiceType, debouncedSearch, selectedEmployeeId, fromDate, toDate, page],
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
    queryKey: ['invoice-details', user?.id, selectedInvoiceId],
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
      const isEcommerce = Boolean(
        invoiceDetails.is_ecommerce_order ||
          invoiceDetails.online_order_id ||
          invoiceDetails.wc_order_id ||
          invoiceDetails.shopify_order_id
      );
      setSelectedSalespersonId(
        invoiceDetails.salesperson_id
          ? String(invoiceDetails.salesperson_id)
          : !isEcommerce && invoiceDetails.created_by
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
      queryClient.invalidateQueries({ queryKey: ['invoice-details', user?.id, selectedInvoiceId] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      setIsEditingSalesperson(false);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'تعذر تعديل مسؤول المبيعات في الفاتورة');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

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

  const handleQuickReturn = (inv: any) => {
    const returnPath = inv.type === 'PURCHASE' ? '/purchases/returns/new' : '/sales/returns/new';
    navigate(`${returnPath}?parent=${encodeURIComponent(inv.invoice_number)}`);
  };

  const handleQuickExchangeInPos = (inv: any) => {
    navigate('/pos', {
      state: {
        exchangeFromReturn: {
          id: inv.id,
          invoice_number: inv.invoice_number,
          total: Number(inv.total) || 0,
          party_id: inv.party_id || null,
          party_name: inv.party_name || null,
        },
      },
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
              placeholder="البحث برقم الفاتورة أو اسم العميل أو رقم الموبايل..."
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
                    <th className="py-3.5 px-4">
                      {isPurchase || isPurchaseReturn ? 'منشئ المستند' : 'مسؤول البيع / المنشئ'}
                    </th>
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
                      <div className="flex flex-col items-start gap-1">
                        <span>{inv.invoice_number}</span>
                        {!isReturn && inv.return_status === 'FULL' && (
                          <Badge tone="bad" className="text-[10px]">
                            مرتجع بالكامل
                          </Badge>
                        )}
                        {!isReturn && inv.return_status === 'PARTIAL' && (
                          <Badge tone="warn" className="text-[10px] tabular-nums">
                            مرتجع جزئي ({formatCurrency(inv.returned_total ?? 0)})
                          </Badge>
                        )}
                        {isReturn && inv.parent_invoice_number && (
                          <Badge tone="info" className="text-[10px] tabular-nums">
                            أصل: {inv.parent_invoice_number}
                          </Badge>
                        )}
                      </div>
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
                              {(inv.is_ecommerce_order ||
                                inv.online_order_id ||
                                inv.wc_order_id ||
                                inv.shopify_order_id) &&
                              !inv.salesperson_id
                                ? 'مؤكد / منشئ الطلب (بدون عمولة)'
                                : inv.salesperson_role
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
                        {!isReturn &&
                          inv.return_status !== 'FULL' &&
                          (!isPurchase || isOwnerOrAdmin || isManager) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="md"
                              onClick={() => handleQuickReturn(inv)}
                              className="text-muted hover:text-warn px-2.5"
                              title="عمل مرتجع لهذه الفاتورة"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          )}
                        {!isReturn && !isPurchase && inv.return_status !== 'FULL' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            onClick={() => navigate(`/exchanges/new?invoiceId=${inv.id}`)}
                            className="text-muted hover:text-brand px-2.5"
                            title="استبدال لهذه الفاتورة"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </Button>
                        )}
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
                  onQuickReturn={
                    !isReturn && (!isPurchase || isOwnerOrAdmin || isManager)
                      ? handleQuickReturn
                      : undefined
                  }
                  onExchange={
                    !isReturn && !isPurchase
                      ? (selectedInv) => navigate(`/exchanges/new?invoiceId=${selectedInv.id}`)
                      : undefined
                  }
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

      {/* Invoice Details Modal + Cashier Thermal Receipt Modal */}
      <InvoiceDetailsModal
        selectedInvoiceId={selectedInvoiceId}
        invoiceDetails={invoiceDetails}
        isDetailsLoading={isDetailsLoading}
        isReceiptModalOpen={isReceiptModalOpen}
        setIsReceiptModalOpen={setIsReceiptModalOpen}
        onClose={() => setSelectedInvoiceId(null)}
        canEditInvoiceSalesperson={canEditInvoiceSalesperson}
        isEditingSalesperson={isEditingSalesperson}
        setIsEditingSalesperson={setIsEditingSalesperson}
        selectedSalespersonId={selectedSalespersonId}
        setSelectedSalespersonId={setSelectedSalespersonId}
        employeesData={employeesData}
        isUpdatingSalesperson={updateSalespersonMutation.isPending}
        onUpdateSalesperson={(invoiceId, salespersonId) =>
          updateSalespersonMutation.mutate({ invoiceId, salespersonId })
        }
        onShareWhatsApp={handleShareWhatsApp}
        onPrint={handlePrint}
        onQuickReturn={
          !isReturn && (!isPurchase || isOwnerOrAdmin || isManager)
            ? (inv) => {
                setSelectedInvoiceId(null);
                handleQuickReturn(inv);
              }
            : undefined
        }
        onQuickExchangePos={
          isSaleReturn
            ? (inv) => {
                setSelectedInvoiceId(null);
                handleQuickExchangeInPos(inv);
              }
            : undefined
        }
      />
    </div>
  );
};
