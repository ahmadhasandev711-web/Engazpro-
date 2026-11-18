<?php

namespace App\Services;

use App\Models\Product;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductImageService
{
    private const PUBLIC_PREFIX = '/storage/';
    private const TENANT_PREFIX = '/storage/tenants/';

    public function uploadProductImage(User $user, Product $product, UploadedFile $file): Product
    {
        $ext = $this->resolveSafeExtension($file);
        $directory = "tenants/{$user->getAccountId()}/products";
        $filename = Str::uuid()->toString().'.'.$ext;
        $storedPath = $file->storeAs($directory, $filename, 'public');
        $previousImageUrl = $product->image_url;

        try {
            $updated = DB::transaction(function () use ($product, $storedPath) {
                $product->update(['image_url' => self::PUBLIC_PREFIX.$storedPath]);

                return $product->fresh(['category', 'variants', 'batches']);
            });
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($storedPath);
            throw $e;
        }

        $this->deleteLocalImageIfOwned($previousImageUrl);

        return $updated;
    }

    public function removeProductImage(Product $product): Product
    {
        $previousImageUrl = $product->image_url;

        $updated = DB::transaction(function () use ($product) {
            $product->update(['image_url' => null]);

            return $product->fresh(['category', 'variants', 'batches']);
        });

        $this->deleteLocalImageIfOwned($previousImageUrl);

        return $updated;
    }

    public function deleteLocalImagesForProduct(Product $product): void
    {
        $this->deleteLocalImageIfOwned($product->image_url);

        if ($product->relationLoaded('variants')) {
            foreach ($product->variants as $variant) {
                $this->deleteLocalImageIfOwned($variant->image_url);
            }
        }
    }

    public function deleteLocalImageIfOwned(?string $imageUrl): void
    {
        if (!$imageUrl || !str_starts_with($imageUrl, self::TENANT_PREFIX)) {
            return;
        }

        $relativePath = substr($imageUrl, strlen(self::PUBLIC_PREFIX));
        if ($relativePath !== '' && !str_contains($relativePath, '..')) {
            Storage::disk('public')->delete($relativePath);
        }
    }

    public function serveTenantProductImage(int $tenantId, string $filename): StreamedResponse
    {
        $relativePath = "tenants/{$tenantId}/products/{$filename}";
        abort_unless(Storage::disk('public')->exists($relativePath), 404);

        return Storage::disk('public')->response($relativePath, null, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    public static function toPublicUrl(?string $imageUrl): ?string
    {
        if ($imageUrl === null || trim($imageUrl) === '') {
            return null;
        }

        $trimmed = trim($imageUrl);
        if (str_starts_with($trimmed, 'http://') || str_starts_with($trimmed, 'https://')) {
            return $trimmed;
        }

        return str_starts_with($trimmed, '/') ? url($trimmed) : $trimmed;
    }

    private function resolveSafeExtension(UploadedFile $file): string
    {
        $raw = strtolower((string) ($file->guessExtension() ?: $file->getClientOriginalExtension() ?: 'webp'));

        return match ($raw) {
            'jpeg', 'jpg' => 'jpg',
            'png' => 'png',
            default => 'webp',
        };
    }
}
