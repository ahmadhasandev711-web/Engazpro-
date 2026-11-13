<?php

namespace App\Support;

class DevNetworkPolicy
{
    /**
     * Determines whether insecure network communication (HTTP / internal Docker IPs)
     * is allowed exclusively during local development with the dev network flag enabled.
     */
    public static function allowsInsecure(): bool
    {
        return app()->environment('local') && (bool) config('anoofy.allow_insecure_dev_network', false);
    }
}
