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

declare enum EasyfyStockMode {
    TRACKED = "TRACKED",
    UNLIMITED = "UNLIMITED",
    MADE_TO_ORDER = "MADE_TO_ORDER"
}
declare enum EasyfyOrderStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    PREPARING = "PREPARING",
    SHIPPED = "SHIPPED",
    DELIVERED = "DELIVERED",
    CANCELLED = "CANCELLED"
}
declare enum EasyfyPaymentMethod {
    CASH_ON_DELIVERY = "CASH_ON_DELIVERY",
    INSTAPAY = "INSTAPAY",
    VODAFONE_CASH = "VODAFONE_CASH"
}
declare enum EasyfyPaymentStatus {
    NOT_REQUIRED = "NOT_REQUIRED",
    PENDING_REVIEW = "PENDING_REVIEW",
    VERIFIED = "VERIFIED",
    REJECTED = "REJECTED"
}
declare enum EasyfyCouponType {
    PERCENTAGE = "PERCENTAGE",
    FIXED = "FIXED",
    FREE_SHIPPING = "FREE_SHIPPING"
}
declare enum EasyfyStockMovementType {
    OPENING = "OPENING",
    RESTOCK = "RESTOCK",
    ORDER_DEDUCTION = "ORDER_DEDUCTION",
    ORDER_CANCEL_RESTORE = "ORDER_CANCEL_RESTORE",
    ADJUSTMENT = "ADJUSTMENT"
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
    COURIER_COD = "COURIER_COD",
    STORE_CREDIT = "STORE_CREDIT",
    EXCHANGE_OFFSET = "EXCHANGE_OFFSET"
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
declare enum EcommercePlatform {
    WOOCOMMERCE = "woocommerce",
    SHOPIFY = "shopify"
}
declare enum ShopifyAuthMode {
    ACCESS_TOKEN = "ACCESS_TOKEN",
    CLIENT_CREDENTIALS = "CLIENT_CREDENTIALS",
    OAUTH = "OAUTH"
}
declare enum StockAdjustmentMode {
    INCREASE = "INCREASE",
    DECREASE = "DECREASE",
    SET_ACTUAL = "SET_ACTUAL"
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
declare enum OnlineOrderCallStatus {
    NO_ANSWER = "NO_ANSWER",
    CALLBACK_SCHEDULED = "CALLBACK_SCHEDULED",
    CONFIRMED = "CONFIRMED"
}
declare enum OrderCancelReason {
    CUSTOMER_REJECTED = "CUSTOMER_REJECTED",
    WRONG_NUMBER = "WRONG_NUMBER",
    DUPLICATE_ORDER = "DUPLICATE_ORDER",
    NO_ANSWER = "NO_ANSWER",
    OTHER = "OTHER"
}
declare enum CustomerTier {
    VIP = "VIP",
    REPEAT = "REPEAT",
    REGULAR = "REGULAR",
    HIGH_CANCELLATION = "HIGH_CANCELLATION",
    BLACKLISTED = "BLACKLISTED"
}
declare enum CustomerInteractionChannel {
    CALL = "CALL",
    WHATSAPP = "WHATSAPP",
    NOTE = "NOTE",
    COMPLAINT = "COMPLAINT",
    FOLLOW_UP = "FOLLOW_UP"
}
declare enum CrmRiskLevel {
    NONE = "NONE",
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH"
}
declare enum InvoiceReturnStatus {
    NONE = "NONE",
    PARTIAL = "PARTIAL",
    FULL = "FULL"
}
declare enum PromotionType {
    COUPON = "COUPON",
    BUY_X_GET_Y = "BUY_X_GET_Y",
    CART_AUTO = "CART_AUTO"
}
declare enum PromotionDiscountType {
    PERCENTAGE = "PERCENTAGE",
    FIXED_AMOUNT = "FIXED_AMOUNT"
}
declare enum PromotionSyncSource {
    LOCAL = "POS_LOCAL",
    WOOCOMMERCE = "WC_STORE",
    SHOPIFY = "SHOPIFY_STORE"
}
declare enum ExchangeSource {
    POS = "POS",
    ONLINE_ORDER = "ONLINE_ORDER"
}
declare enum ExchangeStatus {
    COMPLETED = "COMPLETED",
    AWAITING_COURIER_PICKUP = "AWAITING_COURIER_PICKUP",
    CANCELLED = "CANCELLED"
}
declare enum ExchangeSettlementType {
    EVEN_EXCHANGE = "EVEN_EXCHANGE",
    CUSTOMER_PAYS = "CUSTOMER_PAYS",
    REFUND_CASH = "REFUND_CASH",
    STORE_CREDIT = "STORE_CREDIT"
}
declare enum ReturnItemCondition {
    SELLABLE = "SELLABLE",
    DAMAGED = "DAMAGED"
}
declare enum ExchangeItemDirection {
    RETURNED = "RETURNED",
    REPLACEMENT = "REPLACEMENT"
}
declare enum StoreCreditTransactionType {
    EARNED = "EARNED",
    REDEEMED = "REDEEMED",
    ADJUSTMENT = "ADJUSTMENT"
}

interface EasyfyCategory {
    id: number;
    name: string;
    slug: string;
    description?: string | null;
    image_path?: string | null;
    sort_order: number;
    is_active: boolean;
    products_count?: number;
}
interface EasyfyPriceTier {
    id?: number;
    min_qty: number;
    unit_price: number;
}
interface EasyfyProductImage {
    id: number;
    image_path: string;
    variant_id?: number | null;
    is_primary: boolean;
    sort_order: number;
}
interface EasyfyStockMovement {
    id: number;
    type: EasyfyStockMovementType | string;
    type_label?: string | null;
    quantity_delta: number;
    balance_after: number;
    unit_cost?: number | null;
    notes?: string | null;
    created_at?: string | null;
}
interface EasyfyProductVariant {
    id: number;
    product_id: number;
    sku?: string | null;
    label: string;
    attributes: Record<string, string>;
    cost_price?: number;
    selling_price: number;
    compare_at_price?: number | null;
    stock_quantity: number;
    low_stock_threshold: number;
    min_order_qty: number;
    is_active: boolean;
    product?: {
        id: number;
        name: string;
        stock_mode: EasyfyStockMode | string;
        is_active: boolean;
    };
    price_tiers?: EasyfyPriceTier[];
    stock_movements?: EasyfyStockMovement[];
}
interface EasyfyProduct {
    id: number;
    category_id?: number | null;
    category?: EasyfyCategory | null;
    name: string;
    slug: string;
    short_description?: string | null;
    description?: string | null;
    stock_mode: EasyfyStockMode | string;
    stock_mode_label?: string | null;
    lead_time_days?: number | null;
    min_order_qty: number;
    allow_custom_note: boolean;
    custom_note_label?: string | null;
    allow_artwork_upload: boolean;
    is_active: boolean;
    is_featured: boolean;
    images?: EasyfyProductImage[];
    variants?: EasyfyProductVariant[];
}
interface EasyfyInventoryOverview {
    low_stock_count: number;
    variants: EasyfyProductVariant[];
}
interface EasyfyCoupon {
    id: number;
    code: string;
    discount_type: EasyfyCouponType | string;
    discount_type_label?: string | null;
    discount_value: number;
    min_order_amount: number;
    max_discount_amount?: number | null;
    max_uses?: number | null;
    max_uses_per_account?: number | null;
    used_count: number;
    starts_at?: string | null;
    expires_at?: string | null;
    is_active: boolean;
}
interface EasyfyShippingZone {
    id: number;
    governorate_name: string;
    shipping_fee: number;
    free_shipping_threshold?: number | null;
    estimated_days?: string | null;
    is_active: boolean;
    sort_order: number;
}
interface EasyfyStoreSettings {
    store_enabled: boolean;
    cod_enabled: boolean;
    instapay_enabled: boolean;
    vodafone_cash_enabled: boolean;
    instapay_handle: string;
    instapay_name: string;
    vodafone_cash_number: string;
    default_shipping_fee: number;
    free_shipping_threshold: number | null;
    support_whatsapp: string;
    admin_notification_email: string;
    invoice_footer: string;
}
interface EasyfyOrderItem {
    id: number;
    product_id?: number | null;
    variant_id?: number | null;
    product_name: string;
    variant_label: string;
    sku?: string | null;
    stock_mode: EasyfyStockMode | string;
    quantity: number;
    unit_price: number;
    line_total: number;
    unit_cost?: number;
    line_cost?: number;
    line_profit?: number;
    custom_note?: string | null;
    has_artwork: boolean;
}
interface EasyfyOrderStatusHistory {
    id: number;
    from_status?: EasyfyOrderStatus | string | null;
    to_status: EasyfyOrderStatus | string;
    to_status_label?: string | null;
    actor_name?: string | null;
    note?: string | null;
    created_at?: string | null;
}
interface EasyfyOrder {
    id: number;
    order_number: string;
    status: EasyfyOrderStatus | string;
    status_label?: string | null;
    payment_method: EasyfyPaymentMethod | string;
    payment_method_label?: string | null;
    payment_verification_status: EasyfyPaymentStatus | string;
    payment_verification_label?: string | null;
    transfer_reference?: string | null;
    has_payment_proof: boolean;
    payment_rejection_reason?: string | null;
    verified_at?: string | null;
    verifier_name?: string | null;
    created_at?: string | null;
    account_id: number;
    store_code?: string | null;
    store_name?: string | null;
    owner_name?: string | null;
    owner_phone?: string | null;
    ordered_by_user_id?: number | null;
    ordered_by_name?: string | null;
    ordered_by_phone?: string | null;
    ordered_by_role?: string | null;
    recipient_name: string;
    recipient_phone: string;
    governorate: string;
    shipping_address: string;
    customer_notes?: string | null;
    courier_name?: string | null;
    tracking_number?: string | null;
    admin_notes?: string | null;
    subtotal: number;
    discount_amount: number;
    coupon_code?: string | null;
    shipping_fee: number;
    total_amount: number;
    total_cost?: number;
    gross_profit?: number;
    items?: EasyfyOrderItem[];
    status_histories?: EasyfyOrderStatusHistory[];
    shipping_zone?: EasyfyShippingZone | null;
}
interface EasyfyDemandRow {
    variant_id: number | null;
    product_name: string;
    variant_label: string;
    stock_mode: EasyfyStockMode | string;
    total_qty: number | string;
    orders_count: number | string;
    total_revenue: number | string;
    total_profit: number | string;
}
interface EasyfyDemandReport {
    top_overall: EasyfyDemandRow[];
    unlimited_and_custom_demand: EasyfyDemandRow[];
}
interface EasyfyDailySeriesPoint {
    day: string;
    orders_count: number;
    revenue: number;
    profit: number;
}
interface EasyfyStoreOverviewMetrics {
    orders_count: number;
    gross_revenue: number;
    total_cost: number;
    gross_profit: number;
    shipping_collected: number;
    avg_order_value: number;
    pending_orders_count: number;
    pending_payment_proofs_count: number;
    low_stock_variants_count: number;
    daily_30d_series: EasyfyDailySeriesPoint[];
    demand_report: EasyfyDemandReport;
}
interface AdminExpiringTrialItem {
    id: number;
    user_id: number;
    start_date: string;
    end_date: string;
    plan: string;
    user?: {
        id: number;
        name: string;
        phone: string;
        email?: string | null;
        business_name?: string | null;
        store_code?: string | null;
    } | null;
}
interface AdminCommandCenterOverview {
    platform: AdminStatsData;
    alerts: {
        expiring_trials_72h: AdminExpiringTrialItem[];
        pending_password_resets_count: number;
        new_inquiries_count: number;
    };
    easyfy_store: EasyfyStoreOverviewMetrics;
}
interface SaveEasyfyCategoryPayload {
    id?: number;
    name: string;
    slug?: string | null;
    description?: string | null;
    sort_order?: number;
    is_active?: boolean;
}
interface SaveEasyfyProductVariantInput {
    id?: number;
    sku?: string | null;
    label: string;
    attributes?: Record<string, string>;
    cost_price?: number | null;
    selling_price: number;
    compare_at_price?: number | null;
    stock_quantity?: number;
    low_stock_threshold?: number;
    min_order_qty?: number;
    is_active?: boolean;
    price_tiers?: Array<{
        min_qty: number;
        unit_price: number;
    }>;
}
interface SaveEasyfyProductPayload {
    id?: number;
    category_id?: number | null;
    name: string;
    slug?: string | null;
    short_description?: string | null;
    description?: string | null;
    stock_mode: EasyfyStockMode | string;
    lead_time_days?: number | null;
    min_order_qty?: number;
    allow_custom_note?: boolean;
    custom_note_label?: string | null;
    allow_artwork_upload?: boolean;
    is_active?: boolean;
    is_featured?: boolean;
    sort_order?: number;
    variants: SaveEasyfyProductVariantInput[];
}
interface SaveEasyfyCouponPayload {
    id?: number;
    code: string;
    discount_type: EasyfyCouponType | string;
    discount_value: number;
    min_order_amount?: number | null;
    max_discount_amount?: number | null;
    max_uses?: number | null;
    max_uses_per_account?: number | null;
    starts_at?: string | null;
    expires_at?: string | null;
    is_active?: boolean;
}
interface SaveEasyfyShippingZonePayload {
    id?: number;
    governorate_name: string;
    shipping_fee: number;
    free_shipping_threshold?: number | null;
    estimated_days?: string | null;
    is_active?: boolean;
    sort_order?: number;
}
interface EasyfyStorefrontPayload {
    settings: EasyfyStoreSettings;
    categories: EasyfyCategory[];
    featured_products: EasyfyProduct[];
    shipping_zones: EasyfyShippingZone[];
}
interface EasyfyCartItem {
    id: number;
    variant_id: number;
    product_id: number;
    product_name: string;
    product_slug: string;
    variant_label: string;
    sku?: string | null;
    stock_mode: EasyfyStockMode | string;
    quantity: number;
    min_order_qty: number;
    unit_price: number;
    line_total: number;
    custom_note?: string | null;
    has_artwork: boolean;
    allow_custom_note: boolean;
    allow_artwork_upload: boolean;
    image_path?: string | null;
    price_tiers?: EasyfyPriceTier[];
}
interface EasyfyCart {
    id: number;
    coupon_code?: string | null;
    items_count: number;
    subtotal: number;
    items: EasyfyCartItem[];
}
interface EasyfyCheckoutPreview {
    subtotal: number;
    shipping_fee: number;
    discount_amount: number;
    coupon_code?: string | null;
    total_amount: number;
    free_shipping_threshold: number | null;
}
interface EasyfyStoreAddress {
    id: number;
    label: string;
    recipient_name: string;
    recipient_phone: string;
    shipping_zone_id?: number | null;
    governorate: string;
    address_line: string;
    notes?: string | null;
    is_default: boolean;
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
    image_url?: string | null;
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
    image_url?: string | null;
    notes?: string | null;
    variants?: ProductVariant[];
    batches?: ProductBatch[];
}
interface PartyCrmMetrics {
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
interface PartyInteraction {
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
interface Party extends BaseEntity {
    type: PartyType;
    name: string;
    phone?: string | null;
    phone2?: string | null;
    address?: string | null;
    balance: number;
    store_credit_balance?: number;
    notes?: string | null;
    invoices_count?: number;
    interactions_count?: number;
    has_transactions?: boolean;
    crm_tier_override?: CustomerTier | null;
    crm_metrics?: PartyCrmMetrics | null;
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
    effective_return_unit_price?: number;
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
    parent_invoice_id?: number | null;
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
interface Promotion {
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
interface PromotionEvaluation {
    promotion_id: number | null;
    coupon_code: string | null;
    promotion_name: string | null;
    promotion_type: PromotionType | string | null;
    promotion_discount: number;
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
    image_url?: string | null;
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
interface CashFlowTransaction {
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
interface CashFlowTransactionsResponse {
    success: boolean;
    data: CashFlowTransaction[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
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
interface LicenseKey extends BaseEntity {
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
interface AdminAuditLogItem {
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
interface OnlineOrderItem {
    id?: number;
    online_order_id: number;
    product_id?: number | null;
    product_variant_id?: number | null;
    external_product_id?: string | null;
    external_variant_id?: string | null;
    quantity: number;
}
interface OnlineOrder extends BaseEntity {
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
type WcOrderItem = OnlineOrderItem;
type WcOrder = OnlineOrder;
interface StockAlertsSummary {
    out_of_stock_count: number;
    low_stock_count: number;
    expiring_batches_count: number;
    total_alerts: number;
}
interface LowStockAlertItem {
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
interface ExpiringBatchAlertItem {
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
interface StockAlertsResponse {
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
interface StockMovementRecord {
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
interface PurchaseReportData {
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
interface FinancialClosingReportData {
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
interface ReceivablesPayablesBucketParty {
    id: number;
    name: string;
    phone?: string | null;
    type: PartyType;
    balance: number;
    last_activity_date?: string | null;
    days_since_activity?: number | null;
    aging_bucket: 'CURRENT' | 'DAYS_31_60' | 'DAYS_60_PLUS';
}
interface ReceivablesPayablesAgingBuckets {
    current_0_30: number;
    days_31_60: number;
    days_60_plus: number;
}
interface ReceivablesPayablesReportData {
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
interface ExchangeItemRow {
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
interface ExchangeRecord {
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
interface StoreCreditTransactionRecord {
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

declare const LoginSchema: z.ZodObject<{
    store_code: z.ZodString;
    phone: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    store_code: string;
    phone: string;
    password: string;
}, {
    store_code: string;
    phone: string;
    password: string;
}>;
declare const RegisterSchema: z.ZodObject<{
    store_code: z.ZodEffects<z.ZodString, string, string>;
    name: z.ZodString;
    phone: z.ZodString;
    password: z.ZodString;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    store_code: string;
    phone: string;
    password: string;
    name: string;
    email: string;
}, {
    store_code: string;
    phone: string;
    password: string;
    name: string;
    email: string;
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
    image_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
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
    image_url?: string | null | undefined;
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
    image_url?: string | null | undefined;
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
    image_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
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
        image_url: z.ZodNullable<z.ZodOptional<z.ZodString>>;
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
        image_url?: string | null | undefined;
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
        image_url?: string | null | undefined;
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
    image_url?: string | null | undefined;
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
        image_url?: string | null | undefined;
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
    image_url?: string | null | undefined;
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
        image_url?: string | null | undefined;
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
    date: string;
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
    date: string;
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
    date: string;
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
    date: string;
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
declare function getPaymentMethodLabel(method?: string | null): string;
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

export { type AdminAuditLogItem, type AdminCommandCenterOverview, type AdminExpiringTrialItem, type AdminStatsData, type ApiResponse, BarcodeFormat, BarcodeLabelSize, type BarcodePrintItemInput, BarcodePrintItemSchema, type BarcodePrintRequestInput, BarcodePrintRequestSchema, type BaseEntity, type Branch, type BranchInput, BranchSchema, type BranchStock, BranchType, type CalculationItem, type CashFlowReportData, type CashFlowTransaction, type CashFlowTransactionsResponse, type Category, CategorySchema, CommissionType, CrmRiskLevel, CustomerInteractionChannel, CustomerTier, type DashboardSummary, type EasyfyCart, type EasyfyCartItem, type EasyfyCategory, type EasyfyCheckoutPreview, type EasyfyCoupon, EasyfyCouponType, type EasyfyDailySeriesPoint, type EasyfyDemandReport, type EasyfyDemandRow, type EasyfyInventoryOverview, type EasyfyOrder, type EasyfyOrderItem, EasyfyOrderStatus, type EasyfyOrderStatusHistory, EasyfyPaymentMethod, EasyfyPaymentStatus, type EasyfyPriceTier, type EasyfyProduct, type EasyfyProductImage, type EasyfyProductVariant, type EasyfyShippingZone, EasyfyStockMode, type EasyfyStockMovement, EasyfyStockMovementType, type EasyfyStoreAddress, type EasyfyStoreOverviewMetrics, type EasyfyStoreSettings, type EasyfyStorefrontPayload, EcommercePlatform, EmployeeAdjustmentType, type EmployeeInput, EmployeeSchema, ExchangeItemDirection, type ExchangeItemRow, type ExchangeRecord, ExchangeSettlementType, ExchangeSource, ExchangeStatus, type Expense, type ExpenseInput, ExpenseSchema, type ExpiringBatchAlertItem, ExpiryStatus, type FinancialClosingReportData, type Invoice, type InvoiceCalculations, type InvoiceInput, type InvoiceItem, type InvoiceItemInput, InvoiceItemSchema, InvoiceReturnStatus, InvoiceSchema, InvoiceType, type LedgerEntry, LedgerSource, type LicenseKey, type LoginInput, LoginSchema, type LowStockAlertItem, Money, type OnlineOrder, OnlineOrderCallStatus, type OnlineOrderItem, OrderCancelReason, type PaginatedResponse, type Party, type PartyCrmMetrics, type PartyInput, type PartyInteraction, PartySchema, PartyType, type Payment, type PaymentInput, PaymentMethod, PaymentSchema, type Product, type ProductBatch, type ProductInput, ProductSchema, ProductType, type ProductVariant, type ProductVariantInput, ProductVariantSchema, type ProfitReportData, type Promotion, PromotionDiscountType, type PromotionEvaluation, PromotionSyncSource, PromotionType, type PurchaseReportData, type ReceivablesPayablesAgingBuckets, type ReceivablesPayablesBucketParty, type ReceivablesPayablesReportData, type RegisterInput, RegisterSchema, ReturnItemCondition, type SalesReportData, type SaveEasyfyCategoryPayload, type SaveEasyfyCouponPayload, type SaveEasyfyProductPayload, type SaveEasyfyProductVariantInput, type SaveEasyfyShippingZonePayload, ShiftStatus, ShopifyAuthMode, type SplitPaymentItem, StockAdjustmentMode, type StockAlertsResponse, type StockAlertsSummary, type StockMovement, type StockMovementRecord, StockMovementSource, StockMovementType, type StockReportData, type StockReportItem, type StockTransfer, type StockTransferInput, type StockTransferItem, type StockTransferItemInput, StockTransferItemSchema, StockTransferSchema, StockTransferStatus, type StoreCreditTransactionRecord, StoreCreditTransactionType, type StoreIdentity, type Subscription, SubscriptionPlan, SubscriptionStatus, type Treasury, type TreasuryBreakdown, TreasuryTransactionSource, TreasuryTransactionType, TreasuryType, type Unit, type User, UserRole, UserStatus, type WcOrder, type WcOrderItem, WcOrderStatus, WcPaymentStatus, calculateInvoiceTotals, calculateNetProfit, calculatePartyBalanceImpact, formatCurrency, formatDate, formatDateTime, formatNumber, getPaymentMethodLabel };
