<?php

namespace App\Exceptions;

class InvalidAnoofySignatureException extends PosDomainException
{
    public function __construct(
        string $message = 'توقيع الطلب غير صالح أو منتهي الصلاحية',
        string $errorCode = 'INVALID_ANOOFY_SIGNATURE',
        int $statusCode = 401,
        ?\Exception $previous = null
    ) {
        parent::__construct($message, $errorCode, $statusCode, $previous);
    }
}
