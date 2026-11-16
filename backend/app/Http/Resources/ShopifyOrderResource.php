<?php

namespace App\Http\Resources;

use App\Models\ShopifyOrder;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShopifyOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var ShopifyOrder $order */
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

    protected function userCanViewCustomerPhone(User $user, ShopifyOrder $order): bool
    {
        if ($user->isOwnerOrAdmin() || $user->isManager() || $user->isSupervisor()) {
            return true;
        }

        return $user->isMandob() && (int) $order->mandob_id === (int) $user->id;
    }
}
