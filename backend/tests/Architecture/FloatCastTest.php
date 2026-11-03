<?php

namespace Tests\Architecture;

use PhpParser\Node;
use PhpParser\Node\Expr\Cast\Double;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\NodeVisitorAbstract;
use PHPUnit\Framework\TestCase;
use Tests\Architecture\Support\Baseline;
use Tests\Architecture\Support\PhpSourceScanner;

class FloatCastTest extends TestCase
{
    private const BASELINE_FILE = 'float-casts.json';

    /**
     * قائمة الاستثناءات الصريحة للـ (float) casts الواقعة على حدود الـ APIs الخارجية:
     * مسجلة بصيغة "RelativeFilePath::methodName" => maxAllowedCasts.
     * لا تعتمد على أرقام السطور لضمان عدم تأثرها بالتعديلات العادية داخل الملف.
     *
     * @var array<string, int>
     */
    private const ALLOWLIST = [
        // كائن القيمة Quantity: دالة __construct تقبل float|int كـ fallback وتقوم بالتقريب والتحويل إلى مئات
        'Support/Quantity.php::__construct' => 1,
    ];

    public function test_float_casts_must_not_exceed_ratchet_baseline_with_documented_boundary_allowlist(): void
    {
        $scanner = new PhpSourceScanner();
        $files = $scanner->scan(__DIR__ . '/../../app');

        $violations = [];

        foreach ($files as $relPath => $stmts) {
            $count = 0;

            $visitor = new class($relPath, $count, self::ALLOWLIST) extends NodeVisitorAbstract {
                private string $relPath;
                private int $count;
                /** @var array<string, int> */
                private array $allowlist;
                /** @var list<string> */
                private array $methodStack = [];
                /** @var array<string, int> */
                private array $usedAllowed = [];

                public function __construct(string $relPath, int &$count, array $allowlist)
                {
                    $this->relPath = $relPath;
                    $this->count = &$count;
                    $this->allowlist = $allowlist;
                }

                public function enterNode(Node $node)
                {
                    if ($node instanceof ClassMethod) {
                        $this->methodStack[] = $node->name->toString();
                    }

                    if ($node instanceof Double) {
                        $currentMethod = !empty($this->methodStack) ? end($this->methodStack) : null;
                        $key = $currentMethod !== null
                            ? "{$this->relPath}::{$currentMethod}"
                            : null;

                        if ($key !== null && isset($this->allowlist[$key])) {
                            $used = $this->usedAllowed[$key] ?? 0;
                            if ($used < $this->allowlist[$key]) {
                                $this->usedAllowed[$key] = $used + 1;
                                return null;
                            }
                        }

                        $this->count++;
                    }

                    return null;
                }

                public function leaveNode(Node $node)
                {
                    if ($node instanceof ClassMethod) {
                        array_pop($this->methodStack);
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
