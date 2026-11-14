import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  HelpCircle,
  Package,
  Users,
  Truck,
  Receipt,
  Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { apiClient } from '../../data/api/client';
import {
  downloadProductsTemplate,
  exportProductsToExcel,
  exportPartiesToExcel,
  exportInvoicesToExcel,
  exportExpensesToExcel,
} from '../utils/excelExport';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { Badge, Button, Card, DataTable, PageHeader } from '../components/ui';

interface PreviewRow {
  row_number: number;
  status: 'VALID' | 'DUPLICATE' | 'DUPLICATE_IN_FILE' | 'INVALID';
  errors: string[];
  data: {
    name: string;
    category_name: string | null;
    code: string | null;
    barcode: string | null;
    unit: string;
    purchase_price: number | null;
    sale_price: number | null;
    min_sale_price: number | null;
    quantity: number;
    min_quantity: number | null;
    notes: string | null;
  };
  duplicate_info?: {
    existing_id: number;
    reason: string;
    existing_name: string;
    existing_quantity: number;
    existing_purchase_price: number;
    existing_sale_price: number;
  };
}

interface PreviewResult {
  total_rows: number;
  valid_count: number;
  duplicate_count: number;
  invalid_count: number;
  rows: PreviewRow[];
}

const EXPORT_ITEMS = [
  { key: 'products', label: 'تصدير الأصناف والمخزون الحالي', icon: Package, iconClass: 'text-brand' },
  { key: 'customers', label: 'تصدير قائمة وأرصدة العملاء', icon: Users, iconClass: 'text-info' },
  { key: 'suppliers', label: 'تصدير قائمة وأرصدة الموردين', icon: Truck, iconClass: 'text-warn' },
  { key: 'sales', label: 'تصدير فواتير المبيعات', icon: Receipt, iconClass: 'text-ok' },
  { key: 'purchases', label: 'تصدير فواتير المشتريات', icon: Receipt, iconClass: 'text-brand' },
  { key: 'expenses', label: 'تصدير سجل المصروفات', icon: Wallet, iconClass: 'text-bad' },
] as const;

export const ExcelPage: React.FC = () => {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [file, setFile] = useState<File | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip');
  const [commitResult, setCommitResult] = useState<{
    success: boolean;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    message: string;
  } | null>(null);
  const [exportLoading, setExportLoading] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // قراءة ملف Excel محلياً وإرساله للمعاينة الفورية
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setCommitResult(null);
    setIsReading(true);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: null });

      if (jsonRows.length === 0) {
        toast.error('الملف فارغ أو لا يحتوي على صفوف بيانات صالحة.');
        setIsReading(false);
        return;
      }

      // إرسال البيانات للمعاينة والتحقق في الـ Backend
      setIsPreviewing(true);
      const res = await apiClient.post('/import/products/preview', { rows: jsonRows });
      setPreviewResult(res.data.data);
    } catch (err: any) {
      console.error('Error parsing excel file:', err);
      toast.error('حدث خطأ أثناء قراءة الملف. يرجى التأكد من أن الملف بصيغة Excel (.xlsx, .xls) أو CSV صالحة.');
    } finally {
      setIsReading(false);
      setIsPreviewing(false);
    }
  };

  // تأكيد وحفظ الاستيراد في قاعدة البيانات
  const handleCommit = async () => {
    if (!previewResult || previewResult.rows.length === 0) return;

    const confirmMsg =
      duplicateAction === 'update'
        ? `هل أنت متأكد من حفظ الاستيراد مع تحديث الأصناف المكررة؟`
        : `هل أنت متأكد من حفظ الأصناف الجديدة وتخطي الأصناف المكررة؟`;

    const ok = await confirm({
      title: 'تأكيد حفظ الاستيراد',
      message: confirmMsg,
      type: 'warning',
    });
    if (!ok) return;

    setIsCommitting(true);
    try {
      const res = await apiClient.post('/import/products/commit', {
        rows: previewResult.rows,
        duplicate_action: duplicateAction,
      });

      setCommitResult(res.data.data);
      setPreviewResult(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Error committing import:', err);
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء حفظ البيانات في الخادم.');
    } finally {
      setIsCommitting(false);
    }
  };

  // إعادة التعيين والبدء من جديد
  const handleReset = () => {
    setFile(null);
    setPreviewResult(null);
    setCommitResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // تصدير البيانات بنقرة واحدة
  const handleExport = async (type: string) => {
    setExportLoading(type);
    try {
      if (type === 'products') {
        const res = await apiClient.get('/products');
        const items = res.data.data?.data || res.data.data || [];
        exportProductsToExcel(items);
      } else if (type === 'customers') {
        const res = await apiClient.get('/parties?type=CUSTOMER');
        const items = res.data.data?.data || res.data.data || [];
        exportPartiesToExcel(items, 'العملاء');
      } else if (type === 'suppliers') {
        const res = await apiClient.get('/parties?type=SUPPLIER');
        const items = res.data.data?.data || res.data.data || [];
        exportPartiesToExcel(items, 'الموردين');
      } else if (type === 'sales') {
        const res = await apiClient.get('/invoices?type=SALE');
        const items = res.data.data?.data || res.data.data || [];
        exportInvoicesToExcel(items, 'فواتير_المبيعات');
      } else if (type === 'purchases') {
        const res = await apiClient.get('/invoices?type=PURCHASE');
        const items = res.data.data?.data || res.data.data || [];
        exportInvoicesToExcel(items, 'فواتير_المشتريات');
      } else if (type === 'expenses') {
        const res = await apiClient.get('/expenses');
        const items = res.data.data?.data || res.data.data || [];
        exportExpensesToExcel(items);
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('فشل تصدير البيانات. يرجى التأكد من اتصال الخادم.');
    } finally {
      setExportLoading(null);
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Page Header */}
      <PageHeader
        title="مركز استيراد وتصدير Excel"
        description="استيراد قائمة المنتجات مع المعاينة الفورية الذكية وتصدير كافة سجلات النظام بضغطة زر"
        className="mb-0"
      />

      {/* Success Banner if committed */}
      {commitResult && (
        <div className="p-5 bg-ok-soft border border-ok/30 rounded-xl flex flex-wrap items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-ok flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-ink text-base">تم الاستيراد بنجاح!</h3>
            <p className="text-sm text-ok mt-1 font-medium">{commitResult.message}</p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <Badge tone="ok" className="rounded-md">
                أصناف جديدة: {commitResult.created_count}
              </Badge>
              <Badge tone="warn" className="rounded-md">
                أصناف محدثة: {commitResult.updated_count}
              </Badge>
              <Badge tone="neutral" className="rounded-md">
                أصناف تم تخطيها: {commitResult.skipped_count}
              </Badge>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
            استيراد ملف آخر
          </Button>
        </div>
      )}

      {/* Main Grid: Import vs Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left / Main Column: Import Products with Preview */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-ink">استيراد الأصناف من ملف Excel</h3>
                  <p className="text-xs text-muted">رفع الأصناف، الأسعار، والرصيد الافتتاحي مع المعاينة قبل الحفظ</p>
                </div>
              </div>

              {/* Template Download Button */}
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={downloadProductsTemplate}
                leftIcon={<Download className="w-4 h-4 text-muted" />}
              >
                تحميل نموذج Excel جاهز
              </Button>
            </div>

            {/* Drag & Drop Upload Zone */}
            {!previewResult && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-line-2 hover:border-brand rounded-xl p-8 text-center bg-surface-2/40 hover:bg-surface-2/70 transition-all cursor-pointer group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <FileSpreadsheet className="w-12 h-12 text-muted group-hover:text-brand mx-auto mb-3 transition-colors" />
                <h4 className="text-sm font-bold text-ink">
                  {isReading || isPreviewing ? 'جارٍ قراءة وفحص الملف...' : 'اضغط لاختيار ملف Excel أو اسحبه هنا'}
                </h4>
                <p className="text-xs text-muted mt-1">يدعم ملفات .xlsx و .xls و .csv حتى 10,000 صنف</p>
              </div>
            )}

            {/* Preview Section */}
            {previewResult && (
              <div className="space-y-6">
                {/* Stats Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface-2/60 rounded-xl border border-line">
                  <div className="flex flex-wrap items-center gap-6">
                    {file && (
                      <div>
                        <span className="text-xs text-muted block">الملف الحالي</span>
                        <span
                          className="text-sm font-bold text-ink tabular-nums truncate max-w-[150px] block"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-muted block">إجمالي الصفوف</span>
                      <span className="text-lg font-black text-ink tabular-nums">{previewResult.total_rows}</span>
                    </div>
                    <div className="h-8 w-px bg-line hidden sm:block" />
                    <div>
                      <span className="text-xs text-ok block font-medium">جاهز للاستيراد</span>
                      <span className="text-lg font-black text-ok tabular-nums">{previewResult.valid_count}</span>
                    </div>
                    <div className="h-8 w-px bg-line hidden sm:block" />
                    <div>
                      <span className="text-xs text-warn block font-medium">مكرر</span>
                      <span className="text-lg font-black text-warn tabular-nums">{previewResult.duplicate_count}</span>
                    </div>
                    <div className="h-8 w-px bg-line hidden sm:block" />
                    <div>
                      <span className="text-xs text-bad block font-medium">غير صالح</span>
                      <span className="text-lg font-black text-bad tabular-nums">{previewResult.invalid_count}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="min-h-[44px] px-2 text-xs text-muted hover:text-ink font-bold underline cursor-pointer"
                  >
                    إلغاء واختيار ملف آخر
                  </button>
                </div>

                {/* Duplicate Action Config */}
                {previewResult.duplicate_count > 0 && (
                  <div className="p-4 bg-warn-soft/70 border border-warn/30 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-warn font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-warn" />
                      <span>تحديد طريقة التعامل مع الأصناف المكررة ({previewResult.duplicate_count} صنف):</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 pt-1">
                      <label className="min-h-[44px] flex items-center gap-2 cursor-pointer text-xs text-ink font-medium">
                        <input
                          type="radio"
                          name="duplicateAction"
                          value="skip"
                          checked={duplicateAction === 'skip'}
                          onChange={() => setDuplicateAction('skip')}
                          className="text-brand focus:ring-brand accent-brand"
                        />
                        <span>تخطي الأصناف المكررة (إبقاء البيانات الحالية دون تعديل)</span>
                      </label>
                      <label className="min-h-[44px] flex items-center gap-2 cursor-pointer text-xs text-ink font-medium">
                        <input
                          type="radio"
                          name="duplicateAction"
                          value="update"
                          checked={duplicateAction === 'update'}
                          onChange={() => setDuplicateAction('update')}
                          className="text-brand focus:ring-brand accent-brand"
                        />
                        <span>تحديث البيانات (تعديل الأسعار وإضافة الكمية للمخزون)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Preview Table */}
                <div className="max-h-96 overflow-y-auto rounded-xl border border-line">
                  <DataTable className="border-0 rounded-none shadow-none">
                    <thead className="bg-surface-2 text-muted sticky top-0 font-bold border-b border-line text-xs">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">الصنف</th>
                        <th className="p-2.5">التصنيف</th>
                        <th className="p-2.5">الكود / الباركود</th>
                        <th className="p-2.5">سعر الشراء</th>
                        <th className="p-2.5">سعر البيع</th>
                        <th className="p-2.5">الكمية</th>
                        <th className="p-2.5">حالة المعاينة والتحقق</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line text-xs text-ink">
                      {previewResult.rows.map((row) => {
                        const isValid = row.status === 'VALID';
                        const isDup = row.status === 'DUPLICATE' || row.status === 'DUPLICATE_IN_FILE';
                        const isInvalid = row.status === 'INVALID';

                        return (
                          <tr
                            key={row.row_number}
                            className={
                              isInvalid
                                ? 'bg-bad-soft/40'
                                : isDup
                                ? 'bg-warn-soft/30'
                                : 'hover:bg-surface-2/50'
                            }
                          >
                            <td className="p-2.5 font-bold text-muted tabular-nums">{row.row_number}</td>
                            <td className="p-2.5 font-bold text-ink">
                              {row.data.name || <span className="text-bad">فارغ</span>}
                            </td>
                            <td className="p-2.5 text-muted">{row.data.category_name || '-'}</td>
                            <td className="p-2.5 tabular-nums text-muted">
                              {row.data.barcode || row.data.code || '-'}
                            </td>
                            <td className="p-2.5 font-bold text-ink tabular-nums">
                              {row.data.purchase_price !== null ? `${row.data.purchase_price} ج` : '-'}
                            </td>
                            <td className="p-2.5 font-bold text-ok tabular-nums">
                              {row.data.sale_price !== null ? `${row.data.sale_price} ج` : '-'}
                            </td>
                            <td className="p-2.5 font-bold text-ink tabular-nums">
                              {row.data.quantity > 0 ? (
                                <Badge tone="info" className="rounded text-xs">
                                  {row.data.quantity} {row.data.unit}
                                </Badge>
                              ) : (
                                '0'
                              )}
                            </td>
                            <td className="p-2.5">
                              {isValid && (
                                <Badge tone="ok" className="rounded text-xs">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> سليم
                                </Badge>
                              )}
                              {isDup && (
                                <div className="space-y-0.5">
                                  <Badge tone="warn" className="rounded text-xs">
                                    <AlertTriangle className="w-3.5 h-3.5" /> صنف مكرر
                                  </Badge>
                                  <p className="text-2xs text-warn font-medium">
                                    {row.duplicate_info?.reason || row.errors[0]}
                                  </p>
                                </div>
                              )}
                              {isInvalid && (
                                <div className="space-y-0.5">
                                  <Badge tone="bad" className="rounded text-xs">
                                    <XCircle className="w-3.5 h-3.5" /> خطأ
                                  </Badge>
                                  <p className="text-2xs text-bad font-medium">
                                    {row.errors.join(' | ')}
                                  </p>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                </div>

                {/* Commit Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <Button type="button" variant="secondary" size="md" onClick={handleReset}>
                    إلغاء المعاينة
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleCommit}
                    isLoading={isCommitting}
                    disabled={
                      isCommitting ||
                      (previewResult.valid_count === 0 &&
                        (previewResult.duplicate_count === 0 || duplicateAction === 'skip'))
                    }
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    {isCommitting
                      ? 'جارٍ حفظ البيانات وتوثيق المخزون...'
                      : 'تأكيد واعتماد الاستيراد في النظام'}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Quick Info & Constitution Rules Card */}
          <div className="p-4 bg-surface-2/60 rounded-xl border border-line flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-muted flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted space-y-1">
              <strong className="text-ink block">ضمان سلامة المخزون والدقة المحاسبية:</strong>
              <p>
                - أي صنف يتم إدخال رصيد أولي له سيتم توثيقه فوراً في سجل حركات المخزون كـ (رصيد افتتاحي) لضمان عدم التلاعب.
              </p>
              <p>
                - في حالة الأصناف المكررة واختيار "تحديث"، ستتم زيادة كمية المخزون الحالي بالكمية الجديدة وتحديث الأسعار.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: One-Click Excel Export Hub */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-info-soft text-info flex items-center justify-center shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-ink">تصدير سجلات النظام</h3>
                <p className="text-xs text-muted">تنزيل شيتات Excel فورية لكافة العمليات</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {EXPORT_ITEMS.map((item) => {
                const Icon = item.icon;
                const isItemLoading = exportLoading === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleExport(item.key)}
                    disabled={exportLoading !== null}
                    className="w-full min-h-[44px] flex items-center justify-between p-3 border border-line rounded-xl hover:bg-surface-2/60 text-xs font-bold text-ink transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className={clsx('w-4 h-4', item.iconClass)} />
                      {item.label}
                    </span>
                    {isItemLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-muted" />
                    ) : (
                      <Download className="w-4 h-4 text-muted" />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
