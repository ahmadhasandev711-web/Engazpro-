<?php

namespace App\Services;

use App\Enums\DocumentType;
use App\Models\Branch;
use App\Models\DocumentSequence;
use App\Models\Invoice;
use App\Models\Shift;
use App\Models\StockTransfer;
use Illuminate\Support\Facades\DB;

class DocumentSequenceService
{
    /**
     * استخراج الرقم التسلسلي التالي للمستند للمتجر بشكل ذري وآمن ضد سباقات التزامن.
     * يستخدم قفل تشاؤمي (Pessimistic Locking) لضمان عدم تكرار الأرقام.
     */
    public function next(int $accountId, DocumentType $type): int
    {
        return DB::transaction(function () use ($accountId, $type) {
            $sequence = DocumentSequence::where('user_id', $accountId)
                ->where('type', $type->value)
                ->lockForUpdate()
                ->first();

            if (!$sequence) {
                $maxExisting = $this->getHighestExistingNumber($accountId, $type);
                $sequence = DocumentSequence::create([
                    'user_id' => $accountId,
                    'type' => $type->value,
                    'last_number' => $maxExisting,
                ]);
            }

            $sequence->last_number++;
            $sequence->save();

            return (int) $sequence->last_number;
        });
    }

    /**
     * حساب أعلى رقم موجود حالياً في النظام للمتاجر القديمة قبل تفعيل جدول التسلسل
     */
    private function getHighestExistingNumber(int $accountId, DocumentType $type): int
    {
        return match ($type) {
            DocumentType::SALE,
            DocumentType::PURCHASE,
            DocumentType::SALE_RETURN,
            DocumentType::PURCHASE_RETURN => $this->findMaxFromInvoices($accountId, $type->value),
            DocumentType::TRANSFER => $this->findMaxFromTransfers($accountId),
            DocumentType::SHIFT => $this->findMaxFromShifts($accountId),
            DocumentType::BRANCH => $this->findMaxFromBranches($accountId),
        };
    }

    private function findMaxFromInvoices(int $accountId, string $invoiceType): int
    {
        $numbers = Invoice::withTrashed()
            ->where('user_id', $accountId)
            ->where('type', $invoiceType)
            ->pluck('invoice_number');

        return $this->extractMaxNumber($numbers);
    }

    private function findMaxFromTransfers(int $accountId): int
    {
        $numbers = StockTransfer::where('user_id', $accountId)->pluck('transfer_number');
        return $this->extractMaxNumber($numbers);
    }

    private function findMaxFromShifts(int $accountId): int
    {
        $numbers = Shift::withoutGlobalScopes()->where('user_id', $accountId)->pluck('shift_number');
        return $this->extractMaxNumber($numbers);
    }

    private function findMaxFromBranches(int $accountId): int
    {
        $numbers = Branch::where('user_id', $accountId)->pluck('code');
        return $this->extractMaxNumber($numbers);
    }

    private function extractMaxNumber(iterable $numbers): int
    {
        $max = 0;
        foreach ($numbers as $num) {
            if (preg_match('/(\d+)$/', (string) $num, $matches)) {
                $val = (int) $matches[1];
                if ($val > $max) {
                    $max = $val;
                }
            }
        }
        return $max;
    }
}
