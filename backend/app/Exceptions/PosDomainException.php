<?php

namespace App\Exceptions;

use Exception;

class PosDomainException extends Exception
{
    protected string $errorCode;
    protected int $statusCode;

    public function __construct(
        string $message = 'حدث خطأ في النظام',
        string $errorCode = 'DOMAIN_ERROR',
        int $statusCode = 422,
        ?Exception $previous = null
    ) {
        parent::__construct($message, 0, $previous);
        $this->errorCode = $errorCode;
        $this->statusCode = $statusCode;
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
}
