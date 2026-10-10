<?php

namespace App\Exceptions;

class StockTransferDomainException extends PosDomainException
{
    public function __construct(string $message, string $errorCode = 'STOCK_TRANSFER_ERROR', int $statusCode = 422)
    {
        parent::__construct($message, $errorCode, $statusCode);
    }
}
