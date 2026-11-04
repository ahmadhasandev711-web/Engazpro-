<?php

namespace Tests\Unit\Services\Anoofy;

use App\DTOs\AnoofyEnvelope;
use App\Enums\AnoofyEventType;
use App\Exceptions\InvalidAnoofyPayloadException;
use App\Services\Anoofy\AnoofyEnvelopeParser;
use PHPUnit\Framework\TestCase;

class AnoofyEnvelopeParserTest extends TestCase
{
    private AnoofyEnvelopeParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new AnoofyEnvelopeParser();
    }

    public function test_parses_valid_envelope_from_fixture(): void
    {
        $fixturePath = dirname(__DIR__, 5) . '/docs/integrations/fixtures/order.confirmed.json';
        $json = (string) file_get_contents($fixturePath);

        $envelope = $this->parser->parse($json);

        $this->assertInstanceOf(AnoofyEnvelope::class, $envelope);
        $this->assertSame(1, $envelope->schemaVersion);
        $this->assertSame('22222222-2222-4222-8222-222222222222', $envelope->eventId);
        $this->assertSame(AnoofyEventType::ORDER_CONFIRMED, $envelope->eventType);
        $this->assertSame(1, $envelope->orderVersion);
        $this->assertSame(5001, $envelope->data['wc_order_id']);
        $this->assertSame('2026-11-04T12:05:00+00:00', $envelope->occurredAt->toIso8601String());
    }

    public function test_throws_exception_on_invalid_json(): void
    {
        $this->expectException(InvalidAnoofyPayloadException::class);
        $this->parser->parse('not-a-json');
    }

    public function test_throws_exception_on_invalid_schema_version(): void
    {
        $json = json_encode([
            'schema_version' => 2,
            'event_id' => 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            'event_type' => 'order.confirmed',
            'occurred_at' => '2026-11-04T12:00:00Z',
            'order_version' => 1,
            'data' => [],
        ]);

        $this->expectException(InvalidAnoofyPayloadException::class);
        $this->parser->parse($json);
    }

    public function test_throws_exception_on_invalid_event_id(): void
    {
        $json = json_encode([
            'schema_version' => 1,
            'event_id' => 'invalid-not-uuid',
            'event_type' => 'order.confirmed',
            'occurred_at' => '2026-11-04T12:00:00Z',
            'order_version' => 1,
            'data' => [],
        ]);

        $this->expectException(InvalidAnoofyPayloadException::class);
        $this->parser->parse($json);
    }

    public function test_throws_exception_on_unknown_event_type(): void
    {
        $json = json_encode([
            'schema_version' => 1,
            'event_id' => 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
            'event_type' => 'order.unknown',
            'occurred_at' => '2026-11-04T12:00:00Z',
            'order_version' => 1,
            'data' => [],
        ]);

        $this->expectException(InvalidAnoofyPayloadException::class);
        $this->parser->parse($json);
    }
}
