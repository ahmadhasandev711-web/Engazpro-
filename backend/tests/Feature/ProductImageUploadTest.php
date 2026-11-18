<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductImageUploadTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'صاحب المتجر',
            'phone' => '01099887766',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER->value,
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'PRO',
        ]);

        $this->token = $this->owner->createToken('test')->plainTextToken;
    }

    public function test_owner_can_upload_replace_and_delete_product_image_with_cleanup(): void
    {
        Storage::fake('public');

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'تيشيرت قطن',
            'purchase_price' => 100,
            'sale_price' => 180,
            'quantity' => 10,
        ]);

        $firstFile = UploadedFile::fake()->image('shirt.png', 200, 200);
        $uploadRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/products/{$product->id}/image", [
                'image' => $firstFile,
            ]);

        $uploadRes->assertStatus(200)
            ->assertJsonPath('success', true);

        $firstDbPath = $product->fresh()->image_url;
        $this->assertNotNull($firstDbPath);
        $this->assertStringStartsWith("/storage/tenants/{$this->owner->id}/products/", $firstDbPath);
        $firstDiskPath = substr($firstDbPath, strlen('/storage/'));
        Storage::disk('public')->assertExists($firstDiskPath);

        $this->assertStringEndsWith($firstDbPath, $uploadRes->json('data.image_url'));

        // Verify POS catalog and products list expose image_url
        $catalogRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/products/pos-catalog');
        $catalogRes->assertStatus(200);
        $this->assertStringEndsWith($firstDbPath, $catalogRes->json('data.0.image_url'));

        // Verify fallback web route serves uploaded image cleanly with cache header
        $serveRes = $this->get($firstDbPath);
        $serveRes->assertStatus(200);
        $this->assertStringContainsString('max-age=31536000', (string) $serveRes->headers->get('Cache-Control'));

        // Replace with a second image -> old file must be deleted
        $secondFile = UploadedFile::fake()->image('shirt-v2.jpg', 200, 200);
        $replaceRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/products/{$product->id}/image", [
                'image' => $secondFile,
            ]);

        $replaceRes->assertStatus(200);
        $secondDbPath = $product->fresh()->image_url;
        $this->assertNotSame($firstDbPath, $secondDbPath);
        Storage::disk('public')->assertMissing($firstDiskPath);
        $secondDiskPath = substr((string) $secondDbPath, strlen('/storage/'));
        Storage::disk('public')->assertExists($secondDiskPath);

        // Delete product image
        $deleteRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->deleteJson("/api/products/{$product->id}/image");

        $deleteRes->assertStatus(200)
            ->assertJsonPath('data.image_url', null);
        $this->assertNull($product->fresh()->image_url);
        Storage::disk('public')->assertMissing($secondDiskPath);
    }

    public function test_external_image_url_is_exposed_and_preserved_in_pos_catalog(): void
    {
        Product::create([
            'user_id' => $this->owner->id,
            'name' => 'منتج ووكومرس',
            'purchase_price' => 50,
            'sale_price' => 90,
            'quantity' => 5,
            'image_url' => 'https://example-store.com/uploads/item.webp',
        ]);

        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/products/pos-catalog');

        $res->assertStatus(200)
            ->assertJsonPath('data.0.image_url', 'https://example-store.com/uploads/item.webp');
    }

    public function test_cashier_and_other_tenant_cannot_upload_or_delete_product_image(): void
    {
        Storage::fake('public');

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'قهوة تركي',
            'purchase_price' => 40,
            'sale_price' => 70,
            'quantity' => 15,
        ]);

        $cashier = User::create([
            'owner_id' => $this->owner->id,
            'name' => 'كاشير',
            'phone' => '01099887700',
            'password' => bcrypt('password123'),
            'role' => UserRole::CASHIER->value,
        ]);
        $cashierToken = $cashier->createToken('cashier')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$cashierToken}")
            ->postJson("/api/products/{$product->id}/image", [
                'image' => UploadedFile::fake()->image('coffee.png', 100, 100),
            ])
            ->assertStatus(403);

        $otherOwner = User::create([
            'name' => 'تاجر آخر',
            'phone' => '01099887711',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER->value,
        ]);
        Subscription::create([
            'user_id' => $otherOwner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);
        $otherToken = $otherOwner->createToken('other')->plainTextToken;
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', "Bearer {$otherToken}")
            ->postJson("/api/products/{$product->id}/image", [
                'image' => UploadedFile::fake()->image('hack.png', 100, 100),
            ])
            ->assertStatus(404);
    }

    public function test_rejects_invalid_file_type_or_oversized_image(): void
    {
        Storage::fake('public');

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'عصير',
            'purchase_price' => 10,
            'sale_price' => 20,
            'quantity' => 5,
        ]);

        $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/products/{$product->id}/image", [
                'image' => UploadedFile::fake()->create('malware.pdf', 100, 'application/pdf'),
            ])
            ->assertStatus(422);

        $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/products/{$product->id}/image", [
                'image' => UploadedFile::fake()->image('huge.jpg')->size(2048),
            ])
            ->assertStatus(422);
    }
}
