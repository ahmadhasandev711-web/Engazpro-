<?php

namespace App\Exceptions;

class InsufficientStockException extends PosDomainException
{
    public function __construct(
        string $productName = '',
        float $available = 0,
        float $requested = 0,
        string $errorCode = 'INSUFFICIENT_STOCK',
        ?string $customMessage = null
    ) {
        $msg = $customMessage ?? ($productName
            ? "الرصيد غير كافٍ للصنف [{$productName}]. المتاح: {$available}، المطلوب: {$requested}"
            : "الرصيد المتاح في المخزن لا يكفي لإتمام العملية");

        parent::__construct(
            message: $msg,
            errorCode: $errorCode,
            statusCode: 422
        );
    }
}
