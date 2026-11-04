<?php

namespace App\Exceptions;

class InvalidAnoofyPayloadException extends PosDomainException
{
    public function __construct(
        string $message = 'بيانات الحدث غير صالحة',
        string $errorCode = 'INVALID_ANOOFY_PAYLOAD',
        int $statusCode = 422,
        ?\Exception $previous = null
    ) {
        parent::__construct($message, $errorCode, $statusCode, $previous);
    }
}
