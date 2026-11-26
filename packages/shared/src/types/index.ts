import {
  InvoiceType,
  PaymentMethod,
  PartyType,
  StockMovementType,
  StockMovementSource,
  LedgerSource,
  SubscriptionStatus,
  SubscriptionPlan,
  EcommercePlatform,
  UserRole,
  UserStatus,
  ProductType,
  ExpiryStatus,
  BranchType,
  StockTransferStatus,
  TreasuryType,
  CustomerTier,
  CustomerInteractionChannel,
  CrmRiskLevel,
  InvoiceReturnStatus,
  PromotionType,
  PromotionDiscountType,
  PromotionSyncSource,
} from '../enums';

export interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface StoreIdentity {
  business_name: string;
  store_phone: string;
  store_address: string;
  currency: string;
}

export interface User extends BaseEntity {
  store_code?: string;
  name: string;
  phone: string;
  email?: string | null;
  is_admin?: boolean;
  owner_id?: number | null;
  branch_id?: number | null;
  branch?: Branch | null;
  role?: UserRole;
  status?: UserStatus;
  ecommerce_enabled?: boolean;
  active_ecommerce_platform?: EcommercePlatform | null;
  permissions?: string[];
  subscription?: Subscription | null;
  store_identity?: StoreIdentity | null;
  business_name?: string;
  employees_count?: number;
  branches_count?: number;
  invoices_count?: number;
  products_count?: number;
  parties_count?: number;
}

export interface Subscription extends BaseEntity {
  user_id: number;
  start_date: string;
  end_date: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  is_valid: boolean;
  days_remaining: number;
}

export interface Category extends BaseEntity {
  name: string;
  products_count?: number;
}

export interface Unit extends BaseEntity {
  name: string;
  symbol: string;
}

export interface ProductVariant extends BaseEntity {
  product_id: number;
  name: string;
  color?: string | null;
  size?: string | null;
  barcode?: string | null;
  code?: string | null;
  purchase_price?: number | null;
  regular_price?: number | null;
  sale_price?: number | null;
  quantity: number;
  min_quantity?: number | null;
  is_low_stock?: boolean;
  image_url?: string | null;
}

export interface ProductBatch extends BaseEntity {
  product_id: number;
  product_variant_id?: number | null;
  batch_number: string;
  expiry_date: string;
  production_date?: string | null;
  quantity: number;
  purchase_price?: number | null;
  regular_price?: number | null;
  sale_price?: number | null;
  is_expired?: boolean;
  is_near_expiry?: boolean;
  status?: ExpiryStatus;
  notes?: string | null;
}

export interface Product extends BaseEntity {
  code?: string | null;
  barcode?: string | null;
  name: string;
  type?: ProductType;
  has_expiry?: boolean;
  has_variants?: boolean;
  category_id?: number | null;
  category?: Category | null;
  category_name?: string | null;
  unit?: string | null;
  sub_unit?: string | null;
  sub_unit_factor?: number | null;
  sub_unit_price?: number | null;
  purchase_price?: number | null;
  regular_price?: number | null;
  sale_price: number;
  min_sale_price?: number | null;
  quantity: number;
  current_stock?: number;
  min_quantity?: number | null;
  is_low_stock?: boolean;
  has_movements?: boolean;
  image_url?: string | null;
  notes?: string | null;
  variants?: ProductVariant[];
  batches?: ProductBatch[];
}

export interface PartyCrmMetrics {
  auto_tier: CustomerTier;
  effective_tier: CustomerTier;
  tier_label: string;
  is_manual_override: boolean;
  risk_level: CrmRiskLevel;
  delivered_orders_count: number;
  cancelled_or_returned_count: number;
  active_orders_count: number;
  total_orders_count: number;
  cancellation_rate: number;
  total_spent: number;
  last_order_at?: string | null;
  show_warning: boolean;
  warning_message?: string | null;
}

export interface PartyInteraction {
  id: number;
  party_id: number;
  created_by: number;
  creator_name?: string | null;
  channel: CustomerInteractionChannel;
  channel_label: string;
  notes: string;
  follow_up_at?: string | null;
  created_at: string;
}

export interface Party extends BaseEntity {
  type: PartyType;
  name: string;
  phone?: string | null;
  phone2?: string | null;
  address?: string | null;
  balance: number; // Positive: we owe them (for supplier) or they owe us (for customer)
  store_credit_balance?: number;
  notes?: string | null;
  invoices_count?: number;
  interactions_count?: number;
  has_transactions?: boolean;
  crm_tier_override?: CustomerTier | null;
  crm_metrics?: PartyCrmMetrics | null;
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  product_id: number;
  product_variant_id?: number | null;
  product_batch_id?: number | null;
  product_name: string;
  product_code?: string | null;
  variant_name?: string | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  unit_name?: string | null;
  is_sub_unit?: boolean;
  quantity: number;
  unit_price: number;
  effective_return_unit_price?: number;
  purchase_price_at_sale?: number | null; // for profit tracking
  total: number;
  notes?: string | null;
}

export interface SplitPaymentItem {
  method: PaymentMethod;
  amount: number;
  notes?: string;
}

export interface Invoice extends BaseEntity {
  invoice_number: string;
  type: InvoiceType;
  party_id?: number | null;
  party_name?: string | null;
  party?: Party | null;
  courier_party_id?: number | null;
  courier_party?: Party | null;
  date: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  due_amount?: number;
  payment_method: PaymentMethod;
  split_payments?: SplitPaymentItem[];
  notes?: string | null;
  items: InvoiceItem[];
  branch_id?: number | null;
  branch?: Branch | null;
  parent_invoice_id?: number | null; // For returns
  parent_invoice_number?: string | null;
  exchange_id?: number | null;
  promotion_id?: number | null;
  coupon_code?: string | null;
  promotion_discount?: number;
  returned_total?: number;
  returns_count?: number;
  return_status?: InvoiceReturnStatus | 'NONE' | 'PARTIAL' | 'FULL';
  online_order_id?: number | null;
  wc_order_id?: number | null;
  shopify_order_id?: number | null;
  created_by?: number | null;
  creator?: User | null;
}

export interface Promotion {
  id: number;
  name: string;
  code?: string | null;
  type: PromotionType | string;
  discount_type: PromotionDiscountType | string;
  discount_value: number;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  branch_id?: number | null;
  branch_name?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  product_id?: number | null;
  product_name?: string | null;
  min_order_amount: number;
  max_discount_amount?: number | null;
  max_uses?: number | null;
  used_count: number;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  wc_coupon_id?: number | null;
  shopify_discount_id?: string | null;
  sync_source?: PromotionSyncSource | string;
  sync_to_ecommerce?: boolean;
  last_synced_at?: string | null;
  sync_error?: string | null;
  created_at?: string;
}

export interface PromotionEvaluation {
  promotion_id: number | null;
  coupon_code: string | null;
  promotion_name: string | null;
  promotion_type: PromotionType | string | null;
  promotion_discount: number;
}

export interface Treasury extends BaseEntity {
  user_id: number;
  branch_id?: number | null;
  branch?: Branch | null;
  name: string;
  type: TreasuryType;
  balance: number;
  current_balance?: number;
  assigned_user_id?: number | null;
  assigned_user?: User | null;
  is_active: boolean;
  notes?: string | null;
}

export interface Payment extends BaseEntity {
  party_id: number;
  party?: Party | null;
  invoice_id?: number | null;
  invoice?: Invoice | null;
  amount: number;
  type: 'PAYMENT' | 'RECEIPT'; // Receipt = قبض من عميل, Payment = دفع لمورد
  method: PaymentMethod;
  date: string;
  notes?: string | null;
  created_by?: number | null;
  creator?: User | null;
}

export interface Expense extends BaseEntity {
  title: string;
  category?: string | null;
  amount: number;
  payment_method?: PaymentMethod | string;
  treasury_id?: number | null;
  treasury_name?: string | null;
  creator_name?: string | null;
  date: string;
  notes?: string | null;
}

export interface StockMovement extends BaseEntity {
  product_id: number;
  product?: Product | null;
  branch_id?: number | null;
  branch?: Branch | null;
  type: StockMovementType;
  source_type: StockMovementSource;
  source_id?: number | null;
  quantity: number;
  balance_after: number;
  unit_price?: number | null;
  notes?: string | null;
}

export interface LedgerEntry extends BaseEntity {
  party_id: number;
  party?: Party | null;
  source_type: LedgerSource;
  source_id?: number | null;
  date: string;
  description: string;
  debit: number;   // مدين (عليه)
  credit: number;  // دائن (له)
  balance_after: number;
}

export interface DashboardSummary {
  today_sales: number;
  today_purchases: number;
  today_gross_profit: number;
  today_expenses: number;
  today_net_profit: number;
  cash_in_hand: number;
  total_receivables: number; // ديون العملاء
  total_payables: number;    // ديون الموردين
  low_stock_products_count: number;
  total_products_count: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ProfitReportData {
  period: {
    from_date?: string | null;
    to_date?: string | null;
  };
  sales: {
    gross_sales: number;
    sale_returns: number;
    net_sales: number;
    sales_count: number;
    returns_count: number;
  };
  cogs: {
    cogs_sales: number;
    cogs_returns: number;
    net_cogs: number;
  };
  profit: {
    gross_profit: number;
    total_expenses: number;
    expenses_count: number;
    net_profit: number;
    profit_margin: number;
  };
  summary?: {
    gross_sales?: number;
    sales_returns?: number;
    net_sales?: number;
    cost_of_goods_sold?: number;
    gross_profit?: number;
    total_expenses?: number;
    net_profit?: number;
  };
}

export interface SalesReportData {
  total_sales: number;
  total_purchases: number;
  total_sale_returns: number;
  total_purchase_returns: number;
  sales_paid: number;
  sales_remaining: number;
  payment_methods?: Array<{
    payment_method: string;
    total_amount: number;
    count: number;
  }>;
  top_selling_products?: Array<{
    name: string;
    total_quantity: number;
    total_revenue: number;
  }>;
}

export interface StockReportItem {
  id: number;
  name: string;
  code?: string | null;
  barcode?: string | null;
  category?: string | null;
  quantity: number;
  unit?: string | null;
  purchase_price?: number | null;
  sale_price: number;
  cost_value?: number | null;
  retail_value: number;
  min_quantity?: number | null;
  is_low_stock?: boolean;
  image_url?: string | null;
}

export interface StockReportData {
  summary: {
    products_count: number;
    total_quantity: number;
    total_cost_value?: number | null;
    total_retail_value: number;
    expected_gross_margin?: number | null;
    low_stock_count: number;
  };
  products: StockReportItem[];
  pagination?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface TreasuryBreakdown {
  inflow: {
    sales: number;
    receipt_vouchers: number;
    purchase_returns: number;
    total: number;
    cash_sales?: number;
    total_inflow?: number;
  };
  outflow: {
    purchases: number;
    payment_vouchers: number;
    sale_returns: number;
    expenses: number;
    total: number;
    cash_purchases?: number;
    total_outflow?: number;
  };
  net_balance: number;
}

export interface CashFlowReportData {
  period: {
    from_date?: string | null;
    to_date?: string | null;
  };
  inflow: {
    sales?: number;
    cash_sales?: number;
    receipt_vouchers?: number;
    purchase_returns?: number;
    total?: number;
    total_inflow?: number;
  };
  outflow: {
    purchases?: number;
    cash_purchases?: number;
    payment_vouchers?: number;
    sale_returns?: number;
    expenses?: number;
    total?: number;
    total_outflow?: number;
  };
  net_cash_flow: number;
  total_funds?: number;
  treasuries: {
    cash: TreasuryBreakdown;
    transfer: TreasuryBreakdown;
    card: TreasuryBreakdown;
    instapay?: TreasuryBreakdown;
    vodafone_cash?: TreasuryBreakdown;
  };
}

export interface CashFlowTransaction {
  id: number;
  source_type: 'INVOICE' | 'PAYMENT' | 'EXPENSE';
  movement_category: string;
  category_label: string;
  reference_number: string;
  date: string | null;
  created_at: string | null;
  amount: number;
  flow_direction: 'IN' | 'OUT';
  party_id: number | null;
  party_name: string | null;
  created_by: number | null;
  creator_name: string | null;
  notes: string | null;
}

export interface CashFlowTransactionsResponse {
  success: boolean;
  data: CashFlowTransaction[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface AdminStatsData {
  users: {
    total: number;
    merchants: number;
    staff?: number;
    admins: number;
  };
  subscriptions: {
    active: number;
    expired: number;
    trial: number;
    paid: number;
  };
  licenses: {
    total: number;
    unused: number;
    used: number;
    revoked?: number;
  };
  operations: {
    trial_active: number;
    expiring_7d: number;
    pending_inquiries: number;
    pending_reset_requests: number;
    pending_jobs: number;
    failed_jobs: number;
  };
  financials: {
    estimated_revenue_egp: number;
    recorded_revenue_egp?: number;
  };
  system?: {
    database_driver: string;
    database_label: string;
  };
}

export interface LicenseKey extends BaseEntity {
  code: string;
  duration_days: number;
  plan?: string;
  price?: number | null;
  ecommerce_enabled?: boolean;
  is_used: boolean;
  is_revoked?: boolean;
  revoked_at?: string | null;
  notes?: string | null;
  batch_reference?: string | null;
  used_at?: string | null;
  used_by_user?: {
    id: number;
    name: string;
    phone: string;
  } | null;
  used_by?: {
    id: number;
    name: string;
    phone: string;
  } | null;
}

export interface AdminAuditLogItem {
  id: number;
  actor_user_id: number | null;
  target_user_id: number | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  summary: string;
  metadata?: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  actor?: {
    id: number;
    name: string;
    phone: string;
  } | null;
  target_user?: {
    id: number;
    name: string;
    phone: string;
  } | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, string[]>;
}

export interface Branch extends BaseEntity {
  user_id: number;
  name: string;
  code: string;
  type: BranchType;
  phone?: string | null;
  address?: string | null;
  is_main: boolean;
  is_active: boolean;
  users_count?: number;
  stocks_count?: number;
}

export interface BranchStock extends BaseEntity {
  branch_id: number;
  branch?: Branch | null;
  product_id: number;
  product?: Product | null;
  product_variant_id?: number | null;
  variant?: ProductVariant | null;
  quantity: number;
  min_quantity?: number | null;
}

export interface StockTransferItem {
  id?: number;
  stock_transfer_id?: number;
  product_id: number;
  product?: Product | null;
  product_variant_id?: number | null;
  variant?: ProductVariant | null;
  quantity_sent: number;
  quantity_received?: number;
  unit_name?: string | null;
  notes?: string | null;
}

export interface StockTransfer extends BaseEntity {
  transfer_number: string;
  from_branch_id: number;
  from_branch?: Branch | null;
  to_branch_id: number;
  to_branch?: Branch | null;
  status: StockTransferStatus;
  created_by?: number | null;
  creator?: User | null;
  received_by?: number | null;
  receiver?: User | null;
  transferred_at?: string | null;
  received_at?: string | null;
  notes?: string | null;
  items: StockTransferItem[];
}



export interface OnlineOrderItem {
  id?: number;
  online_order_id: number;
  product_id?: number | null;
  product_variant_id?: number | null;
  external_product_id?: string | null;
  external_variant_id?: string | null;
  quantity: number;
}

export interface OnlineOrder extends BaseEntity {
  user_id: number;
  platform: EcommercePlatform | string;
  external_order_id: string;
  external_order_number?: string | null;
  display_reference?: string;
  order_date?: string | null;
  party_id?: number | null;
  party?: Party | null;
  branch_id?: number | null;
  branch?: Branch | null;
  mandob_id?: number | null;
  shipping_type?: string | null;
  courier_party_id?: number | null;
  courier_name?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  invoice_id?: number | null;
  is_exchange?: boolean;
  exchange_id?: number | null;
  status: string;
  call_confirmed_at?: string | null;
  call_confirmed_by?: string | null;
  call_status?: string | null;
  call_attempts_count?: number;
  last_call_attempt_at?: string | null;
  last_call_attempt_by?: string | null;
  call_scheduled_at?: string | null;
  call_notes?: string | null;
  cancel_reason?: string | null;
  cancel_notes?: string | null;
  cancelled_at?: string | null;
  payment_status?: string | null;
  payment_method_label?: string | null;
  shipping_cost: number;
  subtotal: number;
  discount_total: number;
  total: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  governorate?: string | null;
  city?: string | null;
  notes?: string | null;
  coupon_codes?: string[];
  discount_breakdown?: any[];
  items_snapshot?: any[];
  platform_meta?: Record<string, any>;
  items?: OnlineOrderItem[];
  customer_crm?: PartyCrmMetrics | null;
}

export type WcOrderItem = OnlineOrderItem;
export type WcOrder = OnlineOrder;

export interface StockAlertsSummary {
  out_of_stock_count: number;
  low_stock_count: number;
  expiring_batches_count: number;
  total_alerts: number;
}

export interface LowStockAlertItem {
  branch_stock_id: number;
  branch_id: number;
  branch_name: string | null;
  product_id: number;
  product_name: string | null;
  unit: string;
  product_variant_id: number | null;
  variant_name: string | null;
  quantity: number;
  min_quantity: number;
  is_out_of_stock: boolean;
  suggested_reorder_qty: number;
  last_purchase_price: number;
  last_supplier_id: number | null;
  last_supplier_name: string | null;
}

export interface ExpiringBatchAlertItem {
  batch_id: number;
  product_id: number;
  product_name: string | null;
  variant_name: string | null;
  batch_number: string;
  expiry_date: string | null;
  days_remaining: number;
  is_expired: boolean;
  quantity: number;
}

export interface StockAlertsResponse {
  summary: StockAlertsSummary;
  low_stock_items: LowStockAlertItem[];
  low_stock_meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  expiring_batches: ExpiringBatchAlertItem[];
}

export interface StockMovementRecord {
  id: number;
  branch_id: number | null;
  branch_name: string | null;
  product_id: number;
  product_name: string | null;
  product_code: string | null;
  unit: string | null;
  product_variant_id: number | null;
  variant_name: string | null;
  product_batch_id: number | null;
  batch_number: string | null;
  type: 'IN' | 'OUT';
  source_type: string;
  source_id: number | null;
  quantity: number;
  balance_after: number;
  unit_price: number | null;
  notes: string | null;
  created_at: string | null;
}

export interface PurchaseReportData {
  period: {
    from_date?: string | null;
    to_date?: string | null;
    branch_id?: number | null;
  };
  summary: {
    total_purchases: number;
    total_purchase_returns: number;
    net_purchases: number;
    cash_purchases: number;
    credit_purchases: number;
    total_paid: number;
    total_remaining: number;
    invoices_count: number;
    returns_count: number;
  };
  top_suppliers: Array<{
    party_id: number;
    supplier_name: string;
    supplier_phone: string | null;
    invoices_count: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    current_balance: number;
  }>;
  top_products: Array<{
    product_id: number;
    product_name: string;
    invoices_count: number;
    total_quantity: number;
    total_cost: number;
    avg_unit_cost: number;
  }>;
}

export interface FinancialClosingReportData {
  period: {
    from_date?: string | null;
    to_date?: string | null;
    branch_id?: number | null;
  };
  income_statement: {
    gross_sales: number;
    sales_discounts: number;
    sale_returns: number;
    net_sales: number;
    shipping_revenue: number;
    cogs_sales: number;
    cogs_returns: number;
    net_cogs: number;
    gross_profit: number;
    gross_margin: number;
    expenses_by_category: Array<{
      category: string;
      count: number;
      total_amount: number;
    }>;
    total_expenses: number;
    net_profit: number;
    net_margin: number;
    pending_payroll_reference?: {
      month: string;
      disbursed_this_month: number;
    };
  };
  balance_snapshot: {
    as_of: string;
    assets: {
      treasuries_by_type: Array<{
        type: string;
        label: string;
        balance: number;
      }>;
      total_cash_and_banks: number;
      inventory_cost_value: number;
      in_transit_inventory_value: number;
      customer_receivables: number;
      courier_receivables: number;
      total_assets: number;
    };
    liabilities: {
      supplier_payables: number;
      customer_credits: number;
      courier_payables: number;
      total_liabilities: number;
    };
    net_working_capital: number;
    owner_drawings_total: number;
  };
}

export interface ReceivablesPayablesBucketParty {
  id: number;
  name: string;
  phone?: string | null;
  type: PartyType;
  balance: number;
  last_activity_date?: string | null;
  days_since_activity?: number | null;
  aging_bucket: 'CURRENT' | 'DAYS_31_60' | 'DAYS_60_PLUS';
}

export interface ReceivablesPayablesAgingBuckets {
  current_0_30: number;
  days_31_60: number;
  days_60_plus: number;
}

export interface ReceivablesPayablesReportData {
  as_of: string;
  summary: {
    customer_receivables_total: number;
    customer_credits_total: number;
    supplier_payables_total: number;
    supplier_advances_total: number;
    courier_receivables_total: number;
    courier_payables_total: number;
    net_trade_position: number;
  };
  aging: {
    customers: ReceivablesPayablesAgingBuckets;
    suppliers: ReceivablesPayablesAgingBuckets;
    couriers: ReceivablesPayablesAgingBuckets;
  };
  top_customers: ReceivablesPayablesBucketParty[];
  top_suppliers: ReceivablesPayablesBucketParty[];
  top_couriers: ReceivablesPayablesBucketParty[];
}

export interface ExchangeItemRow {
  id: number;
  direction: 'RETURNED' | 'REPLACEMENT';
  product_id: number;
  product_variant_id?: number | null;
  product_name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  condition?: 'SELLABLE' | 'DAMAGED' | null;
  received_into_stock_at?: string | null;
}

export interface ExchangeRecord {
  id: number;
  exchange_number: string;
  source: 'POS' | 'ONLINE_ORDER';
  status: 'COMPLETED' | 'AWAITING_COURIER_PICKUP' | 'CANCELLED';
  branch_id?: number | null;
  branch_name?: string | null;
  party_id?: number | null;
  party_name?: string | null;
  party_phone?: string | null;
  salesperson_id?: number | null;
  salesperson_name?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  original_invoice_id?: number | null;
  original_invoice_number?: string | null;
  original_online_order_id?: number | null;
  original_online_order_number?: string | null;
  return_invoice_id?: number | null;
  return_invoice_number?: string | null;
  replacement_invoice_id?: number | null;
  replacement_invoice_number?: string | null;
  replacement_online_order_id?: number | null;
  replacement_online_order_number?: string | null;
  return_total: number;
  replacement_total: number;
  exchange_shipping_fee: number;
  store_credit_used: number;
  net_amount: number;
  settlement_type: 'EVEN_EXCHANGE' | 'CUSTOMER_PAYS' | 'REFUND_CASH' | 'STORE_CREDIT';
  payment_method?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  notes?: string | null;
  items?: ExchangeItemRow[];
}

export interface StoreCreditTransactionRecord {
  id: number;
  type: 'EARNED' | 'REDEEMED' | 'ADJUSTMENT';
  amount: number;
  balance_after: number;
  exchange_id?: number | null;
  exchange_number?: string | null;
  invoice_id?: number | null;
  invoice_number?: string | null;
  created_by_name?: string | null;
  expires_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface EasyOrdersWebhookUrls {
  orders_webhook: string;
  order_status_webhook: string;
}

export interface EasyOrdersSettings {
  id?: number;
  store_id?: string | null;
  store_name?: string | null;
  auth_mode?: string;
  has_api_key?: boolean;
  has_webhook_secret?: boolean;
  webhook_secret?: string | null;
  default_branch_id?: number | null;
  default_branch?: Branch | null;
  auto_sync_stock?: boolean;
  is_active?: boolean;
  webhook_registered_at?: string | null;
  last_synced_at?: string | null;
  last_error?: string | null;
  webhooks?: EasyOrdersWebhookUrls;
}

export * from './easyfy';
