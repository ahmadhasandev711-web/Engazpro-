import * as XLSX from 'xlsx';

/**
 * تصدير مصفوفة كائنات إلى ملف Excel منسق باللغة العربية
 */
export const exportJsonToExcel = (
  data: Record<string, any>[],
  fileName: string,
  sheetName: string = 'البيانات'
) => {
  if (!data || data.length === 0) {
    alert('لا توجد بيانات للتصدير');
    return;
  }

  const ws = XLSX.utils.json_to_sheet(data);
  
  // ضبط اتجاه الورقة من اليمين لليسار (RTL)
  ws['!cols'] = Object.keys(data[0]).map(() => ({ wch: 18 }));
  (ws as any)['!views'] = [{ rightToLeft: true }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName}_${dateStr}.xlsx`);
};

/**
 * تصدير مصفوفة صفوف ثنائية الأبعاد (AoA) مثل القوالب
 */
export const exportAoAToExcel = (
  rows: any[][],
  fileName: string,
  sheetName: string = 'نموذج'
) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = (rows[0] || []).map(() => ({ wch: 20 }));
  (ws as any)['!views'] = [{ rightToLeft: true }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

/**
 * تصدير تقرير الأصناف والمخزون الحالي
 */
export const exportProductsToExcel = (products: any[]) => {
  const mapped = products.map((p, idx) => ({
    'م': idx + 1,
    'اسم الصنف': p.name,
    'التصنيف': p.category?.name || p.category_name || 'غير مصنف',
    'الكود': p.code || '',
    'الباركود': p.barcode || '',
    'الوحدة': p.unit || 'قطعة',
    'سعر الشراء': Number(p.purchase_price || 0),
    'سعر البيع': Number(p.sale_price || 0),
    'أقل سعر بيع': p.min_sale_price ? Number(p.min_sale_price) : '',
    'الرصيد الحالي': Number(p.quantity || 0),
    'حد الطلب': p.min_quantity ? Number(p.min_quantity) : '',
    'إجمالي قيمة المخزون (شراء)': Number(p.quantity || 0) * Number(p.purchase_price || 0),
    'ملاحظات': p.notes || '',
  }));

  exportJsonToExcel(mapped, 'تقرير_الأصناف_والمخزون', 'الأصناف');
};

/**
 * تصدير قائمة العملاء أو الموردين
 */
export const exportPartiesToExcel = (parties: any[], typeLabel: string = 'العملاء') => {
  const mapped = parties.map((party, idx) => ({
    'م': idx + 1,
    'الاسم': party.name,
    'رقم الهاتف': party.phone || '',
    'العنوان': party.address || '',
    'الرقم الضريبي': party.tax_number || '',
    'الرصيد الحالي': Number(party.balance || 0),
    'حد الائتمان': party.credit_limit ? Number(party.credit_limit) : '',
    'ملاحظات': party.notes || '',
  }));

  exportJsonToExcel(mapped, `قائمة_${typeLabel}`, typeLabel);
};

/**
 * تصدير سجل الفواتير (مبيعات / مشتريات / مرتجعات)
 */
export const exportInvoicesToExcel = (invoices: any[], title: string = 'سجل_الفواتير') => {
  const typeMap: Record<string, string> = {
    SALE: 'فاتورة مبيعات',
    PURCHASE: 'فاتورة مشتريات',
    SALE_RETURN: 'مرتجع مبيعات',
    PURCHASE_RETURN: 'مرتجع مشتريات',
  };

  const paymentMap: Record<string, string> = {
    CASH: 'نقدي (كاش)',
    CREDIT: 'آجل',
    TRANSFER: 'تحويل',
    CARD: 'بطاقة/فيزا',
    INSTAPAY: 'إنستاباي',
    VODAFONE_CASH: 'فودافون كاش',
    SPLIT: 'دفع مجزأ',
  };

  const mapped = invoices.map((inv, idx) => ({
    'م': idx + 1,
    'رقم الفاتورة': inv.invoice_number,
    'التاريخ': inv.date,
    'نوع الفاتورة': typeMap[inv.type] || inv.type,
    'الطرف (العميل/المورد)': inv.party?.name || 'نقدي',
    'طريقة الدفع': paymentMap[inv.payment_method] || inv.payment_method,
    'إجمالي الأصناف': Number(inv.subtotal || 0),
    'الخصم': Number(inv.discount_amount || 0),
    'الصافي المطلوب': Number(inv.net_total || 0),
    'المدفوع': Number(inv.paid_amount || 0),
    'المتبقي': Number(inv.remaining_amount || 0),
    'ملاحظات': inv.notes || '',
  }));

  exportJsonToExcel(mapped, title, 'الفواتير');
};

/**
 * تصدير سجل المصروفات
 */
export const exportExpensesToExcel = (expenses: any[]) => {
  const mapped = expenses.map((exp, idx) => ({
    'م': idx + 1,
    'التاريخ': exp.date,
    'بيان المصروف': exp.title,
    'التصنيف': exp.category || 'عام',
    'المبلغ': Number(exp.amount || 0),
    'ملاحظات': exp.notes || '',
  }));

  exportJsonToExcel(mapped, 'سجل_المصروفات', 'المصروفات');
};

/**
 * تصدير كشف حساب العميل / المورد
 */
export const exportLedgerToExcel = (statement: any, partyName: string) => {
  const entries = statement.entries || [];
  const mapped = entries.map((e: any, idx: number) => ({
    'م': idx + 1,
    'التاريخ': e.date,
    'البيان': e.description,
    'مدين (عليه)': Number(e.debit || 0),
    'دائن (له)': Number(e.credit || 0),
    'الرصيد التراكمي': Number(e.running_balance || 0),
  }));

  exportJsonToExcel(mapped, `كشف_حساب_${partyName}`, 'كشف الحساب');
};

/**
 * تصدير تقرير الحصيلة النقدية (Cash Flow)
 */
export const exportCashFlowToExcel = (cashFlowData: any, fromDate: string, toDate: string) => {
  const inflow = cashFlowData?.inflow || {};
  const outflow = cashFlowData?.outflow || {};

  const rows = [
    ['تقرير الحصيلة النقدية والمقبوضات', '', ''],
    [`الفترة من: ${fromDate}`, `إلى: ${toDate}`, ''],
    ['', '', ''],
    ['البند (الواردات النقدية)', 'المبلغ بالجنيه', ''],
    ['مبيعات كاش', Number(inflow.cash_sales || 0), ''],
    ['سندات قبض نقدية', Number(inflow.receipt_vouchers || 0), ''],
    ['مرتجعات مشتريات نقدية', Number(inflow.purchase_returns || 0), ''],
    ['إجمالي الواردات (المقبوضات)', Number(inflow.total || 0), ''],
    ['', '', ''],
    ['البند (المصروفات والمدفوعات)', 'المبلغ بالجنيه', ''],
    ['مشتريات كاش', Number(outflow.cash_purchases || 0), ''],
    ['سندات صرف نقدية', Number(outflow.payment_vouchers || 0), ''],
    ['مرتجعات مبيعات نقدية', Number(outflow.sale_returns || 0), ''],
    ['المصروفات النقدية', Number(outflow.expenses || 0), ''],
    ['إجمالي المدفوعات', Number(outflow.total || 0), ''],
    ['', '', ''],
    ['صافي الحصيلة النقدية (الخزينة المتبقية)', Number(cashFlowData?.net_cash_flow || 0), ''],
  ];

  exportAoAToExcel(rows, `تقرير_الحصيلة_النقدية_${fromDate}_${toDate}`, 'الحصيلة النقدية');
};

/**
 * تحميل نموذج استيراد الأصناف الجاهز
 */
export const downloadProductsTemplate = () => {
  const headers = [
    'اسم الصنف',
    'التصنيف',
    'الكود',
    'الباركود',
    'الوحدة',
    'سعر الشراء',
    'سعر البيع',
    'أقل سعر بيع',
    'الرصيد الافتتاحي',
    'حد الطلب',
    'ملاحظات',
  ];

  const sampleRows = [
    headers,
    ['بيبسي كانز 330مل', 'مشروبات غازية', 'BEV-001', '6221234567890', 'قطعة', 12.50, 15.00, 14.00, 50, 10, 'مشروبات باردة'],
    ['شيبسي عائلي جبنة', 'سناكس', 'SNK-002', '6229876543210', 'قطعة', 8.00, 10.00, 9.50, 100, 20, 'طازج'],
    ['مياه معدنية 600مل', 'مياه', 'WTR-003', '6221112223334', 'قطعة', 3.50, 5.00, 4.50, 200, 30, ''],
  ];

  exportAoAToExcel(sampleRows, 'نموذج_استيراد_الأصناف_POS_MANDOB', 'الأصناف');
};

/**
 * تصدير كشف شحنات وبوالص شركة الشحن إلى ملف Excel
 */
export const exportManifestToExcel = (shipments: any[], courierName: string) => {
  const mapped = shipments.map((s, idx) => ({
    'م': idx + 1,
    'رقم الطلب / الفاتورة': s.reference,
    'المصدر': s.source === 'WOOCOMMERCE' ? 'متجر ووكومرس' : 'فاتورة مباشرة (POS)',
    'تاريخ الشحن': s.shipped_at || s.created_at || '',
    'اسم العميل': s.customer_name,
    'هاتف العميل': s.customer_phone || '',
    'المدينة / العنوان': [s.city, s.customer_address].filter(Boolean).join(' - '),
    'رقم البوليصة': s.tracking_number || 'بدون بوليصة',
    'نوع التحصيل': s.is_paid_online ? 'مدفوع مسبقاً (أونلاين)' : 'دفع عند الاستلام (COD)',
    'المطلوب تحصيله (ج.م)': Number(s.cod_amount ?? (s.is_paid_online ? 0 : s.total)),
    'أجرة التوصيل (ج.م)': Number(s.shipping_cost || 0),
    'إجمالي الطلب (ج.م)': Number(s.total || 0),
    'حالة التوصيل': s.status_label || s.status,
    'حالة الدفع': s.payment_status_label || s.payment_status,
  }));

  exportJsonToExcel(mapped, `كشف_شحنات_${courierName.replace(/\s+/g, '_')}`, 'كشف_الشحنات');
};

/**
 * تصدير نموذج إدخال رصيد أول المدة
 * يدعم تعبئة مسبقة بالأصناف والمتغيرات الحالية أو نموذجاً توضيحياً
 */
export const downloadOpeningStockTemplate = (products?: any[]) => {
  const headers = [
    'الباركود أو الكود',
    'اسم الصنف',
    'المتغير (المقاس / اللون)',
    'كمية رصيد أول المدة',
    'سعر التكلفة للقطعة',
  ];

  const rows: any[][] = [headers];

  if (products && products.length > 0) {
    products.forEach((p) => {
      if ((p.has_variants || p.type === 'VARIABLE') && p.variants && p.variants.length > 0) {
        p.variants.forEach((v: any) => {
          rows.push([
            v.barcode || v.code || '',
            p.name,
            v.name || [v.size, v.color].filter(Boolean).join(' - ') || 'متغير',
            '',
            v.purchase_price ? Number(v.purchase_price) : '',
          ]);
        });
      } else {
        rows.push([
          p.barcode || p.code || '',
          p.name,
          '',
          '',
          p.purchase_price ? Number(p.purchase_price) : '',
        ]);
      }
    });
  } else {
    // صفوف توضيحية افتراضية
    rows.push(
      ['6221234567890', 'قميص كاجوال', 'مقاس L / أبيض', 50, 120.00],
      ['6221234567891', 'قميص كاجوال', 'مقاس XL / أبيض', 40, 120.00],
      ['6229876543210', 'ساعة يد كلاسيك', '', 25, 350.00]
    );
  }

  exportAoAToExcel(rows, 'نموذج_رصيد_أول_المدة', 'رصيد_أول_المدة');
};
