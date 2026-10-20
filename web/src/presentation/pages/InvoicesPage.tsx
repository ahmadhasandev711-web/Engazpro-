import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Receipt, Plus, Search, Trash2, Eye, AlertCircle, RotateCcw, Download, X, Printer, Calendar, User, CreditCard, UserCheck, Edit2, Save, Share2 } from 'lucide-react';
import { InvoiceType, formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { exportInvoicesToExcel } from '../utils/excelExport';
import { usePermissions } from '../../hooks/usePermissions';
import { DateRangeFilter, calculatePresetDates } from '../components/common/DateRangeFilter';
import { PaginationBar } from '../components/common/PaginationBar';
import { PosReceiptModal } from '../components/pos/PosReceiptModal';
import { InvoiceMobileCard } from '../components/mobile/InvoiceMobileCard';
import { nativeBackButton } from '../../platform/nativeBackButton';
import { useAuthStore } from '../../data/store/useAuthStore';
import { webShareService, formatInvoiceWhatsAppText } from '../../infrastructure/pwa/webShareService';

export const InvoicesPage: React.FC = () => {
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
  });

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', invoiceType, search, selectedEmployeeId, fromDate, toDate, page],
    queryFn: async () => {
      const res = await apiClient.get('/invoices', {
        params: {
          type: invoiceType,
          search: search || undefined,
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
  const totalInvoicesAmount = data?.summary?.total_amount ?? invoices.reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0);

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
        invoiceDetails.salesperson_id ? String(invoiceDetails.salesperson_id) : (invoiceDetails.created_by ? String(invoiceDetails.created_by) : '')
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

  const handleDelete = (id: number, number: string) => {
    if (window.confirm(`هل أنت متأكد من إلغاء ${number}؟ هذا الإجراء سيقوم بعكس حركات المخزون والقيود المحاسبية المرتبطة به.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    if (!invoiceDetails) return;
    const storeIdentity = user?.store_identity;
    const storeName = storeIdentity?.business_name || (user as any)?.store_name || user?.name || 'المتجر';
    const storePhone = storeIdentity?.store_phone || user?.phone;
    const currencySymbol = storeIdentity?.currency || 'ج.م';
    const text = formatInvoiceWhatsAppText(invoiceDetails, {
      storeName,
      storePhone,
      currencySymbol,
    });
    const invoiceNo = invoiceDetails.invoice_number || `#${invoiceDetails.id}`;
    const customerPhone = invoiceDetails.party?.phone || (invoiceDetails as any).party_phone || (invoiceDetails as any).customer_phone;

    await webShareService.shareInvoice({
      title: `فاتورة ${invoiceNo} - ${storeName}`,
      text,
      phone: customerPhone,
    });
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Desktop Header (hidden on mobile) */}
      <div className="hidden md:flex sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{pageTitle}</h2>
            {isReturn && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800">
                مرتجع
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">{pageSub}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportInvoicesToExcel(invoices, pageTitle)}
            disabled={invoices.length === 0}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            title={`تصدير ${pageTitle} إلى Excel`}
          >
            <Download className="w-4 h-4 text-emerald-600" />
            تصدير Excel
          </button>
          {!isReturn && (
            <Link
              to={isPurchase ? '/purchases/returns' : '/sales/returns'}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              سجل المرتجعات
            </Link>
          )}
          <Link
            to={newLink}
            className={`inline-flex items-center gap-2 ${isReturn ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary-600 hover:bg-primary-700'} text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors`}
          >
            <Plus className="w-4 h-4" />
            {newBtnText}
          </Link>
        </div>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className={`md:hidden ${isReturn ? 'bg-gradient-to-l from-amber-600 to-orange-600' : isPurchase ? 'bg-gradient-to-l from-blue-600 to-indigo-700' : 'bg-gradient-to-l from-emerald-600 to-teal-700'} rounded-2xl p-3.5 text-white shadow-md flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-1 text-[11px] font-bold opacity-90">
            <Receipt className="w-3.5 h-3.5" />
            <span>{pageTitle} ({meta?.total ?? invoices.length})</span>
          </div>
          <h3 className="text-xl font-black mt-0.5 tracking-tight">
            {formatCurrency(totalInvoicesAmount)}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => exportInvoicesToExcel(invoices, pageTitle)}
            disabled={invoices.length === 0}
            className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-sm transition-colors disabled:opacity-40"
            title={`تصدير ${pageTitle} إلى Excel`}
          >
            <Download className="w-4 h-4" />
          </button>
          {!isReturn && (
            <Link
              to={isPurchase ? '/purchases/returns' : '/sales/returns'}
              className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-sm transition-colors"
              title="سجل المرتجعات"
            >
              <RotateCcw className="w-4 h-4" />
            </Link>
          )}
          <Link
            to={newLink}
            className="px-3 py-2 bg-white text-slate-900 hover:bg-slate-50 rounded-xl font-black text-xs shadow-sm flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>{isReturn ? 'مرتجع' : 'جديد'}</span>
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2.5 w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="البحث برقم المستند أو اسم الطرف..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {(isOwnerOrAdmin || isManager) && (
            <div className="sm:w-56">
              <select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  setPage(1);
                }}
                className="w-full border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
              >
                <option value="">جميع الموظفين (الكل)</option>
                {employeesData?.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role === 'SALES' ? 'بائع / سيلز' : emp.role === 'MANDOB' ? 'مندوب' : emp.role === 'CASHIER' ? 'كاشير' : emp.role === 'MANAGER' ? 'مدير' : 'مشرف'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date Range Filter Bar */}
        <div className="pt-2 border-t border-slate-100 w-full min-w-0 max-w-full overflow-hidden">
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
      </div>

      {/* Table */}
      <div className="bg-white flex-1 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400 font-medium flex-1">جاري التحميل...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 flex-1 flex flex-col justify-center items-center">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-700">لا توجد سجلات مسجلة</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              انقر فوق زر الإضافة بالأعلى لإنشاء مستند جديد وحفظه في الحسابات والمخزون.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table (md and above) */}
            <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full text-right text-sm min-w-[750px]">
                <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">رقم المستند</th>
                    <th className="py-3.5 px-4">التاريخ</th>
                    <th className="py-3.5 px-4">الطرف</th>
                    {(isOwnerOrAdmin || isManager) && <th className="py-3.5 px-4">مسؤول البيع / المنشئ</th>}
                    <th className="py-3.5 px-4">الإجمالي</th>
                    <th className="py-3.5 px-4">{isReturn ? 'المسترد نقداً' : 'المدفوع'}</th>
                    <th className="py-3.5 px-4">{isReturn ? 'المخصوم من الحساب' : 'الباقي'}</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv: any) => (
                    <tr 
                      key={inv.id} 
                      onClick={() => setSelectedInvoiceId(inv.id)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-primary-600">{inv.invoice_number}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">{inv.date}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{inv.party_name || 'نقدي (بدون حساب)'}</td>
                      {(isOwnerOrAdmin || isManager) && (
                        <td className="py-3.5 px-4 text-xs">
                          {inv.salesperson_name || inv.created_by_name ? (
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">
                                {inv.salesperson_name || inv.created_by_name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-medium">
                                {inv.salesperson_role ? (
                                  inv.salesperson_role === 'SALES' ? 'بائع / سيلز' :
                                  inv.salesperson_role === 'MANDOB' ? 'مندوب مبيعات' :
                                  inv.salesperson_role === 'CASHIER' ? 'كاشير' :
                                  inv.salesperson_role === 'MANAGER' ? 'مدير' : inv.salesperson_role
                                ) : (
                                  inv.created_by_role === 'MANDOB' ? 'مندوب مبيعات' :
                                  inv.created_by_role === 'CASHIER' ? 'كاشير' :
                                  inv.created_by_role === 'SALES' ? 'بائع / سيلز' :
                                  inv.created_by_role === 'MANAGER' ? 'مدير' :
                                  inv.created_by_role === 'SUPERVISOR' ? 'مشرف' : 'المالك'
                                )}
                              </span>
                              {inv.salesperson_name && inv.created_by_name && inv.salesperson_name !== inv.created_by_name && (
                                <span className="text-[9px] text-slate-400">
                                  منشئ: {inv.created_by_name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}
                      <td className={`py-3.5 px-4 font-black ${isReturn ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {formatCurrency(inv.total)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{formatCurrency(inv.paid_amount)}</td>
                      <td className="py-3.5 px-4">
                        {inv.due_amount > 0 ? (
                          <span className="text-rose-600 font-bold">{formatCurrency(inv.due_amount)}</span>
                        ) : (
                          <span className="text-slate-400">0.00</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"
                            title="طباعة إيصال كاشير حراري (80mm)"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedInvoiceId(inv.id)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="عرض تفاصيل الفاتورة"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canDeleteInvoice && (
                            <button
                              onClick={() => handleDelete(inv.id, inv.invoice_number)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                              title="إلغاء المستند"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch-Friendly Cards (md:hidden) */}
            <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-3 bg-slate-50/60">
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
      </div>

      {/* Invoice Details Modal - Responsive Bottom Sheet on Mobile */}
      {selectedInvoiceId && (
        <div className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150 ${isReceiptModalOpen ? 'print:hidden' : ''}`}>
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in duration-200">
            {/* Sheet Handle for Mobile */}
            <div className="w-12 h-1.5 bg-slate-400/60 rounded-full mx-auto mt-3 mb-1 sm:hidden no-print" />

            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Receipt className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black font-mono">
                      {invoiceDetails?.invoice_number || 'جاري التحميل...'}
                    </h3>
                    {invoiceDetails?.type && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
                        {invoiceDetails.type === 'SALE' ? 'فاتورة بيع' :
                         invoiceDetails.type === 'PURCHASE' ? 'فاتورة شراء' :
                         invoiceDetails.type === 'SALE_RETURN' ? 'مرتجع بيع' : 'مرتجع شراء'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">تفاصيل بنود الفاتورة والمدفوعات والمخزون</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoiceId(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className={`p-6 overflow-y-auto flex-1 space-y-6 ${isReceiptModalOpen ? 'print:hidden' : 'printable-area'}`}>
              {/* Print Header for Physical Printouts */}
              <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">
                      {invoiceDetails?.type === 'SALE' ? 'فاتورة ضريبية مبسطة (مبيعات)' :
                       invoiceDetails?.type === 'PURCHASE' ? 'فاتورة مشتريات' :
                       invoiceDetails?.type === 'SALE_RETURN' ? 'إشعار دائن (مرتجع مبيعات)' : 'مرتجع مشتريات'}
                    </h2>
                    <p className="text-sm font-mono font-bold text-slate-700 mt-0.5">
                      رقم الفاتورة: {invoiceDetails?.invoice_number}
                    </p>
                  </div>
                  <div className="text-left font-mono text-xs text-slate-600">
                    <div>التاريخ: {invoiceDetails?.date}</div>
                    {invoiceDetails?.wc_order_id && <div>طلب ووكومرس: #{invoiceDetails.wc_order_id}</div>}
                  </div>
                </div>
              </div>
              {isDetailsLoading || !invoiceDetails ? (
                <div className="text-center py-12 text-slate-400 font-medium">جاري جلب تفاصيل الفاتورة...</div>
              ) : (
                <>
                  {/* Meta Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5" /> التاريخ
                      </span>
                      <p className="font-bold text-slate-800 font-mono">{invoiceDetails.date}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1 font-medium">
                        <User className="w-3.5 h-3.5" /> الطرف
                      </span>
                      <p className="font-bold text-slate-800">{invoiceDetails.party_name || 'نقدي (بدون حساب)'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1 font-medium">
                        <CreditCard className="w-3.5 h-3.5" /> طريقة الدفع
                      </span>
                      <p className="font-bold text-slate-800">
                        {invoiceDetails.payment_method === 'CASH' ? 'نقدي (كاش)' :
                         invoiceDetails.payment_method === 'CREDIT' ? 'آجل (على الحساب)' :
                         invoiceDetails.payment_method === 'CARD' ? 'فيزا / بطاقة' :
                         invoiceDetails.payment_method === 'INSTAPAY' ? 'إنستاباي' :
                         invoiceDetails.payment_method === 'VODAFONE_CASH' ? 'فودافون كاش' :
                         invoiceDetails.payment_method === 'SPLIT' ? 'دفع مجزأ' : 'تحويل بنكي'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1 font-medium">
                        <User className="w-3.5 h-3.5 text-primary-500" /> المنشئ / المحرر
                      </span>
                      <p className="font-bold text-slate-800">
                        {invoiceDetails.created_by_name || 'المالك'}
                        {invoiceDetails.created_by_role && (
                          <span className="block text-[10px] text-slate-500 font-normal">
                            {invoiceDetails.created_by_role === 'MANDOB' ? 'مندوب مبيعات' :
                             invoiceDetails.created_by_role === 'CASHIER' ? 'كاشير' :
                             invoiceDetails.created_by_role === 'MANAGER' ? 'مدير الفرع' :
                             invoiceDetails.created_by_role === 'SUPERVISOR' ? 'مشرف' : 'صاحب العمل'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Salesperson Attribution & Reassignment Card (Only for SALE and SALE_RETURN) */}
                  {(invoiceDetails.type === 'SALE' || invoiceDetails.type === 'SALE_RETURN') && (
                    <div className="p-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 rounded-2xl border border-indigo-100/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100/80 text-indigo-700 rounded-xl flex-shrink-0">
                          <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium block text-[11px]">
                            مسؤول المبيعات المعتمد (لحساب العمولات والأرباح):
                          </span>
                          {!isEditingSalesperson ? (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="font-black text-slate-900 text-sm">
                                {invoiceDetails.salesperson_name || invoiceDetails.created_by_name || 'المالك / المنشئ'}
                              </span>
                              {invoiceDetails.salesperson_role ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                  {invoiceDetails.salesperson_role === 'SALES' ? 'بائع / سيلز' :
                                   invoiceDetails.salesperson_role === 'MANDOB' ? 'مندوب مبيعات' :
                                   invoiceDetails.salesperson_role === 'CASHIER' ? 'كاشير' :
                                   invoiceDetails.salesperson_role === 'MANAGER' ? 'مدير' : invoiceDetails.salesperson_role}
                                </span>
                              ) : invoiceDetails.created_by_role && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-200 text-slate-700">
                                  {invoiceDetails.created_by_role === 'MANDOB' ? 'مندوب' :
                                   invoiceDetails.created_by_role === 'CASHIER' ? 'كاشير' :
                                   invoiceDetails.created_by_role === 'SALES' ? 'بائع / سيلز' :
                                   invoiceDetails.created_by_role === 'MANAGER' ? 'مدير' : 'المنشئ'}
                                </span>
                              )}
                              {!invoiceDetails.salesperson_id && invoiceDetails.created_by_name && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  (تلقائياً حسب منشئ الفاتورة)
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1">
                              <select
                                value={selectedSalespersonId}
                                onChange={(e) => setSelectedSalespersonId(e.target.value)}
                                className="w-full sm:w-64 border border-indigo-300 rounded-xl text-xs px-3 py-1.5 bg-white text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="">-- تلقائياً (المنشئ / بدون تحديد) --</option>
                                {employeesData?.map((emp: any) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name} ({emp.role === 'SALES' ? 'بائع / سيلز' : emp.role === 'MANDOB' ? 'مندوب' : emp.role === 'CASHIER' ? 'كاشير' : emp.role === 'MANAGER' ? 'مدير' : 'مشرف'})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      {canEditInvoiceSalesperson && (
                        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                          {isEditingSalesperson ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  updateSalespersonMutation.mutate({
                                    invoiceId: invoiceDetails.id,
                                    salespersonId: selectedSalespersonId ? Number(selectedSalespersonId) : null,
                                  });
                                }}
                                disabled={updateSalespersonMutation.isPending}
                                className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
                              >
                                <Save className="w-3.5 h-3.5" />
                                {updateSalespersonMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsEditingSalesperson(false)}
                                className="inline-flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors"
                              >
                                إلغاء
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSalespersonId(
                                  invoiceDetails.salesperson_id ? String(invoiceDetails.salesperson_id) : (invoiceDetails.created_by ? String(invoiceDetails.created_by) : '')
                                );
                                setIsEditingSalesperson(true);
                              }}
                              className="inline-flex items-center gap-1.5 text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors"
                              title="تعديل مسؤول البيع لتصحيح عمولة الموظف"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              تعديل مسؤول البيع
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Items Table */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">بنود الفاتورة</h4>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">اسم الصنف</th>
                            <th className="py-2.5 px-3 text-center">الكمية</th>
                            <th className="py-2.5 px-3 text-left">السعر</th>
                            <th className="py-2.5 px-3 text-left">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {invoiceDetails.items?.map((item: any, idx: number) => (
                            <tr key={item.id || idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">{item.product_name}</td>
                              <td className="py-2.5 px-3 text-center font-bold font-mono">{item.quantity}</td>
                              <td className="py-2.5 px-3 text-left font-mono">{formatCurrency(item.unit_price)}</td>
                              <td className="py-2.5 px-3 text-left font-bold font-mono text-slate-900">
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600 text-xs">
                      <span>الإجمالي الفرعي:</span>
                      <span className="font-mono font-bold">{formatCurrency(invoiceDetails.subtotal)}</span>
                    </div>
                    {invoiceDetails.discount > 0 && (
                      <div className="flex justify-between text-rose-600 text-xs">
                        <span>الخصم:</span>
                        <span className="font-mono font-bold">- {formatCurrency(invoiceDetails.discount)}</span>
                      </div>
                    )}
                    {Number(invoiceDetails.shipping_amount) > 0 && (
                      <div className="flex justify-between text-blue-600 text-xs font-medium">
                        <span>خدمة التوصيل / الشحن:</span>
                        <span className="font-mono font-bold">+ {formatCurrency(invoiceDetails.shipping_amount)}</span>
                      </div>
                    )}
                    {invoiceDetails.tax > 0 && (
                      <div className="flex justify-between text-slate-600 text-xs">
                        <span>الضريبة:</span>
                        <span className="font-mono font-bold">+ {formatCurrency(invoiceDetails.tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                      <span>الصافي الإجمالي:</span>
                      <span className="text-primary-600 font-mono">{formatCurrency(invoiceDetails.total)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-emerald-700 pt-1">
                      <span>المدفوع:</span>
                      <span className="font-mono">{formatCurrency(invoiceDetails.paid_amount)}</span>
                    </div>
                    {invoiceDetails.due_amount > 0 && (
                      <div className="flex justify-between text-xs font-black text-rose-600">
                        <span>المتبقي (آجل):</span>
                        <span className="font-mono">{formatCurrency(invoiceDetails.due_amount)}</span>
                      </div>
                    )}
                  </div>

                  {invoiceDetails.notes && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                      <span className="font-bold">ملاحظات: </span>
                      {invoiceDetails.notes}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 no-print">
              <div className="flex flex-wrap items-stretch sm:items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-700/20"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة إيصال كاشير (حراري 80mm)</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition-all active:scale-98"
                  title="مشاركة الفاتورة عبر واتساب"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>إرسال واتساب</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>طباعة تقرير (A4)</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoiceId(null)}
                className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors text-center"
              >
                إغلاق
              </button>
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
