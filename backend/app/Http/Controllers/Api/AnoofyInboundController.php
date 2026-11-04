<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Anoofy\AnoofyInboundService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnoofyInboundController extends Controller
{
    public function __construct(
        private readonly AnoofyInboundService $service,
    ) {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $kid = (string) $request->header('X-Anoofy-Key-Id', '');
        $timestamp = (int) $request->header('X-Anoofy-Timestamp', 0);
        $signature = (string) $request->header('X-Anoofy-Signature', '');
        $rawBody = (string) $request->getContent();

        $data = $this->service->receive($kid, $timestamp, $signature, $rawBody);

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
