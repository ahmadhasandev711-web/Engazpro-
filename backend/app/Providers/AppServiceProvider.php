<?php

namespace App\Providers;

use App\Models\Category;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Product;
use App\Policies\CategoryPolicy;
use App\Policies\ExpensePolicy;
use App\Policies\InvoicePolicy;
use App\Policies\PartyPolicy;
use App\Policies\PaymentPolicy;
use App\Policies\ProductPolicy;
use App\Policies\ReportPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(
            \App\Contracts\WooCommerceApiClientInterface::class,
            \App\Services\WooCommerce\WooCommerceApiClient::class
        );
        $this->app->bind(
            \App\Contracts\HostResolver::class,
            \App\Services\DnsHostResolver::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(Product::class, ProductPolicy::class);
        Gate::policy(Invoice::class, InvoicePolicy::class);
        Gate::policy(Party::class, PartyPolicy::class);
        Gate::policy(Payment::class, PaymentPolicy::class);
        Gate::policy(Expense::class, ExpensePolicy::class);
        Gate::policy(Category::class, CategoryPolicy::class);
        Gate::policy(\App\Models\User::class, \App\Policies\EmployeePolicy::class);
        Gate::policy(\App\Models\Branch::class, \App\Policies\BranchPolicy::class);
        Gate::policy(\App\Models\StockTransfer::class, \App\Policies\StockTransferPolicy::class);
        Gate::policy(\App\Models\Treasury::class, \App\Policies\TreasuryPolicy::class);
        Gate::policy(\App\Models\PayrollPayout::class, \App\Policies\PayrollPolicy::class);

        Gate::define('view-profit', [ReportPolicy::class, 'viewProfit']);
        Gate::define('view-cash-flow', [ReportPolicy::class, 'viewCashFlow']);
        Gate::define('view-sales', [ReportPolicy::class, 'viewSales']);
        Gate::define('view-stock', [ReportPolicy::class, 'viewStock']);

        \App\Models\BranchStock::observe(\App\Observers\BranchStockWooCommerceObserver::class);
        \App\Models\Party::observe(\App\Observers\PartyWooCommerceObserver::class);

        \Illuminate\Support\Facades\RateLimiter::for('api', function (\Illuminate\Http\Request $request) {
            return \Illuminate\Cache\RateLimiting\Limit::perMinute((int) config('pos.security.api_per_minute', 300))
                ->by($request->user()?->id ?: $request->ip());
        });

        \Illuminate\Support\Facades\RateLimiter::for('login', function (\Illuminate\Http\Request $request) {
            $phone = preg_replace('/\D+/', '', (string) $request->input('phone'));
            $key = !empty($phone) ? $phone : $request->ip();
            return \Illuminate\Cache\RateLimiting\Limit::perMinute((int) config('pos.security.login_per_minute', 5))
                ->by($key);
        });

        \Illuminate\Support\Facades\RateLimiter::for('webhook', function (\Illuminate\Http\Request $request) {
            $userId = (string) $request->route('userId');
            $key = !empty($userId) ? 'wh_user_' . $userId : $request->ip();
            return \Illuminate\Cache\RateLimiting\Limit::perMinute((int) config('pos.security.webhook_per_minute', 600))
                ->by($key);
        });
    }
}
