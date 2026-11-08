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
}
