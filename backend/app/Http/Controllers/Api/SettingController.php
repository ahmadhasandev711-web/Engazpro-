<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateStoreIdentityRequest;
use App\Services\SettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function __construct(
        protected SettingService $settingService
    ) {}

    /**
     * Get store identity and currency settings
     */
    public function getStoreIdentity(Request $request): JsonResponse
    {
        $data = $this->settingService->getStoreIdentity($request->user());

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * Update store identity and currency settings
     */
    public function updateStoreIdentity(UpdateStoreIdentityRequest $request): JsonResponse
    {
        $updated = $this->settingService->updateStoreIdentity($request->user(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات المنشأة والعملة بنجاح.',
            'data' => $updated,
        ]);
    }
}
