<?php

namespace App\Exceptions;

class ShopifyConnectionException extends PosDomainException
{
    /**
     * @param  list<array<string, mixed>>  $userErrors
     */
    public function __construct(
        string $message = 'فشل الاتصال بمتجر Shopify، يرجى التحقق من النطاق وبيانات الاعتماد',
        int $statusCode = 422,
        public readonly array $userErrors = []
    ) {
        parent::__construct($message, 'SHOPIFY_CONNECTION_ERROR', $statusCode);
    }
}
