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
import * as XLSX from 'xlsx';
import { apiClient } from '../../data/api/client';
import {
  downloadProductsTemplate,
  exportProductsToExcel,
  exportPartiesToExcel,
  exportInvoicesToExcel,
  exportExpensesToExcel,
} from '../utils/excelExport';

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

export const ExcelPage: React.FC = () => {
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
        alert('الملف فارغ أو لا يحتوي على صفوف بيانات صالحة.');
        setIsReading(false);
        return;
      }

      // إرسال البيانات للمعاينة والتحقق في الـ Backend
      setIsPreviewing(true);
      const res = await apiClient.post('/import/products/preview', { rows: jsonRows });
      setPreviewResult(res.data.data);
    } catch (err: any) {
      console.error('Error parsing excel file:', err);
      alert('حدث خطأ أثناء قراءة الملف. يرجى التأكد من أن الملف بصيغة Excel (.xlsx, .xls) أو CSV صالحة.');
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

    if (!window.confirm(confirmMsg)) return;

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
      alert(err.response?.data?.message || 'حدث خطأ أثناء حفظ البيانات في الخادم.');
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
      alert('فشل تصدير البيانات. يرجى التأكد من اتصال الخادم.');
    } finally {
      setExportLoading(null);
    }
  };

  return (
    <div className="space-y-8" dir="rtl">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">مركز استيراد وتصدير Excel</h2>
        <p className="text-sm text-slate-500">
          استيراد قائمة المنتجات مع المعاينة الفورية الذكية وتصدير كافة سجلات النظام بضغطة زر
        </p>
      </div>

      {/* Success Banner if committed */}
      {commitResult && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-emerald-900 text-base">تم الاستيراد بنجاح!</h3>
            <p className="text-sm text-emerald-700 mt-1">{commitResult.message}</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-xs bg-emerald-200 text-emerald-800 px-2.5 py-1 rounded-md font-bold">
                أصناف جديدة: {commitResult.created_count}
              </span>
              <span className="text-xs bg-amber-200 text-amber-800 px-2.5 py-1 rounded-md font-bold">
                أصناف محدثة: {commitResult.updated_count}
              </span>
              <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md font-bold">
                أصناف تم تخطيها: {commitResult.skipped_count}
              </span>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-xs font-bold bg-white text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            استيراد ملف آخر
          </button>
        </div>
      )}

      {/* Main Grid: Import vs Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left / Main Column: Import Products with Preview */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">استيراد الأصناف من ملف Excel</h3>
                  <p className="text-xs text-slate-500">رفع الأصناف، الأسعار، والرصيد الافتتاحي مع المعاينة قبل الحفظ</p>
                </div>
              </div>

              {/* Template Download Button */}
              <button
                onClick={downloadProductsTemplate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
              >
                <Download className="w-4 h-4 text-slate-500" />
                تحميل نموذج Excel جاهز
              </button>
            </div>

            {/* Drag & Drop Upload Zone */}
            {!previewResult && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-primary-500 rounded-xl p-8 text-center bg-slate-50/60 hover:bg-slate-50 transition-all cursor-pointer group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <FileSpreadsheet className="w-12 h-12 text-slate-400 group-hover:text-primary-600 mx-auto mb-3 transition-colors" />
                <h4 className="text-sm font-bold text-slate-800">
                  {isReading || isPreviewing ? 'جارٍ قراءة وفحص الملف...' : 'اضغط لاختيار ملف Excel أو اسحبه هنا'}
                </h4>
                <p className="text-xs text-slate-400 mt-1">يدعم ملفات .xlsx و .xls و .csv حتى 10,000 صنف</p>
              </div>
            )}

            {/* Preview Section */}
            {previewResult && (
              <div className="space-y-6">
                {/* Stats Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-6">
                    {file && (
                      <div>
                        <span className="text-xs text-slate-500 block">الملف الحالي</span>
                        <span className="text-sm font-bold text-slate-800 font-mono truncate max-w-[150px] block" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-slate-500 block">إجمالي الصفوف</span>
                      <span className="text-lg font-black text-slate-900">{previewResult.total_rows}</span>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div>
                      <span className="text-xs text-emerald-600 block font-medium">جاهز للاستيراد 🟢</span>
                      <span className="text-lg font-black text-emerald-700">{previewResult.valid_count}</span>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div>
                      <span className="text-xs text-amber-600 block font-medium">مكرر 🟡</span>
                      <span className="text-lg font-black text-amber-700">{previewResult.duplicate_count}</span>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <div>
                      <span className="text-xs text-rose-600 block font-medium">غير صالح 🔴</span>
                      <span className="text-lg font-black text-rose-700">{previewResult.invalid_count}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleReset}
                    className="text-xs text-slate-500 hover:text-slate-800 font-bold underline"
                  >
                    إلغاء واختيار ملف آخر
                  </button>
                </div>

                {/* Duplicate Action Config */}
                {previewResult.duplicate_count > 0 && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span>تحديد طريقة التعامل مع الأصناف المكررة ({previewResult.duplicate_count} صنف):</span>
                    </div>
                    <div className="flex items-center gap-6 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 font-medium">
                        <input
                          type="radio"
                          name="duplicateAction"
                          value="skip"
                          checked={duplicateAction === 'skip'}
                          onChange={() => setDuplicateAction('skip')}
                          className="text-primary-600 focus:ring-primary-500"
                        />
                        <span>تخطي الأصناف المكررة (إبقاء البيانات الحالية دون تعديل)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 font-medium">
                        <input
                          type="radio"
                          name="duplicateAction"
                          value="update"
                          checked={duplicateAction === 'update'}
                          onChange={() => setDuplicateAction('update')}
                          className="text-primary-600 focus:ring-primary-500"
                        />
                        <span>تحديث البيانات (تعديل الأسعار وإضافة الكمية للمخزون)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Preview Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold border-b border-slate-200">
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
                      <tbody className="divide-y divide-slate-100">
                        {previewResult.rows.map((row) => {
                          const isValid = row.status === 'VALID';
                          const isDup = row.status === 'DUPLICATE' || row.status === 'DUPLICATE_IN_FILE';
                          const isInvalid = row.status === 'INVALID';

                          return (
                            <tr
                              key={row.row_number}
                              className={
                                isInvalid
                                  ? 'bg-rose-50/60'
                                  : isDup
                                  ? 'bg-amber-50/40'
                                  : 'hover:bg-slate-50'
                              }
                            >
                              <td className="p-2.5 font-bold text-slate-500">{row.row_number}</td>
                              <td className="p-2.5 font-bold text-slate-900">
                                {row.data.name || <span className="text-rose-500">فارغ</span>}
                              </td>
                              <td className="p-2.5 text-slate-600">{row.data.category_name || '-'}</td>
                              <td className="p-2.5 font-mono text-slate-600">
                                {row.data.barcode || row.data.code || '-'}
                              </td>
                              <td className="p-2.5 font-bold text-slate-700">
                                {row.data.purchase_price !== null ? `${row.data.purchase_price} ج` : '-'}
                              </td>
                              <td className="p-2.5 font-bold text-emerald-700">
                                {row.data.sale_price !== null ? `${row.data.sale_price} ج` : '-'}
                              </td>
                              <td className="p-2.5 font-bold text-slate-900">
                                {row.data.quantity > 0 ? (
                                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                    {row.data.quantity} {row.data.unit}
                                  </span>
                                ) : (
                                  '0'
                                )}
                              </td>
                              <td className="p-2.5">
                                {isValid && (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px] font-bold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> سليم
                                  </span>
                                )}
                                {isDup && (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[11px] font-bold">
                                      <AlertTriangle className="w-3.5 h-3.5" /> صنف مكرر
                                    </span>
                                    <p className="text-[10px] text-amber-800">
                                      {row.duplicate_info?.reason || row.errors[0]}
                                    </p>
                                  </div>
                                )}
                                {isInvalid && (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[11px] font-bold">
                                      <XCircle className="w-3.5 h-3.5" /> خطأ
                                    </span>
                                    <p className="text-[10px] text-rose-700 font-medium">
                                      {row.errors.join(' | ')}
                                    </p>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Commit Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100"
                  >
                    إلغاء المعاينة
                  </button>

                  <button
                    onClick={handleCommit}
                    disabled={isCommitting || (previewResult.valid_count === 0 && (previewResult.duplicate_count === 0 || duplicateAction === 'skip'))}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-black shadow-sm transition-colors"
                  >
                    {isCommitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        جارٍ حفظ البيانات وتوثيق المخزون...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        تأكيد واعتماد الاستيراد في النظام
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Info & Constitution Rules Card */}
          <div className="p-4 bg-slate-100/80 rounded-xl border border-slate-200 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1">
              <strong className="text-slate-800 block">ضمان سلامة المخزون والدقة المحاسبية:</strong>
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
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">تصدير سجلات النظام</h3>
                <p className="text-xs text-slate-500">تنزيل شيتات Excel فورية لكافة العمليات</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => handleExport('products')}
                disabled={exportLoading !== null}
                className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary-600" />
                  تصدير الأصناف والمخزون الحالي
                </span>
                {exportLoading === 'products' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <Download className="w-4 h-4 text-slate-400" />
                )}
              </button>

              <button
                onClick={() => handleExport('customers')}
                disabled={exportLoading !== null}
                className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  تصدير قائمة وأرصدة العملاء
                </span>
                {exportLoading === 'customers' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <Download className="w-4 h-4 text-slate-400" />
                )}
              </button>

              <button
                onClick={() => handleExport('suppliers')}
                disabled={exportLoading !== null}
                className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  تصدير قائمة وأرصدة الموردين
                </span>
                {exportLoading === 'suppliers' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <Download className="w-4 h-4 text-slate-400" />
                )}
              </button>

              <button
                onClick={() => handleExport('sales')}
                disabled={exportLoading !== null}
                className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  تصدير فواتير المبيعات
                </span>
                {exportLoading === 'sales' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <Download className="w-4 h-4 text-slate-400" />
                )}
              </button>

              <button
                onClick={() => handleExport('purchases')}
                disabled={exportLoading !== null}
                className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-600" />
                  تصدير فواتير المشتريات
                </span>
                {exportLoading === 'purchases' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <Download className="w-4 h-4 text-slate-400" />
                )}
              </button>

              <button
                onClick={() => handleExport('expenses')}
                disabled={exportLoading !== null}
                className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-rose-600" />
                  تصدير سجل المصروفات
                </span>
                {exportLoading === 'expenses' ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <Download className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
