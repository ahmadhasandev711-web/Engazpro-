<?php

namespace App\Console\Commands;

use App\Services\ActivationCodeService;
use Illuminate\Console\Command;

class GenerateActivationCodesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'license:generate 
                            {--count=1 : عدد الأكواد المطلوب توليدها} 
                            {--days=365 : مدة الاشتراك بالأيام} 
                            {--plan=BASIC : خطة الاشتراك} 
                            {--notes= : ملاحظات إضافية عن الدفعة أو العميل}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'توليد أكواد تفعيل اشتراكات فريدة ومؤمنة لنظام إنجاز برو';

    /**
     * Execute the console command.
     */
    public function handle(ActivationCodeService $service): int
    {
        $count = (int) $this->option('count');
        $days = (int) $this->option('days');
        $plan = (string) $this->option('plan');
        $notes = $this->option('notes');

        $this->info("🚀 جاري توليد {$count} كود تفعيل لمدة {$days} يوم...");

        $codes = $service->generateCodes($count, $days, $plan, $notes);

        $this->newLine();
        $this->info("✅ تم توليد الأكواد بنجاح:");

        $tableData = array_map(function ($c) {
            return [
                'ID' => $c->id,
                'Code' => $c->code,
                'Duration (Days)' => $c->duration_days,
                'Plan' => $c->plan,
                'Status' => $c->is_used ? 'USED ❌' : 'UNUSED 🟢',
                'Batch' => $c->batch_reference,
            ];
        }, $codes);

        $this->table(['ID', 'الكود', 'المدة (يوم)', 'الخطة', 'الحالة', 'الدفعة'], $tableData);

        return Command::SUCCESS;
    }
}
