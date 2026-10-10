<?php

namespace App\Observers;

use App\Jobs\PushCustomerToWooCommerceJob;
use App\Models\Party;

class PartyWooCommerceObserver
{
    public function created(Party $party): void
    {
        // Outbound sync of local customers to WooCommerce is disabled by business requirement
        // (POS customers lack emails and may be wholesale entities; inbound sync WooCommerce -> Kashat only)
    }

    public function updated(Party $party): void
    {
        // Outbound sync of local customers to WooCommerce is disabled by business requirement
    }
}
