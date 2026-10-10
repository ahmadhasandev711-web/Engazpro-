<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ChangePasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_change_password_with_valid_current_password(): void
    {
        $user = User::factory()->create([
            'phone' => '01011112222',
            'password' => Hash::make('CorrectOldPass123'),
            'role' => UserRole::OWNER->value,
            'status' => 'ACTIVE',
        ]);

        // 1. Wrong current password fails
        $wrongCurrent = $this->actingAs($user)->postJson('/api/auth/change-password', [
            'current_password' => 'WrongPass999',
            'new_password' => 'NewSecretPassword123',
            'new_password_confirmation' => 'NewSecretPassword123',
        ]);
        $wrongCurrent->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'كلمة المرور الحالية غير صحيحة');

        // 2. Unmatched confirmation fails
        $unmatched = $this->actingAs($user)->postJson('/api/auth/change-password', [
            'current_password' => 'CorrectOldPass123',
            'new_password' => 'NewSecretPassword123',
            'new_password_confirmation' => 'DifferentPassword123',
        ]);
        $unmatched->assertStatus(422);

        // 3. Short new password fails
        $short = $this->actingAs($user)->postJson('/api/auth/change-password', [
            'current_password' => 'CorrectOldPass123',
            'new_password' => '123',
            'new_password_confirmation' => '123',
        ]);
        $short->assertStatus(422);

        // 4. Successful password change
        $success = $this->actingAs($user)->postJson('/api/auth/change-password', [
            'current_password' => 'CorrectOldPass123',
            'new_password' => 'BrandNewPassword@2026',
            'new_password_confirmation' => 'BrandNewPassword@2026',
        ]);
        $success->assertOk()
            ->assertJsonPath('success', true);

        // 5. Can login with the new password
        $loginRes = $this->postJson('/api/auth/login', [
            'phone' => '01011112222',
            'password' => 'BrandNewPassword@2026',
        ]);
        $loginRes->assertOk()
            ->assertJsonPath('success', true);
    }
}
