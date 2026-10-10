import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Barcode,
  Trash2,
  Plus,
  Check,
  Sliders,
  Layers,
  Palette,
  Ruler,
  Tag,
} from 'lucide-react';
import { apiClient } from '../../../data/api/client';

export interface VariantRow {
  id?: number;
  name: string;
  color?: string | null;
  size?: string | null;
  barcode?: string | null;
  code?: string | null;
  sale_price?: number | null;
  purchase_price?: number | null;
  quantity?: number;
  min_quantity?: number | null;
}

interface VariantMatrixGeneratorProps {
  variants: VariantRow[];
  onChange: (variants: VariantRow[]) => void;
  baseSalePrice: number;
  basePurchasePrice?: number;
  productCode?: string;
  isEditing?: boolean;
  canViewPurchasePrice?: boolean;
}

const PRESET_COLORS = [
  { name: 'أسود', hex: '#18181b', text: '#ffffff' },
  { name: 'أبيض', hex: '#ffffff', text: '#09090b', border: true },
  { name: 'كحلي', hex: '#1e3a8a', text: '#ffffff' },
  { name: 'رمادي', hex: '#6b7280', text: '#ffffff' },
  { name: 'أحمر', hex: '#dc2626', text: '#ffffff' },
  { name: 'زيتي', hex: '#4d7c0f', text: '#ffffff' },
  { name: 'بيج', hex: '#d4b996', text: '#451a03' },
  { name: 'أزرق', hex: '#2563eb', text: '#ffffff' },
  { name: 'بني', hex: '#78350f', text: '#ffffff' },
  { name: 'وردي', hex: '#ec4899', text: '#ffffff' },
  { name: 'أخضر', hex: '#16a34a', text: '#ffffff' },
  { name: 'أصفر', hex: '#eab308', text: '#713f12' },
  { name: 'برتقالي', hex: '#ea580c', text: '#ffffff' },
  { name: 'سماوي', hex: '#06b6d4', text: '#ffffff' },
  { name: 'بنفسجي', hex: '#9333ea', text: '#ffffff' },
];

const PRESET_SIZE_CATEGORIES = {
  CLOTHING: {
    label: '👕 ملابس',
    sizes: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
  },
  SHOES: {
    label: '👟 أحذية',
    sizes: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'],
  },
  KIDS: {
    label: '🧒 أطفال',
    sizes: ['1Y', '2Y', '3Y', '4Y', '6Y', '8Y', '10Y', '12Y', '14Y', '16Y'],
  },
};

export const VariantMatrixGenerator: React.FC<VariantMatrixGeneratorProps> = ({
  variants,
  onChange,
  baseSalePrice,
  basePurchasePrice = 0,
  productCode = '',
  isEditing = false,
  canViewPurchasePrice = true,
}) => {
  // Selection states
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [activeSizeCategory, setActiveSizeCategory] = useState<'CLOTHING' | 'SHOES' | 'KIDS'>('CLOTHING');
  const [customColorInput, setCustomColorInput] = useState('');
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [isGeneratingBarcodes, setIsGeneratingBarcodes] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Bulk Edit Bar States
  const [bulkSalePrice, setBulkSalePrice] = useState<string>(baseSalePrice ? String(baseSalePrice) : '');
  const [bulkPurchasePrice, setBulkPurchasePrice] = useState<string>(basePurchasePrice ? String(basePurchasePrice) : '');
  const [bulkQuantity, setBulkQuantity] = useState<string>('');
  const [bulkMinQuantity, setBulkMinQuantity] = useState<string>('2');

  const flashMessage = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Toggle Color selection
  const handleToggleColor = (colorName: string) => {
    setSelectedColors((prev) =>
      prev.includes(colorName) ? prev.filter((c) => c !== colorName) : [...prev, colorName]
    );
  };

  // Add custom color
  const handleAddCustomColor = () => {
    const trimmed = customColorInput.trim();
    if (trimmed && !selectedColors.includes(trimmed)) {
      setSelectedColors((prev) => [...prev, trimmed]);
      setCustomColorInput('');
    }
  };

  // Toggle Size selection
  const handleToggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  // Add custom size
  const handleAddCustomSize = () => {
    const trimmed = customSizeInput.trim();
    if (trimmed && !selectedSizes.includes(trimmed)) {
      setSelectedSizes((prev) => [...prev, trimmed]);
      setCustomSizeInput('');
    }
  };

  // Select all sizes in current category
  const handleSelectAllCategorySizes = () => {
    const currentList = PRESET_SIZE_CATEGORIES[activeSizeCategory].sizes;
    setSelectedSizes((prev) => Array.from(new Set([...prev, ...currentList])));
  };

  // Deselect all sizes
  const handleClearSizes = () => {
    setSelectedSizes([]);
  };

  // Cross-Product Generation
  const handleGenerateMatrix = () => {
    if (selectedColors.length === 0 && selectedSizes.length === 0) {
      flashMessage('يرجى تحديد لون واحد أو مقاس واحد على الأقل للتوليد الآلي.');
      return;
    }

    const newVariants: VariantRow[] = [];
    const colors = selectedColors.length > 0 ? selectedColors : [''];
    const sizes = selectedSizes.length > 0 ? selectedSizes : [''];

    const salePrice = Number(bulkSalePrice) || baseSalePrice || 0;
    const purchasePrice = Number(bulkPurchasePrice) || basePurchasePrice || 0;
    const initialQty = Number(bulkQuantity) || 0;
    const minQty = Number(bulkMinQuantity) || 2;

    for (const color of colors) {
      for (const size of sizes) {
        let name = '';
        if (color && size) name = `${color} / ${size}`;
        else if (color) name = `لون ${color}`;
        else if (size) name = `مقاس ${size}`;
        else name = `متغير ${variants.length + newVariants.length + 1}`;

        // Generate SKU code snippet
        let codeSuffix = '';
        if (color && size) codeSuffix = `-${color.slice(0, 3)}-${size}`;
        else if (size) codeSuffix = `-${size}`;
        else if (color) codeSuffix = `-${color.slice(0, 3)}`;

        const code = productCode ? `${productCode}${codeSuffix}` : '';

        // Check if already exists in current list
        const alreadyExists = variants.some(
          (v) => (v.color || '') === color && (v.size || '') === size
        );

        if (!alreadyExists) {
          newVariants.push({
            name,
            color: color || null,
            size: size || null,
            code: code || null,
            barcode: '',
            sale_price: salePrice,
            purchase_price: purchasePrice,
            quantity: initialQty,
            min_quantity: minQty,
          });
        }
      }
    }

    if (newVariants.length === 0) {
      flashMessage('جميع التوافيق المحددة موجودة بالفعل في المصفوفة!');
      return;
    }

    onChange([...variants, ...newVariants]);
    flashMessage(`⚡ تم توليد ${newVariants.length} متغير جديد بنجاح!`);
  };

  // Bulk Apply Values to All Variants
  const handleBulkApply = () => {
    if (variants.length === 0) {
      flashMessage('لا توجد متغيرات لتطبيق القيم عليها.');
      return;
    }

    const updated = variants.map((v) => ({
      ...v,
      sale_price: bulkSalePrice !== '' ? Number(bulkSalePrice) : v.sale_price,
      purchase_price: bulkPurchasePrice !== '' ? Number(bulkPurchasePrice) : v.purchase_price,
      quantity: !isEditing && bulkQuantity !== '' ? Number(bulkQuantity) : v.quantity,
      min_quantity: bulkMinQuantity !== '' ? Number(bulkMinQuantity) : v.min_quantity,
    }));

    onChange(updated);
    flashMessage('✅ تم تطبيق القيم بنجاح على جميع المقاسات والألوان!');
  };

  // Auto Generate Barcodes for Empty Variants via API
  const handleAutoGenerateBarcodes = async () => {
    const emptyBarcodeCount = variants.filter((v) => !v.barcode || v.barcode.trim() === '').length;
    if (emptyBarcodeCount === 0) {
      flashMessage('جميع المتغيرات تمتلك باركود بالفعل!');
      return;
    }

    setIsGeneratingBarcodes(true);
    try {
      const res = await apiClient.get('/barcodes/generate', {
        params: { count: emptyBarcodeCount },
      });

      const barcodes: string[] = res.data?.data?.barcodes || [];
      let barcodeIdx = 0;

      const updated = variants.map((v) => {
        if (!v.barcode || v.barcode.trim() === '') {
          const assigned = barcodes[barcodeIdx] || '';
          barcodeIdx++;
          return { ...v, barcode: assigned };
        }
        return v;
      });

      onChange(updated);
      flashMessage(`⚡ تم توليد ${barcodes.length} باركود فريد وغير مكرر تلقائياً!`);
    } catch (err: any) {
      flashMessage(err.response?.data?.message || 'فشل توليد الباركود التلقائي');
    } finally {
      setIsGeneratingBarcodes(false);
    }
  };

  // Single Row Updates
  const handleUpdateRow = (index: number, field: keyof VariantRow, value: any) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  // Remove Single Row
  const handleRemoveRow = (index: number) => {
    onChange(variants.filter((_, i) => i !== index));
  };

  // Add Manual Blank Row
  const handleAddBlankRow = () => {
    const defaultPrice = Number(bulkSalePrice) || baseSalePrice || 0;
    const defaultCost = Number(bulkPurchasePrice) || basePurchasePrice || 0;
    onChange([
      ...variants,
      {
        name: `مقاس/لون ${variants.length + 1}`,
        color: '',
        size: '',
        barcode: '',
        code: '',
        sale_price: defaultPrice,
        purchase_price: defaultCost,
        quantity: 0,
        min_quantity: 2,
      },
    ]);
  };

  // Total Matrix Stock
  const totalQuantity = useMemo(
    () => variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0),
    [variants]
  );

  return (
    <div className="space-y-4">
      {/* Notifications banner */}
      {statusMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 1. Quick Color Selector */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-indigo-600" />
            <h5 className="text-xs font-black text-slate-800">1. اختيار الألوان</h5>
            {selectedColors.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                {selectedColors.length} محدد
              </span>
            )}
          </div>
          {selectedColors.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedColors([])}
              className="text-[11px] text-slate-400 hover:text-rose-600 font-bold"
            >
              إلغاء التحديد
            </button>
          )}
        </div>

        {/* Color Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESET_COLORS.map((c) => {
            const isSelected = selectedColors.includes(c.name);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => handleToggleColor(c.name)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs scale-102 ring-2 ring-indigo-300'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: c.hex,
                    border: c.border ? '1px solid #cbd5e1' : undefined,
                  }}
                />
                <span>{c.name}</span>
                {isSelected && <Check className="w-3 h-3" />}
              </button>
            );
          })}
        </div>

        {/* Custom Color Input */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={customColorInput}
            onChange={(e) => setCustomColorInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomColor();
              }
            }}
            placeholder="لون مخصص (مثلاً: تركواز، فستقي)..."
            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleAddCustomColor}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            + إضافة
          </button>
        </div>
      </div>

      {/* 2. Quick Size Selector */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-emerald-600" />
            <h5 className="text-xs font-black text-slate-800">2. اختيار المقاسات</h5>
            {selectedSizes.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {selectedSizes.length} محدد
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleSelectAllCategorySizes}
              className="text-[11px] text-emerald-700 hover:underline font-bold"
            >
              تحديد الكل
            </button>
            <span className="text-slate-200">•</span>
            <button
              type="button"
              onClick={handleClearSizes}
              className="text-[11px] text-slate-400 hover:text-rose-600 font-bold"
            >
              إلغاء
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100">
          {(['CLOTHING', 'SHOES', 'KIDS'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveSizeCategory(cat)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                activeSizeCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {PRESET_SIZE_CATEGORIES[cat].label}
            </button>
          ))}
        </div>

        {/* Size Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESET_SIZE_CATEGORIES[activeSizeCategory].sizes.map((s) => {
            const isSelected = selectedSizes.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleToggleSize(s)}
                className={`min-w-9 px-2.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-all text-center ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Custom Size Input */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={customSizeInput}
            onChange={(e) => setCustomSizeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomSize();
              }
            }}
            placeholder="مقاس حر مخصص (مثال: 48, One Size, 5XL)..."
            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={handleAddCustomSize}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            + إضافة
          </button>
        </div>
      </div>

      {/* 3. Cross Product Trigger Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-100/80 rounded-2xl">
        <div className="text-xs">
          <span className="font-bold text-slate-700">التوافيق الناتجة: </span>
          <span className="font-black text-indigo-700">
            {selectedColors.length || (selectedSizes.length ? 1 : 0)} ألوان ×{' '}
            {selectedSizes.length || (selectedColors.length ? 1 : 0)} مقاسات ={' '}
            {(selectedColors.length || 1) * (selectedSizes.length || 1)} مقاس/لون
          </span>
        </div>

        <button
          type="button"
          onClick={handleGenerateMatrix}
          className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>⚡ توليد جميع المتغيرات بضغطة زر</span>
        </button>
      </div>

      {/* 4. Bulk Edit Bar */}
      {variants.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>شريط التعديل الجماعي (تطبيق موحد على الكل)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">سعر البيع</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={bulkSalePrice}
                onChange={(e) => setBulkSalePrice(e.target.value)}
                placeholder="250"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-emerald-700 font-bold"
              />
            </div>

            {canViewPurchasePrice && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">سعر التكلفة</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={bulkPurchasePrice}
                  onChange={(e) => setBulkPurchasePrice(e.target.value)}
                  placeholder="150"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-700"
                />
              </div>
            )}

            {!isEditing && (
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">الرصيد الافتتاحي</label>
                <input
                  type="number"
                  min="0"
                  value={bulkQuantity}
                  onChange={(e) => setBulkQuantity(e.target.value)}
                  placeholder="10"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">الحد الأدنى</label>
              <input
                type="number"
                min="0"
                value={bulkMinQuantity}
                onChange={(e) => setBulkMinQuantity(e.target.value)}
                placeholder="2"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
              />
            </div>

            <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex items-end">
              <button
                type="button"
                onClick={handleBulkApply}
                className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                تطبيق على الكل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Matrix Table & Action Buttons */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-600" />
            <h5 className="text-xs font-black text-slate-800">
              قائمة المتغيرات ({variants.length})
            </h5>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold font-mono">
              إجمالي المخزون: {totalQuantity} قطعة
            </span>
          </div>

          <div className="flex items-center gap-2">
            {variants.length > 0 && (
              <button
                type="button"
                disabled={isGeneratingBarcodes}
                onClick={handleAutoGenerateBarcodes}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-xs"
                title="توليد باركود تلقائي فريد لكل المتغيرات التي ليس لها كود"
              >
                <Barcode className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isGeneratingBarcodes ? 'جاري التوليد...' : '⚡ توليد باركود تلقائي للفارغ'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAddBlankRow}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة صف يدوي</span>
            </button>
          </div>
        </div>

        {/* Variants Rows Table */}
        {variants.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white space-y-1.5">
            <Tag className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">لا توجد مقاسات أو ألوان مضافة بعد.</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              اختر الألوان والمقاسات من الأعلى واضغط على "⚡ توليد جميع المتغيرات" لإنشاء الشبكة بلحظة واحدة.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">اسم المتغير</th>
                    <th className="py-2.5 px-2">اللون</th>
                    <th className="py-2.5 px-2">المقاس</th>
                    <th className="py-2.5 px-2">الباركود</th>
                    <th className="py-2.5 px-2">سعر البيع</th>
                    {canViewPurchasePrice && <th className="py-2.5 px-2">التكلفة</th>}
                    {!isEditing && <th className="py-2.5 px-2">الرصيد</th>}
                    <th className="py-2.5 px-2">حد الطلب</th>
                    <th className="py-2.5 px-2 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {variants.map((v, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={v.name}
                          onChange={(e) => handleUpdateRow(idx, 'name', e.target.value)}
                          className="w-full font-bold text-slate-900 border border-transparent hover:border-slate-200 focus:border-indigo-400 rounded-lg px-1.5 py-1 focus:bg-white focus:outline-none"
                          placeholder="مثال: أسود / XL"
                        />
                      </td>

                      {/* Color */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={v.color || ''}
                          onChange={(e) => handleUpdateRow(idx, 'color', e.target.value)}
                          className="w-20 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          placeholder="اللون"
                        />
                      </td>

                      {/* Size */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={v.size || ''}
                          onChange={(e) => handleUpdateRow(idx, 'size', e.target.value)}
                          className="w-16 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-center"
                          placeholder="المقاس"
                        />
                      </td>

                      {/* Barcode */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={v.barcode || ''}
                          onChange={(e) => handleUpdateRow(idx, 'barcode', e.target.value)}
                          className="w-32 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                          placeholder="الباركود"
                        />
                      </td>

                      {/* Sale Price */}
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={v.sale_price ?? ''}
                          onChange={(e) => handleUpdateRow(idx, 'sale_price', Number(e.target.value))}
                          className="w-20 px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-emerald-700"
                        />
                      </td>

                      {/* Purchase Price */}
                      {canViewPurchasePrice && (
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={v.purchase_price ?? ''}
                            onChange={(e) => handleUpdateRow(idx, 'purchase_price', Number(e.target.value))}
                            className="w-20 px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700"
                          />
                        </td>
                      )}

                      {/* Initial Quantity (for new products) */}
                      {!isEditing && (
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            min="0"
                            value={v.quantity ?? 0}
                            onChange={(e) => handleUpdateRow(idx, 'quantity', Number(e.target.value))}
                            className="w-16 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-center font-bold text-slate-900"
                          />
                        </td>
                      )}

                      {/* Min Quantity */}
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          value={v.min_quantity ?? ''}
                          onChange={(e) => handleUpdateRow(idx, 'min_quantity', Number(e.target.value))}
                          className="w-14 px-1.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-center"
                          placeholder="2"
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="p-1 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="حذف هذا المتغير"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
