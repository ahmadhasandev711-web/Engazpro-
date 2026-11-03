<?php

namespace Tests\Architecture\Support;

use PhpParser\Error;
use PhpParser\Node;
use PhpParser\NodeTraverser;
use PhpParser\NodeVisitorAbstract;
use PhpParser\Parser;
use PhpParser\ParserFactory;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

class PhpSourceScanner
{
    private Parser $parser;

    public function __construct(?Parser $parser = null)
    {
        $this->parser = $parser ?? (new ParserFactory())->createForHostVersion();
    }

    /**
     * Scan a directory and parse all PHP files into AST statements.
     *
     * @return array<string, Node\Stmt[]> Array of [relativePath => stmts]
     */
    public function scan(string $baseDir): array
    {
        $realBaseDir = realpath($baseDir);
        if (!$realBaseDir || !is_dir($realBaseDir)) {
            return [];
        }

        $results = [];
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($realBaseDir));

        /** @var SplFileInfo $file */
        foreach ($iterator as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }

            $realPath = $file->getRealPath();
            $code = file_get_contents($realPath);
            if ($code === false) {
                continue;
            }

            try {
                $stmts = $this->parser->parse($code);
            } catch (Error) {
                continue;
            }

            if (!$stmts) {
                continue;
            }

            $relPath = str_replace('\\', '/', substr($realPath, strlen($realBaseDir) + 1));
            $results[$relPath] = $stmts;
        }

        ksort($results);
        return $results;
    }

    /**
     * Helper to traverse statements with a visitor.
     *
     * @param Node\Stmt[] $stmts
     * @return Node[]
     */
    public function traverse(array $stmts, NodeVisitorAbstract $visitor): array
    {
        $traverser = new NodeTraverser();
        $traverser->addVisitor($visitor);
        return $traverser->traverse($stmts);
    }
}
