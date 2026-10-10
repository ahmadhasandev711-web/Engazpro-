<?php

namespace App\Exceptions;

class BranchDomainException extends PosDomainException
{
    public function __construct(string $message, string $errorCode = 'BRANCH_ERROR', int $statusCode = 422)
    {
        parent::__construct($message, $errorCode, $statusCode);
    }
}
