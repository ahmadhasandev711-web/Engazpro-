<?php

namespace Tests\Feature;

use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Party;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentVoucherMethodsTest extends TestCase
{
    use RefreshDatabase;

    public function test_receipt_voucher_accepts_instapay_and_vodafone_cash_and_credits_wallet_treasury(): void
    {
        $owner = User::create([
            'name' => 'صاحب المتجر',
            'phone' => '01012345670',
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

        $customer = Party::create([
            'user_id' => $owner->id,
            'type' => PartyType::CUSTOMER->value,
            'name' => 'عميل إنستاباي',
            'balance' => 500,
        ]);

        $res1 = $this->actingAs($owner)->postJson('/api/payments', [
            'party_id' => $customer->id,
            'type' => 'RECEIPT',
            'amount' => 90,
            'method' => PaymentMethod::INSTAPAY->value,
            'date' => now()->toDateString(),
            'notes' => 'تحصيل إنستاباي',
        ]);

        $res1->assertStatus(201)->assertJsonPath('data.method', PaymentMethod::INSTAPAY->value);

        $res2 = $this->actingAs($owner)->postJson('/api/payments', [
            'party_id' => $customer->id,
            'type' => 'RECEIPT',
            'amount' => 110,
            'method' => PaymentMethod::VODAFONE_CASH->value,
            'date' => now()->toDateString(),
            'notes' => 'تحصيل فودافون كاش',
        ]);

        $res2->assertStatus(201)->assertJsonPath('data.method', PaymentMethod::VODAFONE_CASH->value);

        $this->assertEquals(300.0, (float) $customer->fresh()->balance);
        $walletSum = (float) Treasury::where('user_id', $owner->id)
            ->where('type', TreasuryType::WALLET->value)
            ->sum('balance');
        $this->assertEquals(200.0, $walletSum);
    }
}
