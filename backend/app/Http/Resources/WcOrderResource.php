<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Models\WcOrder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WcOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var WcOrder $order */
        $order = $this->resource;
        $user = $request->user();
        $canViewPhone = $user && $this->userCanViewCustomerPhone($user, $order);

        $data = $order->toArray();

        if (!$canViewPhone) {
            $data['customer_phone'] = null;
            if (isset($data['party']) && is_array($data['party'])) {
                $data['party']['phone'] = null;
            }
        }

        return $data;
    }

    protected function userCanViewCustomerPhone(User $user, WcOrder $order): bool
    {
        if ($user->isOwnerOrAdmin() || $user->isManager() || $user->isSupervisor()) {
            return true;
        }

        if ($user->isMandob()) {
            return (int) $order->mandob_id === (int) $user->id;
        }

        return false;
    }
}
