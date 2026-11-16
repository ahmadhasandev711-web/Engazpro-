<?php

namespace App\Http\Requests\Concerns;

use Illuminate\Validation\Rule;

trait HasScopedValidation
{
    protected function accountId(): ?int
    {
        return $this->user()?->getAccountId();
    }

    protected function scopedExists(string $table, string $column = 'id'): mixed
    {
        $accountId = $this->accountId();

        return $accountId
            ? Rule::exists($table, $column)->where('user_id', $accountId)
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
