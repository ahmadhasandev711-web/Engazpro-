<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Invoice $invoice): Response
    {
        if ($user->isOwnerOrAdmin()) {
            return Response::allow();
        }

        if ($user->isManager()) {
            return ($user->branch_id && (int) $invoice->branch_id === (int) $user->branch_id)
                ? Response::allow()
                : Response::deny('عذراً، لا يمكنك عرض فواتير فروع أخرى');
        }

        return $invoice->created_by === $user->id
            ? Response::allow()
            : Response::deny('عذراً، لا تملك صلاحية عرض هذه الفاتورة');
    }

    public function create(User $user, ?string $invoiceType = null): Response
    {
        if ($user->isOwnerOrAdmin() || $user->isManager()) {
            return Response::allow();
        }

        // Cashier, Sales, and Mandob cannot create purchase invoices
        if ($invoiceType && in_array($invoiceType, ['PURCHASE', 'PURCHASE_RETURN'], true)) {
            return Response::deny('عذراً، صلاحية إنشاء أو تعديل فواتير المشتريات مقتصرة على المالك والإدارة ومديري الفروع فقط.');
        }

        return Response::allow();
    }

    public function delete(User $user, Invoice $invoice): Response
    {
        return !$user->isOwnerOrAdmin()
            ? Response::deny('عذراً، لا تملك صلاحية حذف أو إلغاء الفواتير')
            : Response::allow();
    }

    public function updateSalesperson(User $user, Invoice $invoice): Response
    {
        if ($user->isOwnerOrAdmin()) {
            return Response::allow();
        }

        if ($user->isManager()) {
            return ($user->branch_id && (int) $invoice->branch_id === (int) $user->branch_id)
                ? Response::allow()
                : Response::deny('عذراً، لا يمكنك تعديل فواتير فروع أخرى');
        }

        return Response::deny('عذراً، تعديل مسؤول المبيعات متاح للمالك والإدارة ومدير الفرع فقط');
    }
}
