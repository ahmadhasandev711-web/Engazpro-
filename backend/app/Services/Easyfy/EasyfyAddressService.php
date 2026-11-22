<?php

namespace App\Services\Easyfy;

use App\Models\Easyfy\EasyfyStoreAddress;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class EasyfyAddressService
{
    public function listForAccount(User $user): Collection
    {
        $accountId = $user->getAccountId();
        $addresses = EasyfyStoreAddress::with('shippingZone')
            ->where('account_id', $accountId)
            ->orderByDesc('is_default')
            ->orderByDesc('id')
            ->get();

        if ($addresses->isEmpty()) {
            $this->seedInitialStoreAddress($user, $accountId);

            return EasyfyStoreAddress::with('shippingZone')->where('account_id', $accountId)->get();
        }

        return $addresses;
    }

    public function create(User $user, array $data): EasyfyStoreAddress
    {
        return DB::transaction(function () use ($user, $data) {
            $accountId = $user->getAccountId();
            $isDefault = !empty($data['is_default']) || !EasyfyStoreAddress::where('account_id', $accountId)->exists();
            if ($isDefault) {
                EasyfyStoreAddress::where('account_id', $accountId)->update(['is_default' => false]);
            }

            return EasyfyStoreAddress::create([
                'account_id' => $accountId,
                'label' => $data['label'],
                'recipient_name' => $data['recipient_name'],
                'recipient_phone' => $data['recipient_phone'],
                'shipping_zone_id' => $data['shipping_zone_id'] ?? null,
                'governorate' => $data['governorate'],
                'address_line' => $data['address_line'],
                'notes' => $data['notes'] ?? null,
                'is_default' => $isDefault,
            ])->load('shippingZone');
        });
    }

    public function update(User $user, int $id, array $data): EasyfyStoreAddress
    {
        return DB::transaction(function () use ($user, $id, $data) {
            $address = EasyfyStoreAddress::where('account_id', $user->getAccountId())->findOrFail($id);
            if (!empty($data['is_default'])) {
                EasyfyStoreAddress::where('account_id', $user->getAccountId())->where('id', '!=', $id)->update(['is_default' => false]);
            }
            $address->update($data);

            return $address->fresh('shippingZone');
        });
    }

    public function delete(User $user, int $id): void
    {
        $address = EasyfyStoreAddress::where('account_id', $user->getAccountId())->findOrFail($id);
        $wasDefault = $address->is_default;
        $address->delete();
        if ($wasDefault) {
            $next = EasyfyStoreAddress::where('account_id', $user->getAccountId())->first();
            $next?->update(['is_default' => true]);
        }
    }

    private function seedInitialStoreAddress(User $user, int $accountId): void
    {
        $owner = User::find($accountId) ?? $user;
        $identity = $owner->store_identity ?? [];
        $addressLine = $identity['store_address'] ?? null;
        if (empty($addressLine)) {
            return;
        }
        EasyfyStoreAddress::create([
            'account_id' => $accountId, 'label' => 'عنوان المتجر الرئيسي',
            'recipient_name' => $identity['business_name'] ?? $owner->business_name ?? $owner->name,
            'recipient_phone' => $identity['store_phone'] ?? $owner->phone ?? '',
            'governorate' => 'القاهرة', 'address_line' => $addressLine, 'is_default' => true,
        ]);
    }
}
