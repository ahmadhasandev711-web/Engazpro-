<?php

namespace Tests\Architecture;

use PhpParser\Node;
use PhpParser\Node\Stmt\ClassMethod;
use PhpParser\NodeVisitorAbstract;
use PHPUnit\Framework\TestCase;
use Tests\Architecture\Support\Baseline;
use Tests\Architecture\Support\PhpSourceScanner;

class MethodLengthTest extends TestCase
{
    private const BASELINE_FILE = 'method-length.json';

    public function test_all_class_methods_must_be_at_most_30_lines_or_in_ratchet_baseline(): void
    {
        $scanner = new PhpSourceScanner();
        $files = $scanner->scan(__DIR__ . '/../../app');

        $violations = [];

        foreach ($files as $relPath => $stmts) {
            $visitor = new class($relPath, $violations) extends NodeVisitorAbstract {
                private string $relPath;
                /** @var array<string, int> */
                private array $violations;

                public function __construct(string $relPath, array &$violations)
                {
                    $this->relPath = $relPath;
                    $this->violations = &$violations;
                }

                public function enterNode(Node $node)
                {
                    if ($node instanceof ClassMethod) {
                        $start = $node->getStartLine();
                        $end = $node->getEndLine();
                        $length = $end - $start + 1;

                        if ($length > 30) {
                            $key = $this->relPath . '::' . $node->name->toString();
                            $this->violations[$key] = $length;
                        }
                    }
                    return null;
                }
            };

            $scanner->traverse($stmts, $visitor);
        }

        ksort($violations);

        Baseline::assertMethodLengths($violations, self::BASELINE_FILE);
    }
}
