<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Validation\Rule;

trait HasScopedValidation
{
    protected function accountId(): ?int
    {
        return $this->user()?->getAccountId();
    }

    protected function scopedExists(string $table, string $column = 'id', bool $excludeTrashed = false): mixed
    {
        $accountId = $this->accountId();

        return $accountId
            ? Rule::exists($table, $column)->where(function ($q) use ($accountId, $table, $excludeTrashed) {
                $q->where('user_id', $accountId);
                if ($excludeTrashed || $table === 'branches') {
                    $q->whereNull('deleted_at');
                }
            })
            : "exists:{$table},{$column}";
    }

    protected function scopedAccountUserExists(): mixed
    {
        $accountId = $this->accountId();

        return $accountId
            ? Rule::exists('users', 'id')->where(fn ($q) => $q->where('id', $accountId)->orWhere('owner_id', $accountId))
            : 'exists:users,id';
    }
}
