<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\Anoofy\AnoofyConnectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SimulatesHttpContext;
use Tests\TestCase;

class AnoofyConnectionTest extends TestCase
{
    use RefreshDatabase, SimulatesHttpContext;

    protected User $owner;
    protected User $manager;
    protected WooCommerceIntegration $integration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER->value]);
        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
            'price' => 1000,
        ]);

        $this->manager = User::factory()->create([
            'role' => UserRole::MANAGER->value,
            'owner_id' => $this->owner->id,
        ]);

        $branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'BR-01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://mystore.example.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'webhook_secret' => 'whsec_test',
            'online_branch_id' => $branch->id,
            'is_active' => true,
        ]);
    }

    public function test_owner_can_generate_connection_key_once_and_decode_payload(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson('/api/woocommerce/anoofy/connection-key');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $encodedKey = $response->json('data.connection_key');
        $this->assertNotEmpty($encodedKey);

        $decodedJson = AnoofyConnectionService::base64UrlDecode($encodedKey);
        $payload = json_decode($decodedJson, true);

        $this->assertIsArray($payload);
        $this->assertSame(1, $payload['v']);
        $this->assertSame(route('anoofy.inbound'), $payload['api']);
        $this->assertNotEmpty($payload['kid']);
        $this->assertNotEmpty($payload['secret']);
        $this->assertSame(64, strlen($payload['secret'])); // 32 bytes hex = 64 chars

        $fresh = $this->integration->fresh();
        $this->assertSame($payload['kid'], $fresh->anoofy_key_id);
        $this->assertNull($fresh->anoofy_connected_at);
    }

    public function test_get_settings_exposes_only_anoofy_connected_status_never_secret(): void
    {
        $this->actingAs($this->owner)->postJson('/api/woocommerce/anoofy/connection-key');

        $response = $this->actingAs($this->owner)->getJson('/api/woocommerce/settings');
        $response->assertOk();

        $data = $response->json('data');
        $this->assertArrayHasKey('anoofy_connected', $data);
        $this->assertArrayHasKey('anoofy_connected_at', $data);
        $this->assertFalse($data['anoofy_connected']);
        $this->assertNull($data['anoofy_connected_at']);

        $this->assertArrayNotHasKey('anoofy_secret', $data);
        $this->assertArrayNotHasKey('anoofy_key_id', $data);
    }

    public function test_disconnect_clears_kid_secret_and_connection_timestamps(): void
    {
        $this->actingAs($this->owner)->postJson('/api/woocommerce/anoofy/connection-key');
        $this->integration->update([
            'anoofy_callback_url' => 'https://mystore.example.com/wp-json/anoofy/v1/cb',
            'anoofy_connected_at' => now(),
        ]);

        $response = $this->actingAs($this->owner)->deleteJson('/api/woocommerce/anoofy/connection');
        $response->assertOk()
            ->assertJsonPath('success', true);

        $fresh = $this->integration->fresh();
        $this->assertNull($fresh->anoofy_key_id);
        $this->assertNull($fresh->anoofy_secret);
        $this->assertNull($fresh->anoofy_callback_url);
        $this->assertNull($fresh->anoofy_connected_at);
    }

    public function test_non_owner_receives_403_on_connection_key_and_disconnect(): void
    {
        $this->actingAs($this->manager)
            ->postJson('/api/woocommerce/anoofy/connection-key')
            ->assertStatus(403);

        $this->actingAs($this->manager)
            ->deleteJson('/api/woocommerce/anoofy/connection')
            ->assertStatus(403);
    }

    public function test_connection_key_api_url_is_routed_to_inbound_endpoint_and_verifies(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson('/api/woocommerce/anoofy/connection-key')
            ->assertOk();

        $encodedKey = $response->json('data.connection_key');
        $payload = json_decode(AnoofyConnectionService::base64UrlDecode($encodedKey), true);

        $this->assertIsArray($payload);
        $this->assertNotEmpty($payload['api']);

        $inboundPath = parse_url($payload['api'], PHP_URL_PATH);
        $this->assertNotEmpty($inboundPath);

        $body = json_encode([
            'schema_version' => 1,
            'event_id' => '11111111-1111-4111-8111-111111111111',
            'event_type' => \App\Enums\AnoofyEventType::CONNECTION_VERIFY->value,
            'occurred_at' => '2026-11-04T11:00:00Z',
            'order_version' => null,
            'data' => [
                'site_url' => 'https://mystore.example.com',
                'callback_url' => 'https://mystore.example.com/wp-json/anoofy/v1/callback',
                'plugin_version' => '1.0.0',
            ],
        ], JSON_THROW_ON_ERROR);

        $ts = now()->timestamp;
        $sig = hash_hmac('sha256', "{$ts}.{$body}", $payload['secret']);

        $verifyResponse = $this->call(
            'POST',
            $inboundPath,
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $payload['kid'],
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $ts,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $verifyResponse->assertStatus(200)
            ->assertJsonPath('success', true);
    }
}
