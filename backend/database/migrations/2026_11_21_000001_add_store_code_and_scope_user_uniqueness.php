<?php

use App\Support\StoreCode;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('store_code', 40)->nullable()->index()->after('id');
            $table->string('owned_store_code', 40)->nullable()->unique()->after('store_code');
        });

        $this->backfillStoreCodes();

        Schema::table('users', function (Blueprint $table) {
            $table->string('store_code', 40)->nullable(false)->change();
            $table->dropUnique(['phone']);
            $table->dropUnique(['email']);
            $table->unique(['store_code', 'phone'], 'users_store_code_phone_unique');
            $table->unique(['store_code', 'email'], 'users_store_code_email_unique');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_store_code_phone_unique');
            $table->dropUnique('users_store_code_email_unique');
            $table->unique('phone');
            $table->unique('email');
            $table->dropUnique(['owned_store_code']);
            $table->dropIndex(['store_code']);
            $table->dropColumn(['owned_store_code', 'store_code']);
        });
    }

    private function backfillStoreCodes(): void
    {
        $used = [];
        $owners = DB::table('users')->whereNull('owner_id')->orderBy('id')->get(['id', 'name', 'is_admin']);

        foreach ($owners as $owner) {
            if ((bool) $owner->is_admin) {
                $this->assignOwnerCode((int) $owner->id, StoreCode::ADMIN_CODE, false);
                continue;
            }
            $code = $this->resolveUniqueCode((int) $owner->id, (string) $owner->name, $used);
            $used[$code] = true;
            $this->assignOwnerCode((int) $owner->id, $code, true);
        }

        $this->backfillEmployees();
    }

    private function assignOwnerCode(int $ownerId, string $code, bool $ownsStore): void
    {
        DB::table('users')->where('id', $ownerId)->update([
            'store_code' => $code,
            'owned_store_code' => $ownsStore ? $code : null,
        ]);
        DB::table('users')->where('owner_id', $ownerId)->update([
            'store_code' => $code,
            'owned_store_code' => null,
        ]);
    }

    private function backfillEmployees(): void
    {
        $orphans = DB::table('users')->whereNull('store_code')->get(['id', 'owner_id']);
        foreach ($orphans as $row) {
            $fallback = 'store-' . ($row->owner_id ?: $row->id);
            DB::table('users')->where('id', $row->id)->update(['store_code' => $fallback]);
        }
    }

    /** @param array<string, bool> $used */
    private function resolveUniqueCode(int $ownerId, string $name, array $used): string
    {
        $slug = Str::slug($name);
        $base = (strlen($slug) >= 2 && !StoreCode::isReserved($slug) && StoreCode::isValidFormat($slug))
            ? substr($slug, 0, 24)
            : "store-{$ownerId}";

        $candidate = $base;
        if (isset($used[$candidate]) || StoreCode::isReserved($candidate)) {
            $candidate = substr($base, 0, 20) . '-' . $ownerId;
        }

        return $candidate;
    }
};
