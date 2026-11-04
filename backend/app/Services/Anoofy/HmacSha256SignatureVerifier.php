<?php

namespace App\Services\Anoofy;

use App\Contracts\AnoofySignatureVerifierInterface;

final class HmacSha256SignatureVerifier implements AnoofySignatureVerifierInterface
{
    public function verify(string $secret, int $timestamp, string $rawBody, string $providedSignature): bool
    {
        $payloadToSign = "{$timestamp}.{$rawBody}";
        $expectedSignature = hash_hmac('sha256', $payloadToSign, $secret);

        return hash_equals($expectedSignature, strtolower(trim($providedSignature)));
    }
}
