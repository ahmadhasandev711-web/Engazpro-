<?php

namespace Tests\Feature;

use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Party;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ExpenseCategoryTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $otherOwner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => 'OWNER',
            'owner_id' => null,
            'status' => 'ACTIVE',
        ]);
        $this->owner->subscription()->create([
            'plan' => 'BASIC',
            'status' => 'ACTIVE',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ]);

        $this->otherOwner = User::factory()->create([
            'role' => 'OWNER',
            'owner_id' => null,
            'status' => 'ACTIVE',
        ]);
        $this->otherOwner->subscription()->create([
            'plan' => 'BASIC',
            'status' => 'ACTIVE',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ]);
    }

    public function test_categories_are_auto_seeded_on_first_query(): void
    {
        $response = $this->actingAs($this->owner)->getJson('/api/expense-categories');

        $response->assertOk()
            ->assertJson(['success' => true])
            ->assertJsonCount(7, 'data');

        $this->assertDatabaseHas('expense_categories', [
            'user_id' => $this->owner->id,
            'name' => 'وقود وبنزين',
            'is_default' => true,
        ]);
    }

    public function test_user_can_create_custom_expense_category(): void
    {
        $response = $this->actingAs($this->owner)->postJson('/api/expense-categories', [
            'name' => 'تسويق وإعلانات فيسبوك',
        ]);

        $response->assertCreated()
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'تسويق وإعلانات فيسبوك',
                    'is_default' => false,
                ],
            ]);

        $this->assertDatabaseHas('expense_categories', [
            'user_id' => $this->owner->id,
            'name' => 'تسويق وإعلانات فيسبوك',
        ]);
    }

    public function test_cannot_create_duplicate_expense_category_name(): void
    {
        $this->actingAs($this->owner)->postJson('/api/expense-categories', [
            'name' => 'نثريات مكتب',
        ]);

        $response = $this->actingAs($this->owner)->postJson('/api/expense-categories', [
            'name' => 'نثريات مكتب',
        ]);

        $response->assertStatus(422);
    }

    public function test_user_can_update_category_and_synced_expenses(): void
    {
        $category = ExpenseCategory::create([
            'user_id' => $this->owner->id,
            'name' => 'كهرباء ومياه',
            'is_default' => false,
        ]);

        $expense = Expense::create([
            'user_id' => $this->owner->id,
            'created_by' => $this->owner->id,
            'title' => 'فاتورة كهرباء المحل',
            'category' => 'كهرباء ومياه',
            'amount' => 500,
            'date' => now()->toDateString(),
        ]);

        $response = $this->actingAs($this->owner)->putJson("/api/expense-categories/{$category->id}", [
            'name' => 'مرافق حكومية وخدمات',
        ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'data' => [
                    'name' => 'مرافق حكومية وخدمات',
                ],
            ]);

        $this->assertDatabaseHas('expense_categories', [
            'id' => $category->id,
            'name' => 'مرافق حكومية وخدمات',
        ]);

        $this->assertDatabaseHas('expenses', [
            'id' => $expense->id,
            'category' => 'مرافق حكومية وخدمات',
        ]);
    }

    public function test_user_can_delete_category(): void
    {
        $category = ExpenseCategory::create([
            'user_id' => $this->owner->id,
            'name' => 'تصنيف مؤقت',
            'is_default' => false,
        ]);

        $response = $this->actingAs($this->owner)->deleteJson("/api/expense-categories/{$category->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('expense_categories', ['id' => $category->id]);
    }

    public function test_categories_are_isolated_between_tenants(): void
    {
        $category = ExpenseCategory::create([
            'user_id' => $this->otherOwner->id,
            'name' => 'خاص بالمتجر الآخر',
            'is_default' => false,
        ]);

        $response = $this->actingAs($this->owner)->putJson("/api/expense-categories/{$category->id}", [
            'name' => 'محاولة اختراق',
        ]);

        $response->assertNotFound();
    }

    public function test_creating_party_does_not_push_to_woocommerce(): void
    {
        Queue::fake();

        $this->actingAs($this->owner)->postJson('/api/parties', [
            'name' => 'عميل محلي كاشات',
            'type' => 'CUSTOMER',
            'phone' => '01011112222',
        ]);

        Queue::assertNothingPushed();
    }
}
