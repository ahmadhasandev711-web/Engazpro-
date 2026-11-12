<?php

namespace Tests\Unit\Services\Anoofy;

use App\Contracts\HostResolver;
use App\Exceptions\Anoofy\AnoofySecurityException;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\Anoofy\HttpAnoofyOutboundClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class HttpAnoofyOutboundClientDevNetworkTest extends TestCase
{
    use RefreshDatabase;

    private HostResolver $fakeResolver;
    private WooCommerceIntegration $integration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeResolver = new class implements HostResolver {
            public function resolve(string $host): array
            {
                if ($host === 'anoofy-wp.test') {
                    return ['172.25.0.2'];
                }
                return [];
            }
        };

        $user = User::factory()->create();
        $this->integration = WooCommerceIntegration::create([
            'user_id' => $user->id,
            'store_url' => 'http://anoofy-wp.test:28080',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'anoofy_callback_url' => 'http://anoofy-wp.test:28080/wp-json/anoofy/v1/events',
            'anoofy_key_id' => 'ak_test_123',
            'anoofy_secret' => bin2hex(random_bytes(32)),
        ]);
    }

    public function test_allows_sending_to_internal_ip_in_local_when_key_is_true(): void
    {
        $this->app->detectEnvironment(fn() => 'local');
        config(['anoofy.allow_insecure_dev_network' => true]);

        Http::fake([
            'http://anoofy-wp.test:28080/*' => Http::response(['ok' => true], 200),
        ]);

        $client = new HttpAnoofyOutboundClient($this->fakeResolver);
        $response = $client->send($this->integration, ['event' => 'order.status_changed']);

        $this->assertTrue($response->successful());
    }

    public function test_rejects_sending_to_internal_ip_in_production_even_if_key_is_true(): void
    {
        $this->app->detectEnvironment(fn() => 'production');
        config(['anoofy.allow_insecure_dev_network' => true]);

        $client = new HttpAnoofyOutboundClient($this->fakeResolver);

        $this->expectException(AnoofySecurityException::class);
        $this->expectExceptionMessage('internal_ip_rejected');

        $client->send($this->integration, ['event' => 'order.status_changed']);
    }

    public function test_rejects_sending_to_unresolvable_host_in_local_even_when_key_is_true(): void
    {
        $this->app->detectEnvironment(fn() => 'local');
        config(['anoofy.allow_insecure_dev_network' => true]);

        $this->integration->anoofy_callback_url = 'http://unresolvable.test:28080/events';

        $client = new HttpAnoofyOutboundClient($this->fakeResolver);

        $this->expectException(AnoofySecurityException::class);
        $this->expectExceptionMessage('unresolvable_host');

        $client->send($this->integration, ['event' => 'order.status_changed']);
    }
}
