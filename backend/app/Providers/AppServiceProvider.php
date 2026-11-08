<?php

namespace App\Providers;

use App\Contracts\AnoofySignatureVerifierInterface;
use App\Contracts\HostResolver;
use App\Contracts\WooCommerceApiClientInterface;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Category;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Payment;
use App\Models\PayrollPayout;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\Treasury;
use App\Models\User;
use App\Models\WcOrder;
use App\Observers\BranchStockWooCommerceObserver;
use App\Observers\PartyWooCommerceObserver;
use App\Observers\WcOrderAnoofyStageObserver;
use App\Observers\WcOrderStockSyncObserver;
use App\Policies\BranchPolicy;
use App\Policies\CategoryPolicy;
use App\Policies\EmployeePolicy;
use App\Policies\ExpensePolicy;
use App\Policies\InvoicePolicy;
use App\Policies\PartyPolicy;
use App\Enums\AnoofyEventType;
use App\Policies\PaymentPolicy;
use App\Policies\PayrollPolicy;
use App\Policies\ProductPolicy;
use App\Policies\ReportPolicy;
use App\Policies\StockTransferPolicy;
use App\Policies\TreasuryPolicy;
use App\Services\Anoofy\AnoofyHandlerRegistry;
use App\Services\Anoofy\Handlers\ConnectionVerifyHandler;
use App\Services\Anoofy\Handlers\OrderConfirmedHandler;
use App\Services\Anoofy\HmacSha256SignatureVerifier;
use App\Services\DnsHostResolver;
use App\Services\WooCommerce\WooCommerceApiClient;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            WooCommerceApiClientInterface::class,
            WooCommerceApiClient::class
        );
        $this->app->bind(
            HostResolver::class,
            DnsHostResolver::class
        );
        $this->app->bind(
            AnoofySignatureVerifierInterface::class,
            HmacSha256SignatureVerifier::class
        );
        $this->app->singleton(AnoofyHandlerRegistry::class, function () {
            $registry = new AnoofyHandlerRegistry();
            $registry->register(AnoofyEventType::CONNECTION_VERIFY, ConnectionVerifyHandler::class);
            $registry->register(AnoofyEventType::ORDER_CONFIRMED, OrderConfirmedHandler::class);
            return $registry;
        });
    }

    public function boot(): void
    {
        $this->registerPolicies();
        $this->registerGates();
        $this->registerObservers();
        $this->registerRateLimiters();
    }

    private function registerPolicies(): void
    {
        Gate::policy(Product::class, ProductPolicy::class);
        Gate::policy(Invoice::class, InvoicePolicy::class);
        Gate::policy(Party::class, PartyPolicy::class);
        Gate::policy(Payment::class, PaymentPolicy::class);
        Gate::policy(Expense::class, ExpensePolicy::class);
        Gate::policy(Category::class, CategoryPolicy::class);
        Gate::policy(User::class, EmployeePolicy::class);
        Gate::policy(Branch::class, BranchPolicy::class);
        Gate::policy(StockTransfer::class, StockTransferPolicy::class);
        Gate::policy(Treasury::class, TreasuryPolicy::class);
        Gate::policy(PayrollPayout::class, PayrollPolicy::class);
    }

    private function registerGates(): void
    {
        Gate::define('view-profit', [ReportPolicy::class, 'viewProfit']);
        Gate::define('view-cash-flow', [ReportPolicy::class, 'viewCashFlow']);
        Gate::define('view-sales', [ReportPolicy::class, 'viewSales']);
        Gate::define('view-stock', [ReportPolicy::class, 'viewStock']);
    }

    private function registerObservers(): void
    {
        BranchStock::observe(BranchStockWooCommerceObserver::class);
        Party::observe(PartyWooCommerceObserver::class);
        WcOrder::observe(WcOrderStockSyncObserver::class);
        WcOrder::observe(WcOrderAnoofyStageObserver::class);
    }

    private function registerRateLimiters(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute((int) config('pos.security.api_per_minute', 300))
                ->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('login', function (Request $request) {
            $phone = preg_replace('/\D+/', '', (string) $request->input('phone'));
            $key = !empty($phone) ? $phone : $request->ip();
            return Limit::perMinute((int) config('pos.security.login_per_minute', 5))->by($key);
        });

        RateLimiter::for('webhook', function (Request $request) {
            $userId = (string) $request->route('userId');
            $key = !empty($userId) ? 'wh_user_' . $userId : $request->ip();
            return Limit::perMinute((int) config('pos.security.webhook_per_minute', 600))->by($key);
        });

        RateLimiter::for('anoofy_inbound', function (Request $request) {
            $kid = (string) $request->header('X-Anoofy-Key-Id');
            $key = !empty($kid) ? 'anoofy_kid_' . $kid : $request->ip();
            return Limit::perMinute((int) config('pos.anoofy.rate_limit_per_minute', 120))->by($key);
        });
    }
}
