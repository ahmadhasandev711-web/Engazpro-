<?php

namespace App\Services\EasyOrders;

use App\Enums\PartyType;
use App\Models\Party;
use App\Models\User;

class EasyOrdersCustomerSyncService
{
    public function syncCustomer(User $user, array $profileData): Party
    {
        $accountId = $user->getAccountId();
        $profile = $this->extractProfile($profileData);

        if ($this->isAnonymous($profile)) {
            return Party::firstOrCreate(
                ['user_id' => $accountId, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل إيزي أوردر'],
                ['phone' => null, 'address' => 'متجر EasyOrders الإلكتروني', 'notes' => 'حساب افتراضي لطلبات الزوار من EasyOrders']
            );
        }

        $existing = $this->findMatchingParty($accountId, $profile);
        if ($existing) {
            return $this->enrichParty($existing, $profile);
        }

        return Party::create([
            'user_id' => $accountId,
            'type' => PartyType::CUSTOMER->value,
            'name' => $profile['name'],
            'phone' => $profile['phone'] ?: null,
            'address' => $profile['address'],
            'notes' => 'تمت المزامنة آلياً من متجر EasyOrders',
        ]);
    }

    public function normalizePhone(?string $phone): string
    {
        $cleaned = preg_replace('/[^\d+]/', '', trim((string) $phone)) ?? '';
        if (str_starts_with($cleaned, '0020')) {
            return '0' . substr($cleaned, 4);
        }
        if (str_starts_with($cleaned, '+20')) {
            return '0' . substr($cleaned, 3);
        }
        if (str_starts_with($cleaned, '20') && strlen($cleaned) === 12) {
            return '0' . substr($cleaned, 2);
        }

        return $cleaned;
    }

    private function extractProfile(array $data): array
    {
        $phone = $this->normalizePhone($data['phone'] ?? null);
        $name = trim((string) ($data['name'] ?? '')) ?: ($phone ?: 'عميل إيزي أوردر');

        return [
            'name' => $name,
            'phone' => $phone,
            'address' => !empty($data['address']) ? (string) $data['address'] : null,
        ];
    }

    private function isAnonymous(array $profile): bool
    {
        return ($profile['name'] === 'عميل إيزي أوردر' || $profile['name'] === '') && empty($profile['phone']);
    }

    private function findMatchingParty(int $accountId, array $profile): ?Party
    {
        if (empty($profile['phone'])) {
            return null;
        }

        return Party::where('user_id', $accountId)
            ->where('type', PartyType::CUSTOMER->value)
            ->where(fn ($q) => $q->where('phone', $profile['phone'])->orWhere('phone2', $profile['phone']))
            ->first();
    }

    private function enrichParty(Party $party, array $profile): Party
    {
        $updates = array_filter([
            'phone' => ($profile['phone'] && !$party->phone) ? $profile['phone'] : null,
            'address' => ($profile['address'] && !$party->address) ? $profile['address'] : null,
        ]);
        if (!empty($updates)) {
            $party->update($updates);
        }

        return $party;
    }
}
