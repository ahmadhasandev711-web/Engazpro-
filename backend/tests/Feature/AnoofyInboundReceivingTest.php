<?php

namespace Tests\Feature;

use App\Enums\AnoofyEventResult;
use App\Enums\AnoofyEventType;
use App\Enums\UserRole;
use App\Models\AnoofyInboxEvent;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AnoofyInboundReceivingTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private WooCommerceIntegration $integration;
    private string $secret = 'anoofy-secret-key-1234567890123456';
    private string $kid = '01JBC4M8R0G1Z6Q9W3X4K7M2P1';

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
            'anoofy_key_id' => $this->kid,
            'anoofy_secret' => $this->secret,
            'anoofy_connected_at' => now(),
        ]);
    }

    public function test_rejects_missing_or_unknown_kid(): void
    {
        $response = $this->postJson('/api/webhooks/anoofy/events', [], [
            'X-Anoofy-Key-Id' => 'non-existent-kid',
            'X-Anoofy-Timestamp' => (string) now()->timestamp,
            'X-Anoofy-Signature' => 'dummy',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error_code' => 'ANOOFY_NOT_CONNECTED',
            ]);
    }

    public function test_rejects_expired_timestamp(): void
    {
        $timestamp = now()->subSeconds(301)->timestamp;
        $body = json_encode(['schema_version' => 1]);
        $sig = hash_hmac('sha256', "{$timestamp}.{$body}", $this->secret);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error_code' => 'INVALID_ANOOFY_SIGNATURE',
            ]);
    }

    public function test_rejects_invalid_signature(): void
    {
        $timestamp = now()->timestamp;
        $body = json_encode(['schema_version' => 1]);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => 'wrong-signature',
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error_code' => 'INVALID_ANOOFY_SIGNATURE',
            ]);
    }

    public function test_rejects_invalid_payload(): void
    {
        $timestamp = now()->timestamp;
        $body = 'invalid-json';
        $sig = hash_hmac('sha256', "{$timestamp}.{$body}", $this->secret);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error_code' => 'INVALID_ANOOFY_PAYLOAD',
            ]);
    }

    public function test_processes_valid_event_and_records_inbox(): void
    {
        $timestamp = now()->timestamp;
        $fixturePath = dirname(__DIR__, 2) . '/../docs/integrations/fixtures/order.confirmed.json';
        $body = (string) file_get_contents($fixturePath);
        $sig = hash_hmac('sha256', "{$timestamp}.{$body}", $this->secret);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::PROCESSED->value,
                ],
            ]);

        $this->assertDatabaseHas('anoofy_inbox_events', [
            'user_id' => $this->user->id,
            'event_id' => '22222222-2222-4222-8222-222222222222',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'order_version' => 1,
            'result' => AnoofyEventResult::PROCESSED->value,
        ]);
    }

    public function test_handles_duplicate_event_idempotently(): void
    {
        AnoofyInboxEvent::create([
            'user_id' => $this->user->id,
            'event_id' => '22222222-2222-4222-8222-222222222222',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'order_version' => 1,
            'result' => AnoofyEventResult::PROCESSED->value,
            'received_at' => now()->subMinute(),
        ]);

        $timestamp = now()->timestamp;
        $fixturePath = dirname(__DIR__, 2) . '/../docs/integrations/fixtures/order.confirmed.json';
        $body = (string) file_get_contents($fixturePath);
        $sig = hash_hmac('sha256', "{$timestamp}.{$body}", $this->secret);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::DUPLICATE->value,
                    'reason' => 'already_processed',
                ],
            ]);

        // Still only 1 row in DB
        $this->assertSame(1, AnoofyInboxEvent::where('event_id', '22222222-2222-4222-8222-222222222222')->count());
    }
}
