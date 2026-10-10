<?php

namespace App\Exceptions;

class WooCommerceConnectionException extends PosDomainException
{
    public function __construct(string $message = 'فشل الاتصال بمتجر ووكومرس، يرجى التحقق من الرابط والمفاتيح', int $statusCode = 422)
    {
        parent::__construct($message, 'WOOCOMMERCE_CONNECTION_ERROR', $statusCode);
    }
}
