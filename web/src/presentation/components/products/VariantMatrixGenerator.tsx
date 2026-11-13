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
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';

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
  { name: 'أسود', swatch: 'var(--swatch-black)' },
  { name: 'أبيض', swatch: 'var(--swatch-white)', border: true },
  { name: 'كحلي', swatch: 'var(--swatch-navy)' },
  { name: 'رمادي', swatch: 'var(--swatch-gray)' },
  { name: 'أحمر', swatch: 'var(--swatch-red)' },
  { name: 'زيتي', swatch: 'var(--swatch-olive)' },
  { name: 'بيج', swatch: 'var(--swatch-beige)' },
  { name: 'أزرق', swatch: 'var(--swatch-blue)' },
  { name: 'بني', swatch: 'var(--swatch-brown)' },
  { name: 'وردي', swatch: 'var(--swatch-pink)' },
  { name: 'أخضر', swatch: 'var(--swatch-green)' },
  { name: 'أصفر', swatch: 'var(--swatch-yellow)' },
  { name: 'برتقالي', swatch: 'var(--swatch-orange)' },
  { name: 'سماوي', swatch: 'var(--swatch-cyan)' },
  { name: 'بنفسجي', swatch: 'var(--swatch-purple)' },
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
        <div className="p-3 bg-brand-soft border border-brand/25 text-brand-ink rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-brand flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 1. Quick Color Selector */}
      <div className="bg-panel p-3.5 rounded-2xl border border-line shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-brand" />
            <h5 className="text-xs font-black text-ink">1. اختيار الألوان</h5>
            {selectedColors.length > 0 && (
              <Badge tone="brand" className="text-2xs px-2 py-0.5 tabular-nums">
                {selectedColors.length} محدد
              </Badge>
            )}
          </div>
          {selectedColors.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setSelectedColors([])}
              className="text-2xs text-muted hover:text-bad font-bold px-2"
            >
              إلغاء التحديد
            </Button>
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
                className={cn(
                  'min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  isSelected
                    ? 'bg-brand text-on-brand shadow-xs scale-[1.02] ring-2 ring-brand/30'
                    : 'bg-surface-2/60 text-ink hover:bg-surface-2 border border-line'
                )}
              >
                <span
                  className={cn('w-3.5 h-3.5 rounded-full flex-shrink-0', c.border && 'border border-line-2')}
                  style={{ backgroundColor: c.swatch }}
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
            className="flex-1 min-h-[44px] px-3 py-1.5 bg-surface-2/50 text-ink border border-line rounded-xl text-xs focus:bg-panel focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleAddCustomColor}
            className="text-xs font-bold"
          >
            + إضافة
          </Button>
        </div>
      </div>

      {/* 2. Quick Size Selector */}
      <div className="bg-panel p-3.5 rounded-2xl border border-line shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-ok" />
            <h5 className="text-xs font-black text-ink">2. اختيار المقاسات</h5>
            {selectedSizes.length > 0 && (
              <Badge tone="ok" className="text-2xs px-2 py-0.5 tabular-nums">
                {selectedSizes.length} محدد
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleSelectAllCategorySizes}
              className="text-2xs text-ok hover:bg-ok-soft font-bold px-2"
            >
              تحديد الكل
            </Button>
            <span className="text-line-2">•</span>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleClearSizes}
              className="text-2xs text-muted hover:text-bad font-bold px-2"
            >
              إلغاء
            </Button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 pb-2 border-b border-line">
          {(['CLOTHING', 'SHOES', 'KIDS'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveSizeCategory(cat)}
              className={cn(
                'min-h-[44px] px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer',
                activeSizeCategory === cat
                  ? 'bg-ink text-panel'
                  : 'text-muted hover:bg-surface-2 hover:text-ink'
              )}
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
                className={cn(
                  'min-w-[44px] min-h-[44px] px-2.5 py-1.5 rounded-xl text-xs font-bold tabular-nums transition-all text-center cursor-pointer',
                  isSelected
                    ? 'bg-ok text-on-brand shadow-xs ring-2 ring-ok/30'
                    : 'bg-surface-2/60 text-ink hover:bg-surface-2 border border-line'
                )}
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
            className="flex-1 min-h-[44px] px-3 py-1.5 bg-surface-2/50 text-ink border border-line rounded-xl text-xs focus:bg-panel focus:outline-none focus:ring-2 focus:ring-ok placeholder:text-muted"
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleAddCustomSize}
            className="text-xs font-bold"
          >
            + إضافة
          </Button>
        </div>
      </div>

      {/* 3. Cross Product Trigger Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 bg-brand-soft/60 border border-brand/20 rounded-2xl">
        <div className="text-xs">
          <span className="font-bold text-ink">التوافيق الناتجة: </span>
          <span className="font-black text-brand-ink tabular-nums">
            {selectedColors.length || (selectedSizes.length ? 1 : 0)} ألوان ×{' '}
            {selectedSizes.length || (selectedColors.length ? 1 : 0)} مقاسات ={' '}
            {(selectedColors.length || 1) * (selectedSizes.length || 1)} مقاس/لون
          </span>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleGenerateMatrix}
          leftIcon={<Sparkles className="w-4 h-4" />}
          className="w-full sm:w-auto text-xs font-bold"
        >
          ⚡ توليد جميع المتغيرات بضغطة زر
        </Button>
      </div>

      {/* 4. Bulk Edit Bar */}
      {variants.length > 0 && (
        <div className="bg-surface-2 border border-line p-3 rounded-2xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
            <Sliders className="w-3.5 h-3.5 text-muted" />
            <span>شريط التعديل الجماعي (تطبيق موحد على الكل)</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
            <div>
              <label className="text-2xs text-muted block mb-0.5">سعر البيع</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={bulkSalePrice}
                onChange={(e) => setBulkSalePrice(e.target.value)}
                placeholder="250"
                className="w-full min-h-[40px] px-2.5 py-1.5 bg-panel border border-line rounded-xl text-xs tabular-nums text-ok font-bold outline-none focus:border-brand"
              />
            </div>

            {canViewPurchasePrice && (
              <div>
                <label className="text-2xs text-muted block mb-0.5">سعر التكلفة</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={bulkPurchasePrice}
                  onChange={(e) => setBulkPurchasePrice(e.target.value)}
                  placeholder="150"
                  className="w-full min-h-[40px] px-2.5 py-1.5 bg-panel border border-line rounded-xl text-xs tabular-nums text-ink outline-none focus:border-brand"
                />
              </div>
            )}

            {!isEditing && (
              <div>
                <label className="text-2xs text-muted block mb-0.5">الرصيد الافتتاحي</label>
                <input
                  type="number"
                  min="0"
                  value={bulkQuantity}
                  onChange={(e) => setBulkQuantity(e.target.value)}
                  placeholder="10"
                  className="w-full min-h-[40px] px-2.5 py-1.5 bg-panel border border-line rounded-xl text-xs tabular-nums text-ink outline-none focus:border-brand"
                />
              </div>
            )}

            <div>
              <label className="text-2xs text-muted block mb-0.5">الحد الأدنى</label>
              <input
                type="number"
                min="0"
                value={bulkMinQuantity}
                onChange={(e) => setBulkMinQuantity(e.target.value)}
                placeholder="2"
                className="w-full min-h-[40px] px-2.5 py-1.5 bg-panel border border-line rounded-xl text-xs tabular-nums text-ink outline-none focus:border-brand"
              />
            </div>

            <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex items-end">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleBulkApply}
                className="w-full text-xs font-bold"
              >
                تطبيق على الكل
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Matrix Table & Action Buttons */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted" />
            <h5 className="text-xs font-black text-ink">
              قائمة المتغيرات ({variants.length})
            </h5>
            <Badge tone="neutral" className="text-2xs px-2 py-0.5 tabular-nums">
              إجمالي المخزون: {totalQuantity} قطعة
            </Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {variants.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={isGeneratingBarcodes}
                onClick={handleAutoGenerateBarcodes}
                leftIcon={<Barcode className="w-3.5 h-3.5 text-ok" />}
                className="bg-ok-soft hover:bg-ok-soft/80 text-ok border-ok/25 text-xs font-bold"
                title="توليد باركود تلقائي فريد لكل المتغيرات التي ليس لها كود"
              >
                {isGeneratingBarcodes ? 'جاري التوليد...' : '⚡ توليد باركود تلقائي للفارغ'}
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleAddBlankRow}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="text-xs font-bold"
            >
              إضافة صف يدوي
            </Button>
          </div>
        </div>

        {/* Variants Rows Table */}
        {variants.length === 0 ? (
          <EmptyState
            className="py-8 border-2 border-dashed border-line"
            icon={<Tag className="w-6 h-6 text-muted" />}
            title="لا توجد مقاسات أو ألوان مضافة بعد."
            description='اختر الألوان والمقاسات من الأعلى واضغط على "⚡ توليد جميع المتغيرات" لإنشاء الشبكة بلحظة واحدة.'
          />
        ) : (
          <DataTable className="max-h-72 overflow-y-auto">
            <thead className="bg-surface-2 text-muted font-bold border-b border-line sticky top-0 z-10 text-xs">
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
            <tbody className="divide-y divide-line text-xs">
              {variants.map((v, idx) => (
                <tr key={idx} className="hover:bg-surface-2/50 transition-colors">
                  {/* Name */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => handleUpdateRow(idx, 'name', e.target.value)}
                      className="w-full min-h-[38px] font-bold text-ink bg-transparent border border-transparent hover:border-line focus:border-brand rounded-lg px-1.5 py-1 focus:bg-panel focus:outline-none"
                      placeholder="مثال: أسود / XL"
                    />
                  </td>

                  {/* Color */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={v.color || ''}
                      onChange={(e) => handleUpdateRow(idx, 'color', e.target.value)}
                      className="w-20 min-h-[38px] px-1.5 py-1 bg-surface-2/50 text-ink border border-line rounded-lg text-xs"
                      placeholder="اللون"
                    />
                  </td>

                  {/* Size */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={v.size || ''}
                      onChange={(e) => handleUpdateRow(idx, 'size', e.target.value)}
                      className="w-16 min-h-[38px] px-1.5 py-1 bg-surface-2/50 text-ink border border-line rounded-lg text-xs tabular-nums text-center"
                      placeholder="المقاس"
                    />
                  </td>

                  {/* Barcode */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={v.barcode || ''}
                      onChange={(e) => handleUpdateRow(idx, 'barcode', e.target.value)}
                      className="w-32 min-h-[38px] px-1.5 py-1 bg-surface-2/50 text-ink border border-line rounded-lg text-xs tabular-nums"
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
                      className="w-20 min-h-[38px] px-1.5 py-1 bg-panel border border-line rounded-lg text-xs tabular-nums font-bold text-ok"
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
                        className="w-20 min-h-[38px] px-1.5 py-1 bg-panel border border-line rounded-lg text-xs tabular-nums text-ink"
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
                        className="w-16 min-h-[38px] px-1.5 py-1 bg-surface-2/50 border border-line rounded-lg text-xs tabular-nums text-center font-bold text-ink"
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
                      className="w-14 min-h-[38px] px-1.5 py-1 bg-surface-2/50 text-ink border border-line rounded-lg text-xs tabular-nums text-center"
                      placeholder="2"
                    />
                  </td>

                  {/* Actions */}
                  <td className="py-2 px-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      onClick={() => handleRemoveRow(idx)}
                      className="min-w-[44px] px-0 text-muted hover:text-bad hover:bg-bad-soft"
                      title="حذف هذا المتغير"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </div>
  );
};
