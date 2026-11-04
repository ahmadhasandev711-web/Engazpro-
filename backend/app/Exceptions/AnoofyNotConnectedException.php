<?php

namespace App\Exceptions;

class AnoofyNotConnectedException extends PosDomainException
{
    public function __construct(
        string $message = 'معرّف المفتاح غير معروف أو متجر أنوفي غير متصل',
        string $errorCode = 'ANOOFY_NOT_CONNECTED',
        int $statusCode = 401,
        ?\Exception $previous = null
    ) {
        parent::__construct($message, $errorCode, $statusCode, $previous);
    }
}
