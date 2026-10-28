import {
  InvoiceType,
  PaymentMethod,
  PartyType,
  StockMovementType,
  StockMovementSource,
  LedgerSource,
  SubscriptionStatus,
  SubscriptionPlan,
  UserRole,
  UserStatus,
  ProductType,
  ExpiryStatus,
  BranchType,
  StockTransferStatus,
  TreasuryType,
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
  name: string;
  phone: string;
  email?: string | null;
  is_admin?: boolean;
  owner_id?: number | null;
  branch_id?: number | null;
  branch?: Branch | null;
  role?: UserRole;
  status?: UserStatus;
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
  notes?: string | null;
  variants?: ProductVariant[];
  batches?: ProductBatch[];
}

export interface Party extends BaseEntity {
  type: PartyType;
  name: string;
  phone?: string | null;
  phone2?: string | null;
  address?: string | null;
  balance: number; // Positive: we owe them (for supplier) or they owe us (for customer)
  notes?: string | null;
  invoices_count?: number;
  has_transactions?: boolean;
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
  payment_method: PaymentMethod;
  split_payments?: SplitPaymentItem[];
  notes?: string | null;
  items: InvoiceItem[];
  branch_id?: number | null;
  branch?: Branch | null;
  parent_invoice_id?: number | null; // For returns
  created_by?: number | null;
  creator?: User | null;
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
  activity: {
    invoices: number;
    products: number;
    parties: number;
  };
  financials: {
    estimated_revenue_egp: number;
  };
  system?: {
    database_driver: string;
    database_name: string;
    database_label: string;
  };
}

export interface LicenseKey extends BaseEntity {
  code: string;
  duration_days: number;
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


