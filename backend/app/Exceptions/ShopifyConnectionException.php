<?php

namespace App\Exceptions;

class ShopifyConnectionException extends PosDomainException
{
    public function __construct(string $message = 'فشل الاتصال بمتجر Shopify، يرجى التحقق من النطاق وبيانات الاعتماد', int $statusCode = 422)
    {
        parent::__construct($message, 'SHOPIFY_CONNECTION_ERROR', $statusCode);
    }
}
