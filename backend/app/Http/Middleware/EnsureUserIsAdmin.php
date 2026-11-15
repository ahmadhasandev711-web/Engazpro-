<?php

namespace App\Http\Middleware;

use App\Enums\AdminAuditAction;
use App\Models\User;
use App\Services\AdminAuditService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function __construct(protected AdminAuditService $auditService) {}

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user || !$user->is_admin || !$user->isActive()) {
            $reason = !$user?->is_admin ? 'not_admin' : 'inactive_admin';

            return $this->denyAccess(
                $request,
                $user,
                $reason,
                'عذراً، لا تمتلك الصلاحيات الكافية للوصول إلى لوحة تحكم الإدارة العامة.'
            );
        }

        if (!$this->isIpAllowed($request->ip())) {
            return $this->denyAccess(
                $request,
                $user,
                'ip_not_allowed',
                'عذراً، عنوان الشبكة (IP) الحالي غير مصرح له بالوصول إلى لوحة الإدارة.'
            );
        }

        return $next($request);
    }

    private function denyAccess(Request $request, ?User $user, string $reason, string $message): Response
    {
        if ($user) {
            $this->auditService->record(
                action: AdminAuditAction::ADMIN_ACCESS_DENIED,
                summary: "رفض دخول إداري ({$reason}) من عنوان IP {$request->ip()}",
                targetUser: $user,
                metadata: ['reason' => $reason, 'path' => $request->path()],
                actor: $user,
            );
        }

        return response()->json([
            'success' => false,
            'message' => $message,
        ], 403);
    }

    private function isIpAllowed(?string $ip): bool
    {
        $configured = config('pos.admin.allowed_ips', []);
        $allowed = is_array($configured)
            ? array_values(array_filter(array_map('trim', $configured)))
            : array_values(array_filter(array_map('trim', explode(',', (string) $configured))));

        if (empty($allowed)) {
            return true;
        }

        return $ip !== null && in_array($ip, $allowed, true);
    }
}
