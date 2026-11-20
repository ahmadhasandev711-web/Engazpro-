<?php

namespace App\Services;

use App\Enums\AdminAuditAction;
use App\Enums\StoreInquiryStatus;
use App\Exceptions\PosDomainException;
use App\Models\StoreInquiry;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class StoreInquiryService
{
    public function __construct(
        protected AdminAuditService $auditService
    ) {}

    public function submitPublicInquiry(array $validated): ?StoreInquiry
    {
        if ($this->isBotTrapTriggered($validated)) {
            Log::info('Blocked automated spam store inquiry via trap.');
            return null;
        }

        $cleanPhone = trim((string) $validated['phone']);
        $this->assertNotDuplicateRecentPhone($cleanPhone);

        return StoreInquiry::create([
            'name' => trim((string) $validated['name']),
            'phone' => $cleanPhone,
            'business_type' => $validated['business_type'] ?? null,
            'city' => $validated['city'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'status' => StoreInquiryStatus::NEW->value,
        ]);
    }

    private function isBotTrapTriggered(array $validated): bool
    {
        if (!empty(trim((string) ($validated['company_ref'] ?? '')))) {
            return true;
        }

        return array_key_exists('elapsed_ms', $validated)
            && $validated['elapsed_ms'] !== null
            && (int) $validated['elapsed_ms'] < 1200;
    }

    private function assertNotDuplicateRecentPhone(string $cleanPhone): void
    {
        $digits = preg_replace('/\D+/', '', $cleanPhone) ?: $cleanPhone;
        $cacheKey = 'store_inquiry_phone_lock:' . sha1($digits);
        $recentlyStored = StoreInquiry::where('phone', $cleanPhone)
            ->where('created_at', '>=', now()->subMinutes(30))
            ->exists();

        if ($recentlyStored || !Cache::add($cacheKey, true, now()->addMinutes(30))) {
            throw new PosDomainException(
                'تم استلام طلبك بهذا الرقم بالفعل منذ قليل، وسيتواصل معك فريقنا قريباً.',
                'DUPLICATE_STORE_INQUIRY',
                429
            );
        }
    }

    public function listWithStats(?string $status, ?string $search, int $perPage): array
    {
        $query = $this->applyFilters(StoreInquiry::query(), $status, $search);

        return [
            'stats' => $this->getStats(),
            'inquiries' => $query->latest()->paginate(min($perPage, 100)),
        ];
    }

    public function updateInquiry(int $id, array $validated): StoreInquiry
    {
        $inquiry = StoreInquiry::findOrFail($id);
        $inquiry->update($validated);

        $this->auditService->record(
            action: AdminAuditAction::INQUIRY_UPDATED,
            summary: "تحديث طلب متجر ({$inquiry->name}) إلى {$inquiry->status}",
            metadata: ['inquiry_id' => $inquiry->id, 'status' => $inquiry->status],
            targetType: StoreInquiry::class,
            targetId: $inquiry->id,
        );

        return $inquiry;
    }

    public function deleteInquiry(int $id): void
    {
        $inquiry = StoreInquiry::findOrFail($id);
        $inquiry->delete();

        $this->auditService->record(
            action: AdminAuditAction::INQUIRY_DELETED,
            summary: "حذف طلب متجر ({$inquiry->name})",
            metadata: ['inquiry_id' => $id, 'phone' => $inquiry->phone],
            targetType: StoreInquiry::class,
            targetId: $id,
        );
    }

    private function applyFilters(Builder $query, ?string $status, ?string $search): Builder
    {
        $allowed = array_column(StoreInquiryStatus::cases(), 'value');
        if ($status && in_array($status, $allowed, true)) {
            $query->where('status', $status);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('business_type', 'like', "%{$search}%");
            });
        }

        return $query;
    }

    private function getStats(): array
    {
        return [
            'total' => StoreInquiry::count(),
            'new' => StoreInquiry::where('status', StoreInquiryStatus::NEW->value)->count(),
            'contacted' => StoreInquiry::where('status', StoreInquiryStatus::CONTACTED->value)->count(),
            'contracted' => StoreInquiry::where('status', StoreInquiryStatus::CONTRACTED->value)->count(),
        ];
    }
}
