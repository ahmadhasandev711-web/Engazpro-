<?php

namespace Tests\Architecture;

use PhpParser\Node;
use PhpParser\Node\Expr\Cast\Double;
use PhpParser\NodeVisitorAbstract;
use PHPUnit\Framework\TestCase;
use Tests\Architecture\Support\Baseline;
use Tests\Architecture\Support\PhpSourceScanner;

class FloatCastTest extends TestCase
{
    private const BASELINE_FILE = 'float-casts.json';

    /**
     * قائمة الاستثناءات الصريحة للـ (float) casts الواقعة على حدود الـ APIs الخارجية:
     * - كل سطر مذكور مع سبب استثنائه الصريح.
     *
     * @var array<string, list<int>>
     */
    private const ALLOWLIST = [
        // كائن القيمة Quantity: دالة toFloat() مخصصة للواجهات الخارجية وتطبيع أرقام القطع لـ APIs و JSON
        'Support/Quantity.php' => [
            31, // public function toFloat(): تحويل integer المئات إلى float عند التصدير لـ WooCommerce API أو JSON
        ],

        // حدود واجهة WooCommerceApiClientInterface: متطلبات باراميترات الـ API لكمية المخزون (float)
        'Services/WooCommerce/WooCommerceBulkStockPushService.php' => [
            102, // updateVariationStock: باراميتر المخزون في واجهة API ووكومرس يتطلب float
            114, // updateProductStock: باراميتر المخزون في واجهة API ووكومرس يتطلب float
        ],

        // تحكم إعدادات ووكومرس: إرسال رصيد الصنف المتغير والبسيط مباشرة لـ API العميل واستجابة JSON
        'Http/Controllers/Api/WooCommerceSettingsController.php' => [
            341, // updateVariationStock: باراميتر كمية مخزون المتغير لـ WooCommerceApiClientInterface
            356, // updateProductStock: باراميتر كمية مخزون الصنف البسيط لـ WooCommerceApiClientInterface
            369, // JSON response data payload: عرض رقم المخزون في استجابة المزامنة المباشرة
        ],
    ];

    public function test_float_casts_must_not_exceed_ratchet_baseline_with_documented_boundary_allowlist(): void
    {
        $scanner = new PhpSourceScanner();
        $files = $scanner->scan(__DIR__ . '/../../app');

        $violations = [];

        foreach ($files as $relPath => $stmts) {
            $count = 0;
            $allowedLines = self::ALLOWLIST[$relPath] ?? [];

            $visitor = new class($count, $allowedLines) extends NodeVisitorAbstract {
                private int $count;
                /** @var list<int> */
                private array $allowedLines;

                public function __construct(int &$count, array $allowedLines)
                {
                    $this->count = &$count;
                    $this->allowedLines = $allowedLines;
                }

                public function enterNode(Node $node)
                {
                    if ($node instanceof Double) {
                        if (!in_array($node->getStartLine(), $this->allowedLines, true)) {
                            $this->count++;
                        }
                    }
                    return null;
                }
            };

            $scanner->traverse($stmts, $visitor);

            if ($count > 0) {
                $violations[$relPath] = $count;
            }
        }

        ksort($violations);

        Baseline::assertFileCounts(
            $violations,
            self::BASELINE_FILE,
            'GR-1.1 (Float Cast)',
            'استخدم كائن Money أو كائن Quantity بدلاً من التحويل القسري إلى (float) للعمليات الحسابية والمالية.'
        );
    }
}
