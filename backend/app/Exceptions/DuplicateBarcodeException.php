<?php

namespace App\Exceptions;

class DuplicateBarcodeException extends PosDomainException
{
    public function __construct(string $barcode, string $message = '')
    {
        parent::__construct(
            message: $message ?: "الباركود ({$barcode}) مسجل بالفعل لصنف أو مقاس آخر في متجرك.",
            errorCode: 'DUPLICATE_BARCODE',
            statusCode: 422
        );
    }
}
