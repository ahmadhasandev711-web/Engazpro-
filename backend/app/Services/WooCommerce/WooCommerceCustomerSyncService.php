<?php

namespace App\Services\WooCommerce;

use App\Enums\PartyType;
use App\Models\Party;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use Exception;
use Illuminate\Support\Facades\Log;

class WooCommerceCustomerSyncService
{
    public function __construct(
        protected WooCommerceApiClient $apiClient
    ) {}

    /**
     * Synchronize a customer from WooCommerce to Kashat
     */
    public function syncCustomerFromWooCommerce(User $user, array $wcCustomer): Party
    {
        $accountId = $user->getAccountId();
        $profile = $this->extractWcCustomerProfile($wcCustomer);

        if ($this->isAnonymousWcCustomer($profile)) {
            return $this->firstOrCreateGuestOnlineParty($accountId);
        }

        $party = $this->findMatchingCustomerParty($accountId, $profile);
        if ($party) {
            return $this->enrichMatchedCustomerParty($party, $profile);
        }

        return Party::create([
            'user_id' => $accountId,
            'type' => PartyType::CUSTOMER->value,
            'name' => $profile['name'],
            'phone' => $profile['phone'] ?: null,
            'wc_email' => $profile['email'],
            'wc_customer_id' => $profile['wc_customer_id'],
            'address' => $profile['address'],
            'notes' => 'تمت المزامنة آلياً من متجر ووكومرس',
        ]);
    }

    private function extractWcCustomerProfile(array $wcCustomer): array
    {
        $email = !empty($wcCustomer['email']) ? strtolower(trim($wcCustomer['email'])) : null;
        $billing = $wcCustomer['billing'] ?? [];
        $shipping = $wcCustomer['shipping'] ?? [];
        $phone = $this->normalizePhone($billing['phone'] ?? ($shipping['phone'] ?? ($wcCustomer['phone'] ?? '')));

        $firstName = trim($billing['first_name'] ?? ($shipping['first_name'] ?? ($wcCustomer['first_name'] ?? '')));
        $lastName = trim($billing['last_name'] ?? ($shipping['last_name'] ?? ($wcCustomer['last_name'] ?? '')));
        $name = trim("{$firstName} {$lastName}") ?: ($wcCustomer['username'] ?? ($email ?: ($phone ?: 'عميل أونلاين')));

        $addressParts = array_filter([
            $billing['address_1'] ?? ($shipping['address_1'] ?? null), $billing['address_2'] ?? ($shipping['address_2'] ?? null),
            $billing['city'] ?? ($shipping['city'] ?? null), $billing['state'] ?? ($shipping['state'] ?? null),
        ]);

        return [
            'wc_customer_id' => !empty($wcCustomer['id']) ? (int) $wcCustomer['id'] : null,
            'email' => $email, 'phone' => $phone, 'name' => $name,
            'address' => !empty($addressParts) ? implode(', ', $addressParts) : null,
        ];
    }

    private function isAnonymousWcCustomer(array $profile): bool
    {
        return ($profile['name'] === 'عميل أونلاين' || empty($profile['name']))
            && empty($profile['phone']) && empty($profile['email']) && empty($profile['wc_customer_id']);
    }

    private function firstOrCreateGuestOnlineParty(int $accountId): Party
    {
        return Party::firstOrCreate([
            'user_id' => $accountId, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل أونلاين',
        ], [
            'phone' => null, 'address' => 'متجر ووكومرس الإلكتروني',
            'notes' => 'حساب موحد لكافة طلبات الزوار المجهولين من المتجر الإلكتروني',
        ]);
    }

    private function findMatchingCustomerParty(int $accountId, array $profile): ?Party
    {
        $base = fn () => Party::where('user_id', $accountId)->where('type', PartyType::CUSTOMER->value);

        if ($profile['wc_customer_id'] && ($party = $base()->where('wc_customer_id', $profile['wc_customer_id'])->first())) {
            return $party;
        }
        if (!empty($profile['phone'])) {
            $party = $base()->where(fn ($q) => $q->where('phone', $profile['phone'])->orWhere('phone2', $profile['phone']))->first();
            if ($party) {
                return $party;
            }
        }
        if (!empty($profile['email']) && ($party = $base()->where('wc_email', $profile['email'])->first())) {
            return $party;
        }

        return (!empty($profile['name']) && $profile['name'] !== 'عميل أونلاين')
            ? $base()->where('name', $profile['name'])->first()
            : null;
    }

    private function enrichMatchedCustomerParty(Party $party, array $profile): Party
    {
        $updateData = array_filter([
            'wc_customer_id' => ($profile['wc_customer_id'] && !$party->wc_customer_id) ? $profile['wc_customer_id'] : null,
            'wc_email' => ($profile['email'] && !$party->wc_email) ? $profile['email'] : null,
            'phone' => ($profile['phone'] && !$party->phone) ? $profile['phone'] : null,
            'address' => ($profile['address'] && !$party->address) ? $profile['address'] : null,
        ]);

        if (!empty($updateData)) {
            $party->update($updateData);
        }

        return $party;
    }

    /**
     * Push a customer from Kashat to WooCommerce
     */
    public function pushCustomerToWooCommerce(User $user, Party $party): void
    {
        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())->where('is_active', true)->first();
        if (!$integration) {
            return;
        }

        $payload = $this->buildOutboundCustomerPayload($party);

        try {
            if ($party->wc_customer_id) {
                $this->apiClient->updateCustomer($integration, $party->wc_customer_id, $payload);
                return;
            }
            $this->createRemoteCustomer($integration, $party, $payload);
        } catch (Exception $e) {
            Log::warning("Failed to push customer #{$party->id} to WooCommerce: " . $e->getMessage());
        }
    }

    private function buildOutboundCustomerPayload(Party $party): array
    {
        [$firstName, $lastName] = array_pad(explode(' ', trim($party->name), 2), 2, '');
        $payload = [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'billing' => ['first_name' => $firstName, 'last_name' => $lastName, 'phone' => $party->phone ?? '', 'address_1' => $party->address ?? ''],
        ];
        if (!empty($party->wc_email)) {
            $payload['email'] = $party->wc_email;
        }

        return $payload;
    }

    private function createRemoteCustomer(WooCommerceIntegration $integration, Party $party, array $payload): void
    {
        if (empty($payload['email']) && !empty($party->phone)) {
            $payload['email'] = $party->phone . '@customer.local';
        }
        $payload['username'] = $party->phone ?: ('cust_' . $party->id);

        $created = $this->apiClient->createCustomer($integration, $payload);
        if ($created && !empty($created['id'])) {
            $party->update(['wc_customer_id' => (int) $created['id']]);
        }
    }

    /**
     * Normalize Egyptian and Arabic phone numbers to 01xxxxxxxxx format
     */
    public function normalizePhone(?string $phone): string
    {
        if (empty($phone)) {
            return '';
        }

        // Remove all non-digits
        $cleaned = preg_replace('/[^\d]/', '', $phone);

        // Remove Egyptian country codes: +20, 0020, 20
        if (str_starts_with($cleaned, '0020')) {
            $cleaned = substr($cleaned, 4);
        } elseif (str_starts_with($cleaned, '20') && strlen($cleaned) >= 12) {
            $cleaned = substr($cleaned, 2);
        }

        // If it starts with 1 and is 10 digits (e.g. 1012345678), prepend 0 -> 01012345678
        if (strlen($cleaned) === 10 && str_starts_with($cleaned, '1')) {
            $cleaned = '0' . $cleaned;
        }

        return $cleaned;
    }
}
