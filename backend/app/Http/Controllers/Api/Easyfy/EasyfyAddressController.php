<?php

namespace App\Http\Controllers\Api\Easyfy;

use App\Http\Controllers\Controller;
use App\Http\Requests\Easyfy\Storefront\StoreAddressRequest;
use App\Http\Resources\Easyfy\EasyfyAddressResource;
use App\Services\Easyfy\EasyfyAddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EasyfyAddressController extends Controller
{
    public function __construct(private readonly EasyfyAddressService $addressService) {}

    public function index(Request $request): JsonResponse
    {
        $addresses = $this->addressService->listForAccount($request->user());

        return response()->json(['success' => true, 'data' => EasyfyAddressResource::collection($addresses)]);
    }

    public function store(StoreAddressRequest $request): JsonResponse
    {
        $address = $this->addressService->create($request->user(), $request->validated());

        return response()->json(['success' => true, 'data' => new EasyfyAddressResource($address)], 201);
    }

    public function update(StoreAddressRequest $request, int $id): JsonResponse
    {
        $address = $this->addressService->update($request->user(), $id, $request->validated());

        return response()->json(['success' => true, 'data' => new EasyfyAddressResource($address)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->addressService->delete($request->user(), $id);

        return response()->json(['success' => true, 'message' => 'تم حذف العنوان بنجاح.']);
    }
}
