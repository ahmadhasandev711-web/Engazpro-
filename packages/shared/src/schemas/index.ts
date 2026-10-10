import { z } from 'zod';
import { InvoiceType, PaymentMethod, PartyType, BranchType, BarcodeLabelSize } from '../enums';

// Auth Schemas
export const LoginSchema = z.object({
  phone: z.string().min(8, 'رقم الهاتف يجب أن يكون 8 أرقام على الأقل'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

export const RegisterSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  phone: z.string().min(8, 'رقم الهاتف غير صالح'),
  password: z.string().min(6, 'كلمة المرور لا تقل عن 6 خانات'),
  email: z.string().email('البريد الإلكتروني غير صالح').optional().nullable(),
});

// Category Schema
export const CategorySchema = z.object({
  name: z.string().min(1, 'اسم التصنيف مطلوب'),
});

// Product Variant Schema
export const ProductVariantSchema = z.object({
  id: z.number().optional().nullable(),
  product_id: z.number().optional().nullable(),
  name: z.string().min(1, 'اسم المتغير مطلوب'),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  purchase_price: z.coerce.number().min(0).optional().nullable(),
  regular_price: z.coerce.number().min(0).optional().nullable(),
  sale_price: z.coerce.number().min(0).optional().nullable(),
  quantity: z.coerce.number().min(0, 'الكمية لا يمكن أن تكون سالبة').default(0),
  min_quantity: z.coerce.number().min(0).optional().nullable(),
});

// Barcode Print Item & Request Schemas
export const BarcodePrintItemSchema = z.object({
  product_id: z.number().optional().nullable(),
  variant_id: z.number().optional().nullable(),
  product_name: z.string().min(1),
  variant_name: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  barcode: z.string().min(1, 'الباركود مطلوب للطباعة'),
  price: z.number().optional().nullable(),
  copies: z.coerce.number().int().min(1, 'عدد النسخ يجب أن يكون 1 على الأقل'),
});

export const BarcodePrintRequestSchema = z.object({
  label_size: z.nativeEnum(BarcodeLabelSize).default(BarcodeLabelSize.THERMAL_38_25),
  show_store_name: z.boolean().default(true),
  show_product_name: z.boolean().default(true),
  show_size_color: z.boolean().default(true),
  show_barcode_text: z.boolean().default(true),
  show_price: z.boolean().default(true),
  store_name: z.string().optional().nullable(),
  items: z.array(BarcodePrintItemSchema).min(1, 'يجب تحديد صنف واحد على الأقل للطباعة'),
});

// Product Schema
export const ProductSchema = z.object({
  name: z.string().min(1, 'اسم الصنف مطلوب'),
  type: z.enum(['STANDARD', 'VARIABLE', 'EXPIRY']).optional().nullable(),
  has_expiry: z.boolean().optional(),
  has_variants: z.boolean().optional(),
  code: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  category_id: z.number().optional().nullable(),
  unit: z.string().optional().nullable(),
  sub_unit: z.string().optional().nullable(),
  sub_unit_factor: z.coerce.number().min(0).optional().nullable(),
  sub_unit_price: z.coerce.number().min(0).optional().nullable(),
  purchase_price: z.coerce.number().min(0, 'سعر الشراء يجب أن يكون صفر أو أكثر'),
  regular_price: z.coerce.number().min(0).optional().nullable(),
  sale_price: z.coerce.number().min(0, 'سعر البيع يجب أن يكون صفر أو أكثر'),
  min_sale_price: z.coerce.number().min(0).optional().nullable(),
  quantity: z.coerce.number().min(0, 'الكمية لا يمكن أن تكون سالبة').default(0),
  min_quantity: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  variants: z.array(ProductVariantSchema).optional().nullable(),
  batches: z.array(z.any()).optional().nullable(),
});


// Party Schema (Customer / Supplier)
export const PartySchema = z.object({
  type: z.nativeEnum(PartyType, { errorMap: () => ({ message: 'نوع الطرف غير صحيح' }) }),
  name: z.string().min(1, 'الاسم مطلوب'),
  phone: z.string().optional().nullable(),
  phone2: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  initial_balance: z.coerce.number().default(0), // رصيد افتتاحي
});

// Invoice Item Schema
export const InvoiceItemSchema = z.object({
  product_id: z.number({ required_error: 'الصنف مطلوب' }),
  product_variant_id: z.number().optional().nullable(),
  product_batch_id: z.number().optional().nullable(),
  variant_name: z.string().optional().nullable(),
  batch_number: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  unit_name: z.string().optional().nullable(),
  is_sub_unit: z.boolean().optional().nullable(),
  quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unit_price: z.coerce.number().min(0, 'السعر لا يمكن أن يكون سالب'),
  notes: z.string().optional().nullable(),
});

// Invoice Schema
export const InvoiceSchema = z.object({
  type: z.nativeEnum(InvoiceType),
  party_id: z.number().optional().nullable(),
  courier_party_id: z.number().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'تاريخ غير صالح (YYYY-MM-DD)'),
  items: z.array(InvoiceItemSchema).min(1, 'يجب إضافة صنف واحد على الأقل'),
  discount: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  paid_amount: z.coerce.number().min(0).default(0),
  payment_method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  branch_id: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  parent_invoice_id: z.number().optional().nullable(),
}).refine(
  (data) => {
    // If payment is CREDIT or partial payment, party_id is required
    if (data.payment_method === PaymentMethod.CREDIT && !data.party_id) {
      return false;
    }
    return true;
  },
  {
    message: 'يجب اختيار العميل/المورد في حالة الدفع الآجل',
    path: ['party_id'],
  }
);

// Payment Schema (سند قبض / دفع)
export const PaymentSchema = z.object({
  party_id: z.number({ required_error: 'يجب تحديد الطرف (العميل أو المورد)' }),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  type: z.enum(['PAYMENT', 'RECEIPT']),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'تاريخ غير صالح (YYYY-MM-DD)'),
  invoice_id: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Expense Schema
export const ExpenseSchema = z.object({
  title: z.string().min(1, 'عنوان/جهة المصروف مطلوب'),
  category: z.string().optional().nullable(),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  payment_method: z.string().optional().default('CASH'),
  treasury_id: z.number().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'تاريخ غير صالح (YYYY-MM-DD)'),
  notes: z.string().optional().nullable(),
});

// Employee Schema (إضافة / تعديل موظف)
export const EmployeeSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  phone: z.string().min(8, 'رقم الهاتف يجب ألا يقل عن 8 أرقام'),
  password: z.string().min(6, 'كلمة المرور يجب ألا تقل عن 6 أحرف').optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'MANAGER', 'SUPERVISOR', 'MANDOB', 'CASHIER'], { errorMap: () => ({ message: 'الدور غير صالح' }) }),
  branch_id: z.number().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  email: z.string().email('بريد إلكتروني غير صالح').optional().nullable().or(z.literal('')),
});

// Branch Schema
export const BranchSchema = z.object({
  name: z.string().min(1, 'اسم الفرع أو المخزن مطلوب'),
  code: z.string().min(1, 'كود الفرع مطلوب'),
  type: z.nativeEnum(BranchType).default(BranchType.STORE),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  is_main: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

// Stock Transfer Item Schema
export const StockTransferItemSchema = z.object({
  product_id: z.number({ required_error: 'الصنف مطلوب' }),
  product_variant_id: z.number().optional().nullable(),
  quantity_sent: z.coerce.number().positive('الكمية المحولة يجب أن تكون أكبر من صفر'),
  unit_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// Stock Transfer Schema
export const StockTransferSchema = z.object({
  from_branch_id: z.number({ required_error: 'فرع المصدر مطلوب' }),
  to_branch_id: z.number({ required_error: 'فرع الوجهة مطلوب' }),
  items: z.array(StockTransferItemSchema).min(1, 'يجب إضافة صنف واحد على الأقل للتحويل'),
  notes: z.string().optional().nullable(),
}).refine(data => data.from_branch_id !== data.to_branch_id, {
  message: 'لا يمكن التحويل لنفس الفرع',
  path: ['to_branch_id'],
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ProductVariantInput = z.infer<typeof ProductVariantSchema>;
export type BarcodePrintItemInput = z.infer<typeof BarcodePrintItemSchema>;
export type BarcodePrintRequestInput = z.infer<typeof BarcodePrintRequestSchema>;
export type ProductInput = z.infer<typeof ProductSchema>;
export type PartyInput = z.infer<typeof PartySchema>;
export type InvoiceItemInput = z.infer<typeof InvoiceItemSchema>;
export type InvoiceInput = z.infer<typeof InvoiceSchema>;
export type PaymentInput = z.infer<typeof PaymentSchema>;
export type ExpenseInput = z.infer<typeof ExpenseSchema>;
export type EmployeeInput = z.infer<typeof EmployeeSchema>;
export type BranchInput = z.infer<typeof BranchSchema>;
export type StockTransferItemInput = z.infer<typeof StockTransferItemSchema>;
export type StockTransferInput = z.infer<typeof StockTransferSchema>;


