import {
  EasyfyCouponType,
  EasyfyOrderStatus,
  EasyfyPaymentMethod,
  EasyfyPaymentStatus,
  EasyfyStockMode,
  EasyfyStockMovementType,
} from '../enums/easyfy';
import type { AdminStatsData } from './index';

export interface EasyfyCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image_path?: string | null;
  sort_order: number;
  is_active: boolean;
  products_count?: number;
}

export interface EasyfyPriceTier {
  id?: number;
  min_qty: number;
  unit_price: number;
}

export interface EasyfyProductImage {
  id: number;
  image_path: string;
  variant_id?: number | null;
  is_primary: boolean;
  sort_order: number;
}

export interface EasyfyStockMovement {
  id: number;
  type: EasyfyStockMovementType | string;
  type_label?: string | null;
  quantity_delta: number;
  balance_after: number;
  unit_cost?: number | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface EasyfyProductVariant {
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

export interface EasyfyProduct {
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

export interface EasyfyInventoryOverview {
  low_stock_count: number;
  variants: EasyfyProductVariant[];
}

export interface EasyfyCoupon {
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

export interface EasyfyShippingZone {
  id: number;
  governorate_name: string;
  shipping_fee: number;
  free_shipping_threshold?: number | null;
  estimated_days?: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface EasyfyStoreSettings {
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

export interface EasyfyOrderItem {
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

export interface EasyfyOrderStatusHistory {
  id: number;
  from_status?: EasyfyOrderStatus | string | null;
  to_status: EasyfyOrderStatus | string;
  to_status_label?: string | null;
  actor_name?: string | null;
  note?: string | null;
  created_at?: string | null;
}

export interface EasyfyOrder {
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

export interface EasyfyDemandRow {
  variant_id: number | null;
  product_name: string;
  variant_label: string;
  stock_mode: EasyfyStockMode | string;
  total_qty: number | string;
  orders_count: number | string;
  total_revenue: number | string;
  total_profit: number | string;
}

export interface EasyfyDemandReport {
  top_overall: EasyfyDemandRow[];
  unlimited_and_custom_demand: EasyfyDemandRow[];
}

export interface EasyfyDailySeriesPoint {
  day: string;
  orders_count: number;
  revenue: number;
  profit: number;
}

export interface EasyfyStoreOverviewMetrics {
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

export interface AdminExpiringTrialItem {
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

export interface AdminCommandCenterOverview {
  platform: AdminStatsData;
  alerts: {
    expiring_trials_72h: AdminExpiringTrialItem[];
    pending_password_resets_count: number;
    new_inquiries_count: number;
  };
  easyfy_store: EasyfyStoreOverviewMetrics;
}

export interface SaveEasyfyCategoryPayload {
  id?: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface SaveEasyfyProductVariantInput {
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
  price_tiers?: Array<{ min_qty: number; unit_price: number }>;
}

export interface SaveEasyfyProductPayload {
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

export interface SaveEasyfyCouponPayload {
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

export interface SaveEasyfyShippingZonePayload {
  id?: number;
  governorate_name: string;
  shipping_fee: number;
  free_shipping_threshold?: number | null;
  estimated_days?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface EasyfyStorefrontPayload {
  settings: EasyfyStoreSettings;
  categories: EasyfyCategory[];
  featured_products: EasyfyProduct[];
  shipping_zones: EasyfyShippingZone[];
}

export interface EasyfyCartItem {
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

export interface EasyfyCart {
  id: number;
  coupon_code?: string | null;
  items_count: number;
  subtotal: number;
  items: EasyfyCartItem[];
}

export interface EasyfyCheckoutPreview {
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  coupon_code?: string | null;
  total_amount: number;
  free_shipping_threshold: number | null;
}

export interface EasyfyStoreAddress {
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
