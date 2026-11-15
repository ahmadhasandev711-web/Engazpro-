<?php

namespace App\Services;

use App\Enums\AdminAuditAction;
use App\Models\AdminAuditLog;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;

class AdminAuditService
{
    public function record(
        AdminAuditAction $action,
        string $summary,
        ?User $targetUser = null,
        ?array $metadata = null,
        ?string $targetType = null,
        ?int $targetId = null,
        ?User $actor = null,
    ): AdminAuditLog {
        $request = request();
        $resolvedActor = $actor ?? $request?->user();

        return AdminAuditLog::create([
            'actor_user_id' => $resolvedActor?->id,
            'target_user_id' => $targetUser?->id,
            'action' => $action->value,
            'target_type' => $targetType ?? ($targetUser ? User::class : null),
            'target_id' => $targetId ?? $targetUser?->id,
            'summary' => Str::limit($summary, 495, '...'),
            'metadata' => $metadata,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent() ? Str::limit($request->userAgent(), 250, '') : null,
        ]);
    }

    public function recordRedeemFailure(User $user, string $normalizedCode, string $reason): AdminAuditLog
    {
        $prefix = mb_substr(trim($normalizedCode), 0, 4);

        return $this->record(
            action: AdminAuditAction::LICENSE_REDEEM_FAILED,
            summary: "فشل محاولة تفعيل كود يبدأ بـ ({$prefix}***)",
            targetUser: $user,
            metadata: [
                'user_id' => $user->id,
                'code_prefix' => $prefix,
                'reason' => $reason,
            ],
            actor: $user,
        );
    }

    public function getLogsPaginated(?string $action = null, ?string $search = null, int $perPage = 30): LengthAwarePaginator
    {
        $query = AdminAuditLog::with(['actor:id,name,phone', 'targetUser:id,name,phone'])
            ->orderByDesc('id');

        if ($action && $action !== 'all') {
            $query->where('action', $action);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('summary', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhereHas('actor', fn ($aq) => $aq->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"))
                    ->orWhereHas('targetUser', fn ($tq) => $tq->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
            });
        }

        return $query->paginate(min(max($perPage, 1), 100));
    }
}
