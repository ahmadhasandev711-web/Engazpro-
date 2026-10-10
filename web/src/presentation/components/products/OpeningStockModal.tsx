import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Boxes,
  Search,
  Building2,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Layers,
  Save,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { apiClient } from '../../../data/api/client';
import { Product } from '@pos-mandob/shared';
import { downloadOpeningStockTemplate } from '../../utils/excelExport';

interface OpeningStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  products: Product[];
}

interface StockEntryItem {
  key: string;
  productId: number;
  productVariantId: number | null;
  productName: string;
  variantName?: string;
  barcode?: string;
  unit: string;
  currentStock: number;
  quantity: number | '';
  costPrice: number | '';
  isVariant: boolean;
}

export const OpeningStockModal: React.FC<OpeningStockModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  products,
}) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [showZeroOnly, setShowZeroOnly] = useState(false);
  const [stockInputs, setStockInputs] = useState<Record<string, { quantity: number | ''; costPrice: number | '' }>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [excelSuccessNote, setExcelSuccessNote] = useState<string | null>(null);

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return (res.data?.data?.data || res.data?.data || res.data || []) as any[];
    },
    enabled: isOpen,
  });

  // Default to main branch when loaded
  useEffect(() => {
    if (isOpen && branches.length > 0 && selectedBranchId === '') {
      const main = branches.find((b: any) => b.is_main) || branches[0];
      if (main) {
        setSelectedBranchId(main.id);
      }
    }
  }, [isOpen, branches, selectedBranchId]);

  // Reset states when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setErrorMessage(null);
      setExcelSuccessNote(null);
      setStockInputs({});
    }
  }, [isOpen]);

  // Build flattened / hierarchical display items
  const flattenedList = useMemo(() => {
    const list: StockEntryItem[] = [];

    products.forEach((p) => {
      const isVariable = Boolean(p.has_variants || p.type === 'VARIABLE');
      const variants = p.variants || [];

      if (isVariable && variants.length > 0) {
        variants.forEach((v: any) => {
          const key = `${p.id}_${v.id}`;
          list.push({
            key,
            productId: p.id,
            productVariantId: v.id,
            productName: p.name,
            variantName: v.name || [v.size, v.color].filter(Boolean).join(' - ') || `متغير #${v.id}`,
            barcode: v.barcode || v.code || p.barcode || '',
            unit: p.unit || 'قطعة',
            currentStock: Number(v.quantity ?? 0),
            quantity: stockInputs[key]?.quantity ?? '',
            costPrice: stockInputs[key]?.costPrice ?? (v.purchase_price ? Number(v.purchase_price) : ''),
            isVariant: true,
          });
        });
      } else {
        const key = `${p.id}_base`;
        list.push({
          key,
          productId: p.id,
          productVariantId: null,
          productName: p.name,
          barcode: p.barcode || p.code || '',
          unit: p.unit || 'قطعة',
          currentStock: Number(p.quantity ?? 0),
          quantity: stockInputs[key]?.quantity ?? '',
          costPrice: stockInputs[key]?.costPrice ?? (p.purchase_price ? Number(p.purchase_price) : ''),
          isVariant: false,
        });
      }
    });

    return list;
  }, [products, stockInputs]);

  // Filter items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flattenedList.filter((item) => {
      if (showZeroOnly && item.currentStock > 0) {
        return false;
      }
      if (!q) return true;

      const matchName = item.productName.toLowerCase().includes(q);
      const matchVar = item.variantName?.toLowerCase().includes(q);
      const matchBar = item.barcode?.toLowerCase().includes(q);
      return matchName || matchVar || matchBar;
    });
  }, [flattenedList, search, showZeroOnly]);

  const handleInputChange = (key: string, field: 'quantity' | 'costPrice', val: string) => {
    const numericVal = val === '' ? '' : Math.max(0, Number(val));
    setStockInputs((prev) => ({
      ...prev,
      [key]: {
        quantity: field === 'quantity' ? numericVal : (prev[key]?.quantity ?? ''),
        costPrice: field === 'costPrice' ? numericVal : (prev[key]?.costPrice ?? ''),
      },
    }));
  };

  // Excel Upload Parser
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        alert('ملف Excel لا يحتوي على صفوف بيانات.');
        return;
      }

      let matchedCount = 0;
      const updatedInputs = { ...stockInputs };

      rawRows.forEach((row) => {
        // Read columns flexibly
        const barcodeOrCode = String(
          row['الباركود أو الكود'] ||
          row['الباركود'] ||
          row['الكود'] ||
          row['باركود'] ||
          row['كود'] ||
          row['barcode'] ||
          row['Barcode'] ||
          row['code'] ||
          ''
        ).trim();

        const rawQty = row['كمية رصيد أول المدة'] || row['الكمية'] || row['كمية'] || row['quantity'] || row['Quantity'];
        const rawCost = row['سعر التكلفة للقطعة'] || row['سعر الشراء'] || row['التكلفة'] || row['cost_price'] || row['purchase_price'];

        const qtyNum = parseFloat(rawQty);
        const costNum = parseFloat(rawCost);

        if (!barcodeOrCode || isNaN(qtyNum) || qtyNum <= 0) {
          return;
        }

        // Find matching item in flattened list
        const match = flattenedList.find(
          (item) => item.barcode && item.barcode.trim().toLowerCase() === barcodeOrCode.toLowerCase()
        );

        if (match) {
          updatedInputs[match.key] = {
            quantity: qtyNum,
            costPrice: !isNaN(costNum) && costNum >= 0 ? costNum : (updatedInputs[match.key]?.costPrice ?? ''),
          };
          matchedCount++;
        }
      });

      setStockInputs(updatedInputs);
      setExcelSuccessNote(`تمت قراءة ملف Excel ومطابقة أرصدة ${matchedCount} صنف بنجاح! راجع الكميات ثم اضغط حفظ.`);
      setErrorMessage(null);
    } catch (err) {
      console.error('Failed to parse excel:', err);
      setErrorMessage('تعذر قراءة ملف Excel، يرجى التأكد من اختيار ملف سليم بصيغة xlsx.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Mutation to save opening balance
  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedBranchId) {
        throw new Error('يرجى اختيار الفرع المراد إدخال الرصيد فيه.');
      }

      // Collect entered items with quantity > 0
      const itemsPayload: {
        product_id: number;
        product_variant_id: number | null;
        quantity: number;
        cost_price?: number;
      }[] = [];

      Object.entries(stockInputs).forEach(([key, val]) => {
        const qty = Number(val.quantity);
        if (qty > 0) {
          const [pIdStr, vIdStr] = key.split('_');
          const productId = parseInt(pIdStr, 10);
          const variantId = vIdStr === 'base' ? null : parseInt(vIdStr, 10);

          itemsPayload.push({
            product_id: productId,
            product_variant_id: variantId,
            quantity: qty,
            cost_price: val.costPrice !== '' ? Number(val.costPrice) : undefined,
          });
        }
      });

      if (itemsPayload.length === 0) {
        throw new Error('يرجى إدخال كمية رصيد أول مدة أكبر من صفر لصنف واحد على الأقل.');
      }

      const res = await apiClient.post('/products/opening-balance', {
        branch_id: selectedBranchId,
        items: itemsPayload,
      });

      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      onSuccess(data?.message || 'تم تسجيل رصيد أول المدة وتحديث المخزون بنجاح 🟢');
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.message || err.message || 'حدث خطأ أثناء حفظ رصيد أول المدة');
    },
  });

  const filledCount = Object.values(stockInputs).filter((v) => Number(v.quantity) > 0).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">إدخال رصيد أول المدة</h2>
              <p className="text-xs text-slate-500 font-medium">
                تسجيل حركة مخزنية رسمية (INITIAL) للأصناف والمتغيرات بدون فواتير مشتريات أو مديونيات
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Bar (Branch, Search, Excel, Filters) */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            {/* Branch Selector */}
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-primary-600" />
                <span>الفرع / المخزن المستهدف:</span>
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(Number(e.target.value) || '')}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
              >
                {branches.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.is_main ? '(الرئيسي)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span>بحث سريع:</span>
              </label>
              <input
                type="text"
                placeholder="ابحث بالاسم أو الباركود أو المقاس..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-right"
              />
            </div>

            {/* Excel Actions */}
            <div className="sm:col-span-3 flex items-center gap-2 pt-4 sm:pt-0">
              <button
                type="button"
                onClick={() => downloadOpeningStockTemplate(products)}
                className="flex-1 inline-flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
                title="تحميل نموذج Excel معبأ بالأصناف والمتغيرات لتسهيل الإدخال"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>نموذج Excel</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 inline-flex items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
                title="رفع ملف Excel معبأ بالأرصدة"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                <span>رفع Excel</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleExcelUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
            </div>
          </div>

          {/* Quick Filter Pill */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => setShowZeroOnly(!showZeroOnly)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                showZeroOnly
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>عرض الأصناف بدون رصيد فقط (المستوردة بـ 0)</span>
            </button>

            <span className="text-slate-500 font-medium">
              تم تجهيز رصيد لـ <strong className="text-primary-600">{filledCount}</strong> صنف
            </span>
          </div>
        </div>

        {/* Notifications */}
        {excelSuccessNote && (
          <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{excelSuccessNote}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mx-4 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Table Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              لا توجد أصناف مطابقة للبحث أو الفلتر المحدد.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 sm:p-3 w-10 text-center">#</th>
                    <th className="p-2.5 sm:p-3">الصنف / المتغير</th>
                    <th className="p-2.5 sm:p-3 hidden sm:table-cell">الباركود / الكود</th>
                    <th className="p-2.5 sm:p-3 text-center">الرصيد الحالي</th>
                    <th className="p-2.5 sm:p-3 w-36 sm:w-44">كمية أول المدة</th>
                    <th className="p-2.5 sm:p-3 w-32 sm:w-36">سعر التكلفة (اختياري)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => {
                    const isFilled = Number(item.quantity) > 0;
                    return (
                      <tr
                        key={item.key}
                        className={`transition-colors ${
                          isFilled ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-2.5 sm:p-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="p-2.5 sm:p-3">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {item.isVariant ? (
                              <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[10px] font-black px-1.5 py-0.5 rounded-md">
                                <Layers className="w-3 h-3" />
                                {item.variantName}
                              </span>
                            ) : (
                              <span>{item.productName}</span>
                            )}
                          </div>
                          {item.isVariant && (
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                              تابع لصنف: {item.productName}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 sm:p-3 hidden sm:table-cell font-mono text-slate-500 text-[11px]">
                          {item.barcode || '—'}
                        </td>
                        <td className="p-2.5 sm:p-3 text-center font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] ${
                              item.currentStock > 0
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {item.currentStock} {item.unit}
                          </span>
                        </td>
                        <td className="p-2.5 sm:p-3">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={item.quantity}
                              onChange={(e) => handleInputChange(item.key, 'quantity', e.target.value)}
                              className={`w-full text-center font-black text-xs py-1.5 px-2 rounded-lg border transition-all ${
                                isFilled
                                  ? 'border-emerald-500 bg-white text-emerald-900 ring-2 ring-emerald-500/20'
                                  : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-primary-500'
                              }`}
                            />
                          </div>
                        </td>
                        <td className="p-2.5 sm:p-3">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="سعر التكلفة"
                              value={item.costPrice}
                              onChange={(e) => handleInputChange(item.key, 'costPrice', e.target.value)}
                              className="w-full text-center text-xs py-1.5 px-2 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-primary-500 font-bold text-slate-800"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            سيتم قيد حركة مخزنية بنوع <strong className="text-slate-800 font-black">INITIAL</strong> لكل صنف تم تحديد كميته.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || filledCount === 0}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{mutation.isPending ? 'جاري الاعتماد...' : `اعتماد رصيد أول المدة (${filledCount})`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
