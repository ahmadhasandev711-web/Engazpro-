<?php

namespace Tests\Feature;

use App\Enums\PartyType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\Subscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LedgerStatementPaginationTest extends TestCase
{
    use RefreshDatabase;

    public function test_ledger_statement_pagination_and_cumulative_opening_balances(): void
    {
        $owner = User::create([
            'name' => 'مالك تجربة الحسابات',
            'phone' => '01055556666',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER,
            'status' => UserStatus::ACTIVE,
        ]);

        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
        ]);

        $token = $owner->createToken('test')->plainTextToken;

        $customer = Party::create([
            'user_id' => $owner->id,
            'name' => 'عميل كشف الحساب',
            'type' => PartyType::CUSTOMER,
            'phone' => '01099998888',
            'balance' => 0,
        ]);

        // إنشاء 250 حركة متعاقبة للعميل
        // كل حركة: مدين 100، دائن 40 -> صافي +60 لكل حركة
        $startDate = Carbon::parse('2026-01-01');
        $entries = [];
        $runningBalance = 0;

        for ($i = 1; $i <= 250; $i++) {
            $runningBalance += 60; // 100 - 40
            $entries[] = [
                'user_id' => $owner->id,
                'party_id' => $customer->id,
                'source_type' => 'INVOICE',
                'source_id' => $i,
                'date' => $startDate->copy()->addDays($i)->format('Y-m-d'),
                'description' => "حركة رقم {$i}",
                'debit' => 100,
                'credit' => 40,
                'balance_after' => $runningBalance,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
        LedgerEntry::insert($entries);
        $customer->update(['balance' => $runningBalance]);

        // 1. طلب الصفحة 1: يجب أن تحتوي على 100 حركة فقط
        $resPage1 = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/ledger/{$customer->id}?page=1");

        $resPage1->assertStatus(200);
        $data1 = $resPage1->json('data');
        $this->assertCount(100, $data1['entries'], 'الصفحة الأولى يجب أن تحتوي على 100 حركة');
        $this->assertEquals(0, $data1['summary']['opening_balance'], 'الرصيد الافتتاحي للصفحة الأولى بدون فلتر تاريخ يجب أن يكون 0');
        $closingPage1 = $data1['entries'][99]['balance_after']; // رصيد إغلاق الصفحة 1 (الحركة 100) = 6000

        // 2. طلب الصفحة 2: 100 حركة، ورصيدها الافتتاحي = رصيد إغلاق الصفحة 1
        $resPage2 = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/ledger/{$customer->id}?page=2");
        $resPage2->assertStatus(200);
        $data2 = $resPage2->json('data');
        $this->assertCount(100, $data2['entries']);
        $this->assertEquals($closingPage1, $data2['summary']['opening_balance'], 'الرصيد الافتتاحي للصفحة 2 يجب أن يساوي رصيد إغلاق الصفحة 1');
        $closingPage2 = $data2['entries'][99]['balance_after']; // رصيد إغلاق الصفحة 2 (الحركة 200) = 12000

        // 3. طلب الصفحة 3: 50 حركة، ورصيدها الافتتاحي = رصيد إغلاق الصفحة 2
        $resPage3 = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/ledger/{$customer->id}?page=3");
        $resPage3->assertStatus(200);
        $data3 = $resPage3->json('data');
        $this->assertCount(50, $data3['entries']);
        $this->assertEquals($closingPage2, $data3['summary']['opening_balance'], 'الرصيد الافتتاحي للصفحة 3 يجب أن يساوي رصيد إغلاق الصفحة 2');

        // 4. اختبار إضافي محدد من المطور: from_date بعد 30 حركة -> أول رصيد في الصفحة 1 = رصيد الحركة رقم 30
        $entry30 = LedgerEntry::where('party_id', $customer->id)->orderBy('id', 'asc')->skip(29)->first();
        $entry31 = LedgerEntry::where('party_id', $customer->id)->orderBy('id', 'asc')->skip(30)->first();
        $fromDate = $entry31->date;

        $resFiltered = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/ledger/{$customer->id}?from_date={$fromDate}&page=1");

        $resFiltered->assertStatus(200);
        $dataFiltered = $resFiltered->json('data');

        // رصيد ما قبله في الصفحة 1 يجب أن يساوي تماماً balance_after للحركة رقم 30
        $this->assertEquals(
            $entry30->balance_after,
            $dataFiltered['summary']['opening_balance'],
            'عند تحديد from_date بعد 30 حركة، يجب أن يكون الرصيد الافتتاحي للصفحة 1 هو رصيد الحركة 30'
        );
    }
}
