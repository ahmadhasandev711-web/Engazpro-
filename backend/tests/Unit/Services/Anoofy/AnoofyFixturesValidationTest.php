<?php

namespace Tests\Unit\Services\Anoofy;

use App\DTOs\AnoofyEnvelope;
use App\Services\Anoofy\AnoofyEnvelopeParser;
use PHPUnit\Framework\TestCase;

class AnoofyFixturesValidationTest extends TestCase
{
    private AnoofyEnvelopeParser $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new AnoofyEnvelopeParser();
    }

    public function test_all_fixtures_pass_envelope_parser(): void
    {
        $fixturesDir = dirname(__DIR__, 5) . '/docs/integrations/fixtures';
        $fixtureFiles = glob($fixturesDir . '/*.json');

        $this->assertNotEmpty($fixtureFiles, 'Fixtures directory must contain json fixtures');

        foreach ($fixtureFiles as $filePath) {
            $json = (string) file_get_contents($filePath);
            $envelope = $this->parser->parse($json);

            $this->assertInstanceOf(
                AnoofyEnvelope::class,
                $envelope,
                "Fixture file {$filePath} failed to parse into AnoofyEnvelope"
            );
            $this->assertSame(1, $envelope->schemaVersion);
            $this->assertNotEmpty($envelope->eventId);
        }
    }

    public function test_order_confirmed_fixtures_money_fields_are_two_decimal_strings(): void
    {
        $fixturesDir = dirname(__DIR__, 5) . '/docs/integrations/fixtures';
        $fixtureFiles = glob($fixturesDir . '/order.confirmed*.json');

        $this->assertNotEmpty($fixtureFiles, 'Fixtures directory must contain order.confirmed fixtures');

        $decimalPattern = '/^-?\d+\.\d{2}$/';

        foreach ($fixtureFiles as $filePath) {
            $json = (string) file_get_contents($filePath);
            $data = json_decode($json, true);

            $this->assertIsArray($data, "Fixture file {$filePath} is not valid json");
            $this->assertArrayHasKey('data', $data, "Fixture file {$filePath} missing data key");
            $this->assertArrayHasKey('line_items', $data['data'], "Fixture file {$filePath} missing line_items");

            foreach ($data['data']['line_items'] as $item) {
                $this->assertArrayHasKey('price', $item, "Line item missing price in {$filePath}");
                $this->assertArrayHasKey('total', $item, "Line item missing total in {$filePath}");

                $this->assertIsString($item['price'], "Price must be string in {$filePath}");
                $this->assertMatchesRegularExpression(
                    $decimalPattern,
                    $item['price'],
                    "Price '{$item['price']}' in {$filePath} does not match 2-decimal string format"
                );

                $this->assertIsString($item['total'], "Total must be string in {$filePath}");
                $this->assertMatchesRegularExpression(
                    $decimalPattern,
                    $item['total'],
                    "Total '{$item['total']}' in {$filePath} does not match 2-decimal string format"
                );
            }
        }
    }
}
