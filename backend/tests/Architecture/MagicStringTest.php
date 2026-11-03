<?php

namespace Tests\Architecture;

use PhpParser\Node;
use PhpParser\Node\Scalar\String_;
use PhpParser\NodeVisitorAbstract;
use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use ReflectionEnum;
use Tests\Architecture\Support\Baseline;
use Tests\Architecture\Support\PhpSourceScanner;

class MagicStringTest extends TestCase
{
    private const BASELINE_FILE = 'magic-strings.json';

    public function test_backed_enum_values_must_not_be_used_as_raw_magic_strings(): void
    {
        $enumValues = $this->collectAllBackedEnumValues();

        $scanner = new PhpSourceScanner();
        $files = $scanner->scan(__DIR__ . '/../../app');

        $violations = [];

        foreach ($files as $relPath => $stmts) {
            if (str_starts_with($relPath, 'Enums/')) {
                continue;
            }

            $count = 0;
            $visitor = new class($count, $enumValues) extends NodeVisitorAbstract {
                private int $count;
                /** @var array<string, bool> */
                private array $enumValues;

                public function __construct(int &$count, array $enumValues)
                {
                    $this->count = &$count;
                    $this->enumValues = $enumValues;
                }

                public function enterNode(Node $node)
                {
                    if ($node instanceof String_) {
                        if (isset($this->enumValues[$node->value])) {
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
            'GR-8 (Magic String مطابقة لقيمة Enum)',
            'استخدم Case الـ Enum المناسب (مثل Role::OWNER أو WcOrderStatus::CONFIRMED) بدلاً من النص الصريح.'
        );
    }

    /**
     * @return array<string, bool>
     */
    private function collectAllBackedEnumValues(): array
    {
        $enumsDir = realpath(__DIR__ . '/../../app/Enums');
        if (!$enumsDir || !is_dir($enumsDir)) {
            return [];
        }

        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($enumsDir));
        $values = [];

        foreach ($iterator as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }

            $rel = str_replace('\\', '/', substr($file->getRealPath(), strlen($enumsDir) + 1));
            $className = 'App\\Enums\\' . str_replace('/', '\\', substr($rel, 0, -4));

            if (enum_exists($className)) {
                $reflection = new ReflectionEnum($className);
                if ($reflection->isBacked()) {
                    foreach ($className::cases() as $case) {
                        if (is_string($case->value)) {
                            $values[$case->value] = true;
                        }
                    }
                }
            }
        }

        return $values;
    }
}
