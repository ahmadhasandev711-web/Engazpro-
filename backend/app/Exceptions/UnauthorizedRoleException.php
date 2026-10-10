<?php

namespace App\Exceptions;

class UnauthorizedRoleException extends PosDomainException
{
    public function __construct(string $message = 'ليس لديك الصلاحية للقيام بهذا الإجراء')
    {
        parent::__construct(
            message: $message,
            errorCode: 'UNAUTHORIZED_ROLE',
            statusCode: 403
        );
    }
}
