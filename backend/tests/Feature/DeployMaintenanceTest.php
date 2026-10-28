<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class DeployMaintenanceTest extends TestCase
{
    public function test_endpoint_is_closed_when_secret_is_not_configured(): void
    {
        config(['pos.deploy_sync_secret' => null]);

        $this->getJson('/api/ops/maintenance-sync-7b3e9a?token=anything')
            ->assertForbidden();
    }

    public function test_endpoint_rejects_a_wrong_token(): void
    {
        config(['pos.deploy_sync_secret' => 'correct-secret']);

        $this->getJson('/api/ops/maintenance-sync-7b3e9a', [
            'X-Deploy-Token' => 'wrong-secret',
        ])->assertForbidden();
    }

    public function test_valid_token_refreshes_cache_and_never_migrates(): void
    {
        config(['pos.deploy_sync_secret' => 'correct-secret']);

        $commands = [];
        Artisan::shouldReceive('call')->andReturnUsing(function (string $command) use (&$commands) {
            $commands[] = $command;

            return 0;
        });
        Artisan::shouldReceive('output')->andReturn('ok');

        $this->getJson('/api/ops/maintenance-sync-7b3e9a', [
            'X-Deploy-Token' => 'correct-secret',
        ])->assertOk()
            ->assertJsonPath('message', 'تم تحديث كاش التطبيق.');

        $this->assertSame(
            ['optimize:clear', 'config:cache', 'route:cache', 'view:cache'],
            $commands
        );
        $this->assertNotContains('migrate', $commands);
    }
}
