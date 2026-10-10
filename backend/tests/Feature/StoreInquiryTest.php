<?php

namespace Tests\Feature;

use App\Models\StoreInquiry;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreInquiryTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_user_can_submit_store_inquiry(): void
    {
        $response = $this->postJson('/api/landing/inquiries', [
            'name' => 'محمد طارق',
            'phone' => '01012345678',
            'business_type' => 'ملابس وأحذية',
            'city' => 'القاهرة',
            'notes' => 'محتاجين متجر مربوط بالفرعين في مدينة نصر والتجمع',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('store_inquiries', [
            'name' => 'محمد طارق',
            'phone' => '01012345678',
            'status' => 'NEW',
        ]);
    }

    public function test_admin_can_view_and_update_inquiries(): void
    {
        $admin = User::factory()->create([
            'is_admin' => true,
        ]);

        $inquiry = StoreInquiry::create([
            'name' => 'عميل تجريبي',
            'phone' => '01198765432',
            'business_type' => 'عطور',
            'status' => 'NEW',
        ]);

        // List inquiries
        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/inquiries');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data',
                'stats' => ['total', 'new', 'contacted', 'contracted'],
            ]);

        // Update inquiry status
        $updateResponse = $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/admin/inquiries/{$inquiry->id}", [
                'status' => 'CONTACTED',
                'admin_notes' => 'تم التواصل بالواتساب وإرسال عرض السعر',
            ]);

        $updateResponse->assertStatus(200);
        $this->assertEquals('CONTACTED', $inquiry->fresh()->status);
        $this->assertEquals('تم التواصل بالواتساب وإرسال عرض السعر', $inquiry->fresh()->admin_notes);

        // Delete inquiry
        $deleteResponse = $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/inquiries/{$inquiry->id}");

        $deleteResponse->assertStatus(200);
        $this->assertDatabaseMissing('store_inquiries', ['id' => $inquiry->id]);
    }

    public function test_non_admin_cannot_access_inquiries_management(): void
    {
        $user = User::factory()->create([
            'is_admin' => false,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/admin/inquiries');

        $response->assertStatus(403);
    }
}
