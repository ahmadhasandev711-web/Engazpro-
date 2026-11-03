<?php

namespace Tests\Unit\Services\WooCommerce;

use App\Enums\WcPaymentStatus;
use App\Services\WooCommerce\WcOrderPayloadParser;
use App\Support\Money;
use PHPUnit\Framework\TestCase;

class WcOrderPayloadParserTest extends TestCase
{
    private WcOrderPayloadParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new WcOrderPayloadParser();
    }

    public function test_parses_standard_cod_order_correctly(): void
    {
        $payload = [
            'id' => 12345,
            'status' => 'processing',
            'date_created' => '2026-03-01T12:00:00',
            'total' => '370.00',
            'shipping_total' => '50.00',
            'discount_total' => '30.00',
            'payment_method' => 'cod',
            'customer_id' => 999,
            'customer_note' => 'يرجى الاتصال قبل التوصيل',
            'billing' => [
                'first_name' => 'أحمد',
                'last_name' => 'حسن',
                'phone' => '01011112222',
                'email' => 'ahmed@example.com',
                'address_1' => 'الدقي',
                'city' => 'الدقي',
                'state' => 'الجيزة',
            ],
            'shipping' => [
                'first_name' => 'أحمد',
                'last_name' => 'حسن',
                'phone' => '',
                'address_1' => 'الدقي',
                'city' => 'الدقي',
                'state' => 'الجيزة',
            ],
            'meta_data' => [
                ['key' => '_bosta_tracking_number', 'value' => 'BOSTA-1234'],
            ],
            'coupon_lines' => [
                ['code' => 'SAVE30'],
            ],
            'line_items' => [
                ['id' => 1, 'name' => 'Item 1'],
            ],
        ];

        $parsed = $this->parser->parse($payload);

        $this->assertSame(12345, $parsed->wcOrderId);
        $this->assertSame('2026-03-01 12:00:00', $parsed->orderDate->format('Y-m-d H:i:s'));
        $this->assertSame('processing', $parsed->status);
        $this->assertTrue($parsed->total->equals(Money::of('370.00')));
        $this->assertTrue($parsed->shippingCost->equals(Money::of('50.00')));
        $this->assertTrue($parsed->discountTotal->equals(Money::of('30.00')));
        $this->assertTrue($parsed->subtotal->equals(Money::of('350.00')));
        $this->assertSame('cod', $parsed->paymentMethod);
        $this->assertSame(WcPaymentStatus::PENDING_COD, $parsed->paymentStatus);
        $this->assertFalse($parsed->isPaidOnline);
        $this->assertSame('أحمد حسن', $parsed->customerName);
        $this->assertSame('01011112222', $parsed->customerPhone);
        $this->assertSame('ahmed@example.com', $parsed->customerEmail);
        $this->assertSame('الدقي, الدقي, الجيزة', $parsed->customerAddress);
        $this->assertSame('الجيزة', $parsed->governorate);
        $this->assertSame('الدقي', $parsed->city);
        $this->assertSame('يرجى الاتصال قبل التوصيل', $parsed->notes);
        $this->assertSame('BOSTA-1234', $parsed->trackingNumber);
        $this->assertSame('بوسطة (Bosta)', $parsed->courierName);
        $this->assertSame(['SAVE30'], $parsed->couponCodes);
        $this->assertSame(999, $parsed->customerId);
        $this->assertCount(1, $parsed->rawLineItems);
    }

    public function test_payment_status_detection(): void
    {
        // 1. COD without payment date is COD
        $cod = $this->parser->parse(['payment_method' => 'cod', 'status' => 'pending']);
        $this->assertFalse($cod->isPaidOnline);
        $this->assertSame(WcPaymentStatus::PENDING_COD, $cod->paymentStatus);

        // 2. Gateway in list is online paid
        $paymob = $this->parser->parse(['payment_method' => 'paymob', 'status' => 'pending']);
        $this->assertTrue($paymob->isPaidOnline);
        $this->assertSame(WcPaymentStatus::PAID_ONLINE, $paymob->paymentStatus);

        // 3. date_paid present marks as paid online
        $paid = $this->parser->parse(['payment_method' => 'custom', 'date_paid' => '2026-03-01T10:00:00']);
        $this->assertTrue($paid->isPaidOnline);
        $this->assertSame(WcPaymentStatus::PAID_ONLINE, $paid->paymentStatus);

        // 4. needs_payment = false for non-cod marks as paid online
        $needsPayment = $this->parser->parse(['payment_method' => 'kiosk', 'needs_payment' => false]);
        $this->assertTrue($needsPayment->isPaidOnline);
        $this->assertSame(WcPaymentStatus::PAID_ONLINE, $needsPayment->paymentStatus);

        // 5. non-cod with processing status marks as paid online
        $processingNonCod = $this->parser->parse(['payment_method' => 'other', 'status' => 'processing']);
        $this->assertTrue($processingNonCod->isPaidOnline);
        $this->assertSame(WcPaymentStatus::PAID_ONLINE, $processingNonCod->paymentStatus);
    }

    public function test_negative_subtotal_clamps_to_zero(): void
    {
        $payload = [
            'total' => '10.00',
            'shipping_total' => '50.00',
            'discount_total' => '0.00',
        ];

        $parsed = $this->parser->parse($payload);
        $this->assertTrue($parsed->subtotal->isZero());
    }

    public function test_customer_name_fallback_hierarchy_without_party(): void
    {
        // Shipping name priority
        $p1 = $this->parser->parse([
            'shipping' => ['first_name' => 'محمد', 'last_name' => 'علي'],
            'billing' => ['first_name' => 'طارق', 'last_name' => 'محسن'],
        ]);
        $this->assertSame('محمد علي', $p1->customerName);

        // Billing name fallback
        $p2 = $this->parser->parse([
            'shipping' => ['first_name' => '', 'last_name' => ''],
            'billing' => ['first_name' => 'طارق', 'last_name' => 'محسن'],
        ]);
        $this->assertSame('طارق محسن', $p2->customerName);

        // Null if both empty
        $p3 = $this->parser->parse([
            'shipping' => [],
            'billing' => [],
        ]);
        $this->assertNull($p3->customerName);
    }

    public function test_phone_fallback_hierarchy(): void
    {
        // 1. Billing phone first
        $p1 = $this->parser->parse([
            'billing' => ['phone' => '01011111111'],
            'shipping' => ['phone' => '01022222222'],
        ]);
        $this->assertSame('01011111111', $p1->customerPhone);

        // 2. Shipping phone fallback
        $p2 = $this->parser->parse([
            'billing' => ['phone' => ''],
            'shipping' => ['phone' => '01022222222'],
        ]);
        $this->assertSame('01022222222', $p2->customerPhone);

        // 3. Meta data fallback
        $p3 = $this->parser->parse([
            'billing' => [],
            'shipping' => [],
            'meta_data' => [
                ['key' => 'irrelevant', 'value' => 'abc'],
                ['key' => '_shipping_phone', 'value' => '01033333333'],
            ],
        ]);
        $this->assertSame('01033333333', $p3->customerPhone);

        // 4. Missing everywhere returns null
        $p4 = $this->parser->parse([]);
        $this->assertNull($p4->customerPhone);
    }

    public function test_tracking_and_courier_extraction(): void
    {
        // Generic tracking
        $p1 = $this->parser->parse([
            'meta_data' => [
                ['key' => 'tracking_number', 'value' => 'TRK-987654'],
            ],
        ]);
        $this->assertSame('TRK-987654', $p1->trackingNumber);
        $this->assertNull($p1->courierName);

        // Bosta courier detection
        $p2 = $this->parser->parse([
            'meta_data' => [
                ['key' => '_bosta_delivery_id', 'value' => 'DEL-7788'],
            ],
        ]);
        $this->assertSame('DEL-7788', $p2->trackingNumber);
        $this->assertSame('بوسطة (Bosta)', $p2->courierName);
    }

    public function test_invalid_or_missing_date_handled_gracefully(): void
    {
        $p1 = $this->parser->parse(['date_created' => 'invalid-date-string']);
        $this->assertNotNull($p1->orderDate);

        $p2 = $this->parser->parse([]);
        $this->assertNotNull($p2->orderDate);
    }
}
