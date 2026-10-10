<?php

namespace App\Exceptions;

class ShiftDomainException extends PosDomainException
{
    public function __construct(string $message, string $errorCode = 'SHIFT_ERROR', int $statusCode = 422)
    {
        parent::__construct($message, $errorCode, $statusCode);
    }
}
