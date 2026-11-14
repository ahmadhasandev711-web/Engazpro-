import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Printer,
  Barcode,
  Eye,
  Settings2,
  Layers,
} from 'lucide-react';
import {
  Product,
  BarcodeLabelSize,
  formatCurrency,
} from '@pos-mandob/shared';
import { useAuthStore } from '../../../data/store/useAuthStore';
import { renderBarcodeSvg } from '../../utils/barcodeSvgRenderer';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { DataTable } from '../ui/DataTable';
import { cn } from '../../utils/cn';

interface BarcodePrintModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

interface PrintableItem {
  key: string;
  name: string;
  variant_name?: string | null;
  size?: string | null;
  color?: string | null;
  barcode: string;
  price: number;
  stock: number;
  copies: number;
}

const LABEL_CONFIGS: Record<
  BarcodeLabelSize,
  {
    name: string;
    description: string;
    widthMm: number;
    heightMm: number;
    isSheet: boolean;
    columns?: number;
    rows?: number;
  }
> = {
  [BarcodeLabelSize.THERMAL_38_25]: {
    name: 'بكرة حرارية 38×25 مم',
    description: 'المقاس الأكثر شيوعاً لكروت الملابس والإكسسوارات',
    widthMm: 38,
    heightMm: 25,
    isSheet: false,
  },
  [BarcodeLabelSize.THERMAL_50_25]: {
    name: 'بكرة حرارية 50×25 مم',
    description: 'المقاس المعتمد لعلب وكراتين الأحذية',
    widthMm: 50,
    heightMm: 25,
    isSheet: false,
  },
  [BarcodeLabelSize.THERMAL_50_30]: {
    name: 'بكرة حرارية 50×30 مم',
    description: 'ملصق عريض يحتوي بيانات تفصيلية مريحة للقراءة',
    widthMm: 50,
    heightMm: 30,
    isSheet: false,
  },
  [BarcodeLabelSize.A4_SHEET_24]: {
    name: 'ورق A4 استيكر (24 ملصق)',
    description: '3 أعمدة × 8 صفوف للطابعات العادية (مقاس 70×37 مم)',
    widthMm: 70,
    heightMm: 37,
    isSheet: true,
    columns: 3,
    rows: 8,
  },
  [BarcodeLabelSize.A4_SHEET_30]: {
    name: 'ورق A4 استيكر (30 ملصق)',
    description: '3 أعمدة × 10 صفوف للطابعات العادية (مقاس 70×29.7 مم)',
    widthMm: 70,
    heightMm: 29.7,
    isSheet: true,
    columns: 3,
    rows: 10,
  },
};

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const toast = useToast();
  const { user } = useAuthStore();

  // Print Settings
  const [labelSize, setLabelSize] = useState<BarcodeLabelSize>(BarcodeLabelSize.THERMAL_38_25);
  const [showStoreName, setShowStoreName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showSizeColor, setShowSizeColor] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [storeName, setStoreName] = useState('');

  // Items with copies
  const [items, setItems] = useState<PrintableItem[]>([]);

  useEffect(() => {
    if (user?.name) {
      setStoreName(user.name);
    }
  }, [user]);

  // Initialize printable items whenever product changes or modal opens
  useEffect(() => {
    if (!product || !isOpen) {
      setItems([]);
      return;
    }

    if (product.has_variants && product.variants && product.variants.length > 0) {
      const variantItems: PrintableItem[] = product.variants.map((v) => ({
        key: `var_${v.id || v.barcode || v.name}`,
        name: product.name,
        variant_name: v.name,
        size: v.size || null,
        color: v.color || null,
        barcode: v.barcode || v.code || product.barcode || `PRD-${v.id || 1}`,
        price: Number(v.sale_price ?? product.sale_price ?? 0),
        stock: Math.max(0, Math.round(Number(v.quantity || 0))),
        copies: 1,
      }));
      setItems(variantItems);
    } else {
      // Standard product
      setItems([
        {
          key: `prod_${product.id}`,
          name: product.name,
          barcode: product.barcode || product.code || `PRD-${product.id}`,
          price: Number(product.sale_price || 0),
          stock: Math.max(0, Math.round(Number(product.quantity || 0))),
          copies: 1,
        },
      ]);
    }
  }, [product, isOpen]);

  // Update copies for a specific item
  const handleUpdateCopies = (key: string, copies: number) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, copies: Math.max(0, copies) } : item))
    );
  };

  // Quick preset buttons for copies
  const handleSetAllCopies = (copies: number) => {
    setItems((prev) => prev.map((item) => ({ ...item, copies })));
  };

  const handleSetCopiesToStock = () => {
    setItems((prev) => prev.map((item) => ({ ...item, copies: item.stock > 0 ? item.stock : 1 })));
  };

  // Total copies to print
  const totalLabels = useMemo(
    () => items.reduce((sum, item) => sum + (item.copies || 0), 0),
    [items]
  );

  // Flatten items into repeated list for printing
  const expandedPrintLabels = useMemo(() => {
    const list: PrintableItem[] = [];
    items.forEach((item) => {
      for (let i = 0; i < item.copies; i++) {
        list.push(item);
      }
    });
    return list;
  }, [items]);

  // Print action
  const handlePrint = () => {
    if (expandedPrintLabels.length === 0) {
      toast.error('يرجى تحديد نسخة واحدة على الأقل للطباعة.');
      return;
    }
    window.print();
  };

  if (!isOpen || !product) return null;

  const currentConfig = LABEL_CONFIGS[labelSize];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-canvas/80 backdrop-blur-sm animate-fadeIn">
      {/* Dynamic Print CSS injected into head during print */}
      <style>{`
        @media screen {
          #printable-barcode-labels {
            display: none !important;
          }
        }
        @media print {
          /* Hide EVERYTHING else */
          body * {
            visibility: hidden !important;
          }
          #printable-barcode-labels, #printable-barcode-labels * {
            visibility: visible !important;
          }
          #printable-barcode-labels {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          /* Thermal Page formatting */
          ${
            !currentConfig.isSheet
              ? `
            @page {
              size: ${currentConfig.widthMm}mm ${currentConfig.heightMm}mm;
              margin: 0mm;
            }
            .thermal-label-item {
              width: ${currentConfig.widthMm}mm !important;
              height: ${currentConfig.heightMm}mm !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              box-sizing: border-box !important;
              padding: 1.5mm !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              text-align: center !important;
              overflow: hidden !important;
            }
          `
              : `
            @page {
              size: A4 portrait;
              margin: 8mm 6mm;
            }
            .a4-sheet-container {
              display: grid !important;
              grid-template-columns: repeat(${currentConfig.columns}, ${currentConfig.widthMm}mm) !important;
              gap: 2mm !important;
              justify-content: center !important;
            }
            .a4-label-item {
              width: ${currentConfig.widthMm}mm !important;
              height: ${currentConfig.heightMm}mm !important;
              page-break-inside: avoid !important;
              box-sizing: border-box !important;
              padding: 2mm !important;
              border: 0.5px dashed #cccccc !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              text-align: center !important;
              overflow: hidden !important;
            }
          `
          }
        }
      `}</style>

      {/* Modal Dialog */}
      <div className="bg-panel rounded-3xl shadow-2xl border border-line w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-right">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-surface-2/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand text-on-brand flex items-center justify-center shadow-xs">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink leading-tight">
                طباعة ملصقات الباركود للملابس والأحذية
              </h3>
              <p className="text-xs text-muted mt-0.5">
                الصنف: <span className="font-bold text-ink">{product.name}</span>
                {product.has_variants && ` • (${items.length} مقاس/لون)`}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            className="min-w-[44px] px-0 text-muted hover:text-ink"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Modal Body: Left Settings / Right Preview */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Top (7 cols): Sizes and Copies selection */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Label Size Selector */}
            <div className="bg-surface-2 p-4 rounded-2xl border border-line space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-ink">
                <Settings2 className="w-4 h-4 text-brand" />
                <span>اختر مقاس ونوع الملصق:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(LABEL_CONFIGS).map(([key, cfg]) => {
                  const isSelected = labelSize === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setLabelSize(key as BarcodeLabelSize)}
                      className={cn(
                        'min-h-[44px] p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer',
                        isSelected
                          ? 'bg-brand text-on-brand border-brand shadow-xs ring-2 ring-brand/25'
                          : 'bg-panel hover:bg-surface-2 border-line text-ink'
                      )}
                    >
                      <div className="font-bold text-xs">{cfg.name}</div>
                      <div
                        className={cn(
                          'text-2xs mt-1 line-clamp-2',
                          isSelected ? 'text-on-brand/80' : 'text-muted'
                        )}
                      >
                        {cfg.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Customization Toggles */}
            <div className="bg-panel p-4 rounded-2xl border border-line shadow-xs space-y-3">
              <h5 className="text-xs font-black text-ink">بيانات الملصق المطبوعة:</h5>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand focus:ring-brand"
                  />
                  <span className="font-bold text-ink">اسم المتجر / الماركة</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={(e) => setShowProductName(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand focus:ring-brand"
                  />
                  <span className="font-bold text-ink">اسم الصنف</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={showSizeColor}
                    onChange={(e) => setShowSizeColor(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand focus:ring-brand"
                  />
                  <span className="font-bold text-ink">المقاس واللون</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={showBarcodeText}
                    onChange={(e) => setShowBarcodeText(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand focus:ring-brand"
                  />
                  <span className="font-bold text-ink">الرقم المقروء</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand focus:ring-brand"
                  />
                  <span className="font-bold text-ink">سعر البيع</span>
                </label>
              </div>

              {showStoreName && (
                <div className="pt-2">
                  <Input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="اسم المتجر / المحل المطبوع أعلى الاستيكر..."
                    className="bg-surface-2/50 focus:bg-panel text-xs font-medium"
                  />
                </div>
              )}
            </div>

            {/* 3. Items & Copies Table */}
            <div className="bg-panel p-4 rounded-2xl border border-line shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Layers className="w-4 h-4 text-muted" />
                  <span className="font-black text-ink">تحديد عدد النسخ لكل مقاس:</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => handleSetAllCopies(1)}
                    className="px-2.5 text-xs font-bold"
                  >
                    1 لكل مقاس
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleSetCopiesToStock}
                    className="px-2.5 bg-ok-soft hover:bg-ok-soft/80 text-ok border-ok/25 text-xs font-bold"
                    title="ضبط النسخ مساوية لكمية المخزون الحالي"
                  >
                    حسب المخزون
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => handleSetAllCopies(0)}
                    className="px-2 text-muted hover:text-bad font-bold text-xs"
                  >
                    تصفير
                  </Button>
                </div>
              </div>

              <DataTable className="max-h-56 overflow-y-auto">
                <thead className="bg-surface-2 text-muted font-bold sticky top-0 z-10 border-b border-line text-xs">
                  <tr>
                    <th className="py-2 px-3">المقاس / المتغير</th>
                    <th className="py-2 px-2">الباركود</th>
                    <th className="py-2 px-2">السعر</th>
                    <th className="py-2 px-2">المتاح</th>
                    <th className="py-2 px-3 text-center">النسخ المطلوبة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {items.map((item) => (
                    <tr key={item.key} className="hover:bg-surface-2/50">
                      <td className="py-2 px-3 font-bold text-ink">
                        {item.variant_name || item.name}
                      </td>
                      <td className="py-2 px-2 tabular-nums text-2xs text-muted">
                        {item.barcode}
                      </td>
                      <td className="py-2 px-2 font-bold text-ok tabular-nums">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="py-2 px-2 text-muted tabular-nums">
                        {item.stock}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => handleUpdateCopies(item.key, item.copies - 1)}
                            className="min-w-[44px] px-0 font-bold text-xs"
                          >
                            -
                          </Button>
                          <input
                            type="number"
                            min="0"
                            value={item.copies}
                            onChange={(e) =>
                              handleUpdateCopies(item.key, parseInt(e.target.value) || 0)
                            }
                            className="w-14 min-h-[44px] text-center tabular-nums font-bold text-xs bg-surface-2/50 text-ink border border-line rounded-lg py-1 focus:bg-panel focus:outline-none focus:border-brand"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => handleUpdateCopies(item.key, item.copies + 1)}
                            className="min-w-[44px] px-0 font-bold text-xs"
                          >
                            +
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </div>

          {/* Right (5 cols): Live Visual Preview */}
          <div className="lg:col-span-5 bg-surface-2 p-5 rounded-2xl border border-line flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-ink">
                  <Eye className="w-4 h-4 text-brand" />
                  <span>معاينة الملصق المباشرة (Live Preview)</span>
                </div>
                <Badge tone="neutral" className="text-2xs tabular-nums bg-panel">
                  {currentConfig.widthMm} × {currentConfig.heightMm} مم
                </Badge>
              </div>

              {/* Visual Card Preview */}
              {expandedPrintLabels.length > 0 ? (
                <div className="flex justify-center p-4 bg-panel/60 rounded-2xl border border-dashed border-line-2">
                  {(() => {
                    const sample = expandedPrintLabels[0];
                    const svgData = renderBarcodeSvg(sample.barcode, {
                      barHeight: labelSize === BarcodeLabelSize.THERMAL_38_25 ? 35 : 45,
                      includeText: showBarcodeText,
                      fontSize: 10,
                    });

                    return (
                      <div
                        className="bg-panel rounded-lg shadow-md p-2.5 flex flex-col justify-between items-center text-center text-ink border border-line-2 select-none transition-all"
                        style={{
                          width: `${currentConfig.widthMm * 5.2}px`,
                          minHeight: `${currentConfig.heightMm * 5.2}px`,
                        }}
                      >
                        {/* Store / Brand */}
                        {showStoreName && storeName && (
                          <div className="text-2xs font-black uppercase tracking-wider text-ink truncate w-full border-b border-line pb-0.5 mb-1">
                            {storeName}
                          </div>
                        )}

                        {/* Product Name */}
                        {showProductName && (
                          <div className="text-2xs font-extrabold leading-tight line-clamp-1 w-full text-ink">
                            {sample.name}
                          </div>
                        )}

                        {/* Size & Color Badge */}
                        {showSizeColor && (sample.size || sample.color) && (
                          <div className="inline-flex items-center gap-1 my-0.5 text-2xs font-black px-2 py-0.5 rounded-md bg-surface-2 border border-line-2 text-ink">
                            {sample.color && <span>{sample.color}</span>}
                            {sample.color && sample.size && <span>•</span>}
                            {sample.size && <span>مقاس: {sample.size}</span>}
                          </div>
                        )}

                        {/* Barcode Vector SVG */}
                        <div
                          className="w-full my-1 flex justify-center"
                          dangerouslySetInnerHTML={{ __html: svgData }}
                        />

                        {/* Price */}
                        {showPrice && (
                          <div className="text-xs font-black text-ink tabular-nums mt-0.5 border-t border-line pb-0 pt-0.5 w-full">
                            {formatCurrency(sample.price)}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-8 text-center bg-panel rounded-2xl border border-line text-muted text-xs font-bold">
                  لم تقم بتحديد أي نسخ للطباعة.
                </div>
              )}

              <p className="text-2xs text-muted text-center leading-relaxed">
                ملاحظة: الباركود يُطبع كـ Vector SVG فائق الدقة بدون تشويش أو بهتان ليضمن قراءة 100% فورية بجميع أجهزة الماسح الضوئي والليزر.
              </p>
            </div>

            {/* Total Summary Badge */}
            <div className="p-3 bg-panel rounded-xl border border-line flex items-center justify-between text-xs">
              <span className="font-bold text-muted">إجمالي الملصقات للطباعة:</span>
              <span className="font-black text-sm text-brand-ink tabular-nums">
                {totalLabels} استيكر
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-line bg-surface-2/60 flex items-center justify-between">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onClose}
            className="text-xs font-bold"
          >
            إلغاء
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={totalLabels === 0}
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
            className="text-xs font-bold"
          >
            طباعة الملصقات الآن ({totalLabels})
          </Button>
        </div>
      </div>

      {/* Hidden Printable Container for @media print */}
      <div id="printable-barcode-labels">
        {!currentConfig.isSheet ? (
          // Thermal Roll Container
          <div>
            {expandedPrintLabels.map((label, idx) => {
              const svgData = renderBarcodeSvg(label.barcode, {
                barHeight: labelSize === BarcodeLabelSize.THERMAL_38_25 ? 36 : 46,
                includeText: showBarcodeText,
                fontSize: 10,
              });

              return (
                <div key={idx} className="thermal-label-item">
                  {showStoreName && storeName && (
                    <div
                      style={{
                        fontSize: '8pt',
                        fontWeight: 'bold',
                        borderBottom: '0.5px solid #000',
                        paddingBottom: '1px',
                        marginBottom: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {storeName}
                    </div>
                  )}

                  {showProductName && (
                    <div
                      style={{
                        fontSize: '9pt',
                        fontWeight: 'bold',
                        lineHeight: 1.1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label.name}
                    </div>
                  )}

                  {showSizeColor && (label.size || label.color) && (
                    <div
                      style={{
                        fontSize: '8.5pt',
                        fontWeight: 'bold',
                        margin: '1px 0',
                      }}
                    >
                      {label.color && <span>{label.color} </span>}
                      {label.size && <span>[ {label.size} ]</span>}
                    </div>
                  )}

                  <div
                    style={{ margin: '1px 0', width: '100%' }}
                    dangerouslySetInnerHTML={{ __html: svgData }}
                  />

                  {showPrice && (
                    <div
                      style={{
                        fontSize: '9pt',
                        fontWeight: 'bold',
                        borderTop: '0.5px solid #000',
                        paddingTop: '1px',
                      }}
                    >
                      {formatCurrency(label.price)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // A4 Sticker Sheet Container
          <div className="a4-sheet-container">
            {expandedPrintLabels.map((label, idx) => {
              const svgData = renderBarcodeSvg(label.barcode, {
                barHeight: 40,
                includeText: showBarcodeText,
                fontSize: 10,
              });

              return (
                <div key={idx} className="a4-label-item">
                  {showStoreName && storeName && (
                    <div
                      style={{
                        fontSize: '8pt',
                        fontWeight: 'bold',
                        borderBottom: '0.5px solid #000',
                        paddingBottom: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {storeName}
                    </div>
                  )}

                  {showProductName && (
                    <div
                      style={{
                        fontSize: '9pt',
                        fontWeight: 'bold',
                        lineHeight: 1.1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label.name}
                    </div>
                  )}

                  {showSizeColor && (label.size || label.color) && (
                    <div
                      style={{
                        fontSize: '8.5pt',
                        fontWeight: 'bold',
                        margin: '1px 0',
                      }}
                    >
                      {label.color && <span>{label.color} </span>}
                      {label.size && <span>[ {label.size} ]</span>}
                    </div>
                  )}

                  <div
                    style={{ margin: '1px 0', width: '100%' }}
                    dangerouslySetInnerHTML={{ __html: svgData }}
                  />

                  {showPrice && (
                    <div
                      style={{
                        fontSize: '9pt',
                        fontWeight: 'bold',
                        borderTop: '0.5px solid #000',
                        paddingTop: '1px',
                      }}
                    >
                      {formatCurrency(label.price)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
