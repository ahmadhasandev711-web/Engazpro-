<?php

namespace App\Contracts;

interface AnoofySignatureVerifierInterface
{
    public function verify(string $secret, int $timestamp, string $rawBody, string $providedSignature): bool;
}
