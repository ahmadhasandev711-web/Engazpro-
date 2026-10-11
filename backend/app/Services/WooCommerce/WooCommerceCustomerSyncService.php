<?php

namespace App\Services\WooCommerce;

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
        $wcCustomerId = !empty($wcCustomer['id']) ? (int) $wcCustomer['id'] : null;
        $email = !empty($wcCustomer['email']) ? strtolower(trim($wcCustomer['email'])) : null;
        
        $billing = $wcCustomer['billing'] ?? [];
        $shipping = $wcCustomer['shipping'] ?? [];

        $rawPhone = $billing['phone'] ?? ($shipping['phone'] ?? ($wcCustomer['phone'] ?? ''));
        $phone = $this->normalizePhone($rawPhone);

        $firstName = trim($billing['first_name'] ?? ($shipping['first_name'] ?? ($wcCustomer['first_name'] ?? '')));
        $lastName = trim($billing['last_name'] ?? ($shipping['last_name'] ?? ($wcCustomer['last_name'] ?? '')));
        $name = trim("{$firstName} {$lastName}");
        if (empty($name)) {
            $name = $wcCustomer['username'] ?? ($email ?: ($phone ?: 'عميل أونلاين'));
        }

        // إذا كان الطلب مجهول الهوية بالكامل أو اسمه الافتراضي "عميل أونلاين" بدون هاتف أو إيميل، نوحده في عميل واحد
        if (($name === 'عميل أونلاين' || empty($name)) && empty($phone) && empty($email) && empty($wcCustomerId)) {
            return Party::firstOrCreate([
                'user_id' => $accountId,
                'type' => 'CUSTOMER',
                'name' => 'عميل أونلاين',
            ], [
                'phone' => null,
                'address' => 'متجر ووكومرس الإلكتروني',
                'notes' => 'حساب موحد لكافة طلبات الزوار المجهولين من المتجر الإلكتروني',
            ]);
        }

        $addressParts = array_filter([
            $billing['address_1'] ?? ($shipping['address_1'] ?? null),
            $billing['address_2'] ?? ($shipping['address_2'] ?? null),
            $billing['city'] ?? ($shipping['city'] ?? null),
            $billing['state'] ?? ($shipping['state'] ?? null),
        ]);
        $address = !empty($addressParts) ? implode(', ', $addressParts) : null;

        // 1. Search by wc_customer_id
        $party = null;
        if ($wcCustomerId) {
            $party = Party::where('user_id', $accountId)
                ->where('type', 'CUSTOMER')
                ->where('wc_customer_id', $wcCustomerId)
                ->first();
        }

        // 2. Search by normalized phone
        if (!$party && !empty($phone)) {
            $party = Party::where('user_id', $accountId)
                ->where('type', 'CUSTOMER')
                ->where(function ($q) use ($phone) {
                    $q->where('phone', $phone)->orWhere('phone2', $phone);
                })
                ->first();
        }

        // 3. Search by email
        if (!$party && !empty($email)) {
            $party = Party::where('user_id', $accountId)
                ->where('type', 'CUSTOMER')
                ->where('wc_email', $email)
                ->first();
        }

        // 4. Search by exact customer name if unique
        if (!$party && !empty($name) && $name !== 'عميل أونلاين') {
            $party = Party::where('user_id', $accountId)
                ->where('type', 'CUSTOMER')
                ->where('name', $name)
                ->first();
        }

        if ($party) {
            // Update existing party without overwriting phone if party already has it
            $updateData = [];
            if ($wcCustomerId && !$party->wc_customer_id) {
                $updateData['wc_customer_id'] = $wcCustomerId;
            }
            if ($email && !$party->wc_email) {
                $updateData['wc_email'] = $email;
            }
            if ($phone && !$party->phone) {
                $updateData['phone'] = $phone;
            }
            if ($address && !$party->address) {
                $updateData['address'] = $address;
            }
            if (!empty($updateData)) {
                $party->update($updateData);
            }
            return $party;
        }

        // 5. Create new customer party
        return Party::create([
            'user_id' => $accountId,
            'type' => 'CUSTOMER',
            'name' => $name,
            'phone' => $phone ?: null,
            'wc_email' => $email,
            'wc_customer_id' => $wcCustomerId,
            'address' => $address,
            'notes' => 'تمت المزامنة آلياً من متجر ووكومرس',
        ]);
    }

    /**
     * Push a customer from Kashat to WooCommerce
     */
    public function pushCustomerToWooCommerce(User $user, Party $party): void
    {
        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())
            ->where('is_active', true)
            ->first();

        if (!$integration) {
            return;
        }

        $names = explode(' ', trim($party->name), 2);
        $firstName = $names[0] ?? '';
        $lastName = $names[1] ?? '';

        $payload = [
            'first_name' => $firstName,
            'last_name' => $lastName,
            'billing' => [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'phone' => $party->phone ?? '',
                'address_1' => $party->address ?? '',
            ],
        ];

        if (!empty($party->wc_email)) {
            $payload['email'] = $party->wc_email;
        }

        try {
            if ($party->wc_customer_id) {
                $this->apiClient->updateCustomer($integration, $party->wc_customer_id, $payload);
            } else {
                if (empty($payload['email']) && !empty($party->phone)) {
                    $payload['email'] = $party->phone . '@customer.local';
                }
                $payload['username'] = $party->phone ?: ('cust_' . $party->id);

                $created = $this->apiClient->createCustomer($integration, $payload);
                if ($created && !empty($created['id'])) {
                    $party->update([
                        'wc_customer_id' => (int) $created['id'],
                    ]);
                }
            }
        } catch (Exception $e) {
            Log::warning("Failed to push customer #{$party->id} to WooCommerce: " . $e->getMessage());
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
