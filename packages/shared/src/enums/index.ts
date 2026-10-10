export enum InvoiceType {
  SALE = 'SALE',
  PURCHASE = 'PURCHASE',
  SALE_RETURN = 'SALE_RETURN',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  INSTAPAY = 'INSTAPAY',
  VODAFONE_CASH = 'VODAFONE_CASH',
  TRANSFER = 'TRANSFER',
  CREDIT = 'CREDIT',
  SPLIT = 'SPLIT',
  COURIER_COD = 'COURIER_COD',
}

export enum PartyType {
  CUSTOMER = 'CUSTOMER',
  SUPPLIER = 'SUPPLIER',
  COURIER = 'COURIER',
}

export enum StockMovementType {
  IN = 'IN',
  OUT = 'OUT',
}

export enum StockMovementSource {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  SALE_RETURN = 'SALE_RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  INITIAL = 'INITIAL',
  TRANSFER_OUT = 'TRANSFER_OUT',
  TRANSFER_IN = 'TRANSFER_IN',
}

export enum LedgerSource {
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
  INITIAL = 'INITIAL',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',
}

export enum SubscriptionPlan {
  BASIC = 'BASIC',
}

export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  MANDOB = 'MANDOB',
  CASHIER = 'CASHIER',
  SALES = 'SALES',
}

export enum CommissionType {
  NONE = 'NONE',
  PERCENTAGE_OF_SALES = 'PERCENTAGE_OF_SALES',
  FIXED_PER_INVOICE = 'FIXED_PER_INVOICE',
}

export enum EmployeeAdjustmentType {
  BONUS = 'BONUS',
  DEDUCTION = 'DEDUCTION',
  ADVANCE = 'ADVANCE',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum TreasuryType {
  MAIN = 'MAIN',
  BRANCH_SAFE = 'BRANCH_SAFE',
  CASHIER_DRAWER = 'CASHIER_DRAWER',
  MANDOB_CUSTODY = 'MANDOB_CUSTODY',
  BANK = 'BANK',
  WALLET = 'WALLET',
  OWNER_DRAWINGS = 'OWNER_DRAWINGS',
}

export enum ShiftStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  SETTLED = 'SETTLED',
}

export enum TreasuryTransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  TRANSFER = 'TRANSFER',
  HANDOVER = 'HANDOVER',
}

export enum TreasuryTransactionSource {
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  EXPENSE = 'EXPENSE',
  SHIFT_HANDOVER = 'SHIFT_HANDOVER',
  MANUAL = 'MANUAL',
}

export enum ProductType {
  STANDARD = 'STANDARD',
  VARIABLE = 'VARIABLE',
  EXPIRY = 'EXPIRY',
}

export enum ExpiryStatus {
  VALID = 'VALID',
  NEAR_EXPIRY = 'NEAR_EXPIRY',
  EXPIRED = 'EXPIRED',
}

export enum BranchType {
  STORE = 'STORE',
  WAREHOUSE = 'WAREHOUSE',
  VAN = 'VAN',
}

export enum StockTransferStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
}

export * from './barcode';

export enum WcOrderStatus {
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  DISPATCHED = 'DISPATCHED',
  SHIPPED_VIA_COURIER = 'SHIPPED_VIA_COURIER',
  DELIVERED = 'DELIVERED',
  PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
}

export enum WcPaymentStatus {
  PENDING_COD = 'PENDING_COD',
  PAID_ONLINE = 'PAID_ONLINE',
  COLLECTED = 'COLLECTED',
}
