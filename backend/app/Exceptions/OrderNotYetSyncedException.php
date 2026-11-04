<?php

namespace App\Exceptions;

class OrderNotYetSyncedException extends PosDomainException
{
    public function __construct(
        string $message = 'الطلب غير متزامن بعد في النظام',
        string $errorCode = 'ORDER_NOT_YET_SYNCED',
        int $statusCode = 409,
        ?\Exception $previous = null
    ) {
        parent::__construct($message, $errorCode, $statusCode, $previous);
    }
}
