<?php

namespace App\Services\Easyfy;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EasyfyMediaService
{
    private const CATALOG_PREFIX = '/storage/easyfy/catalog/';
    private const PUBLIC_PREFIX = '/storage/';

    public function storeCatalogImage(UploadedFile $file): string
    {
        $ext = $this->resolveExtension($file, ['jpg', 'jpeg', 'png', 'webp']);
        $filename = Str::uuid()->toString() . '.' . $ext;
        $storedPath = $file->storeAs('easyfy/catalog', $filename, 'public');

        return self::PUBLIC_PREFIX . $storedPath;
    }

    public function serveCatalogImage(string $filename): StreamedResponse
    {
        $relativePath = 'easyfy/catalog/' . basename($filename);
        abort_unless(Storage::disk('public')->exists($relativePath), 404);

        return Storage::disk('public')->response($relativePath, null, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }

    public function deleteCatalogImage(?string $imageUrl): void
    {
        if (!$imageUrl || !str_starts_with($imageUrl, self::CATALOG_PREFIX)) {
            return;
        }
        $relativePath = substr($imageUrl, strlen(self::PUBLIC_PREFIX));
        if ($relativePath !== '' && !str_contains($relativePath, '..')) {
            Storage::disk('public')->delete($relativePath);
        }
    }

    public function storePrivateFile(UploadedFile $file, string $folder, array $allowed = ['jpg', 'jpeg', 'png', 'webp']): string
    {
        $ext = $this->resolveExtension($file, $allowed);
        $filename = Str::uuid()->toString() . '.' . $ext;

        return $file->storeAs('easyfy/' . trim($folder, '/'), $filename, 'local');
    }

    public function servePrivateFile(?string $relativePath): StreamedResponse
    {
        abort_if(!$relativePath || str_contains($relativePath, '..'), 404);
        abort_unless(Storage::disk('local')->exists($relativePath), 404);

        return Storage::disk('local')->response($relativePath, null, [
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function deletePrivateFile(?string $relativePath): void
    {
        if ($relativePath && !str_contains($relativePath, '..')) {
            Storage::disk('local')->delete($relativePath);
        }
    }

    private function resolveExtension(UploadedFile $file, array $allowed): string
    {
        $ext = strtolower($file->guessExtension() ?: $file->getClientOriginalExtension() ?: 'jpg');

        return in_array($ext, $allowed, true) ? $ext : $allowed[0];
    }
}
