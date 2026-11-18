<?php

namespace App\Services\Shopify;

use App\Enums\PartyType;
use App\Models\Party;
use App\Models\User;
use App\Support\ShopifyGid;

class ShopifyCustomerSyncService
{
    public function syncCustomerFromShopify(User $user, array $profileData): Party
    {
        $accountId = $user->getAccountId();
        $profile = $this->extractProfile($profileData);

        if ($this->isAnonymous($profile)) {
            return $this->firstOrCreateGuestParty($accountId);
        }

        $party = $this->findMatchingParty($accountId, $profile);
        if ($party) {
            return $this->enrichParty($party, $profile);
        }

        return Party::create([
            'user_id' => $accountId,
            'type' => PartyType::CUSTOMER->value,
            'name' => $profile['name'],
            'phone' => $profile['phone'] ?: null,
            'wc_email' => $profile['email'],
            'shopify_customer_id' => $profile['shopify_customer_id'],
            'address' => $profile['address'],
            'notes' => 'تمت المزامنة آلياً من متجر Shopify',
        ]);
    }

    public function normalizePhone(?string $phone): string
    {
        $cleaned = preg_replace('/[^\d+]/', '', trim((string) $phone)) ?? '';
        if (str_starts_with($cleaned, '0020')) {
            $cleaned = '0' . substr($cleaned, 4);
        } elseif (str_starts_with($cleaned, '+20')) {
            $cleaned = '0' . substr($cleaned, 3);
        } elseif (str_starts_with($cleaned, '20') && strlen($cleaned) === 12) {
            $cleaned = '0' . substr($cleaned, 2);
        }

        return $cleaned;
    }

    private function extractProfile(array $data): array
    {
        $email = !empty($data['email']) ? strtolower(trim((string) $data['email'])) : null;
        $phone = $this->normalizePhone($data['phone'] ?? null);
        $name = trim((string) ($data['name'] ?? '')) ?: ($email ?: ($phone ?: 'عميل شوبيفاي'));

        return [
            'shopify_customer_id' => ShopifyGid::extractId($data['customer_id'] ?? null),
            'email' => $email,
            'phone' => $phone,
            'name' => $name,
            'address' => !empty($data['address']) ? (string) $data['address'] : null,
        ];
    }

    private function isAnonymous(array $profile): bool
    {
        return ($profile['name'] === 'عميل شوبيفاي' || empty($profile['name']))
            && empty($profile['phone']) && empty($profile['email']) && empty($profile['shopify_customer_id']);
    }

    private function firstOrCreateGuestParty(int $accountId): Party
    {
        return Party::firstOrCreate(
            ['user_id' => $accountId, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل شوبيفاي'],
            ['phone' => null, 'address' => 'متجر شوبيفاي الإلكتروني', 'notes' => 'حساب موحد لطلبات الزوار المجهولين من Shopify']
        );
    }

    private function findMatchingParty(int $accountId, array $profile): ?Party
    {
        $base = fn () => Party::where('user_id', $accountId)->where('type', PartyType::CUSTOMER->value);

        if ($profile['shopify_customer_id'] && ($p = $base()->where('shopify_customer_id', $profile['shopify_customer_id'])->first())) {
            return $p;
        }
        if (!empty($profile['phone'])) {
            $p = $base()->where(fn ($q) => $q->where('phone', $profile['phone'])->orWhere('phone2', $profile['phone']))->first();
            if ($p) {
                return $p;
            }
        }
        if (!empty($profile['email']) && ($p = $base()->where('wc_email', $profile['email'])->first())) {
            return $p;
        }

        return null;
    }

    private function enrichParty(Party $party, array $profile): Party
    {
        $updates = array_filter([
            'shopify_customer_id' => ($profile['shopify_customer_id'] && !$party->shopify_customer_id) ? $profile['shopify_customer_id'] : null,
            'wc_email' => ($profile['email'] && !$party->wc_email) ? $profile['email'] : null,
            'phone' => ($profile['phone'] && !$party->phone) ? $profile['phone'] : null,
            'address' => ($profile['address'] && !$party->address) ? $profile['address'] : null,
        ]);

        if (!empty($updates)) {
            $party->update($updates);
        }

        return $party;
    }
}
