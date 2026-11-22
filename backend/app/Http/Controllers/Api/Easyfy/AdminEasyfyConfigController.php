<?php

namespace App\Http\Controllers\Api\Easyfy;

use App\Http\Controllers\Controller;
use App\Http\Requests\Easyfy\Admin\SaveEasyfyCouponRequest;
use App\Http\Requests\Easyfy\Admin\SaveEasyfyShippingZoneRequest;
use App\Http\Requests\Easyfy\Admin\UpdateEasyfySettingsRequest;
use App\Http\Resources\Easyfy\EasyfyCouponResource;
use App\Http\Resources\Easyfy\EasyfyShippingZoneResource;
use App\Services\Easyfy\EasyfyCatalogAdminService;
use App\Services\Easyfy\EasyfySettingsService;
use Illuminate\Http\JsonResponse;

class AdminEasyfyConfigController extends Controller
{
    public function __construct(
        private readonly EasyfyCatalogAdminService $adminService,
        private readonly EasyfySettingsService $settingsService,
    ) {}

    public function coupons(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => EasyfyCouponResource::collection($this->adminService->listCoupons())]);
    }

    public function storeCoupon(SaveEasyfyCouponRequest $request): JsonResponse
    {
        $coupon = $this->adminService->saveCoupon($request->user(), $request->validated());

        return response()->json(['success' => true, 'data' => new EasyfyCouponResource($coupon)], 201);
    }

    public function updateCoupon(SaveEasyfyCouponRequest $request, int $id): JsonResponse
    {
        $coupon = $this->adminService->saveCoupon($request->user(), $request->validated(), $id);

        return response()->json(['success' => true, 'data' => new EasyfyCouponResource($coupon)]);
    }

    public function destroyCoupon(int $id): JsonResponse
    {
        $this->adminService->deleteCoupon($id);

        return response()->json(['success' => true, 'message' => 'تم حذف الكوبون بنجاح.']);
    }

    public function shippingZones(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => EasyfyShippingZoneResource::collection($this->adminService->listShippingZones())]);
    }

    public function storeShippingZone(SaveEasyfyShippingZoneRequest $request): JsonResponse
    {
        $zone = $this->adminService->saveShippingZone($request->validated());

        return response()->json(['success' => true, 'data' => new EasyfyShippingZoneResource($zone)], 201);
    }

    public function updateShippingZone(SaveEasyfyShippingZoneRequest $request, int $id): JsonResponse
    {
        $zone = $this->adminService->saveShippingZone($request->validated(), $id);

        return response()->json(['success' => true, 'data' => new EasyfyShippingZoneResource($zone)]);
    }

    public function destroyShippingZone(int $id): JsonResponse
    {
        $this->adminService->deleteShippingZone($id);

        return response()->json(['success' => true, 'message' => 'تم حذف منطقة الشحن بنجاح.']);
    }

    public function settings(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->settingsService->all()]);
    }

    public function updateSettings(UpdateEasyfySettingsRequest $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->settingsService->update($request->user(), $request->validated())]);
    }
}
