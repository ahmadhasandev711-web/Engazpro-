<?php

namespace Tests\Architecture;

use PhpParser\Node;
use PhpParser\Node\Expr\FuncCall;
use PhpParser\NodeVisitorAbstract;
use PHPUnit\Framework\TestCase;
use Tests\Architecture\Support\PhpSourceScanner;

class EnvUsageTest extends TestCase
{
    /**
     * GR-4.3: حظر استدعاء دالة env() خارج مجلد config/ نهائياً.
     * استدعاء env() المباشر في app/ أو routes/ أو database/ يعطل config:cache ويسبب ثغرات وتصرفات غير متوقعة.
     */
    public function test_env_helper_must_never_be_called_in_app_routes_or_database(): void
    {
        $scanner = new PhpSourceScanner();
        $directories = [
            'app' => __DIR__ . '/../../app',
            'routes' => __DIR__ . '/../../routes',
            'database' => __DIR__ . '/../../database',
        ];

        $violations = [];

        foreach ($directories as $label => $dir) {
            $files = $scanner->scan($dir);

            foreach ($files as $relPath => $stmts) {
                $visitor = new class($label, $relPath, $violations) extends NodeVisitorAbstract {
                    private string $label;
                    private string $relPath;
                    /** @var list<string> */
                    private array $violations;

                    public function __construct(string $label, string $relPath, array &$violations)
                    {
                        $this->label = $label;
                        $this->relPath = $relPath;
                        $this->violations = &$violations;
                    }

                    public function enterNode(Node $node)
                    {
                        if ($node instanceof FuncCall) {
                            $name = $node->name instanceof Node\Name ? $node->name->toString() : '';
                            if (strtolower($name) === 'env') {
                                $this->violations[] = "{$this->label}/{$this->relPath}:{$node->getStartLine()}";
                            }
                        }
                        return null;
                    }
                };

                $scanner->traverse($stmts, $visitor);
            }
        }

        $this->assertEmpty(
            $violations,
            "مخالفة معمارية صريحة (GR-4.3): تم رصد استدعاء مباشر لـ env() خارج مجلد config/:\n"
            . implode("\n", $violations) . "\n\n"
            . "يجب قراءة الإعدادات عبر دالة config() حصراً لضمان توافق النظام مع php artisan config:cache."
        );
    }
}
