<?php

namespace App\Services\Easyfy;

use App\Enums\Easyfy\EasyfyOrderStatus;
use App\Enums\Easyfy\EasyfyPaymentStatus;
use App\Enums\Easyfy\EasyfyStockMode;
use App\Enums\PasswordResetRequestStatus;
use App\Enums\StoreInquiryStatus;
use App\Models\Easyfy\EasyfyOrder;
use App\Models\Easyfy\EasyfyOrderItem;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\PasswordResetRequest;
use App\Models\StoreInquiry;
use App\Models\Subscription;
use App\Services\AdminStatsService;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class EasyfyAnalyticsService
{
    public function __construct(private readonly AdminStatsService $adminStatsService) {}

    public function getCommandCenterOverview(): array
    {
        $platform = $this->adminStatsService->getPlatformStats();
        $expiringTrials = Subscription::with('user:id,name,phone,email,business_name,store_code')
            ->where('plan', 'TRIAL')
            ->whereBetween('end_date', [now()->toDateString(), now()->addDays(3)->toDateString()])
            ->orderBy('end_date')
            ->limit(15)
            ->get();

        return [
            'platform' => $platform,
            'alerts' => [
                'expiring_trials_72h' => $expiringTrials,
                'pending_password_resets_count' => PasswordResetRequest::whereNull('owner_id')->where('status', PasswordResetRequestStatus::PENDING->value)->count(),
                'new_inquiries_count' => StoreInquiry::where('status', StoreInquiryStatus::NEW->value)->count(),
            ],
            'easyfy_store' => $this->getStoreOverviewMetrics(),
        ];
    }

    public function getStoreOverviewMetrics(): array
    {
        $validOrders = EasyfyOrder::where('status', '!=', EasyfyOrderStatus::CANCELLED->value);
        $agg = (clone $validOrders)->selectRaw('COUNT(*) as orders_cnt, SUM(total_amount) as rev, SUM(total_cost) as cogs, SUM(gross_profit) as profit, SUM(shipping_fee) as ship')->first();
        $ordersCount = (int) ($agg->orders_cnt ?? 0);
        $revenue = Money::of($agg->rev ?? 0);

        return [
            'orders_count' => $ordersCount,
            'gross_revenue' => $revenue->getAmount(),
            'total_cost' => Money::of($agg->cogs ?? 0)->getAmount(),
            'gross_profit' => Money::of($agg->profit ?? 0)->getAmount(),
            'shipping_collected' => Money::of($agg->ship ?? 0)->getAmount(),
            'avg_order_value' => $ordersCount > 0 ? $revenue->divide($ordersCount)->getAmount() : 0,
            'pending_orders_count' => EasyfyOrder::whereIn('status', [EasyfyOrderStatus::PENDING->value, EasyfyOrderStatus::CONFIRMED->value, EasyfyOrderStatus::PREPARING->value])->count(),
            'pending_payment_proofs_count' => EasyfyOrder::where('payment_verification_status', EasyfyPaymentStatus::PENDING_REVIEW->value)->where('status', '!=', EasyfyOrderStatus::CANCELLED->value)->count(),
            'low_stock_variants_count' => $this->countLowStockVariants(),
            'daily_30d_series' => $this->buildDaily30dSeries(),
            'demand_report' => $this->getUnlimitedAndTopDemandReport(),
        ];
    }

    public function getUnlimitedAndTopDemandReport(): array
    {
        $rows = EasyfyOrderItem::query()
            ->join('easyfy_orders', 'easyfy_orders.id', '=', 'easyfy_order_items.order_id')
            ->where('easyfy_orders.status', '!=', EasyfyOrderStatus::CANCELLED->value)
            ->groupBy('easyfy_order_items.variant_id', 'easyfy_order_items.product_name', 'easyfy_order_items.variant_label', 'easyfy_order_items.stock_mode')
            ->selectRaw('easyfy_order_items.variant_id, easyfy_order_items.product_name, easyfy_order_items.variant_label, easyfy_order_items.stock_mode, SUM(easyfy_order_items.quantity) as total_qty, COUNT(DISTINCT easyfy_order_items.order_id) as orders_count, SUM(easyfy_order_items.line_total) as total_revenue, SUM(easyfy_order_items.line_profit) as total_profit')
            ->orderByDesc('total_qty')
            ->limit(25)
            ->get();

        return [
            'top_overall' => $rows->take(10)->values(),
            'unlimited_and_custom_demand' => $rows->filter(fn ($r) => $r->stock_mode !== EasyfyStockMode::TRACKED->value)->values(),
        ];
    }

    private function countLowStockVariants(): int
    {
        return EasyfyProductVariant::whereHas('product', fn ($q) => $q->where('stock_mode', EasyfyStockMode::TRACKED->value))
            ->whereColumn('stock_quantity', '<=', 'low_stock_threshold')
            ->count();
    }

    private function buildDaily30dSeries(): array
    {
        return EasyfyOrder::where('status', '!=', EasyfyOrderStatus::CANCELLED->value)
            ->where('created_at', '>=', now()->subDays(29)->startOfDay())
            ->groupBy(DB::raw('DATE(created_at)'))
            ->orderBy(DB::raw('DATE(created_at)'))
            ->selectRaw('DATE(created_at) as day, COUNT(*) as orders_count, SUM(total_amount) as revenue, SUM(gross_profit) as profit')
            ->get()
            ->map(fn ($r) => ['day' => $r->day, 'orders_count' => (int) $r->orders_count, 'revenue' => Money::of($r->revenue ?? 0)->getAmount(), 'profit' => Money::of($r->profit ?? 0)->getAmount()])
            ->values()
            ->all();
    }
}
