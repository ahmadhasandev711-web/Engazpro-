<?php

namespace Tests\Feature;

use App\Contracts\HostResolver;
use App\DTOs\AnoofyEnvelope;
use App\Enums\AnoofyEventResult;
use App\Enums\AnoofyEventType;
use App\Enums\UserRole;
use App\Exceptions\InvalidAnoofyPayloadException;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\Anoofy\Handlers\ConnectionVerifyHandler;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SimulatesHttpContext;
use Tests\TestCase;

class ConnectionVerifyHandlerTest extends TestCase
{
    use RefreshDatabase, SimulatesHttpContext;

    private User $user;
    private WooCommerceIntegration $integration;
    private ConnectionVerifyHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create(['role' => UserRole::OWNER]);
        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->user->id,
            'store_url' => 'https://mystore.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'is_active' => true,
            'anoofy_key_id' => '01JBC4M8R0G1Z6Q9W3X4K7M2P1',
            'anoofy_secret' => 'anoofy-secret-key-1234567890123456',
            'anoofy_connected_at' => null,
        ]);

        $mockResolver = $this->createMock(HostResolver::class);
        $mockResolver->method('resolve')->willReturn(['93.184.216.34']);
        $this->app->instance(HostResolver::class, $mockResolver);

        $this->handler = $this->app->make(ConnectionVerifyHandler::class);
    }

    public function test_successfully_verifies_connection_and_updates_timestamps(): void
    {
        $envelope = new AnoofyEnvelope(
            schemaVersion: 1,
            eventId: '11111111-1111-4111-8111-111111111111',
            eventType: AnoofyEventType::CONNECTION_VERIFY,
            occurredAt: CarbonImmutable::parse('2026-11-04T12:00:00Z'),
            orderVersion: null,
            data: [
                'site_url' => 'https://mystore.com',
                'callback_url' => 'https://mystore.com/wp-json/anoofy/v1/callback',
                'plugin_version' => '1.0.0',
            ]
        );

        $outcome = $this->handler->handle($this->integration, $envelope);

        $this->assertSame(AnoofyEventResult::PROCESSED, $outcome->result);
        $this->integration->refresh();
        $this->assertSame('https://mystore.com/wp-json/anoofy/v1/callback', $this->integration->anoofy_callback_url);
        $this->assertNotNull($this->integration->anoofy_connected_at);
    }

    public function test_throws_exception_if_site_url_host_does_not_match_store_url(): void
    {
        $envelope = new AnoofyEnvelope(
            schemaVersion: 1,
            eventId: '11111111-1111-4111-8111-111111111111',
            eventType: AnoofyEventType::CONNECTION_VERIFY,
            occurredAt: CarbonImmutable::parse('2026-11-04T12:00:00Z'),
            orderVersion: null,
            data: [
                'site_url' => 'https://malicious.com',
                'callback_url' => 'https://mystore.com/wp-json/anoofy/v1/callback',
                'plugin_version' => '1.0.0',
            ]
        );

        $this->expectException(InvalidAnoofyPayloadException::class);
        $this->handler->handle($this->integration, $envelope);
    }

    public function test_throws_exception_if_callback_url_host_does_not_match_store_url(): void
    {
        $envelope = new AnoofyEnvelope(
            schemaVersion: 1,
            eventId: '11111111-1111-4111-8111-111111111111',
            eventType: AnoofyEventType::CONNECTION_VERIFY,
            occurredAt: CarbonImmutable::parse('2026-11-04T12:00:00Z'),
            orderVersion: null,
            data: [
                'site_url' => 'https://mystore.com',
                'callback_url' => 'https://attacker.com/callback',
                'plugin_version' => '1.0.0',
            ]
        );

        $this->expectException(InvalidAnoofyPayloadException::class);
        $this->handler->handle($this->integration, $envelope);
    }
}
