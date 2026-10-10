<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$inv21 = App\Models\Invoice::with(['items', 'payments'])->find(21);
if ($inv21) {
    echo json_encode($inv21->toArray(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}

echo "\nPayments:\n";
foreach (App\Models\Payment::all() as $p) {
    echo sprintf(
        "Payment #%d | inv: %s | amount: %s | method: %s | type: %s\n",
        $p->id,
        $p->invoice_id,
        $p->amount,
        $p->method?->value ?? $p->method,
        $p->type?->value ?? $p->type
    );
}
