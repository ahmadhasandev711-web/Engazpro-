<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\BranchRequest;
use App\Models\Branch;
use App\Services\BranchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class BranchController extends Controller
{
    public function __construct(
        protected BranchService $branchService
    ) {}

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Branch::class);
        $branches = $this->branchService->getBranches($request->user(), $request->all());

        return response()->json([
            'success' => true,
            'data' => $branches,
        ]);
    }

    public function store(BranchRequest $request): JsonResponse
    {
        Gate::authorize('create', Branch::class);
        $branch = $this->branchService->createBranch($request->user(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الفرع بنجاح',
            'data' => $branch,
        ], 201);
    }

    public function show(Request $request, Branch $branch): JsonResponse
    {
        Gate::authorize('view', $branch);

        return response()->json([
            'success' => true,
            'data' => $branch->loadCount(['users', 'stocks']),
        ]);
    }

    public function update(BranchRequest $request, Branch $branch): JsonResponse
    {
        Gate::authorize('update', $branch);
        $updated = $this->branchService->updateBranch($branch, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات الفرع بنجاح',
            'data' => $updated,
        ]);
    }

    public function destroy(Request $request, Branch $branch): JsonResponse
    {
        Gate::authorize('delete', $branch);
        $this->branchService->deleteBranch($branch);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الفرع بنجاح',
        ]);
    }

    public function inventory(Request $request, Branch $branch): JsonResponse
    {
        Gate::authorize('inventory', $branch);
        $inventory = $this->branchService->getBranchInventory($branch, $request->all());

        return response()->json([
            'success' => true,
            'data' => $inventory->items(),
            'meta' => [
                'current_page' => $inventory->currentPage(),
                'last_page' => $inventory->lastPage(),
                'total' => $inventory->total(),
            ],
        ]);
    }
}
