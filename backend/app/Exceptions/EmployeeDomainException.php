<?php

namespace App\Exceptions;

class EmployeeDomainException extends PosDomainException
{
    public function __construct(string $message, string $errorCode = 'EMPLOYEE_ERROR', int $statusCode = 422)
    {
        parent::__construct($message, $errorCode, $statusCode);
    }
}
