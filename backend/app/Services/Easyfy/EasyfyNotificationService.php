<?php

namespace App\Services\Easyfy;

use App\Mail\EasyfyNewOrderAdminMail;
use App\Models\Easyfy\EasyfyOrder;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class EasyfyNotificationService
{
    public function __construct(private readonly EasyfySettingsService $settingsService) {}

    public function notifyAdminNewOrder(EasyfyOrder $order, bool $isProofReupload = false): void
    {
        $recipient = $this->resolveAdminEmail();
        if (!$recipient) {
            return;
        }

        try {
            Mail::to($recipient)->send(new EasyfyNewOrderAdminMail($order, $isProofReupload));
        } catch (\Throwable $e) {
            Log::warning("Easyfy admin order email failed ({$order->order_number}): " . $e->getMessage());
        }
    }

    private function resolveAdminEmail(): ?string
    {
        $configured = trim((string) ($this->settingsService->all()[EasyfySettingsService::KEY_ADMIN_NOTIFICATION_EMAIL] ?? ''));
        if ($configured !== '') {
            return $configured;
        }

        $adminEmail = User::where('is_admin', true)->whereNotNull('email')->value('email');
        if (!empty($adminEmail)) {
            return (string) $adminEmail;
        }

        $fallback = config('mail.from.address');

        return is_string($fallback) && $fallback !== '' ? $fallback : null;
    }
}
