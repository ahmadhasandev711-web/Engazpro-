<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BarcodeController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\ImportExportController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\LedgerController;
use App\Http\Controllers\Api\PartyController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\StockTransferController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\TreasuryController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public Authentication Routes (Protected by Rate Limiter)
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:30,1');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
});

// WooCommerce Incoming Webhooks (Public endpoint with HMAC signature verification)
Route::post('webhooks/woocommerce/{userId}', [\App\Http\Controllers\Api\WooCommerceWebhookController::class, 'handle'])->middleware('throttle:webhook');
// Shopify Incoming Webhooks (Public endpoint with X-Shopify-Hmac-Sha256 verification)
Route::post('webhooks/shopify/{userId}', [\App\Http\Controllers\Api\ShopifyWebhookController::class, 'handle'])->middleware('throttle:webhook');
// WooCommerce 1-Click OAuth Callback (Public endpoint called by WordPress)
Route::post('woocommerce/auth-callback', [\App\Http\Controllers\Api\WooCommerceAuthController::class, 'authCallback'])->middleware('throttle:webhook');
// Shopify OAuth Callback (Public endpoint redirected from Shopify)
Route::get('shopify/auth-callback', [\App\Http\Controllers\Api\ShopifyAuthController::class, 'callback'])->middleware('throttle:webhook');
// Anoofy Inbound Events (Public endpoint with HMAC-SHA256 signature verification)
Route::post('webhooks/anoofy/events', \App\Http\Controllers\Api\AnoofyInboundController::class)
    ->middleware('throttle:anoofy_inbound')
    ->name('anoofy.inbound');

// Public Landing Page Pricing & Store Creation Inquiries
Route::get('public/pricing', \App\Http\Controllers\Api\PublicPricingController::class)->middleware('throttle:60,1');
Route::post('landing/inquiries', [\App\Http\Controllers\Api\StoreInquiryController::class, 'submitPublic'])->middleware('throttle:15,1');

// Production cache refresh without SSH. Secret required. Migrations are not run here.
Route::get('ops/maintenance-sync-7b3e9a', [\App\Http\Controllers\Api\DeployMaintenanceController::class, 'clearCache'])->middleware('throttle:5,1');

// Authenticated Routes
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    // Auth Management
    Route::prefix('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });

    // Subscription Management
    Route::prefix('subscription')->group(function () {
        Route::get('/status', [SubscriptionController::class, 'status']);
        Route::post('/activate-code', [SubscriptionController::class, 'activateCode'])
            ->middleware('throttle:activation');
    });

    // Operational Routes (Must have Active Subscription)
    Route::middleware('subscription')->group(function () {
        // Products & Categories
        Route::apiResource('categories', CategoryController::class);
        Route::get('products/lookup', [ProductController::class, 'lookup']);
        Route::get('products/pos-catalog', [ProductController::class, 'posCatalog']);
        Route::post('products/opening-balance', [ProductController::class, 'recordOpeningBalance']);
        Route::post('products/{id}/batches', [ProductController::class, 'addBatch']);
        Route::post('products/{id}/image', [ProductController::class, 'uploadImage']);
        Route::delete('products/{id}/image', [ProductController::class, 'deleteImage']);
        Route::apiResource('products', ProductController::class);

        // Barcode Generation & Validation
        Route::prefix('barcodes')->group(function () {
            Route::get('generate', [BarcodeController::class, 'generate']);
            Route::post('validate', [BarcodeController::class, 'validateBarcode']);
        });

        // Parties (Customers & Suppliers & Couriers)
        Route::apiResource('parties', PartyController::class);

        // Couriers Management & Shipment Manifest (إدارة شركات الشحن وكشف البوالص والتسويات)
        Route::prefix('couriers')->group(function () {
            Route::get('/', [\App\Http\Controllers\Api\CourierController::class, 'index']);
            Route::get('{id}/manifest', [\App\Http\Controllers\Api\CourierController::class, 'manifest']);
            Route::post('{id}/settle', [\App\Http\Controllers\Api\CourierController::class, 'settleNet']);
        });

        // Invoices (Sales, Purchases, Returns)
        Route::get('invoices/by-number/{invoiceNumber}', [InvoiceController::class, 'findByNumber']);
        Route::patch('invoices/{id}/salesperson', [InvoiceController::class, 'updateSalesperson']);
        Route::apiResource('invoices', InvoiceController::class)->except(['update']);

        // Payments (Receipts & Payments)
        Route::apiResource('payments', PaymentController::class)->except(['update']);

        // Expenses & Categories
        Route::apiResource('expenses', ExpenseController::class);
        Route::apiResource('expense-categories', \App\Http\Controllers\Api\ExpenseCategoryController::class);

        // Employees & Team Members (إدارة فريق العمل والمناديب)
        Route::apiResource('employees', EmployeeController::class);

        // Payroll & Sales Commissions (مسير الرواتب وعمولات المبيعات والتسويات)
        Route::prefix('payroll')->group(function () {
            Route::get('{employeeId}/summary', [\App\Http\Controllers\Api\PayrollController::class, 'summary']);
            Route::post('{employeeId}/adjustments', [\App\Http\Controllers\Api\PayrollController::class, 'addAdjustment']);
            Route::delete('adjustments/{adjustmentId}', [\App\Http\Controllers\Api\PayrollController::class, 'deleteAdjustment']);
            Route::post('{employeeId}/disburse', [\App\Http\Controllers\Api\PayrollController::class, 'disburse']);
        });

        // Treasuries (إدارة الخزن والأرصدة والتحويل المالي)
        Route::prefix('treasuries')->group(function () {
            Route::get('/', [TreasuryController::class, 'index']);
            Route::post('/', [TreasuryController::class, 'store']);
            Route::put('/{id}', [TreasuryController::class, 'update']);
            Route::post('/transfer', [TreasuryController::class, 'transfer']);
            Route::get('/{id}', [TreasuryController::class, 'show']);
            Route::get('/{id}/transactions', [TreasuryController::class, 'transactions']);
        });

        // Shifts (الورديات والعهد وتوريد النقدية)
        Route::prefix('shifts')->group(function () {
            Route::get('/active', [ShiftController::class, 'active']);
            Route::post('/open', [ShiftController::class, 'open']);
            Route::post('/close', [ShiftController::class, 'close']);
            Route::get('/', [ShiftController::class, 'index']);
            Route::get('/{id}', [ShiftController::class, 'show']);
            Route::post('/{id}/settle', [ShiftController::class, 'settle']);
        });

        // Branches & Warehouses (إدارة الفروع والمخازن)
        Route::get('branches/{branch}/inventory', [BranchController::class, 'inventory']);
        Route::apiResource('branches', BranchController::class);

        // Stock Transfers (التحويلات المخزنية بين الفروع)
        Route::post('stock-transfers/{stockTransfer}/receive', [StockTransferController::class, 'receive']);
        Route::post('stock-transfers/{stockTransfer}/cancel', [StockTransferController::class, 'cancel']);
        Route::apiResource('stock-transfers', StockTransferController::class)->except(['update', 'destroy']);

        // Stock Operations, Alerts & Movements Ledger (إشعارات النواقص، تسوية الجرد، ودفتر الحركات)
        Route::prefix('stock')->group(function () {
            Route::get('alerts/summary', [\App\Http\Controllers\Api\StockOperationsController::class, 'alertsSummary']);
            Route::get('alerts', [\App\Http\Controllers\Api\StockOperationsController::class, 'alerts']);
            Route::post('adjust', [\App\Http\Controllers\Api\StockOperationsController::class, 'adjust']);
            Route::get('movements', [\App\Http\Controllers\Api\StockOperationsController::class, 'movements']);
        });

        // Dashboard (لوحة القيادة والدفتر الذكي)
        Route::get('dashboard', [DashboardController::class, 'index']);

        // Ledger (كشف حساب)
        Route::get('ledger/{party}', [LedgerController::class, 'statement']);

        // Reports (التقارير والأرباح والخزينة)
        Route::prefix('reports')->group(function () {
            Route::get('profit', [ReportController::class, 'profit']);
            Route::get('sales', [ReportController::class, 'sales']);
            Route::get('stock', [ReportController::class, 'stock']);
            Route::get('purchases', [ReportController::class, 'purchases']);
            Route::get('cash-flow', [ReportController::class, 'cashFlow']);
            Route::get('cash-flow/transactions', [ReportController::class, 'cashFlowTransactions']);
        });

        // Import & Export (الاستيراد والتصدير)
        Route::prefix('import')->group(function () {
            Route::post('products/preview', [ImportExportController::class, 'previewProducts']);
            Route::post('products/commit', [ImportExportController::class, 'commitProducts']);
        });
        Route::prefix('export')->group(function () {
            Route::get('template/products', [ImportExportController::class, 'productsTemplate']);
        });

        // E-Commerce Store Integrations & Online Orders (مقفول افتراضياً ويُفتح من السوبر أدمن)
        Route::middleware('ecommerce')->group(function () {
            // WooCommerce Integration (ربط ومزامنة متجر ووكومرس)
            Route::prefix('woocommerce')->group(function () {
                Route::get('authorize-url', [\App\Http\Controllers\Api\WooCommerceAuthController::class, 'authorizeUrl']);
                Route::get('settings', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'getSettings']);
                Route::post('settings', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'saveSettings']);
                Route::post('test-connection', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'testConnection']);
                Route::post('import-products', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'importProducts']);
                Route::post('sync-customers', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'syncCustomers']);
                Route::post('register-webhooks', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'autoRegisterWebhooks']);
                Route::post('products/{product}/push-stock', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'pushProductStock']);
                Route::post('push-all-stocks', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'pushAllStocks']);
                Route::post('anoofy/connection-key', [\App\Http\Controllers\Api\AnoofyConnectionController::class, 'generateKey']);
                Route::delete('anoofy/connection', [\App\Http\Controllers\Api\AnoofyConnectionController::class, 'disconnect']);
            });

            // Unified Online Store Orders & Dispatch (طلبات المتجر والشحن والتسليم الميداني)
            Route::prefix('online-orders')->group(function () {
                Route::get('/', [\App\Http\Controllers\Api\OnlineOrderController::class, 'index']);
                Route::post('pull', [\App\Http\Controllers\Api\OnlineOrderController::class, 'pull']);
                Route::get('/{id}', [\App\Http\Controllers\Api\OnlineOrderController::class, 'show']);
                Route::post('/{id}/confirm', [\App\Http\Controllers\Api\OnlineOrderController::class, 'confirm']);
                Route::post('/{id}/dispatch', [\App\Http\Controllers\Api\OnlineOrderController::class, 'dispatchToMandob']);
                Route::post('/{id}/dispatch-courier', [\App\Http\Controllers\Api\OnlineOrderController::class, 'dispatchCourier']);
                Route::post('/{id}/deliver', [\App\Http\Controllers\Api\OnlineOrderController::class, 'deliver']);
                Route::post('/{id}/return', [\App\Http\Controllers\Api\OnlineOrderController::class, 'returnOrder']);
                Route::post('/{id}/log-call', [\App\Http\Controllers\Api\OnlineOrderController::class, 'logCall']);
                Route::post('/{id}/cancel', [\App\Http\Controllers\Api\OnlineOrderController::class, 'cancel']);
            });

            // Shopify Integration (ربط ومزامنة متجر شوبيفاي)
            Route::prefix('shopify')->group(function () {
                Route::get('authorize-url', [\App\Http\Controllers\Api\ShopifyAuthController::class, 'authorizeUrl']);
                Route::get('settings', [\App\Http\Controllers\Api\ShopifySettingsController::class, 'getSettings']);
                Route::post('settings', [\App\Http\Controllers\Api\ShopifySettingsController::class, 'saveSettings']);
                Route::post('test-connection', [\App\Http\Controllers\Api\ShopifySettingsController::class, 'testConnection']);
                Route::post('sync-locations', [\App\Http\Controllers\Api\ShopifySettingsController::class, 'syncLocations']);
                Route::post('location-mappings', [\App\Http\Controllers\Api\ShopifySettingsController::class, 'saveLocationMappings']);
                Route::post('register-webhooks', [\App\Http\Controllers\Api\ShopifySettingsController::class, 'registerWebhooks']);
                Route::post('import-products', [\App\Http\Controllers\Api\ShopifySettingsController::class, 'importProducts']);
                Route::post('products/{product}/push-stock', [\App\Http\Controllers\Api\ShopifySettingsController::class, 'pushProductStock']);
                Route::post('push-all-stocks', [\App\Http\Controllers\Api\ShopifySettingsController::class, 'pushAllStocks']);
            });
        });

        // Store Settings & Identity (هوية المنشأة والعملة)
        Route::prefix('settings')->group(function () {
            Route::get('store-identity', [\App\Http\Controllers\Api\SettingController::class, 'getStoreIdentity']);
            Route::put('store-identity', [\App\Http\Controllers\Api\SettingController::class, 'updateStoreIdentity']);
        });

    });

    // Super Admin Routes (حماية مشددة للمدير العام فقط)
    Route::prefix('admin')->middleware(['admin', 'throttle:admin'])->group(function () {
        Route::get('/stats', [\App\Http\Controllers\Api\AdminController::class, 'stats']);
        Route::get('/audit-logs', [\App\Http\Controllers\Api\AdminController::class, 'auditLogs']);
        Route::get('/licenses', [\App\Http\Controllers\Api\AdminController::class, 'licenses']);
        Route::post('/licenses/generate', [\App\Http\Controllers\Api\AdminController::class, 'generateLicenses']);
        Route::get('/users', [\App\Http\Controllers\Api\AdminController::class, 'users']);
        Route::post('/users/{user}/extend', [\App\Http\Controllers\Api\AdminController::class, 'extendUser']);
        Route::post('/users/{user}/revoke-subscription', [\App\Http\Controllers\Api\AdminController::class, 'revokeSubscription']);
        Route::post('/users/{user}/force-logout', [\App\Http\Controllers\Api\AdminController::class, 'forceLogout']);
        Route::post('/users/{user}/toggle-status', [\App\Http\Controllers\Api\AdminController::class, 'toggleStatus']);
        Route::post('/users/{user}/toggle-ecommerce', [\App\Http\Controllers\Api\AdminController::class, 'toggleEcommerce']);
        Route::post('/users/{user}/reset-password', [\App\Http\Controllers\Api\AdminController::class, 'resetPassword']);
        Route::get('/users/{user}/staff', [\App\Http\Controllers\Api\AdminController::class, 'storeStaff']);
        Route::post('/licenses/{id}/revoke', [\App\Http\Controllers\Api\AdminController::class, 'revokeLicense']);
        Route::get('/inquiries', [\App\Http\Controllers\Api\StoreInquiryController::class, 'index']);
        Route::patch('/inquiries/{id}', [\App\Http\Controllers\Api\StoreInquiryController::class, 'update']);
        Route::delete('/inquiries/{id}', [\App\Http\Controllers\Api\StoreInquiryController::class, 'destroy']);
    });
});
