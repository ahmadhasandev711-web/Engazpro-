<?php

namespace Tests\Unit\Support;

use App\Models\User;
use App\Support\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class TenantContextTest extends TestCase
{
    use RefreshDatabase;

    public function test_run_as_switches_user_and_restores_previous_user(): void
    {
        $userA = User::factory()->create();
        $userB = User::factory()->create();

        $this->actingAs($userA);
        $this->assertSame($userA->id, Auth::id());

        $executed = false;
        $result = TenantContext::runAs($userB->id, function () use ($userB, &$executed) {
            $executed = true;
            $this->assertSame($userB->id, Auth::id());
            return 'success';
        });

        $this->assertTrue($executed);
        $this->assertSame('success', $result);
        $this->assertSame($userA->id, Auth::id());
    }

    public function test_run_as_forgets_guards_when_no_previous_user(): void
    {
        $user = User::factory()->create();

        Auth::forgetGuards();
        $this->assertNull(Auth::user());

        TenantContext::runAs($user->id, function () use ($user) {
            $this->assertSame($user->id, Auth::id());
        });

        $this->assertNull(Auth::user());
    }
}
