<?php

use App\Services\Easyfy\EasyfyMediaService;
use App\Services\ProductImageService;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'service' => config('app.name'),
        'status' => 'ok',
    ]);
});

Route::get('/storage/tenants/{tenantId}/products/{filename}', function (
    int $tenantId,
    string $filename,
    ProductImageService $imageService
) {
    return $imageService->serveTenantProductImage($tenantId, $filename);
})
    ->whereNumber('tenantId')
    ->where('filename', '[A-Za-z0-9\-_]+\.(webp|jpe?g|png)');

Route::get('/storage/easyfy/catalog/{filename}', function (
    string $filename,
    EasyfyMediaService $mediaService
) {
    return $mediaService->serveCatalogImage($filename);
})->where('filename', '[A-Za-z0-9\-_]+\.(webp|jpe?g|png)');
