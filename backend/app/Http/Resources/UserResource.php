<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        $effectiveSubscription = $this->owner_id ? $this->owner?->subscription : $this->subscription;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'is_admin' => (bool) $this->is_admin,
            'owner_id' => $this->owner_id,
            'role' => $this->role instanceof \BackedEnum ? $this->role->value : ($this->role ?? UserRole::OWNER->value),
            'branch_id' => $this->branch_id,
            'branch' => $this->branch ? ['id' => $this->branch->id, 'name' => $this->branch->name, 'code' => $this->branch->code, 'type' => $this->branch->type instanceof \BackedEnum ? $this->branch->type->value : $this->branch->type] : null,
            'status' => $this->status instanceof \BackedEnum ? $this->status->value : ($this->status ?? UserStatus::ACTIVE->value),
            ...$this->resolveEcommerceFlags(),
            'permissions' => $this->permissions ?? [],
            'subscription' => $effectiveSubscription ? new SubscriptionResource($effectiveSubscription) : null,
            'store_identity' => app(\App\Services\SettingService::class)->getStoreIdentity($this->resource),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function resolveEcommerceFlags(): array
    {
        $owner = $this->owner_id ? $this->owner : $this->resource;
        $enabled = (bool) ($owner?->ecommerce_enabled ?? false);
        if (!$enabled) {
            return ['ecommerce_enabled' => false, 'active_ecommerce_platform' => null];
        }

        if ($owner && $owner->relationLoaded('wooCommerceIntegration') && $owner->relationLoaded('shopifyIntegration')) {
            $platform = $owner->wooCommerceIntegration?->is_active
                ? \App\Enums\EcommercePlatform::WOOCOMMERCE->value
                : ($owner->shopifyIntegration?->is_active ? \App\Enums\EcommercePlatform::SHOPIFY->value : null);

            return ['ecommerce_enabled' => true, 'active_ecommerce_platform' => $platform];
        }

        return [
            'ecommerce_enabled' => true,
            'active_ecommerce_platform' => app(\App\Services\EcommerceAccessService::class)->activePlatformForAccount($this->getAccountId())?->value,
        ];
    }
}
