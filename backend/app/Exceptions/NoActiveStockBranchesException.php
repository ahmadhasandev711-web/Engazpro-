<?php

namespace App\Exceptions;

class NoActiveStockBranchesException extends PosDomainException
{
    public function __construct(
        string $message = 'لا توجد فروع أو مخازن نشطة محددة للمتجر الإلكتروني لسحب الرصيد منها.',
        string $errorCode = 'NO_ACTIVE_STOCK_BRANCHES',
        int $statusCode = 422,
        ?\Exception $previous = null
    ) {
        parent::__construct($message, $errorCode, $statusCode, $previous);
    }
}
