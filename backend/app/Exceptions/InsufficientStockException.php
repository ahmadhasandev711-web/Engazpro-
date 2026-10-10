<?php

namespace App\Exceptions;

class InsufficientStockException extends PosDomainException
{
    public function __construct(string $productName = '', float $available = 0, float $requested = 0)
    {
        $msg = $productName
            ? "الرصيد غير كافٍ للصنف [{$productName}]. المتاح: {$available}، المطلوب: {$requested}"
            : "الرصيد المتاح في المخزن لا يكفي لإتمام العملية";

        parent::__construct(
            message: $msg,
            errorCode: 'INSUFFICIENT_STOCK',
            statusCode: 422
        );
    }
}
