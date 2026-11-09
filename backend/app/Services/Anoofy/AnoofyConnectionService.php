<?php

namespace App\Services\Anoofy;

use App\Exceptions\PosDomainException;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use Illuminate\Support\Str;

class AnoofyConnectionService
{
    public function generateKey(User $user): string
    {
        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())->first();

        if (!$integration) {
            throw new PosDomainException('لم يتم تهيئة ربط ووكومرس بعد.', 'WOOCOMMERCE_NOT_CONFIGURED', 422);
        }

        $kid = (string) Str::ulid();
        $secret = bin2hex(random_bytes(32));

        $integration->update([
            'anoofy_key_id' => $kid,
            'anoofy_secret' => $secret,
            'anoofy_connected_at' => null,
        ]);

        $payload = [
            'v' => 1,
            'api' => route('anoofy.inbound'),
            'kid' => $kid,
            'secret' => $secret,
        ];

        return self::base64UrlEncode((string) json_encode($payload, JSON_THROW_ON_ERROR));
    }

    public function disconnect(User $user): void
    {
        $integration = WooCommerceIntegration::where('user_id', $user->getAccountId())->first();

        if ($integration) {
            $integration->update([
                'anoofy_key_id' => null,
                'anoofy_secret' => null,
                'anoofy_callback_url' => null,
                'anoofy_connected_at' => null,
            ]);
        }
    }

    public static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public static function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;
        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }
        return (string) base64_decode(strtr($data, '-_', '+/'));
    }
}
