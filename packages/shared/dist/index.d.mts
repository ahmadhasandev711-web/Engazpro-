import { z } from 'zod';

declare enum BarcodeLabelSize {
    THERMAL_38_25 = "THERMAL_38_25",// 38mm x 25mm (ملابس وإكسسوارات)
    THERMAL_50_25 = "THERMAL_50_25",// 50mm x 25mm (أحذية وكراتين)
    THERMAL_50_30 = "THERMAL_50_30",// 50mm x 30mm (تفصيلي عريض)
    A4_SHEET_24 = "A4_SHEET_24",// A4 3x8 (24 ملصق)
    A4_SHEET_30 = "A4_SHEET_30"
}
declare enum BarcodeFormat {
    CODE128 = "CODE128",
    EAN13 = "EAN13"
}

declare enum InvoiceType {
    SALE = "SALE",
    PURCHASE = "PURCHASE",
    SALE_RETURN = "SALE_RETURN",
    PURCHASE_RETURN = "PURCHASE_RETURN"
}
declare enum PaymentMethod {
    CASH = "CASH",
    CARD = "CARD",
    INSTAPAY = "INSTAPAY",
    VODAFONE_CASH = "VODAFONE_CASH",
    TRANSFER = "TRANSFER",
    CREDIT = "CREDIT",
    SPLIT = "SPLIT",
    COURIER_COD = "COURIER_COD"
}
declare enum PartyType {
    CUSTOMER = "CUSTOMER",
    SUPPLIER = "SUPPLIER",
    COURIER = "COURIER"
}
declare enum StockMovementType {
    IN = "IN",
    OUT = "OUT"
}
declare enum StockMovementSource {
    PURCHASE = "PURCHASE",
    SALE = "SALE",
    PURCHASE_RETURN = "PURCHASE_RETURN",
    SALE_RETURN = "SALE_RETURN",
    ADJUSTMENT = "ADJUSTMENT",
    INITIAL = "INITIAL",
    TRANSFER_OUT = "TRANSFER_OUT",
    TRANSFER_IN = "TRANSFER_IN"
}
declare enum LedgerSource {
    INVOICE = "INVOICE",
    PAYMENT = "PAYMENT",
    ADJUSTMENT = "ADJUSTMENT",
    INITIAL = "INITIAL"
}
declare enum SubscriptionStatus {
    ACTIVE = "ACTIVE",
    EXPIRED = "EXPIRED",
    CANCELLED = "CANCELLED",
    SUSPENDED = "SUSPENDED"
}
declare enum SubscriptionPlan {
    BASIC = "BASIC"
}
declare enum UserRole {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    MANAGER = "MANAGER",
    SUPERVISOR = "SUPERVISOR",
    MANDOB = "MANDOB",
    CASHIER = "CASHIER",
    SALES = "SALES"
}
declare enum CommissionType {
    NONE = "NONE",
    PERCENTAGE_OF_SALES = "PERCENTAGE_OF_SALES",
    FIXED_PER_INVOICE = "FIXED_PER_INVOICE"
}
declare enum EmployeeAdjustmentType {
    BONUS = "BONUS",
    DEDUCTION = "DEDUCTION",
    ADVANCE = "ADVANCE"
}
declare enum UserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE"
}
declare enum TreasuryType {
    MAIN = "MAIN",
    BRANCH_SAFE = "BRANCH_SAFE",
    CASHIER_DRAWER = "CASHIER_DRAWER",
    MANDOB_CUSTODY = "MANDOB_CUSTODY",
    BANK = "BANK",
    WALLET = "WALLET",
    OWNER_DRAWINGS = "OWNER_DRAWINGS"
}
declare enum ShiftStatus {
    OPEN = "OPEN",
    CLOSED = "CLOSED",
    SETTLED = "SETTLED"
}
declare enum TreasuryTransactionType {
    DEPOSIT = "DEPOSIT",
    WITHDRAWAL = "WITHDRAWAL",
    TRANSFER = "TRANSFER",
    HANDOVER = "HANDOVER"
}
declare enum TreasuryTransactionSource {
    INVOICE = "INVOICE",
    PAYMENT = "PAYMENT",
    EXPENSE = "EXPENSE",
    SHIFT_HANDOVER = "SHIFT_HANDOVER",
    MANUAL = "MANUAL"
}
declare enum ProductType {
    STANDARD = "STANDARD",
    VARIABLE = "VARIABLE",
    EXPIRY = "EXPIRY"
}
declare enum ExpiryStatus {
    VALID = "VALID",
    NEAR_EXPIRY = "NEAR_EXPIRY",
    EXPIRED = "EXPIRED"
}
declare enum BranchType {
    STORE = "STORE",
    WAREHOUSE = "WAREHOUSE",
    VAN = "VAN"
}
declare enum StockTransferStatus {
    PENDING = "PENDING",
    IN_TRANSIT = "IN_TRANSIT",
    RECEIVED = "RECEIVED",
    CANCELLED = "CANCELLED"
}

declare enum WcOrderStatus {
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
    CONFIRMED = "CONFIRMED",
    PREPARING = "PREPARING",
    DISPATCHED = "DISPATCHED",
    SHIPPED_VIA_COURIER = "SHIPPED_VIA_COURIER",
    DELIVERED = "DELIVERED",
    PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED",
    RETURNED = "RETURNED",
    CANCELLED = "CANCELLED"
}
declare enum WcPaymentStatus {
    PENDING_COD = "PENDING_COD",
    PAID_ONLINE = "PAID_ONLINE",
    COLLECTED = "COLLECTED"
}

interface BaseEntity {
    id: number;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}
interface StoreIdentity {
    business_name: string;
    store_phone: string;
    store_address: string;
    currency: string;
}
interface User extends BaseEntity {
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
interface Subscription extends BaseEntity {
    user_id: number;
    start_date: string;
    end_date: string;
    status: SubscriptionStatus;
    plan: SubscriptionPlan;
    is_valid: boolean;
    days_remaining: number;
}
interface Category extends BaseEntity {
    name: string;
    products_count?: number;
}
interface Unit extends BaseEntity {
    name: string;
    symbol: string;
}
interface ProductVariant extends BaseEntity {
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
interface ProductBatch extends BaseEntity {
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
interface Product extends BaseEntity {
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
interface Party extends BaseEntity {
    type: PartyType;
    name: string;
    phone?: string | null;
    phone2?: string | null;
    address?: string | null;
    balance: number;
    notes?: string | null;
    invoices_count?: number;
    has_transactions?: boolean;
}
interface InvoiceItem {
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
    purchase_price_at_sale?: number | null;
    total: number;
    notes?: string | null;
}
interface SplitPaymentItem {
    method: PaymentMethod;
    amount: number;
    notes?: string;
}
interface Invoice extends BaseEntity {
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
    parent_invoice_id?: number | null;
    created_by?: number | null;
    creator?: User | null;
}
interface Treasury extends BaseEntity {
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
interface Payment extends BaseEntity {
    party_id: number;
    party?: Party | null;
    invoice_id?: number | null;
    invoice?: Invoice | null;
    amount: number;
    type: 'PAYMENT' | 'RECEIPT';
    method: PaymentMethod;
    date: string;
    notes?: string | null;
    created_by?: number | null;
    creator?: User | null;
}
interface Expense extends BaseEntity {
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
interface StockMovement extends BaseEntity {
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
interface LedgerEntry extends BaseEntity {
    party_id: number;
    party?: Party | null;
    source_type: LedgerSource;
    source_id?: number | null;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance_after: number;
}
interface DashboardSummary {
    today_sales: number;
    today_purchases: number;
    today_gross_profit: number;
    today_expenses: number;
    today_net_profit: number;
    cash_in_hand: number;
    total_receivables: number;
    total_payables: number;
    low_stock_products_count: number;
    total_products_count: number;
}
interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}
interface ProfitReportData {
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
interface SalesReportData {
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
interface StockReportItem {
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
interface StockReportData {
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
interface TreasuryBreakdown {
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
interface CashFlowReportData {
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
interface AdminStatsData {
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
interface LicenseKey extends BaseEntity {
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
interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data: T;
    errors?: Record<string, string[]>;
}
interface Branch extends BaseEntity {
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
interface BranchStock extends BaseEntity {
    branch_id: number;
    branch?: Branch | null;
    product_id: number;
    product?: Product | null;
    product_variant_id?: number | null;
    variant?: ProductVariant | null;
    quantity: number;
    min_quantity?: number | null;
}
interface StockTransferItem {
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
interface StockTransfer extends BaseEntity {
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

declare const LoginSchema: z.ZodObject<{
    phone: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    password: string;
}, {
    phone: string;
    password: string;
}>;
declare const RegisterSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodString;
    password: z.ZodString;
    email: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    password: string;
    name: string;
    email?: string | null | undefined;
}, {
    phone: string;
    password: string;
    name: string;
    email?: string | null | undefined;
}>;
declare const CategorySchema: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
declare const ProductVariantSchema: z.ZodObject<{
    id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    product_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    name: z.ZodString;
    color: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    size: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    barcode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    code: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    purchase_price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    regular_price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    sale_price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    quantity: z.ZodDefault<z.ZodNumber>;
    min_quantity: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    quantity: number;
    code?: string | null | undefined;
    id?: number | null | undefined;
    product_id?: number | null | undefined;
    color?: string | null | undefined;
    size?: string | null | undefined;
    barcode?: string | null | undefined;
    purchase_price?: number | null | undefined;
    regular_price?: number | null | undefined;
    sale_price?: number | null | undefined;
    min_quantity?: number | null | undefined;
}, {
    name: string;
    code?: string | null | undefined;
    id?: number | null | undefined;
    product_id?: number | null | undefined;
    color?: string | null | undefined;
    size?: string | null | undefined;
    barcode?: string | null | undefined;
    purchase_price?: number | null | undefined;
    regular_price?: number | null | undefined;
    sale_price?: number | null | undefined;
    quantity?: number | undefined;
    min_quantity?: number | null | undefined;
}>;
declare const BarcodePrintItemSchema: z.ZodObject<{
    product_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    variant_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    product_name: z.ZodString;
    variant_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    size: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    color: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    barcode: z.ZodString;
    price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    copies: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    barcode: string;
    product_name: string;
    copies: number;
    product_id?: number | null | undefined;
    color?: string | null | undefined;
    size?: string | null | undefined;
    variant_id?: number | null | undefined;
    variant_name?: string | null | undefined;
    price?: number | null | undefined;
}, {
    barcode: string;
    product_name: string;
    copies: number;
    product_id?: number | null | undefined;
    color?: string | null | undefined;
    size?: string | null | undefined;
    variant_id?: number | null | undefined;
    variant_name?: string | null | undefined;
    price?: number | null | undefined;
}>;
declare const BarcodePrintRequestSchema: z.ZodObject<{
    label_size: z.ZodDefault<z.ZodNativeEnum<typeof BarcodeLabelSize>>;
    show_store_name: z.ZodDefault<z.ZodBoolean>;
    show_product_name: z.ZodDefault<z.ZodBoolean>;
    show_size_color: z.ZodDefault<z.ZodBoolean>;
    show_barcode_text: z.ZodDefault<z.ZodBoolean>;
    show_price: z.ZodDefault<z.ZodBoolean>;
    store_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    items: z.ZodArray<z.ZodObject<{
        product_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        variant_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        product_name: z.ZodString;
        variant_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        size: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        color: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        barcode: z.ZodString;
        price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        copies: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        barcode: string;
        product_name: string;
        copies: number;
        product_id?: number | null | undefined;
        color?: string | null | undefined;
        size?: string | null | undefined;
        variant_id?: number | null | undefined;
        variant_name?: string | null | undefined;
        price?: number | null | undefined;
    }, {
        barcode: string;
        product_name: string;
        copies: number;
        product_id?: number | null | undefined;
        color?: string | null | undefined;
        size?: string | null | undefined;
        variant_id?: number | null | undefined;
        variant_name?: string | null | undefined;
        price?: number | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    label_size: BarcodeLabelSize;
    show_store_name: boolean;
    show_product_name: boolean;
    show_size_color: boolean;
    show_barcode_text: boolean;
    show_price: boolean;
    items: {
        barcode: string;
        product_name: string;
        copies: number;
        product_id?: number | null | undefined;
        color?: string | null | undefined;
        size?: string | null | undefined;
        variant_id?: number | null | undefined;
        variant_name?: string | null | undefined;
        price?: number | null | undefined;
    }[];
    store_name?: string | null | undefined;
}, {
    items: {
        barcode: string;
        product_name: string;
        copies: number;
        product_id?: number | null | undefined;
        color?: string | null | undefined;
        size?: string | null | undefined;
        variant_id?: number | null | undefined;
        variant_name?: string | null | undefined;
        price?: number | null | undefined;
    }[];
    label_size?: BarcodeLabelSize | undefined;
    show_store_name?: boolean | undefined;
    show_product_name?: boolean | undefined;
    show_size_color?: boolean | undefined;
    show_barcode_text?: boolean | undefined;
    show_price?: boolean | undefined;
    store_name?: string | null | undefined;
}>;
declare const ProductSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodNullable<z.ZodOptional<z.ZodEnum<["STANDARD", "VARIABLE", "EXPIRY"]>>>;
    has_expiry: z.ZodOptional<z.ZodBoolean>;
    has_variants: z.ZodOptional<z.ZodBoolean>;
    code: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    barcode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    category_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    unit: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sub_unit: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    sub_unit_factor: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    sub_unit_price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    purchase_price: z.ZodNumber;
    regular_price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    sale_price: z.ZodNumber;
    min_sale_price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    quantity: z.ZodDefault<z.ZodNumber>;
    min_quantity: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    variants: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        product_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        name: z.ZodString;
        color: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        size: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        barcode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        code: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        purchase_price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        regular_price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        sale_price: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        quantity: z.ZodDefault<z.ZodNumber>;
        min_quantity: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        quantity: number;
        code?: string | null | undefined;
        id?: number | null | undefined;
        product_id?: number | null | undefined;
        color?: string | null | undefined;
        size?: string | null | undefined;
        barcode?: string | null | undefined;
        purchase_price?: number | null | undefined;
        regular_price?: number | null | undefined;
        sale_price?: number | null | undefined;
        min_quantity?: number | null | undefined;
    }, {
        name: string;
        code?: string | null | undefined;
        id?: number | null | undefined;
        product_id?: number | null | undefined;
        color?: string | null | undefined;
        size?: string | null | undefined;
        barcode?: string | null | undefined;
        purchase_price?: number | null | undefined;
        regular_price?: number | null | undefined;
        sale_price?: number | null | undefined;
        quantity?: number | undefined;
        min_quantity?: number | null | undefined;
    }>, "many">>>;
    batches: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodAny, "many">>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    purchase_price: number;
    sale_price: number;
    quantity: number;
    code?: string | null | undefined;
    type?: "STANDARD" | "VARIABLE" | "EXPIRY" | null | undefined;
    barcode?: string | null | undefined;
    regular_price?: number | null | undefined;
    min_quantity?: number | null | undefined;
    has_expiry?: boolean | undefined;
    has_variants?: boolean | undefined;
    category_id?: number | null | undefined;
    unit?: string | null | undefined;
    sub_unit?: string | null | undefined;
    sub_unit_factor?: number | null | undefined;
    sub_unit_price?: number | null | undefined;
    min_sale_price?: number | null | undefined;
    notes?: string | null | undefined;
    variants?: {
        name: string;
        quantity: number;
        code?: string | null | undefined;
        id?: number | null | undefined;
        product_id?: number | null | undefined;
        color?: string | null | undefined;
        size?: string | null | undefined;
        barcode?: string | null | undefined;
        purchase_price?: number | null | undefined;
        regular_price?: number | null | undefined;
        sale_price?: number | null | undefined;
        min_quantity?: number | null | undefined;
    }[] | null | undefined;
    batches?: any[] | null | undefined;
}, {
    name: string;
    purchase_price: number;
    sale_price: number;
    code?: string | null | undefined;
    type?: "STANDARD" | "VARIABLE" | "EXPIRY" | null | undefined;
    barcode?: string | null | undefined;
    regular_price?: number | null | undefined;
    quantity?: number | undefined;
    min_quantity?: number | null | undefined;
    has_expiry?: boolean | undefined;
    has_variants?: boolean | undefined;
    category_id?: number | null | undefined;
    unit?: string | null | undefined;
    sub_unit?: string | null | undefined;
    sub_unit_factor?: number | null | undefined;
    sub_unit_price?: number | null | undefined;
    min_sale_price?: number | null | undefined;
    notes?: string | null | undefined;
    variants?: {
        name: string;
        code?: string | null | undefined;
        id?: number | null | undefined;
        product_id?: number | null | undefined;
        color?: string | null | undefined;
        size?: string | null | undefined;
        barcode?: string | null | undefined;
        purchase_price?: number | null | undefined;
        regular_price?: number | null | undefined;
        sale_price?: number | null | undefined;
        quantity?: number | undefined;
        min_quantity?: number | null | undefined;
    }[] | null | undefined;
    batches?: any[] | null | undefined;
}>;
declare const PartySchema: z.ZodObject<{
    type: z.ZodNativeEnum<typeof PartyType>;
    name: z.ZodString;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    phone2: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    initial_balance: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: PartyType;
    name: string;
    initial_balance: number;
    phone?: string | null | undefined;
    notes?: string | null | undefined;
    phone2?: string | null | undefined;
    address?: string | null | undefined;
}, {
    type: PartyType;
    name: string;
    phone?: string | null | undefined;
    notes?: string | null | undefined;
    phone2?: string | null | undefined;
    address?: string | null | undefined;
    initial_balance?: number | undefined;
}>;
declare const InvoiceItemSchema: z.ZodObject<{
    product_id: z.ZodNumber;
    product_variant_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    product_batch_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    variant_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    batch_number: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    expiry_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    unit_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_sub_unit: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
    quantity: z.ZodNumber;
    unit_price: z.ZodNumber;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    product_id: number;
    quantity: number;
    unit_price: number;
    variant_name?: string | null | undefined;
    notes?: string | null | undefined;
    product_variant_id?: number | null | undefined;
    product_batch_id?: number | null | undefined;
    batch_number?: string | null | undefined;
    expiry_date?: string | null | undefined;
    unit_name?: string | null | undefined;
    is_sub_unit?: boolean | null | undefined;
}, {
    product_id: number;
    quantity: number;
    unit_price: number;
    variant_name?: string | null | undefined;
    notes?: string | null | undefined;
    product_variant_id?: number | null | undefined;
    product_batch_id?: number | null | undefined;
    batch_number?: string | null | undefined;
    expiry_date?: string | null | undefined;
    unit_name?: string | null | undefined;
    is_sub_unit?: boolean | null | undefined;
}>;
declare const InvoiceSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodNativeEnum<typeof InvoiceType>;
    party_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    courier_party_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    date: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        product_id: z.ZodNumber;
        product_variant_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        product_batch_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        variant_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        batch_number: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        expiry_date: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        unit_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        is_sub_unit: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
        quantity: z.ZodNumber;
        unit_price: z.ZodNumber;
        notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        product_id: number;
        quantity: number;
        unit_price: number;
        variant_name?: string | null | undefined;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        product_batch_id?: number | null | undefined;
        batch_number?: string | null | undefined;
        expiry_date?: string | null | undefined;
        unit_name?: string | null | undefined;
        is_sub_unit?: boolean | null | undefined;
    }, {
        product_id: number;
        quantity: number;
        unit_price: number;
        variant_name?: string | null | undefined;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        product_batch_id?: number | null | undefined;
        batch_number?: string | null | undefined;
        expiry_date?: string | null | undefined;
        unit_name?: string | null | undefined;
        is_sub_unit?: boolean | null | undefined;
    }>, "many">;
    discount: z.ZodDefault<z.ZodNumber>;
    tax: z.ZodDefault<z.ZodNumber>;
    paid_amount: z.ZodDefault<z.ZodNumber>;
    payment_method: z.ZodDefault<z.ZodNativeEnum<typeof PaymentMethod>>;
    branch_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    parent_invoice_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    type: InvoiceType;
    items: {
        product_id: number;
        quantity: number;
        unit_price: number;
        variant_name?: string | null | undefined;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        product_batch_id?: number | null | undefined;
        batch_number?: string | null | undefined;
        expiry_date?: string | null | undefined;
        unit_name?: string | null | undefined;
        is_sub_unit?: boolean | null | undefined;
    }[];
    date: string;
    discount: number;
    tax: number;
    paid_amount: number;
    payment_method: PaymentMethod;
    notes?: string | null | undefined;
    party_id?: number | null | undefined;
    courier_party_id?: number | null | undefined;
    branch_id?: number | null | undefined;
    parent_invoice_id?: number | null | undefined;
}, {
    type: InvoiceType;
    items: {
        product_id: number;
        quantity: number;
        unit_price: number;
        variant_name?: string | null | undefined;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        product_batch_id?: number | null | undefined;
        batch_number?: string | null | undefined;
        expiry_date?: string | null | undefined;
        unit_name?: string | null | undefined;
        is_sub_unit?: boolean | null | undefined;
    }[];
    date: string;
    notes?: string | null | undefined;
    party_id?: number | null | undefined;
    courier_party_id?: number | null | undefined;
    discount?: number | undefined;
    tax?: number | undefined;
    paid_amount?: number | undefined;
    payment_method?: PaymentMethod | undefined;
    branch_id?: number | null | undefined;
    parent_invoice_id?: number | null | undefined;
}>, {
    type: InvoiceType;
    items: {
        product_id: number;
        quantity: number;
        unit_price: number;
        variant_name?: string | null | undefined;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        product_batch_id?: number | null | undefined;
        batch_number?: string | null | undefined;
        expiry_date?: string | null | undefined;
        unit_name?: string | null | undefined;
        is_sub_unit?: boolean | null | undefined;
    }[];
    date: string;
    discount: number;
    tax: number;
    paid_amount: number;
    payment_method: PaymentMethod;
    notes?: string | null | undefined;
    party_id?: number | null | undefined;
    courier_party_id?: number | null | undefined;
    branch_id?: number | null | undefined;
    parent_invoice_id?: number | null | undefined;
}, {
    type: InvoiceType;
    items: {
        product_id: number;
        quantity: number;
        unit_price: number;
        variant_name?: string | null | undefined;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        product_batch_id?: number | null | undefined;
        batch_number?: string | null | undefined;
        expiry_date?: string | null | undefined;
        unit_name?: string | null | undefined;
        is_sub_unit?: boolean | null | undefined;
    }[];
    date: string;
    notes?: string | null | undefined;
    party_id?: number | null | undefined;
    courier_party_id?: number | null | undefined;
    discount?: number | undefined;
    tax?: number | undefined;
    paid_amount?: number | undefined;
    payment_method?: PaymentMethod | undefined;
    branch_id?: number | null | undefined;
    parent_invoice_id?: number | null | undefined;
}>;
declare const PaymentSchema: z.ZodObject<{
    party_id: z.ZodNumber;
    amount: z.ZodNumber;
    type: z.ZodEnum<["PAYMENT", "RECEIPT"]>;
    method: z.ZodDefault<z.ZodNativeEnum<typeof PaymentMethod>>;
    date: z.ZodString;
    invoice_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "PAYMENT" | "RECEIPT";
    date: string;
    party_id: number;
    amount: number;
    method: PaymentMethod;
    notes?: string | null | undefined;
    invoice_id?: number | null | undefined;
}, {
    type: "PAYMENT" | "RECEIPT";
    date: string;
    party_id: number;
    amount: number;
    notes?: string | null | undefined;
    method?: PaymentMethod | undefined;
    invoice_id?: number | null | undefined;
}>;
declare const ExpenseSchema: z.ZodObject<{
    title: z.ZodString;
    category: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    amount: z.ZodNumber;
    payment_method: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    treasury_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    date: z.ZodString;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    date: string;
    payment_method: string;
    amount: number;
    title: string;
    notes?: string | null | undefined;
    category?: string | null | undefined;
    treasury_id?: number | null | undefined;
}, {
    date: string;
    amount: number;
    title: string;
    notes?: string | null | undefined;
    payment_method?: string | undefined;
    category?: string | null | undefined;
    treasury_id?: number | null | undefined;
}>;
declare const EmployeeSchema: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodString;
    password: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    role: z.ZodEffects<z.ZodNativeEnum<typeof UserRole>, UserRole.ADMIN | UserRole.MANAGER | UserRole.SUPERVISOR | UserRole.MANDOB | UserRole.CASHIER | UserRole.SALES, UserRole>;
    branch_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    status: z.ZodDefault<z.ZodNativeEnum<typeof UserStatus>>;
    email: z.ZodUnion<[z.ZodNullable<z.ZodOptional<z.ZodString>>, z.ZodLiteral<"">]>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    status: UserStatus;
    name: string;
    role: UserRole.ADMIN | UserRole.MANAGER | UserRole.SUPERVISOR | UserRole.MANDOB | UserRole.CASHIER | UserRole.SALES;
    password?: string | undefined;
    email?: string | null | undefined;
    branch_id?: number | null | undefined;
}, {
    phone: string;
    name: string;
    role: UserRole;
    password?: string | undefined;
    status?: UserStatus | undefined;
    email?: string | null | undefined;
    branch_id?: number | null | undefined;
}>;
declare const BranchSchema: z.ZodObject<{
    name: z.ZodString;
    code: z.ZodString;
    type: z.ZodDefault<z.ZodNativeEnum<typeof BranchType>>;
    phone: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    address: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    is_main: z.ZodDefault<z.ZodBoolean>;
    is_active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    code: string;
    type: BranchType;
    name: string;
    is_main: boolean;
    is_active: boolean;
    phone?: string | null | undefined;
    address?: string | null | undefined;
}, {
    code: string;
    name: string;
    phone?: string | null | undefined;
    type?: BranchType | undefined;
    address?: string | null | undefined;
    is_main?: boolean | undefined;
    is_active?: boolean | undefined;
}>;
declare const StockTransferItemSchema: z.ZodObject<{
    product_id: z.ZodNumber;
    product_variant_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    quantity_sent: z.ZodNumber;
    unit_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    product_id: number;
    quantity_sent: number;
    notes?: string | null | undefined;
    product_variant_id?: number | null | undefined;
    unit_name?: string | null | undefined;
}, {
    product_id: number;
    quantity_sent: number;
    notes?: string | null | undefined;
    product_variant_id?: number | null | undefined;
    unit_name?: string | null | undefined;
}>;
declare const StockTransferSchema: z.ZodEffects<z.ZodObject<{
    from_branch_id: z.ZodNumber;
    to_branch_id: z.ZodNumber;
    items: z.ZodArray<z.ZodObject<{
        product_id: z.ZodNumber;
        product_variant_id: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
        quantity_sent: z.ZodNumber;
        unit_name: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        product_id: number;
        quantity_sent: number;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        unit_name?: string | null | undefined;
    }, {
        product_id: number;
        quantity_sent: number;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        unit_name?: string | null | undefined;
    }>, "many">;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    items: {
        product_id: number;
        quantity_sent: number;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        unit_name?: string | null | undefined;
    }[];
    from_branch_id: number;
    to_branch_id: number;
    notes?: string | null | undefined;
}, {
    items: {
        product_id: number;
        quantity_sent: number;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        unit_name?: string | null | undefined;
    }[];
    from_branch_id: number;
    to_branch_id: number;
    notes?: string | null | undefined;
}>, {
    items: {
        product_id: number;
        quantity_sent: number;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        unit_name?: string | null | undefined;
    }[];
    from_branch_id: number;
    to_branch_id: number;
    notes?: string | null | undefined;
}, {
    items: {
        product_id: number;
        quantity_sent: number;
        notes?: string | null | undefined;
        product_variant_id?: number | null | undefined;
        unit_name?: string | null | undefined;
    }[];
    from_branch_id: number;
    to_branch_id: number;
    notes?: string | null | undefined;
}>;
type LoginInput = z.infer<typeof LoginSchema>;
type RegisterInput = z.infer<typeof RegisterSchema>;
type ProductVariantInput = z.infer<typeof ProductVariantSchema>;
type BarcodePrintItemInput = z.infer<typeof BarcodePrintItemSchema>;
type BarcodePrintRequestInput = z.infer<typeof BarcodePrintRequestSchema>;
type ProductInput = z.infer<typeof ProductSchema>;
type PartyInput = z.infer<typeof PartySchema>;
type InvoiceItemInput = z.infer<typeof InvoiceItemSchema>;
type InvoiceInput = z.infer<typeof InvoiceSchema>;
type PaymentInput = z.infer<typeof PaymentSchema>;
type ExpenseInput = z.infer<typeof ExpenseSchema>;
type EmployeeInput = z.infer<typeof EmployeeSchema>;
type BranchInput = z.infer<typeof BranchSchema>;
type StockTransferItemInput = z.infer<typeof StockTransferItemSchema>;
type StockTransferInput = z.infer<typeof StockTransferSchema>;

interface CalculationItem {
    quantity: number;
    unit_price: number;
    purchase_price?: number;
}
interface InvoiceCalculations {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    remaining_amount: number;
    total_cost?: number;
    gross_profit?: number;
}
/**
 * حساب إجماليات الفاتورة باستخدام كائن Money لمنع أخطاء التقريب
 */
declare function calculateInvoiceTotals(items: CalculationItem[], discount?: number, tax?: number, paid_amount?: number): InvoiceCalculations;
/**
 * حساب صافي الربح باستخدام كائن Money
 */
declare function calculateNetProfit(totalSales: number | string, costOfGoodsSold: number | string, totalExpenses: number | string): {
    grossProfit: number;
    netProfit: number;
};
/**
 * حساب حركة الرصيد في كشف الحساب باستخدام كائن Money
 */
declare function calculatePartyBalanceImpact(partyType: PartyType, invoiceType?: InvoiceType, amount?: number | string, isPayment?: boolean, paymentType?: 'PAYMENT' | 'RECEIPT'): {
    debit: number;
    credit: number;
    balanceChange: number;
};

/**
 * تنسيق العملة
 */
declare function formatCurrency(amount: number | string | null | undefined, currency?: string): string;
/**
 * تنسيق الأرقام
 */
declare function formatNumber(num: number): string;
/**
 * تنسيق التاريخ للعرض
 */
declare function formatDate(dateString: string): string;
/**
 * تنسيق التاريخ والوقت للعرض
 */
declare function formatDateTime(dateString: string): string;

/**
 * كائن القيمة المركزي للمبالغ المالية والعملات (Money Value Object)
 * وفقاً للقاعدة الذهبية GR-1.1 في ARCHITECTURE_RULES.md
 *
 * يتم تخزين المبالغ داخلياً كقروش صحيحة (Integer Cents) لتفادي أي أخطاء حسابية
 * ناتجة عن الفواصل العائمة (Floating Point Arithmetic) في جافاسكريبت.
 */
declare class Money {
    protected readonly cents: number;
    protected readonly currency: string;
    constructor(amount?: number | string, currency?: string);
    static fromCents(cents: number, currency?: string): Money;
    static of(amount?: number | string, currency?: string): Money;
    static zero(currency?: string): Money;
    getAmount(): number;
    getCents(): number;
    getCurrency(): string;
    private extractCents;
    add(other: Money | number | string): Money;
    subtract(other: Money | number | string): Money;
    multiply(multiplier: number | string): Money;
    divide(divisor: number | string): Money;
    isZero(): boolean;
    isPositive(): boolean;
    isNegative(): boolean;
    equals(other: Money | number | string): boolean;
    greaterThan(other: Money | number | string): boolean;
    lessThan(other: Money | number | string): boolean;
    greaterThanOrEqual(other: Money | number | string): boolean;
    lessThanOrEqual(other: Money | number | string): boolean;
    format(currencySymbol?: string): string;
    toJSON(): number;
    toString(): string;
}

export { type AdminStatsData, type ApiResponse, BarcodeFormat, BarcodeLabelSize, type BarcodePrintItemInput, BarcodePrintItemSchema, type BarcodePrintRequestInput, BarcodePrintRequestSchema, type BaseEntity, type Branch, type BranchInput, BranchSchema, type BranchStock, BranchType, type CalculationItem, type CashFlowReportData, type Category, CategorySchema, CommissionType, type DashboardSummary, EmployeeAdjustmentType, type EmployeeInput, EmployeeSchema, type Expense, type ExpenseInput, ExpenseSchema, ExpiryStatus, type Invoice, type InvoiceCalculations, type InvoiceInput, type InvoiceItem, type InvoiceItemInput, InvoiceItemSchema, InvoiceSchema, InvoiceType, type LedgerEntry, LedgerSource, type LicenseKey, type LoginInput, LoginSchema, Money, type PaginatedResponse, type Party, type PartyInput, PartySchema, PartyType, type Payment, type PaymentInput, PaymentMethod, PaymentSchema, type Product, type ProductBatch, type ProductInput, ProductSchema, ProductType, type ProductVariant, type ProductVariantInput, ProductVariantSchema, type ProfitReportData, type RegisterInput, RegisterSchema, type SalesReportData, ShiftStatus, type SplitPaymentItem, type StockMovement, StockMovementSource, StockMovementType, type StockReportData, type StockReportItem, type StockTransfer, type StockTransferInput, type StockTransferItem, type StockTransferItemInput, StockTransferItemSchema, StockTransferSchema, StockTransferStatus, type StoreIdentity, type Subscription, SubscriptionPlan, SubscriptionStatus, type Treasury, type TreasuryBreakdown, TreasuryTransactionSource, TreasuryTransactionType, TreasuryType, type Unit, type User, UserRole, UserStatus, WcOrderStatus, WcPaymentStatus, calculateInvoiceTotals, calculateNetProfit, calculatePartyBalanceImpact, formatCurrency, formatDate, formatDateTime, formatNumber };
