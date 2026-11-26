<?php

namespace App\Exceptions;

class EasyOrdersConnectionException extends PosDomainException
{
    public function __construct(
        string $message = 'فشل الاتصال بمتجر EasyOrders، يرجى التحقق من مفتاح API.',
        int $statusCode = 422,
        public readonly int $retryAfterSeconds = 0
    ) {
        parent::__construct($message, 'EASYORDERS_CONNECTION_ERROR', $statusCode);
    }

    public function isRateLimited(): bool
    {
        return $this->getStatusCode() === 429;
    }
}
