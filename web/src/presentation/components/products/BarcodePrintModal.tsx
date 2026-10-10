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
      alert('يرجى تحديد نسخة واحدة على الأقل للطباعة.');
      return;
    }
    window.print();
  };

  if (!isOpen || !product) return null;

  const currentConfig = LABEL_CONFIGS[labelSize];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
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
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-right">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                طباعة ملصقات الباركود للملابس والأحذية
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                الصنف: <span className="font-bold text-slate-800">{product.name}</span>
                {product.has_variants && ` • (${items.length} مقاس/لون)`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Left Settings / Right Preview */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Top (7 cols): Sizes and Copies selection */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Label Size Selector */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Settings2 className="w-4 h-4 text-indigo-600" />
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
                      className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                          : 'bg-white hover:bg-slate-100/70 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="font-bold text-xs">{cfg.name}</div>
                      <div
                        className={`text-[10px] mt-1 line-clamp-2 ${
                          isSelected ? 'text-indigo-100' : 'text-slate-400'
                        }`}
                      >
                        {cfg.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Customization Toggles */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h5 className="text-xs font-black text-slate-800">بيانات الملصق المطبوعة:</h5>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-700">اسم المتجر / الماركة</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={(e) => setShowProductName(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-700">اسم الصنف</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSizeColor}
                    onChange={(e) => setShowSizeColor(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-700">المقاس واللون</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showBarcodeText}
                    onChange={(e) => setShowBarcodeText(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-700">الرقم المقروء</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-700">سعر البيع</span>
                </label>
              </div>

              {showStoreName && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="اسم المتجر / المحل المطبوع أعلى الاستيكر..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right font-medium"
                  />
                </div>
              )}
            </div>

            {/* 3. Items & Copies Table */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Layers className="w-4 h-4 text-slate-600" />
                  <span className="font-black text-slate-800">تحديد عدد النسخ لكل مقاس:</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSetAllCopies(1)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold transition-colors"
                  >
                    1 لكل مقاس
                  </button>
                  <button
                    type="button"
                    onClick={handleSetCopiesToStock}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold transition-colors"
                    title="ضبط النسخ مساوية لكمية المخزون الحالي"
                  >
                    حسب المخزون
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllCopies(0)}
                    className="px-2 py-1 text-slate-400 hover:text-rose-600 font-bold"
                  >
                    تصفير
                  </button>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 z-10 border-b border-slate-100">
                    <tr>
                      <th className="py-2 px-3">المقاس / المتغير</th>
                      <th className="py-2 px-2">الباركود</th>
                      <th className="py-2 px-2">السعر</th>
                      <th className="py-2 px-2">المتاح</th>
                      <th className="py-2 px-3 text-center">النسخ المطلوبة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.key} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-bold text-slate-800">
                          {item.variant_name || item.name}
                        </td>
                        <td className="py-2 px-2 font-mono text-[11px] text-slate-500">
                          {item.barcode}
                        </td>
                        <td className="py-2 px-2 font-bold text-emerald-700 font-mono">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="py-2 px-2 text-slate-500 font-mono">
                          {item.stock}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateCopies(item.key, item.copies - 1)}
                              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={item.copies}
                              onChange={(e) =>
                                handleUpdateCopies(item.key, parseInt(e.target.value) || 0)
                              }
                              className="w-14 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg py-1 focus:bg-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateCopies(item.key, item.copies + 1)}
                              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right (5 cols): Live Visual Preview */}
          <div className="lg:col-span-5 bg-slate-100/70 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span>معاينة الملصق المباشرة (Live Preview)</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 font-bold">
                  {currentConfig.widthMm} × {currentConfig.heightMm} مم
                </span>
              </div>

              {/* Visual Card Preview */}
              {expandedPrintLabels.length > 0 ? (
                <div className="flex justify-center p-4 bg-slate-200/60 rounded-2xl border border-dashed border-slate-300">
                  {(() => {
                    const sample = expandedPrintLabels[0];
                    const svgData = renderBarcodeSvg(sample.barcode, {
                      barHeight: labelSize === BarcodeLabelSize.THERMAL_38_25 ? 35 : 45,
                      includeText: showBarcodeText,
                      fontSize: 10,
                    });

                    return (
                      <div
                        className="bg-white rounded-lg shadow-md p-2.5 flex flex-col justify-between items-center text-center text-slate-900 border border-slate-300 select-none transition-all"
                        style={{
                          width: `${currentConfig.widthMm * 5.2}px`,
                          minHeight: `${currentConfig.heightMm * 5.2}px`,
                        }}
                      >
                        {/* Store / Brand */}
                        {showStoreName && storeName && (
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 truncate w-full border-b border-slate-100 pb-0.5 mb-1">
                            {storeName}
                          </div>
                        )}

                        {/* Product Name */}
                        {showProductName && (
                          <div className="text-[11px] font-extrabold leading-tight line-clamp-1 w-full text-slate-950">
                            {sample.name}
                          </div>
                        )}

                        {/* Size & Color Badge */}
                        {showSizeColor && (sample.size || sample.color) && (
                          <div className="inline-flex items-center gap-1 my-0.5 text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300">
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
                          <div className="text-xs font-black text-slate-950 font-mono mt-0.5 border-t border-slate-100 pt-0.5 w-full">
                            {formatCurrency(sample.price)}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs font-bold">
                  لم تقم بتحديد أي نسخ للطباعة.
                </div>
              )}

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                ملاحظة: الباركود يُطبع كـ Vector SVG فائق الدقة بدون تشويش أو بهتان ليضمن قراءة 100% فورية بجميع أجهزة الماسح الضوئي والليزر.
              </p>
            </div>

            {/* Total Summary Badge */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">إجمالي الملصقات للطباعة:</span>
              <span className="font-black text-sm text-indigo-700 font-mono">
                {totalLabels} استيكر
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors"
          >
            إلغاء
          </button>

          <button
            type="button"
            disabled={totalLabels === 0}
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الملصقات الآن ({totalLabels})</span>
          </button>
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
