<?php

namespace App\Services\Easyfy;

use App\Enums\AdminAuditAction;
use App\Models\Easyfy\EasyfyStoreSetting;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class EasyfySettingsService
{
    public const KEY_STORE_ENABLED = 'store_enabled';
    public const KEY_COD_ENABLED = 'cod_enabled';
    public const KEY_INSTAPAY_ENABLED = 'instapay_enabled';
    public const KEY_VODAFONE_CASH_ENABLED = 'vodafone_cash_enabled';
    public const KEY_INSTAPAY_HANDLE = 'instapay_handle';
    public const KEY_INSTAPAY_NAME = 'instapay_name';
    public const KEY_VODAFONE_CASH_NUMBER = 'vodafone_cash_number';
    public const KEY_DEFAULT_SHIPPING_FEE = 'default_shipping_fee';
    public const KEY_FREE_SHIPPING_THRESHOLD = 'free_shipping_threshold';
    public const KEY_SUPPORT_WHATSAPP = 'support_whatsapp';
    public const KEY_ADMIN_NOTIFICATION_EMAIL = 'admin_notification_email';
    public const KEY_INVOICE_FOOTER = 'invoice_footer';
    public const KEY_LAST_ORDER_SEQUENCE = 'last_order_sequence';

    public function __construct(private readonly AdminAuditService $auditService) {}

    public function all(): array
    {
        $stored = EasyfyStoreSetting::pluck('value', 'key')->all();

        return [
            self::KEY_STORE_ENABLED => ($stored[self::KEY_STORE_ENABLED] ?? '1') === '1',
            self::KEY_COD_ENABLED => ($stored[self::KEY_COD_ENABLED] ?? '1') === '1',
            self::KEY_INSTAPAY_ENABLED => ($stored[self::KEY_INSTAPAY_ENABLED] ?? '1') === '1',
            self::KEY_VODAFONE_CASH_ENABLED => ($stored[self::KEY_VODAFONE_CASH_ENABLED] ?? '1') === '1',
            self::KEY_INSTAPAY_HANDLE => $stored[self::KEY_INSTAPAY_HANDLE] ?? '',
            self::KEY_INSTAPAY_NAME => $stored[self::KEY_INSTAPAY_NAME] ?? '',
            self::KEY_VODAFONE_CASH_NUMBER => $stored[self::KEY_VODAFONE_CASH_NUMBER] ?? '',
            self::KEY_DEFAULT_SHIPPING_FEE => Money::of($stored[self::KEY_DEFAULT_SHIPPING_FEE] ?? 50)->getAmount(),
            self::KEY_FREE_SHIPPING_THRESHOLD => $this->nullableMoneyAmount($stored[self::KEY_FREE_SHIPPING_THRESHOLD] ?? null),
            self::KEY_SUPPORT_WHATSAPP => $stored[self::KEY_SUPPORT_WHATSAPP] ?? '',
            self::KEY_ADMIN_NOTIFICATION_EMAIL => $stored[self::KEY_ADMIN_NOTIFICATION_EMAIL] ?? '',
            self::KEY_INVOICE_FOOTER => $stored[self::KEY_INVOICE_FOOTER] ?? '',
        ];
    }

    public function update(User $admin, array $data): array
    {
        DB::transaction(function () use ($admin, $data) {
            foreach ($this->mapPayloadToKeyValues($data) as $key => $value) {
                EasyfyStoreSetting::updateOrCreate(['key' => $key], ['value' => $value]);
            }

            $this->auditService->record(AdminAuditAction::EASYFY_SETTINGS_UPDATED, 'تحديث إعدادات متجر Easyfy', null, ['keys' => array_keys($data)], null, null, $admin);
        });

        return $this->all();
    }

    public function nextOrderNumber(): string
    {
        $seq = EasyfyStoreSetting::where('key', self::KEY_LAST_ORDER_SEQUENCE)->lockForUpdate()->first();
        if (!$seq) {
            EasyfyStoreSetting::insertOrIgnore([
                'key' => self::KEY_LAST_ORDER_SEQUENCE, 'value' => '0',
                'created_at' => now(), 'updated_at' => now(),
            ]);
            $seq = EasyfyStoreSetting::where('key', self::KEY_LAST_ORDER_SEQUENCE)->lockForUpdate()->firstOrFail();
        }
        $next = ((int) $seq->value) + 1;
        $seq->update(['value' => (string) $next]);

        return 'ESF-' . str_pad((string) $next, 5, '0', STR_PAD_LEFT);
    }

    private function nullableMoneyAmount(mixed $raw): ?float
    {
        return ($raw === null || $raw === '') ? null : Money::of($raw)->getAmount();
    }

    private function mapPayloadToKeyValues(array $data): array
    {
        $pairs = [];
        foreach ([self::KEY_STORE_ENABLED, self::KEY_COD_ENABLED, self::KEY_INSTAPAY_ENABLED, self::KEY_VODAFONE_CASH_ENABLED] as $boolKey) {
            if (array_key_exists($boolKey, $data)) {
                $pairs[$boolKey] = !empty($data[$boolKey]) ? '1' : '0';
            }
        }
        foreach ([self::KEY_INSTAPAY_HANDLE, self::KEY_INSTAPAY_NAME, self::KEY_VODAFONE_CASH_NUMBER, self::KEY_DEFAULT_SHIPPING_FEE, self::KEY_FREE_SHIPPING_THRESHOLD, self::KEY_SUPPORT_WHATSAPP, self::KEY_ADMIN_NOTIFICATION_EMAIL, self::KEY_INVOICE_FOOTER] as $strKey) {
            if (array_key_exists($strKey, $data)) {
                $pairs[$strKey] = $data[$strKey] !== null ? (string) $data[$strKey] : null;
            }
        }

        return $pairs;
    }
}
