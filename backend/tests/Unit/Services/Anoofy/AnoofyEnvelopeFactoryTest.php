<?php

namespace Tests\Unit\Services\Anoofy;

use App\DTOs\AnoofyEnvelope;
use App\Enums\AnoofyEventType;
use App\Services\Anoofy\AnoofyEnvelopeFactory;
use App\Services\Anoofy\AnoofyEnvelopeParser;
use PHPUnit\Framework\TestCase;

class AnoofyEnvelopeFactoryTest extends TestCase
{
    public function test_factory_builds_envelope_matching_fixture_keys_and_types(): void
    {
        $factory = new AnoofyEnvelopeFactory();

        $data = [
            'wc_order_id' => 5001,
            'stage' => 'CONFIRMED',
            'previous_stage' => 'PENDING_CONFIRMATION',
            'changed_at' => '2026-11-04T12:10:00Z',
            'branch_name' => 'الفرع الرئيسي',
            'courier_name' => 'شركة أرامكس',
            'tracking_number' => 'TRK-987654321',
        ];

        $built = $factory->build(AnoofyEventType::ORDER_STAGE_CHANGED, 1, $data);

        $fixturePath = dirname(__DIR__, 5) . '/docs/integrations/fixtures/order.stage_changed.json';
        $fixture = json_decode((string) file_get_contents($fixturePath), true);

        // Assert exact top-level keys
        $this->assertSame(array_keys($fixture), array_keys($built));

        // Assert schema version
        $this->assertSame(1, $built['schema_version']);
        $this->assertSame($fixture['schema_version'], $built['schema_version']);

        // Assert UUID
        $uuidRegex = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';
        $this->assertMatchesRegularExpression($uuidRegex, $built['event_id']);

        // Assert event type
        $this->assertSame(AnoofyEventType::ORDER_STAGE_CHANGED->value, $built['event_type']);

        // Assert occurred_at is valid ISO8601 UTC
        $this->assertNotEmpty($built['occurred_at']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/', $built['occurred_at']);

        // Assert order_version
        $this->assertSame(1, $built['order_version']);

        // Assert data keys
        $this->assertSame(array_keys($fixture['data']), array_keys($built['data']));
        $this->assertSame($data, $built['data']);
    }

    public function test_order_stage_changed_fixture_passes_envelope_parser(): void
    {
        $fixturePath = dirname(__DIR__, 5) . '/docs/integrations/fixtures/order.stage_changed.json';
        $raw = (string) file_get_contents($fixturePath);

        $parser = new AnoofyEnvelopeParser();
        $envelope = $parser->parse($raw);

        $this->assertInstanceOf(AnoofyEnvelope::class, $envelope);
        $this->assertSame(AnoofyEventType::ORDER_STAGE_CHANGED, $envelope->eventType);
        $this->assertSame(1, $envelope->schemaVersion);
        $this->assertSame(1, $envelope->orderVersion);
        $this->assertSame(5001, $envelope->data['wc_order_id']);
    }
}
