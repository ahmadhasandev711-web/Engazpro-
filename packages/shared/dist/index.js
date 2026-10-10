"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BarcodeFormat: () => BarcodeFormat,
  BarcodeLabelSize: () => BarcodeLabelSize,
  BarcodePrintItemSchema: () => BarcodePrintItemSchema,
  BarcodePrintRequestSchema: () => BarcodePrintRequestSchema,
  BranchSchema: () => BranchSchema,
  BranchType: () => BranchType,
  CategorySchema: () => CategorySchema,
  CommissionType: () => CommissionType,
  EmployeeAdjustmentType: () => EmployeeAdjustmentType,
  EmployeeSchema: () => EmployeeSchema,
  ExpenseSchema: () => ExpenseSchema,
  ExpiryStatus: () => ExpiryStatus,
  InvoiceItemSchema: () => InvoiceItemSchema,
  InvoiceSchema: () => InvoiceSchema,
  InvoiceType: () => InvoiceType,
  LedgerSource: () => LedgerSource,
  LoginSchema: () => LoginSchema,
  Money: () => Money,
  PartySchema: () => PartySchema,
  PartyType: () => PartyType,
  PaymentMethod: () => PaymentMethod,
  PaymentSchema: () => PaymentSchema,
  ProductSchema: () => ProductSchema,
  ProductType: () => ProductType,
  ProductVariantSchema: () => ProductVariantSchema,
  RegisterSchema: () => RegisterSchema,
  ShiftStatus: () => ShiftStatus,
  StockMovementSource: () => StockMovementSource,
  StockMovementType: () => StockMovementType,
  StockTransferItemSchema: () => StockTransferItemSchema,
  StockTransferSchema: () => StockTransferSchema,
  StockTransferStatus: () => StockTransferStatus,
  SubscriptionPlan: () => SubscriptionPlan,
  SubscriptionStatus: () => SubscriptionStatus,
  TreasuryTransactionSource: () => TreasuryTransactionSource,
  TreasuryTransactionType: () => TreasuryTransactionType,
  TreasuryType: () => TreasuryType,
  UserRole: () => UserRole,
  UserStatus: () => UserStatus,
  WcOrderStatus: () => WcOrderStatus,
  WcPaymentStatus: () => WcPaymentStatus,
  calculateInvoiceTotals: () => calculateInvoiceTotals,
  calculateNetProfit: () => calculateNetProfit,
  calculatePartyBalanceImpact: () => calculatePartyBalanceImpact,
  formatCurrency: () => formatCurrency,
  formatDate: () => formatDate,
  formatDateTime: () => formatDateTime,
  formatNumber: () => formatNumber
});
module.exports = __toCommonJS(index_exports);

// src/enums/barcode.ts
var BarcodeLabelSize = /* @__PURE__ */ ((BarcodeLabelSize2) => {
  BarcodeLabelSize2["THERMAL_38_25"] = "THERMAL_38_25";
  BarcodeLabelSize2["THERMAL_50_25"] = "THERMAL_50_25";
  BarcodeLabelSize2["THERMAL_50_30"] = "THERMAL_50_30";
  BarcodeLabelSize2["A4_SHEET_24"] = "A4_SHEET_24";
  BarcodeLabelSize2["A4_SHEET_30"] = "A4_SHEET_30";
  return BarcodeLabelSize2;
})(BarcodeLabelSize || {});
var BarcodeFormat = /* @__PURE__ */ ((BarcodeFormat2) => {
  BarcodeFormat2["CODE128"] = "CODE128";
  BarcodeFormat2["EAN13"] = "EAN13";
  return BarcodeFormat2;
})(BarcodeFormat || {});

// src/enums/index.ts
var InvoiceType = /* @__PURE__ */ ((InvoiceType2) => {
  InvoiceType2["SALE"] = "SALE";
  InvoiceType2["PURCHASE"] = "PURCHASE";
  InvoiceType2["SALE_RETURN"] = "SALE_RETURN";
  InvoiceType2["PURCHASE_RETURN"] = "PURCHASE_RETURN";
  return InvoiceType2;
})(InvoiceType || {});
var PaymentMethod = /* @__PURE__ */ ((PaymentMethod2) => {
  PaymentMethod2["CASH"] = "CASH";
  PaymentMethod2["CARD"] = "CARD";
  PaymentMethod2["INSTAPAY"] = "INSTAPAY";
  PaymentMethod2["VODAFONE_CASH"] = "VODAFONE_CASH";
  PaymentMethod2["TRANSFER"] = "TRANSFER";
  PaymentMethod2["CREDIT"] = "CREDIT";
  PaymentMethod2["SPLIT"] = "SPLIT";
  PaymentMethod2["COURIER_COD"] = "COURIER_COD";
  return PaymentMethod2;
})(PaymentMethod || {});
var PartyType = /* @__PURE__ */ ((PartyType2) => {
  PartyType2["CUSTOMER"] = "CUSTOMER";
  PartyType2["SUPPLIER"] = "SUPPLIER";
  PartyType2["COURIER"] = "COURIER";
  return PartyType2;
})(PartyType || {});
var StockMovementType = /* @__PURE__ */ ((StockMovementType2) => {
  StockMovementType2["IN"] = "IN";
  StockMovementType2["OUT"] = "OUT";
  return StockMovementType2;
})(StockMovementType || {});
var StockMovementSource = /* @__PURE__ */ ((StockMovementSource2) => {
  StockMovementSource2["PURCHASE"] = "PURCHASE";
  StockMovementSource2["SALE"] = "SALE";
  StockMovementSource2["PURCHASE_RETURN"] = "PURCHASE_RETURN";
  StockMovementSource2["SALE_RETURN"] = "SALE_RETURN";
  StockMovementSource2["ADJUSTMENT"] = "ADJUSTMENT";
  StockMovementSource2["INITIAL"] = "INITIAL";
  StockMovementSource2["TRANSFER_OUT"] = "TRANSFER_OUT";
  StockMovementSource2["TRANSFER_IN"] = "TRANSFER_IN";
  return StockMovementSource2;
})(StockMovementSource || {});
var LedgerSource = /* @__PURE__ */ ((LedgerSource2) => {
  LedgerSource2["INVOICE"] = "INVOICE";
  LedgerSource2["PAYMENT"] = "PAYMENT";
  LedgerSource2["ADJUSTMENT"] = "ADJUSTMENT";
  LedgerSource2["INITIAL"] = "INITIAL";
  return LedgerSource2;
})(LedgerSource || {});
var SubscriptionStatus = /* @__PURE__ */ ((SubscriptionStatus2) => {
  SubscriptionStatus2["ACTIVE"] = "ACTIVE";
  SubscriptionStatus2["EXPIRED"] = "EXPIRED";
  SubscriptionStatus2["CANCELLED"] = "CANCELLED";
  SubscriptionStatus2["SUSPENDED"] = "SUSPENDED";
  return SubscriptionStatus2;
})(SubscriptionStatus || {});
var SubscriptionPlan = /* @__PURE__ */ ((SubscriptionPlan2) => {
  SubscriptionPlan2["BASIC"] = "BASIC";
  return SubscriptionPlan2;
})(SubscriptionPlan || {});
var UserRole = /* @__PURE__ */ ((UserRole2) => {
  UserRole2["OWNER"] = "OWNER";
  UserRole2["ADMIN"] = "ADMIN";
  UserRole2["MANAGER"] = "MANAGER";
  UserRole2["SUPERVISOR"] = "SUPERVISOR";
  UserRole2["MANDOB"] = "MANDOB";
  UserRole2["CASHIER"] = "CASHIER";
  UserRole2["SALES"] = "SALES";
  return UserRole2;
})(UserRole || {});
var CommissionType = /* @__PURE__ */ ((CommissionType2) => {
  CommissionType2["NONE"] = "NONE";
  CommissionType2["PERCENTAGE_OF_SALES"] = "PERCENTAGE_OF_SALES";
  CommissionType2["FIXED_PER_INVOICE"] = "FIXED_PER_INVOICE";
  return CommissionType2;
})(CommissionType || {});
var EmployeeAdjustmentType = /* @__PURE__ */ ((EmployeeAdjustmentType2) => {
  EmployeeAdjustmentType2["BONUS"] = "BONUS";
  EmployeeAdjustmentType2["DEDUCTION"] = "DEDUCTION";
  EmployeeAdjustmentType2["ADVANCE"] = "ADVANCE";
  return EmployeeAdjustmentType2;
})(EmployeeAdjustmentType || {});
var UserStatus = /* @__PURE__ */ ((UserStatus2) => {
  UserStatus2["ACTIVE"] = "ACTIVE";
  UserStatus2["INACTIVE"] = "INACTIVE";
  return UserStatus2;
})(UserStatus || {});
var TreasuryType = /* @__PURE__ */ ((TreasuryType2) => {
  TreasuryType2["MAIN"] = "MAIN";
  TreasuryType2["BRANCH_SAFE"] = "BRANCH_SAFE";
  TreasuryType2["CASHIER_DRAWER"] = "CASHIER_DRAWER";
  TreasuryType2["MANDOB_CUSTODY"] = "MANDOB_CUSTODY";
  TreasuryType2["BANK"] = "BANK";
  TreasuryType2["WALLET"] = "WALLET";
  TreasuryType2["OWNER_DRAWINGS"] = "OWNER_DRAWINGS";
  return TreasuryType2;
})(TreasuryType || {});
var ShiftStatus = /* @__PURE__ */ ((ShiftStatus2) => {
  ShiftStatus2["OPEN"] = "OPEN";
  ShiftStatus2["CLOSED"] = "CLOSED";
  ShiftStatus2["SETTLED"] = "SETTLED";
  return ShiftStatus2;
})(ShiftStatus || {});
var TreasuryTransactionType = /* @__PURE__ */ ((TreasuryTransactionType2) => {
  TreasuryTransactionType2["DEPOSIT"] = "DEPOSIT";
  TreasuryTransactionType2["WITHDRAWAL"] = "WITHDRAWAL";
  TreasuryTransactionType2["TRANSFER"] = "TRANSFER";
  TreasuryTransactionType2["HANDOVER"] = "HANDOVER";
  return TreasuryTransactionType2;
})(TreasuryTransactionType || {});
var TreasuryTransactionSource = /* @__PURE__ */ ((TreasuryTransactionSource2) => {
  TreasuryTransactionSource2["INVOICE"] = "INVOICE";
  TreasuryTransactionSource2["PAYMENT"] = "PAYMENT";
  TreasuryTransactionSource2["EXPENSE"] = "EXPENSE";
  TreasuryTransactionSource2["SHIFT_HANDOVER"] = "SHIFT_HANDOVER";
  TreasuryTransactionSource2["MANUAL"] = "MANUAL";
  return TreasuryTransactionSource2;
})(TreasuryTransactionSource || {});
var ProductType = /* @__PURE__ */ ((ProductType2) => {
  ProductType2["STANDARD"] = "STANDARD";
  ProductType2["VARIABLE"] = "VARIABLE";
  ProductType2["EXPIRY"] = "EXPIRY";
  return ProductType2;
})(ProductType || {});
var ExpiryStatus = /* @__PURE__ */ ((ExpiryStatus2) => {
  ExpiryStatus2["VALID"] = "VALID";
  ExpiryStatus2["NEAR_EXPIRY"] = "NEAR_EXPIRY";
  ExpiryStatus2["EXPIRED"] = "EXPIRED";
  return ExpiryStatus2;
})(ExpiryStatus || {});
var BranchType = /* @__PURE__ */ ((BranchType2) => {
  BranchType2["STORE"] = "STORE";
  BranchType2["WAREHOUSE"] = "WAREHOUSE";
  BranchType2["VAN"] = "VAN";
  return BranchType2;
})(BranchType || {});
var StockTransferStatus = /* @__PURE__ */ ((StockTransferStatus2) => {
  StockTransferStatus2["PENDING"] = "PENDING";
  StockTransferStatus2["IN_TRANSIT"] = "IN_TRANSIT";
  StockTransferStatus2["RECEIVED"] = "RECEIVED";
  StockTransferStatus2["CANCELLED"] = "CANCELLED";
  return StockTransferStatus2;
})(StockTransferStatus || {});
var WcOrderStatus = /* @__PURE__ */ ((WcOrderStatus2) => {
  WcOrderStatus2["PENDING_CONFIRMATION"] = "PENDING_CONFIRMATION";
  WcOrderStatus2["CONFIRMED"] = "CONFIRMED";
  WcOrderStatus2["PREPARING"] = "PREPARING";
  WcOrderStatus2["DISPATCHED"] = "DISPATCHED";
  WcOrderStatus2["SHIPPED_VIA_COURIER"] = "SHIPPED_VIA_COURIER";
  WcOrderStatus2["DELIVERED"] = "DELIVERED";
  WcOrderStatus2["PARTIALLY_DELIVERED"] = "PARTIALLY_DELIVERED";
  WcOrderStatus2["RETURNED"] = "RETURNED";
  WcOrderStatus2["CANCELLED"] = "CANCELLED";
  return WcOrderStatus2;
})(WcOrderStatus || {});
var WcPaymentStatus = /* @__PURE__ */ ((WcPaymentStatus2) => {
  WcPaymentStatus2["PENDING_COD"] = "PENDING_COD";
  WcPaymentStatus2["PAID_ONLINE"] = "PAID_ONLINE";
  WcPaymentStatus2["COLLECTED"] = "COLLECTED";
  return WcPaymentStatus2;
})(WcPaymentStatus || {});

// src/schemas/index.ts
var import_zod = require("zod");
var LoginSchema = import_zod.z.object({
  phone: import_zod.z.string().min(8, "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 8 \u0623\u0631\u0642\u0627\u0645 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644"),
  password: import_zod.z.string().min(6, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 6 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644")
});
var RegisterSchema = import_zod.z.object({
  name: import_zod.z.string().min(2, "\u0627\u0644\u0627\u0633\u0645 \u0645\u0637\u0644\u0648\u0628"),
  phone: import_zod.z.string().min(8, "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D"),
  password: import_zod.z.string().min(6, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 6 \u062E\u0627\u0646\u0627\u062A"),
  email: import_zod.z.string().email("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D").optional().nullable()
});
var CategorySchema = import_zod.z.object({
  name: import_zod.z.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0645\u0637\u0644\u0648\u0628")
});
var ProductVariantSchema = import_zod.z.object({
  id: import_zod.z.number().optional().nullable(),
  product_id: import_zod.z.number().optional().nullable(),
  name: import_zod.z.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u0645\u062A\u063A\u064A\u0631 \u0645\u0637\u0644\u0648\u0628"),
  color: import_zod.z.string().optional().nullable(),
  size: import_zod.z.string().optional().nullable(),
  barcode: import_zod.z.string().optional().nullable(),
  code: import_zod.z.string().optional().nullable(),
  purchase_price: import_zod.z.coerce.number().min(0).optional().nullable(),
  regular_price: import_zod.z.coerce.number().min(0).optional().nullable(),
  sale_price: import_zod.z.coerce.number().min(0).optional().nullable(),
  quantity: import_zod.z.coerce.number().min(0, "\u0627\u0644\u0643\u0645\u064A\u0629 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0633\u0627\u0644\u0628\u0629").default(0),
  min_quantity: import_zod.z.coerce.number().min(0).optional().nullable()
});
var BarcodePrintItemSchema = import_zod.z.object({
  product_id: import_zod.z.number().optional().nullable(),
  variant_id: import_zod.z.number().optional().nullable(),
  product_name: import_zod.z.string().min(1),
  variant_name: import_zod.z.string().optional().nullable(),
  size: import_zod.z.string().optional().nullable(),
  color: import_zod.z.string().optional().nullable(),
  barcode: import_zod.z.string().min(1, "\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F \u0645\u0637\u0644\u0648\u0628 \u0644\u0644\u0637\u0628\u0627\u0639\u0629"),
  price: import_zod.z.number().optional().nullable(),
  copies: import_zod.z.coerce.number().int().min(1, "\u0639\u062F\u062F \u0627\u0644\u0646\u0633\u062E \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 1 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644")
});
var BarcodePrintRequestSchema = import_zod.z.object({
  label_size: import_zod.z.nativeEnum(BarcodeLabelSize).default("THERMAL_38_25" /* THERMAL_38_25 */),
  show_store_name: import_zod.z.boolean().default(true),
  show_product_name: import_zod.z.boolean().default(true),
  show_size_color: import_zod.z.boolean().default(true),
  show_barcode_text: import_zod.z.boolean().default(true),
  show_price: import_zod.z.boolean().default(true),
  store_name: import_zod.z.string().optional().nullable(),
  items: import_zod.z.array(BarcodePrintItemSchema).min(1, "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0635\u0646\u0641 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0644\u0644\u0637\u0628\u0627\u0639\u0629")
});
var ProductSchema = import_zod.z.object({
  name: import_zod.z.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628"),
  type: import_zod.z.enum(["STANDARD", "VARIABLE", "EXPIRY"]).optional().nullable(),
  has_expiry: import_zod.z.boolean().optional(),
  has_variants: import_zod.z.boolean().optional(),
  code: import_zod.z.string().optional().nullable(),
  barcode: import_zod.z.string().optional().nullable(),
  category_id: import_zod.z.number().optional().nullable(),
  unit: import_zod.z.string().optional().nullable(),
  sub_unit: import_zod.z.string().optional().nullable(),
  sub_unit_factor: import_zod.z.coerce.number().min(0).optional().nullable(),
  sub_unit_price: import_zod.z.coerce.number().min(0).optional().nullable(),
  purchase_price: import_zod.z.coerce.number().min(0, "\u0633\u0639\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0635\u0641\u0631 \u0623\u0648 \u0623\u0643\u062B\u0631"),
  regular_price: import_zod.z.coerce.number().min(0).optional().nullable(),
  sale_price: import_zod.z.coerce.number().min(0, "\u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0635\u0641\u0631 \u0623\u0648 \u0623\u0643\u062B\u0631"),
  min_sale_price: import_zod.z.coerce.number().min(0).optional().nullable(),
  quantity: import_zod.z.coerce.number().min(0, "\u0627\u0644\u0643\u0645\u064A\u0629 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0633\u0627\u0644\u0628\u0629").default(0),
  min_quantity: import_zod.z.coerce.number().min(0).optional().nullable(),
  notes: import_zod.z.string().optional().nullable(),
  variants: import_zod.z.array(ProductVariantSchema).optional().nullable(),
  batches: import_zod.z.array(import_zod.z.any()).optional().nullable()
});
var PartySchema = import_zod.z.object({
  type: import_zod.z.nativeEnum(PartyType, { errorMap: () => ({ message: "\u0646\u0648\u0639 \u0627\u0644\u0637\u0631\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" }) }),
  name: import_zod.z.string().min(1, "\u0627\u0644\u0627\u0633\u0645 \u0645\u0637\u0644\u0648\u0628"),
  phone: import_zod.z.string().optional().nullable(),
  phone2: import_zod.z.string().optional().nullable(),
  address: import_zod.z.string().optional().nullable(),
  notes: import_zod.z.string().optional().nullable(),
  initial_balance: import_zod.z.coerce.number().default(0)
  // رصيد افتتاحي
});
var InvoiceItemSchema = import_zod.z.object({
  product_id: import_zod.z.number({ required_error: "\u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628" }),
  product_variant_id: import_zod.z.number().optional().nullable(),
  product_batch_id: import_zod.z.number().optional().nullable(),
  variant_name: import_zod.z.string().optional().nullable(),
  batch_number: import_zod.z.string().optional().nullable(),
  expiry_date: import_zod.z.string().optional().nullable(),
  unit_name: import_zod.z.string().optional().nullable(),
  is_sub_unit: import_zod.z.boolean().optional().nullable(),
  quantity: import_zod.z.coerce.number().positive("\u0627\u0644\u0643\u0645\u064A\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631"),
  unit_price: import_zod.z.coerce.number().min(0, "\u0627\u0644\u0633\u0639\u0631 \u0644\u0627 \u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0633\u0627\u0644\u0628"),
  notes: import_zod.z.string().optional().nullable()
});
var InvoiceSchema = import_zod.z.object({
  type: import_zod.z.nativeEnum(InvoiceType),
  party_id: import_zod.z.number().optional().nullable(),
  courier_party_id: import_zod.z.number().optional().nullable(),
  date: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}/, "\u062A\u0627\u0631\u064A\u062E \u063A\u064A\u0631 \u0635\u0627\u0644\u062D (YYYY-MM-DD)"),
  items: import_zod.z.array(InvoiceItemSchema).min(1, "\u064A\u062C\u0628 \u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644"),
  discount: import_zod.z.coerce.number().min(0).default(0),
  tax: import_zod.z.coerce.number().min(0).default(0),
  paid_amount: import_zod.z.coerce.number().min(0).default(0),
  payment_method: import_zod.z.nativeEnum(PaymentMethod).default("CASH" /* CASH */),
  branch_id: import_zod.z.number().optional().nullable(),
  notes: import_zod.z.string().optional().nullable(),
  parent_invoice_id: import_zod.z.number().optional().nullable()
}).refine(
  (data) => {
    if (data.payment_method === "CREDIT" /* CREDIT */ && !data.party_id) {
      return false;
    }
    return true;
  },
  {
    message: "\u064A\u062C\u0628 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0639\u0645\u064A\u0644/\u0627\u0644\u0645\u0648\u0631\u062F \u0641\u064A \u062D\u0627\u0644\u0629 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0622\u062C\u0644",
    path: ["party_id"]
  }
);
var PaymentSchema = import_zod.z.object({
  party_id: import_zod.z.number({ required_error: "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0637\u0631\u0641 (\u0627\u0644\u0639\u0645\u064A\u0644 \u0623\u0648 \u0627\u0644\u0645\u0648\u0631\u062F)" }),
  amount: import_zod.z.coerce.number().positive("\u0627\u0644\u0645\u0628\u0644\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631"),
  type: import_zod.z.enum(["PAYMENT", "RECEIPT"]),
  method: import_zod.z.nativeEnum(PaymentMethod).default("CASH" /* CASH */),
  date: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}/, "\u062A\u0627\u0631\u064A\u062E \u063A\u064A\u0631 \u0635\u0627\u0644\u062D (YYYY-MM-DD)"),
  invoice_id: import_zod.z.number().optional().nullable(),
  notes: import_zod.z.string().optional().nullable()
});
var ExpenseSchema = import_zod.z.object({
  title: import_zod.z.string().min(1, "\u0639\u0646\u0648\u0627\u0646/\u062C\u0647\u0629 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0645\u0637\u0644\u0648\u0628"),
  category: import_zod.z.string().optional().nullable(),
  amount: import_zod.z.coerce.number().positive("\u0627\u0644\u0645\u0628\u0644\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631"),
  payment_method: import_zod.z.string().optional().default("CASH"),
  treasury_id: import_zod.z.number().optional().nullable(),
  date: import_zod.z.string().regex(/^\d{4}-\d{2}-\d{2}/, "\u062A\u0627\u0631\u064A\u062E \u063A\u064A\u0631 \u0635\u0627\u0644\u062D (YYYY-MM-DD)"),
  notes: import_zod.z.string().optional().nullable()
});
var EmployeeSchema = import_zod.z.object({
  name: import_zod.z.string().min(2, "\u0627\u0644\u0627\u0633\u0645 \u0645\u0637\u0644\u0648\u0628"),
  phone: import_zod.z.string().min(8, "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u064A\u062C\u0628 \u0623\u0644\u0627 \u064A\u0642\u0644 \u0639\u0646 8 \u0623\u0631\u0642\u0627\u0645"),
  password: import_zod.z.string().min(6, "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 6 \u0623\u062D\u0631\u0641").optional().or(import_zod.z.literal("")),
  role: import_zod.z.enum(["ADMIN", "MANAGER", "SUPERVISOR", "MANDOB", "CASHIER"], { errorMap: () => ({ message: "\u0627\u0644\u062F\u0648\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" }) }),
  branch_id: import_zod.z.number().optional().nullable(),
  status: import_zod.z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  email: import_zod.z.string().email("\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D").optional().nullable().or(import_zod.z.literal(""))
});
var BranchSchema = import_zod.z.object({
  name: import_zod.z.string().min(1, "\u0627\u0633\u0645 \u0627\u0644\u0641\u0631\u0639 \u0623\u0648 \u0627\u0644\u0645\u062E\u0632\u0646 \u0645\u0637\u0644\u0648\u0628"),
  code: import_zod.z.string().min(1, "\u0643\u0648\u062F \u0627\u0644\u0641\u0631\u0639 \u0645\u0637\u0644\u0648\u0628"),
  type: import_zod.z.nativeEnum(BranchType).default("STORE" /* STORE */),
  phone: import_zod.z.string().optional().nullable(),
  address: import_zod.z.string().optional().nullable(),
  is_main: import_zod.z.boolean().default(false),
  is_active: import_zod.z.boolean().default(true)
});
var StockTransferItemSchema = import_zod.z.object({
  product_id: import_zod.z.number({ required_error: "\u0627\u0644\u0635\u0646\u0641 \u0645\u0637\u0644\u0648\u0628" }),
  product_variant_id: import_zod.z.number().optional().nullable(),
  quantity_sent: import_zod.z.coerce.number().positive("\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062D\u0648\u0644\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631"),
  unit_name: import_zod.z.string().optional().nullable(),
  notes: import_zod.z.string().optional().nullable()
});
var StockTransferSchema = import_zod.z.object({
  from_branch_id: import_zod.z.number({ required_error: "\u0641\u0631\u0639 \u0627\u0644\u0645\u0635\u062F\u0631 \u0645\u0637\u0644\u0648\u0628" }),
  to_branch_id: import_zod.z.number({ required_error: "\u0641\u0631\u0639 \u0627\u0644\u0648\u062C\u0647\u0629 \u0645\u0637\u0644\u0648\u0628" }),
  items: import_zod.z.array(StockTransferItemSchema).min(1, "\u064A\u062C\u0628 \u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0644\u0644\u062A\u062D\u0648\u064A\u0644"),
  notes: import_zod.z.string().optional().nullable()
}).refine((data) => data.from_branch_id !== data.to_branch_id, {
  message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u062D\u0648\u064A\u0644 \u0644\u0646\u0641\u0633 \u0627\u0644\u0641\u0631\u0639",
  path: ["to_branch_id"]
});

// src/utils/currency.ts
var Money = class _Money {
  cents;
  currency;
  constructor(amount = 0, currency = "EGP") {
    const numeric = typeof amount === "string" ? parseFloat(amount) || 0 : Number(amount) || 0;
    this.cents = Math.round(numeric * 100);
    this.currency = currency;
  }
  static fromCents(cents, currency = "EGP") {
    const instance = new _Money(0, currency);
    instance.cents = Math.round(Number(cents) || 0);
    return instance;
  }
  static of(amount = 0, currency = "EGP") {
    return new _Money(amount, currency);
  }
  static zero(currency = "EGP") {
    return new _Money(0, currency);
  }
  getAmount() {
    return Number((this.cents / 100).toFixed(2));
  }
  getCents() {
    return this.cents;
  }
  getCurrency() {
    return this.currency;
  }
  extractCents(other) {
    if (other instanceof _Money) {
      return other.getCents();
    }
    const numeric = typeof other === "string" ? parseFloat(other) || 0 : Number(other) || 0;
    return Math.round(numeric * 100);
  }
  add(other) {
    const otherCents = this.extractCents(other);
    return _Money.fromCents(this.cents + otherCents, this.currency);
  }
  subtract(other) {
    const otherCents = this.extractCents(other);
    return _Money.fromCents(this.cents - otherCents, this.currency);
  }
  multiply(multiplier) {
    const mult = typeof multiplier === "string" ? parseFloat(multiplier) || 0 : Number(multiplier) || 0;
    return _Money.fromCents(Math.round(this.cents * mult), this.currency);
  }
  divide(divisor) {
    const div = typeof divisor === "string" ? parseFloat(divisor) || 0 : Number(divisor) || 0;
    if (div === 0) {
      throw new Error("Cannot divide Money by zero");
    }
    return _Money.fromCents(Math.round(this.cents / div), this.currency);
  }
  isZero() {
    return this.cents === 0;
  }
  isPositive() {
    return this.cents > 0;
  }
  isNegative() {
    return this.cents < 0;
  }
  equals(other) {
    return this.cents === this.extractCents(other);
  }
  greaterThan(other) {
    return this.cents > this.extractCents(other);
  }
  lessThan(other) {
    return this.cents < this.extractCents(other);
  }
  greaterThanOrEqual(other) {
    return this.cents >= this.extractCents(other);
  }
  lessThanOrEqual(other) {
    return this.cents <= this.extractCents(other);
  }
  format(currencySymbol = "\u062C.\u0645") {
    const amount = this.getAmount();
    return `${amount.toLocaleString("ar-EG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} ${currencySymbol}`;
  }
  toJSON() {
    return this.getAmount();
  }
  toString() {
    return this.getAmount().toFixed(2);
  }
};

// src/utils/calculations.ts
function calculateInvoiceTotals(items, discount = 0, tax = 0, paid_amount = 0) {
  let subtotalMoney = Money.zero();
  let totalCostMoney = Money.zero();
  let hasCost = false;
  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const itemTotal = Money.of(item.unit_price).multiply(qty);
    subtotalMoney = subtotalMoney.add(itemTotal);
    if (item.purchase_price !== void 0) {
      hasCost = true;
      const itemCost = Money.of(item.purchase_price).multiply(qty);
      totalCostMoney = totalCostMoney.add(itemCost);
    }
  }
  const discountMoney = Money.of(Math.max(0, Number(discount) || 0));
  const taxMoney = Money.of(Math.max(0, Number(tax) || 0));
  const totalMoney = subtotalMoney.subtract(discountMoney).add(taxMoney);
  const safeTotal = totalMoney.isNegative() ? Money.zero() : totalMoney;
  const paidMoney = Money.of(Math.max(0, Number(paid_amount) || 0));
  const remainingMoney = safeTotal.subtract(paidMoney);
  const safeRemaining = remainingMoney.isNegative() ? Money.zero() : remainingMoney;
  const grossProfitMoney = hasCost ? safeTotal.subtract(totalCostMoney) : void 0;
  return {
    subtotal: subtotalMoney.getAmount(),
    discount: discountMoney.getAmount(),
    tax: taxMoney.getAmount(),
    total: safeTotal.getAmount(),
    remaining_amount: safeRemaining.getAmount(),
    total_cost: hasCost ? totalCostMoney.getAmount() : void 0,
    gross_profit: grossProfitMoney !== void 0 ? grossProfitMoney.getAmount() : void 0
  };
}
function calculateNetProfit(totalSales, costOfGoodsSold, totalExpenses) {
  const gross = Money.of(totalSales).subtract(Money.of(costOfGoodsSold));
  const net = gross.subtract(Money.of(totalExpenses));
  return {
    grossProfit: gross.getAmount(),
    netProfit: net.getAmount()
  };
}
function calculatePartyBalanceImpact(partyType, invoiceType, amount = 0, isPayment = false, paymentType) {
  const moneyAmount = Money.of(amount);
  let debitMoney = Money.zero();
  let creditMoney = Money.zero();
  if (isPayment) {
    if (paymentType === "RECEIPT") {
      creditMoney = moneyAmount;
    } else {
      debitMoney = moneyAmount;
    }
  } else if (invoiceType) {
    switch (invoiceType) {
      case "SALE" /* SALE */:
        debitMoney = moneyAmount;
        break;
      case "SALE_RETURN" /* SALE_RETURN */:
        creditMoney = moneyAmount;
        break;
      case "PURCHASE" /* PURCHASE */:
        creditMoney = moneyAmount;
        break;
      case "PURCHASE_RETURN" /* PURCHASE_RETURN */:
        debitMoney = moneyAmount;
        break;
    }
  }
  const balanceChangeMoney = partyType === "CUSTOMER" /* CUSTOMER */ ? debitMoney.subtract(creditMoney) : creditMoney.subtract(debitMoney);
  return {
    debit: debitMoney.getAmount(),
    credit: creditMoney.getAmount(),
    balanceChange: balanceChangeMoney.getAmount()
  };
}

// src/utils/formatters.ts
function formatCurrency(amount, currency = "\u062C.\u0645") {
  const safeAmount = Number(amount) || 0;
  return `${safeAmount.toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${currency}`;
}
function formatNumber(num) {
  const safeNum = Number(num) || 0;
  return safeNum.toLocaleString("ar-EG");
}
function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
function formatDateTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BarcodeFormat,
  BarcodeLabelSize,
  BarcodePrintItemSchema,
  BarcodePrintRequestSchema,
  BranchSchema,
  BranchType,
  CategorySchema,
  CommissionType,
  EmployeeAdjustmentType,
  EmployeeSchema,
  ExpenseSchema,
  ExpiryStatus,
  InvoiceItemSchema,
  InvoiceSchema,
  InvoiceType,
  LedgerSource,
  LoginSchema,
  Money,
  PartySchema,
  PartyType,
  PaymentMethod,
  PaymentSchema,
  ProductSchema,
  ProductType,
  ProductVariantSchema,
  RegisterSchema,
  ShiftStatus,
  StockMovementSource,
  StockMovementType,
  StockTransferItemSchema,
  StockTransferSchema,
  StockTransferStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  TreasuryTransactionSource,
  TreasuryTransactionType,
  TreasuryType,
  UserRole,
  UserStatus,
  WcOrderStatus,
  WcPaymentStatus,
  calculateInvoiceTotals,
  calculateNetProfit,
  calculatePartyBalanceImpact,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber
});
