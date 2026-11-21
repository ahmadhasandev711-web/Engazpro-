<?php

namespace App\Services;

use App\Enums\PasswordResetRequestStatus;
use App\Exceptions\PosDomainException;
use App\Mail\OwnerPasswordOtpMail;
use App\Models\PasswordResetOtp;
use App\Models\PasswordResetRequest;
use App\Models\User;
use App\Support\PhoneNormalizer;
use App\Support\StoreCode;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class PasswordRecoveryService
{
    public const OTP_TTL_MINUTES = 10;

    public function requestRecovery(string $storeCode, string $phone, ?string $notes = null): array
    {
        $user = $this->findUserByStoreAndPhone($storeCode, $phone);
        if (!$user) {
            return [
                'mode' => 'SUBMITTED',
                'message' => 'إذا كان رقم الهاتف مسجلاً لدينا فسيتم إرسال رمز التحقق أو تسجيل طلب الاستعادة للمسؤول.',
            ];
        }

        if ($user->isOwner() && !$user->is_admin && !empty($user->email)) {
            $sent = $this->issueAndSendOwnerOtp($user);
            if ($sent) {
                return [
                    'mode' => 'OTP_EMAIL',
                    'masked_email' => $this->maskEmail((string) $user->email),
                    'message' => 'تم إرسال رمز تحقق من 6 أرقام إلى بريدك الإلكتروني المسجل.',
                ];
            }
        }

        return $this->recordResetRequest($user, $notes);
    }

    public function resetOwnerPasswordWithOtp(string $storeCode, string $phone, string $otp, string $newPassword): void
    {
        $user = $this->findUserByStoreAndPhone($storeCode, $phone);
        if (!$user || !$user->isOwner() || $user->is_admin) {
            throw new PosDomainException('رمز التحقق غير صحيح أو منتهي الصلاحية.', 'INVALID_RECOVERY_OTP', 422);
        }

        $record = PasswordResetOtp::where('user_id', $user->id)->whereNull('used_at')->latest('id')->first();
        if (!$record || !$record->isUsable()) {
            throw new PosDomainException('انتهت صلاحية رمز التحقق أو تم تجاوز عدد المحاولات المسموح.', 'OTP_EXPIRED_OR_LOCKED', 422);
        }

        $this->verifyOtpAndCommitPassword($record, $user, $otp, $newPassword);
    }

    public function getPendingRequestsForOwner(User $actor): Collection
    {
        $query = PasswordResetRequest::with(['user:id,name,phone,role,branch_id', 'user.branch:id,name'])
            ->where('owner_id', $actor->getAccountId())
            ->where('status', PasswordResetRequestStatus::PENDING)
            ->orderByDesc('id');

        if ($actor->isManager() && $actor->branch_id) {
            $query->whereHas('user', fn ($uq) => $uq->where('branch_id', $actor->branch_id));
        }

        return $query->get();
    }

    public function dismissRequestForOwner(User $actor, PasswordResetRequest $resetRequest): PasswordResetRequest
    {
        $isSameOwner = (int) $resetRequest->owner_id === $actor->getAccountId();
        $allowedBranch = !$actor->isManager() || ((int) ($resetRequest->user?->branch_id) === (int) $actor->branch_id);
        if (!$isSameOwner || !$allowedBranch) {
            throw new PosDomainException('غير مصرح لك بالتعامل مع هذا الطلب.', 'FORBIDDEN_RESET_REQUEST', 403);
        }

        $resetRequest->update([
            'status' => PasswordResetRequestStatus::DISMISSED,
            'handled_by' => $actor->id,
            'handled_at' => now(),
        ]);

        return $resetRequest->fresh();
    }

    public function getPendingRequestsForAdmin(): Collection
    {
        return PasswordResetRequest::with(['user:id,name,phone,email,business_name,role'])
            ->whereNull('owner_id')
            ->where('status', PasswordResetRequestStatus::PENDING)
            ->orderByDesc('id')
            ->get();
    }

    public function dismissRequestForAdmin(User $admin, PasswordResetRequest $resetRequest): PasswordResetRequest
    {
        $resetRequest->update([
            'status' => PasswordResetRequestStatus::DISMISSED,
            'handled_by' => $admin->id,
            'handled_at' => now(),
        ]);

        return $resetRequest->fresh();
    }

    public function resolvePendingRequestsForUser(int $userId, int $handlerId): void
    {
        PasswordResetRequest::where('user_id', $userId)
            ->where('status', PasswordResetRequestStatus::PENDING)
            ->update([
                'status' => PasswordResetRequestStatus::RESOLVED,
                'handled_by' => $handlerId,
                'handled_at' => now(),
            ]);
    }

    private function verifyOtpAndCommitPassword(PasswordResetOtp $record, User $user, string $otp, string $newPassword): void
    {
        if (!Hash::check($otp, $record->otp_hash)) {
            $record->increment('attempts');
            throw new PosDomainException('رمز التحقق المدخل غير صحيح.', 'INVALID_RECOVERY_OTP', 422);
        }

        DB::transaction(function () use ($record, $user, $newPassword) {
            $record->update(['used_at' => now()]);
            $user->update(['password' => Hash::make($newPassword)]);
            $user->revokeTokens();
            $this->resolvePendingRequestsForUser($user->id, $user->id);
        });
    }

    private function issueAndSendOwnerOtp(User $user): bool
    {
        $code = (string) random_int(100000, 999999);
        DB::transaction(function () use ($user, $code) {
            PasswordResetOtp::where('user_id', $user->id)->whereNull('used_at')->update(['used_at' => now()]);
            PasswordResetOtp::create([
                'user_id' => $user->id,
                'email' => (string) $user->email,
                'otp_hash' => Hash::make($code),
                'expires_at' => now()->addMinutes(self::OTP_TTL_MINUTES),
            ]);
        });

        return $this->trySendOtpMail($user, $code);
    }

    private function trySendOtpMail(User $user, string $code): bool
    {
        try {
            Mail::to((string) $user->email)->send(new OwnerPasswordOtpMail($user, $code, self::OTP_TTL_MINUTES));
            return true;
        } catch (\Throwable $e) {
            Log::warning("Failed sending OTP email to user #{$user->id}: " . $e->getMessage());
            return false;
        }
    }

    private function recordResetRequest(User $user, ?string $notes): array
    {
        $targetOwnerId = ($user->isOwner() || $user->is_admin) ? null : (int) $user->owner_id;
        $existing = PasswordResetRequest::where('user_id', $user->id)
            ->where('status', PasswordResetRequestStatus::PENDING)
            ->where('created_at', '>=', now()->subMinutes(15))
            ->first();

        if (!$existing) {
            PasswordResetRequest::create([
                'user_id' => $user->id,
                'owner_id' => $targetOwnerId,
                'phone' => $user->phone,
                'requester_role' => $user->role?->value,
                'status' => PasswordResetRequestStatus::PENDING,
                'notes' => $notes,
            ]);
        }

        $isStaff = $targetOwnerId !== null;
        return [
            'mode' => $isStaff ? 'STAFF_REQUEST' : 'OWNER_SUPPORT_REQUEST',
            'message' => $isStaff
                ? 'تم إرسال طلب استعادة كلمة المرور لصاحب المتجر أو مدير الفرع داخل لوحة فريق العمل.'
                : 'تم تسجيل طلب استعادة كلمة المرور لإدارة المنصة وسيتواصل معك فريق الدعم فوراً.',
        ];
    }

    private function findUserByStoreAndPhone(string $storeCode, string $phone): ?User
    {
        $code = StoreCode::normalize($storeCode);
        $query = StoreCode::isAdminCode($code)
            ? User::where('is_admin', true)
            : User::where('store_code', $code);

        return $query->whereIn('phone', PhoneNormalizer::variants($phone))->first();
    }

    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        if ($domain === '') {
            return '***';
        }
        $prefix = mb_substr($local, 0, min(2, mb_strlen($local)));

        return $prefix . '***@' . $domain;
    }
}
