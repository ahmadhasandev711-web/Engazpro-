<?php

namespace App\Services;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\AdminAuditAction;
use App\Enums\EcommercePlatform;
use App\Enums\UserStatus;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\Setting;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\Shopify\ShopifyStockSyncGate;
use App\Services\WooCommerce\WooStockSyncGate;
use App\Support\ShopifyGid;
use App\Support\StoreCode;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class AdminStoreControlService
{
    public function __construct(
        protected AdminAuditService $auditService,
        protected WooCommerceApiClientInterface $wcClient,
        protected ShopifyGraphqlClientInterface $shopifyClient,
        protected PasswordRecoveryService $recoveryService
    ) {}

    public function getStoreDetails(User $merchant): array
    {
        $this->assertMerchantAccount($merchant);
        $merchant->load(['settings', 'subscription', 'branches:id,user_id,name,code,is_main,is_active', 'wooCommerceIntegration', 'shopifyIntegration']);

        return [
            'owner' => [
                'id' => $merchant->id,
                'store_code' => $merchant->store_code,
                'name' => $merchant->name,
                'business_name' => $merchant->business_name,
                'phone' => $merchant->phone,
                'email' => $merchant->email,
                'status' => $merchant->status?->value ?? UserStatus::ACTIVE->value,
                'ecommerce_enabled' => (bool) $merchant->ecommerce_enabled,
                'subscription' => $merchant->subscription,
            ],
            'branches' => $merchant->branches,
            EcommercePlatform::WOOCOMMERCE->value => $this->formatWooSummary($merchant->wooCommerceIntegration),
            EcommercePlatform::SHOPIFY->value => $this->formatShopifySummary($merchant->shopifyIntegration),
        ];
    }

    public function updateStoreProfile(User $merchant, array $data): User
    {
        $this->assertMerchantAccount($merchant);

        return DB::transaction(function () use ($merchant, $data) {
            $this->applyMerchantUpdates($merchant, $data);
            $this->syncMerchantBusinessAndPlan($merchant, $data);
            $this->auditService->record(AdminAuditAction::STORE_UPDATED, "تحديث بيانات وباقة المتجر ({$merchant->name})", $merchant, ['plan' => $data['plan'] ?? null]);

            return $merchant->fresh(['settings', 'subscription']);
        });
    }

    private function applyMerchantUpdates(User $merchant, array $data): void
    {
        $merchant->update([
            'name' => $data['name'],
            'phone' => $data['phone'],
            'email' => $data['email'] ?? null,
        ]);
        if (!empty($data['store_code'])) {
            $newCode = StoreCode::normalize((string) $data['store_code']);
            if ($newCode !== $merchant->store_code) {
                $merchant->store_code = $newCode;
                $merchant->owned_store_code = $newCode;
                $merchant->save();
                User::where('owner_id', $merchant->id)->update(['store_code' => $newCode]);
            }
        }
    }

    private function syncMerchantBusinessAndPlan(User $merchant, array $data): void
    {
        if (array_key_exists('business_name', $data)) {
            $val = trim((string) ($data['business_name'] ?? ''));
            Setting::updateOrCreate(['user_id' => $merchant->id, 'key' => SettingService::KEY_BUSINESS_NAME], ['value' => $val]);
        }
        if (!empty($data['plan']) && $merchant->subscription) {
            $merchant->subscription->update(['plan' => $data['plan']]);
            SubscriptionGate::clear($merchant->id);
        }
    }

    public function configureWooCommerce(User $merchant, array $data): array
    {
        $this->assertMerchantAccount($merchant);
        $existing = WooCommerceIntegration::withoutGlobalScopes()->where('user_id', $merchant->id)->first();
        if (!$existing && (empty($data['consumer_key']) || empty($data['consumer_secret']))) {
            throw new PosDomainException('مفاتيح WooCommerce مطلوبة عند إعداد الربط لأول مرة.', 'WC_CREDENTIALS_REQUIRED', 422);
        }

        return DB::transaction(function () use ($merchant, $existing, $data) {
            $isActive = array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true;
            if ($isActive) {
                ShopifyIntegration::withoutGlobalScopes()->where('user_id', $merchant->id)->where('is_active', true)->update(['is_active' => false]);
            }
            $integration = WooCommerceIntegration::updateOrCreate(
                ['user_id' => $merchant->id],
                $this->extractWooPayload($merchant->id, $existing, $data, $isActive)
            );
            $this->enableEcommerceAndFlushGates($merchant, AdminAuditAction::STORE_ECOMMERCE_CONFIGURED, "إعداد ربط WooCommerce للمتجر ({$merchant->name})", ['platform' => EcommercePlatform::WOOCOMMERCE->value]);

            return $this->formatWooSummary($integration->fresh()) ?? [];
        });
    }

    public function configureShopify(User $merchant, array $data): array
    {
        $this->assertMerchantAccount($merchant);
        $domain = ShopifyGid::normalizeShopDomain((string) $data['shop_domain']);
        $existing = ShopifyIntegration::withoutGlobalScopes()->where('user_id', $merchant->id)->first();
        if (!$existing && empty($data['access_token'])) {
            throw new PosDomainException('رمز الوصول (Access Token) مطلوب عند ربط Shopify لأول مرة.', 'SHOPIFY_TOKEN_REQUIRED', 422);
        }

        return DB::transaction(function () use ($merchant, $existing, $data, $domain) {
            $isActive = array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true;
            if ($isActive) {
                WooCommerceIntegration::withoutGlobalScopes()->where('user_id', $merchant->id)->where('is_active', true)->update(['is_active' => false]);
            }
            $integration = ShopifyIntegration::updateOrCreate(
                ['user_id' => $merchant->id],
                $this->extractShopifyPayload($merchant->id, $existing, $data, $domain, $isActive)
            );
            $this->enableEcommerceAndFlushGates($merchant, AdminAuditAction::STORE_ECOMMERCE_CONFIGURED, "إعداد ربط Shopify للمتجر ({$merchant->name})", ['platform' => EcommercePlatform::SHOPIFY->value]);

            return $this->formatShopifySummary($integration->fresh()) ?? [];
        });
    }

    public function removeEcommerceIntegration(User $merchant, EcommercePlatform $platform, bool $disableAddon = false): void
    {
        $this->assertMerchantAccount($merchant);

        DB::transaction(function () use ($merchant, $platform, $disableAddon) {
            if ($platform === EcommercePlatform::WOOCOMMERCE) {
                WooCommerceIntegration::withoutGlobalScopes()->where('user_id', $merchant->id)->delete();
            } else {
                ShopifyIntegration::withoutGlobalScopes()->where('user_id', $merchant->id)->delete();
            }
            if ($disableAddon) {
                $merchant->forceFill(['ecommerce_enabled' => false])->save();
            }
            $this->flushAllEcommerceGates($merchant->id);
            $this->auditService->record(AdminAuditAction::STORE_ECOMMERCE_REMOVED, "إزالة ربط {$platform->label()} من متجر ({$merchant->name})", $merchant, ['platform' => $platform->value, 'disabled_addon' => $disableAddon]);
        });
    }

    public function testStoreConnection(User $merchant): array
    {
        $this->assertMerchantAccount($merchant);
        $wc = WooCommerceIntegration::withoutGlobalScopes()->where('user_id', $merchant->id)->where('is_active', true)->first();
        if ($wc) {
            $ok = $this->wcClient->testConnection($wc);
            return ['platform' => EcommercePlatform::WOOCOMMERCE->value, 'connected' => $ok, 'message' => $ok ? 'الاتصال بمتجر WooCommerce سليم 100%' : 'تعذر الاتصال بمتجر WooCommerce'];
        }
        $sh = ShopifyIntegration::withoutGlobalScopes()->where('user_id', $merchant->id)->where('is_active', true)->first();
        if ($sh) {
            $shop = $this->shopifyClient->testConnection($sh);
            return ['platform' => EcommercePlatform::SHOPIFY->value, 'connected' => $shop !== null, 'message' => $shop ? "متصل بمتجر Shopify: {$shop['name']}" : 'تعذر الاتصال بمتجر Shopify'];
        }

        throw new PosDomainException('لا يوجد متجر إلكتروني مفعّل لهذا الحساب لاختباره.', 'NO_ACTIVE_ECOMMERCE', 422);
    }

    public function impersonateMerchant(User $admin, User $merchant): array
    {
        $this->assertMerchantAccount($merchant);
        if (!$merchant->isActive()) {
            throw new PosDomainException('لا يمكن الدخول لحساب متجر مجمد؛ قم بتنشيطه أولاً.', 'CANNOT_IMPERSONATE_INACTIVE', 422);
        }

        $token = $merchant->createToken('admin_impersonation', ['admin_impersonation'], now()->addHours(2))->plainTextToken;
        $merchant->load(['branch:id,name,code,type', 'subscription', 'wooCommerceIntegration:id,user_id,is_active', 'shopifyIntegration:id,user_id,is_active']);
        $this->auditService->record(AdminAuditAction::STORE_IMPERSONATED, "دخول دعم فني إلى متجر ({$merchant->name}) بواسطة ({$admin->name})", $merchant);

        return ['user' => $merchant, 'token' => $token, 'impersonated_by' => $admin->name];
    }

    public function resetStaffPassword(User $merchant, User $staff, string $newPassword, User $admin): void
    {
        $this->assertStaffBelongsToMerchant($merchant, $staff);
        DB::transaction(function () use ($staff, $newPassword, $admin) {
            $staff->update(['password' => Hash::make($newPassword)]);
            $staff->revokeTokens();
            $this->recoveryService->resolvePendingRequestsForUser($staff->id, $admin->id);
            $this->auditService->record(AdminAuditAction::USER_PASSWORD_RESET, "تغيير كلمة مرور الموظف ({$staff->name}) من الإدارة", $staff);
        });
    }

    public function toggleStaffStatus(User $merchant, User $staff): User
    {
        $this->assertStaffBelongsToMerchant($merchant, $staff);
        return DB::transaction(function () use ($staff) {
            $newStatus = $staff->status === UserStatus::INACTIVE ? UserStatus::ACTIVE : UserStatus::INACTIVE;
            $staff->update(['status' => $newStatus]);
            if ($newStatus === UserStatus::INACTIVE) {
                $staff->revokeTokens();
            }
            $action = $newStatus === UserStatus::INACTIVE ? AdminAuditAction::USER_FROZEN : AdminAuditAction::USER_UNFROZEN;
            $this->auditService->record($action, ($newStatus === UserStatus::INACTIVE ? 'إيقاف' : 'تنشيط') . " موظف ({$staff->name}) من الإدارة", $staff);

            return $staff->fresh();
        });
    }

    public function forceLogoutStaff(User $merchant, User $staff): int
    {
        $this->assertStaffBelongsToMerchant($merchant, $staff);
        $count = $staff->revokeTokens();
        $this->auditService->record(AdminAuditAction::STORE_SESSIONS_REVOKED, "طرد جلسات الموظف ({$staff->name}) من الإدارة", $staff, ['count' => $count]);

        return $count;
    }

    public function getQueueOverview(): array
    {
        $pending = Schema::hasTable('jobs') ? DB::table('jobs')->count() : 0;
        $failed = Schema::hasTable('failed_jobs')
            ? DB::table('failed_jobs')->orderByDesc('id')->limit(20)->get(['id', 'uuid', 'queue', 'payload', 'exception', 'failed_at'])
            : collect();

        return [
            'pending_count' => $pending,
            'failed_count' => Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0,
            'failed_items' => $failed->map(fn ($row) => $this->formatFailedJobRow($row))->values(),
        ];
    }

    public function retryFailedJob(string $uuid): void
    {
        Artisan::call('queue:retry', ['id' => [$uuid]]);
        $this->auditService->record(AdminAuditAction::QUEUE_JOB_RETRIED, "إعادة تشغيل مهمة طابور فاشلة ({$uuid})", null, ['uuid' => $uuid]);
    }

    public function retryAllFailedJobs(): void
    {
        Artisan::call('queue:retry', ['id' => ['all']]);
        $this->auditService->record(AdminAuditAction::QUEUE_JOB_RETRIED, 'إعادة تشغيل جميع مهام الطابور الفاشلة');
    }

    public function flushFailedJobs(): void
    {
        Artisan::call('queue:flush');
        $this->auditService->record(AdminAuditAction::QUEUE_JOBS_FLUSHED, 'تنظيف وحذف سجل المهام الفاشلة');
    }

    private function assertMerchantAccount(User $merchant): void
    {
        if ($merchant->is_admin || $merchant->owner_id !== null) {
            throw new PosDomainException('هذا الإجراء متاح لحسابات أصحاب المتاجر فقط.', 'INVALID_MERCHANT_TARGET', 422);
        }
    }

    private function assertStaffBelongsToMerchant(User $merchant, User $staff): void
    {
        $this->assertMerchantAccount($merchant);
        if ($staff->is_admin || (int) $staff->owner_id !== $merchant->id) {
            throw new PosDomainException('الموظف المحدد لا ينتمي لهذا المتجر.', 'STAFF_MERCHANT_MISMATCH', 422);
        }
    }

    private function enableEcommerceAndFlushGates(User $merchant, AdminAuditAction $action, string $summary, array $meta): void
    {
        if (!$merchant->ecommerce_enabled) {
            $merchant->forceFill(['ecommerce_enabled' => true])->save();
        }
        $this->flushAllEcommerceGates($merchant->id);
        $this->auditService->record($action, $summary, $merchant, $meta);
    }

    private function flushAllEcommerceGates(int $merchantId): void
    {
        SubscriptionGate::clear($merchantId);
        EcommerceAccessService::clearPlatformCache($merchantId);
        WooStockSyncGate::forget($merchantId);
        ShopifyStockSyncGate::forget($merchantId);
    }

    private function extractWooPayload(int $merchantId, ?WooCommerceIntegration $existing, array $data, bool $isActive): array
    {
        $branchId = $this->resolveMerchantBranchId($merchantId, $data['online_branch_id'] ?? $existing?->online_branch_id);

        return array_filter([
            'store_url' => rtrim((string) $data['store_url'], '/'),
            'consumer_key' => !empty($data['consumer_key']) ? $data['consumer_key'] : $existing?->consumer_key,
            'consumer_secret' => !empty($data['consumer_secret']) ? $data['consumer_secret'] : $existing?->consumer_secret,
            'webhook_secret' => array_key_exists('webhook_secret', $data) ? $data['webhook_secret'] : $existing?->webhook_secret,
            'online_branch_id' => $branchId,
            'auto_sync_stock' => (bool) ($data['auto_sync_stock'] ?? $existing?->auto_sync_stock ?? true),
            'auto_sync_prices' => (bool) ($data['auto_sync_prices'] ?? $existing?->auto_sync_prices ?? true),
            'auto_sync_promotions' => (bool) ($data['auto_sync_promotions'] ?? $existing?->auto_sync_promotions ?? true),
            'is_active' => $isActive,
        ], fn ($v) => $v !== null);
    }

    private function extractShopifyPayload(int $merchantId, ?ShopifyIntegration $existing, array $data, string $domain, bool $isActive): array
    {
        $branchId = $this->resolveMerchantBranchId($merchantId, $data['online_branch_id'] ?? $existing?->online_branch_id);

        return array_filter([
            'shop_domain' => $domain,
            'access_token' => !empty($data['access_token']) ? $data['access_token'] : $existing?->access_token,
            'client_id' => array_key_exists('client_id', $data) ? $data['client_id'] : $existing?->client_id,
            'client_secret' => !empty($data['client_secret']) ? $data['client_secret'] : $existing?->client_secret,
            'webhook_secret' => array_key_exists('webhook_secret', $data) ? $data['webhook_secret'] : $existing?->webhook_secret,
            'online_branch_id' => $branchId,
            'auto_sync_stock' => (bool) ($data['auto_sync_stock'] ?? $existing?->auto_sync_stock ?? true),
            'auto_sync_prices' => (bool) ($data['auto_sync_prices'] ?? $existing?->auto_sync_prices ?? true),
            'auto_sync_promotions' => (bool) ($data['auto_sync_promotions'] ?? $existing?->auto_sync_promotions ?? true),
            'is_active' => $isActive,
        ], fn ($v) => $v !== null);
    }

    private function resolveMerchantBranchId(int $merchantId, mixed $branchId): ?int
    {
        if (empty($branchId)) {
            return null;
        }
        $exists = Branch::withoutGlobalScopes()->where('user_id', $merchantId)->where('id', (int) $branchId)->exists();

        return $exists ? (int) $branchId : null;
    }

    private function formatWooSummary(?WooCommerceIntegration $wc): ?array
    {
        if (!$wc) {
            return null;
        }

        return [
            'id' => $wc->id,
            'store_url' => $wc->store_url,
            'has_credentials' => !empty($wc->consumer_key) && !empty($wc->consumer_secret),
            'has_webhook_secret' => !empty($wc->webhook_secret),
            'online_branch_id' => $wc->online_branch_id,
            'auto_sync_stock' => (bool) $wc->auto_sync_stock,
            'auto_sync_prices' => (bool) $wc->auto_sync_prices,
            'auto_sync_promotions' => (bool) $wc->auto_sync_promotions,
            'is_active' => (bool) $wc->is_active,
            'last_synced_at' => $wc->last_synced_at?->toIso8601String(),
        ];
    }

    private function formatShopifySummary(?ShopifyIntegration $sh): ?array
    {
        if (!$sh) {
            return null;
        }

        return [
            'id' => $sh->id,
            'shop_domain' => $sh->shop_domain,
            'has_token' => !empty($sh->access_token),
            'has_webhook_secret' => !empty($sh->webhook_secret),
            'online_branch_id' => $sh->online_branch_id,
            'auto_sync_stock' => (bool) $sh->auto_sync_stock,
            'auto_sync_prices' => (bool) $sh->auto_sync_prices,
            'auto_sync_promotions' => (bool) $sh->auto_sync_promotions,
            'is_active' => (bool) $sh->is_active,
            'last_synced_at' => $sh->last_synced_at?->toIso8601String(),
        ];
    }

    private function formatFailedJobRow(object $row): array
    {
        $decoded = json_decode((string) $row->payload, true);
        $jobName = $decoded['displayName'] ?? 'QueuedJob';
        $firstLine = trim(explode("\n", (string) $row->exception)[0] ?? '');

        return [
            'id' => $row->id,
            'uuid' => $row->uuid,
            'queue' => $row->queue,
            'job_name' => $jobName,
            'error_summary' => mb_substr($firstLine, 0, 180),
            'failed_at' => (string) $row->failed_at,
        ];
    }
}
