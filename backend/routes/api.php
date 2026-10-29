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
// WooCommerce 1-Click OAuth Callback (Public endpoint called by WordPress)
Route::post('woocommerce/auth-callback', [\App\Http\Controllers\Api\WooCommerceAuthController::class, 'authCallback'])->middleware('throttle:webhook');

// Public Landing Page Store Creation Inquiries
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
        Route::post('/activate-code', [SubscriptionController::class, 'activateCode']);
    });

    // Operational Routes (Must have Active Subscription)
    Route::middleware('subscription')->group(function () {
        // Products & Categories
        Route::apiResource('categories', CategoryController::class);
        Route::get('products/lookup', [ProductController::class, 'lookup']);
        Route::get('products/pos-catalog', [ProductController::class, 'posCatalog']);
        Route::post('products/opening-balance', [ProductController::class, 'recordOpeningBalance']);
        Route::post('products/{id}/batches', [ProductController::class, 'addBatch']);
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

        // Dashboard (لوحة القيادة والدفتر الذكي)
        Route::get('dashboard', [DashboardController::class, 'index']);

        // Ledger (كشف حساب)
        Route::get('ledger/{party}', [LedgerController::class, 'statement']);

        // Reports (التقارير والأرباح والخزينة)
        Route::prefix('reports')->group(function () {
            Route::get('profit', [ReportController::class, 'profit']);
            Route::get('sales', [ReportController::class, 'sales']);
            Route::get('stock', [ReportController::class, 'stock']);
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

        // WooCommerce Integration (ربط ومزامنة متجر ووكومرس)
        Route::prefix('woocommerce')->group(function () {
            Route::get('authorize-url', [\App\Http\Controllers\Api\WooCommerceAuthController::class, 'authorizeUrl']);
            Route::get('settings', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'getSettings']);
            Route::post('settings', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'saveSettings']);
            Route::post('test-connection', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'testConnection']);
            Route::post('import-products', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'importProducts']);
            Route::post('sync-customers', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'syncCustomers']);
            Route::post('register-webhooks', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'autoRegisterWebhooks']);
            Route::post('products/{id}/push-stock', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'pushProductStock']);
            Route::post('push-all-stocks', [\App\Http\Controllers\Api\WooCommerceSettingsController::class, 'pushAllStocks']);
        });

        // WooCommerce Orders & Dispatch (طلبات المتجر والشحن والتسليم الميداني)
        Route::prefix('wc-orders')->group(function () {
            Route::get('/', [\App\Http\Controllers\Api\WcOrderController::class, 'index']);
            Route::post('pull', [\App\Http\Controllers\Api\WcOrderController::class, 'pull']);
            Route::get('/{id}', [\App\Http\Controllers\Api\WcOrderController::class, 'show']);
            Route::post('/{id}/confirm', [\App\Http\Controllers\Api\WcOrderController::class, 'confirm']);
            Route::post('/{id}/dispatch', [\App\Http\Controllers\Api\WcOrderController::class, 'dispatchToMandob']);
            Route::post('/{id}/dispatch-courier', [\App\Http\Controllers\Api\WcOrderController::class, 'dispatchCourier']);
            Route::post('/{id}/deliver', [\App\Http\Controllers\Api\WcOrderController::class, 'deliver']);
            Route::post('/{id}/return', [\App\Http\Controllers\Api\WcOrderController::class, 'returnOrder']);
        });

        // Store Settings & Identity (هوية المنشأة والعملة)
        Route::prefix('settings')->group(function () {
            Route::get('store-identity', [\App\Http\Controllers\Api\SettingController::class, 'getStoreIdentity']);
            Route::put('store-identity', [\App\Http\Controllers\Api\SettingController::class, 'updateStoreIdentity']);
        });

    });

    // Super Admin Routes (حماية مشددة للمدير العام فقط)
    Route::prefix('admin')->middleware('admin')->group(function () {
        Route::get('/stats', [\App\Http\Controllers\Api\AdminController::class, 'stats']);
        Route::get('/licenses', [\App\Http\Controllers\Api\AdminController::class, 'licenses']);
        Route::post('/licenses/generate', [\App\Http\Controllers\Api\AdminController::class, 'generateLicenses']);
        Route::get('/users', [\App\Http\Controllers\Api\AdminController::class, 'users']);
        Route::post('/users/{user}/extend', [\App\Http\Controllers\Api\AdminController::class, 'extendUser']);
        Route::post('/users/{user}/toggle-status', [\App\Http\Controllers\Api\AdminController::class, 'toggleStatus']);
        Route::post('/users/{user}/reset-password', [\App\Http\Controllers\Api\AdminController::class, 'resetPassword']);
        Route::get('/users/{user}/staff', [\App\Http\Controllers\Api\AdminController::class, 'storeStaff']);
        Route::post('/licenses/{id}/revoke', [\App\Http\Controllers\Api\AdminController::class, 'revokeLicense']);
        Route::get('/inquiries', [\App\Http\Controllers\Api\StoreInquiryController::class, 'index']);
        Route::patch('/inquiries/{id}', [\App\Http\Controllers\Api\StoreInquiryController::class, 'update']);
        Route::delete('/inquiries/{id}', [\App\Http\Controllers\Api\StoreInquiryController::class, 'destroy']);
    });
});
