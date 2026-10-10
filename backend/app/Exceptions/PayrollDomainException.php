<?php

namespace App\Exceptions;

class PayrollDomainException extends PosDomainException
{
    public function __construct(
        string $message = 'حدث خطأ في معالجة مسير الرواتب والعمولات',
        string $errorCode = 'PAYROLL_ERROR',
        int $statusCode = 422
    ) {
        parent::__construct($message, $errorCode, $statusCode);
    }
}
