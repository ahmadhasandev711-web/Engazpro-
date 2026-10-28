<?php

namespace App\Services;

use Illuminate\Support\Facades\Artisan;
use Throwable;

class DeployCacheRefreshService
{
    /**
     * @return array<string, string>
     */
    public function refresh(): array
    {
        return [
            'optimize_clear' => $this->run('optimize:clear'),
            'config_cache' => $this->run('config:cache'),
            'route_cache' => $this->run('route:cache'),
            'view_cache' => $this->run('view:cache'),
        ];
    }

    private function run(string $command): string
    {
        try {
            Artisan::call($command);

            $output = trim(Artisan::output());

            return $output !== '' ? $output : 'ok';
        } catch (Throwable) {
            return 'failed';
        }
    }
}
