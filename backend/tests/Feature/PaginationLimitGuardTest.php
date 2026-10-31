<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Branch;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaginationLimitGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_per_page_is_bounded_to_pos_pagination_max_in_transfer_and_branch_inventory(): void
    {
        $owner = User::create([
            'name' => 'مالك تجربة التحجيم',
            'phone' => '01088889999',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER,
            'status' => UserStatus::ACTIVE,
        ]);

        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
        ]);

        $branch1 = Branch::create([
            'user_id' => $owner->id,
            'name' => 'الفرع الأول',
            'code' => 'BR-01',
            'is_main' => true,
        ]);

        $branch2 = Branch::create([
            'user_id' => $owner->id,
            'name' => 'الفرع الثاني',
            'code' => 'BR-02',
            'is_main' => false,
        ]);

        $token = $owner->createToken('test')->plainTextToken;

        // 1. اختبار StockTransferService
        $resTransfer = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/stock-transfers?per_page=100000');

        $resTransfer->assertStatus(200);
        $transferMeta = $resTransfer->json('meta');
        $this->assertLessThanOrEqual(
            100,
            $transferMeta['per_page'] ?? 0,
            'سقف per_page للتحويلات المخزنية يجب ألا يتجاوز 100'
        );

        // 2. اختبار BranchService inventory
        $resInventory = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/branches/{$branch1->id}/inventory?per_page=100000");

        $resInventory->assertStatus(200);
        $inventoryMeta = $resInventory->json('meta');
        $this->assertLessThanOrEqual(
            100,
            $inventoryMeta['per_page'] ?? 0,
            'سقف per_page لجرد الفرع يجب ألا يتجاوز 100'
        );
    }
}
