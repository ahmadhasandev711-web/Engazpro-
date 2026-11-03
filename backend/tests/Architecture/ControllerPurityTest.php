<?php

namespace Tests\Architecture;

use PhpParser\Node;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Stmt\TryCatch;
use PhpParser\NodeVisitorAbstract;
use PHPUnit\Framework\TestCase;
use Tests\Architecture\Support\Baseline;
use Tests\Architecture\Support\PhpSourceScanner;

class ControllerPurityTest extends TestCase
{
    private const BASELINE_FILE = 'controller-purity.json';

    private const FORBIDDEN_STATICS = [
        'where',
        'query',
        'find',
        'findOrFail',
        'create',
        'firstOrCreate',
        'updateOrCreate',
        'withoutGlobalScopes',
    ];

    public function test_controllers_must_be_skinny_and_free_of_database_queries_and_try_blocks(): void
    {
        $scanner = new PhpSourceScanner();
        $files = $scanner->scan(__DIR__ . '/../../app/Http/Controllers');

        $violations = [];

        foreach ($files as $relPath => $stmts) {
            $queries = 0;
            $try = 0;

            $visitor = new class($queries, $try, self::FORBIDDEN_STATICS) extends NodeVisitorAbstract {
                private int $queries;
                private int $try;
                private array $forbiddenStatics;

                public function __construct(int &$queries, int &$try, array $forbiddenStatics)
                {
                    $this->queries = &$queries;
                    $this->try = &$try;
                    $this->forbiddenStatics = $forbiddenStatics;
                }

                public function enterNode(Node $node)
                {
                    if ($node instanceof TryCatch) {
                        $this->try++;
                    }

                    if ($node instanceof StaticCall) {
                        $class = $node->class instanceof Node\Name ? $node->class->toString() : '';
                        $method = $node->name instanceof Node\Identifier ? $node->name->toString() : '';

                        if ($class === 'DB' || $class === 'Illuminate\Support\Facades\DB') {
                            $this->queries++;
                        } elseif (in_array($method, $this->forbiddenStatics, true)) {
                            $this->queries++;
                        }
                    }

                    if ($node instanceof MethodCall) {
                        $method = $node->name instanceof Node\Identifier ? $node->name->toString() : '';
                        if ($method === 'where') {
                            $this->queries++;
                        }
                    }

                    return null;
                }
            };

            $scanner->traverse($stmts, $visitor);

            if ($queries > 0 || $try > 0) {
                $violations[$relPath] = [
                    'queries' => $queries,
                    'try' => $try,
                ];
            }
        }

        ksort($violations);

        Baseline::assertControllerPurity($violations, self::BASELINE_FILE);
    }
}
