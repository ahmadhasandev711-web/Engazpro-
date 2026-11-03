<?php

namespace Tests\Architecture;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RegexIterator;

class MoneyArchitectureTest extends TestCase
{
    /**
     * التحقق المعماري من حظر العمليات الحسابية والمقارنات اليدوية بـ float
     * للمتغيرات والحقول المالية، وإلزامية استخدام كائن Money الموحد.
     */
    public function test_financial_calculations_and_comparisons_must_use_money_object(): void
    {
        $basePath = realpath(__DIR__ . '/../../app');
        $directories = [
            $basePath . '/Services',
            $basePath . '/Http',
            $basePath . '/Jobs',
        ];

        $keywords = 'amount|total|price|balance|paid|collected|cost|salary|commission|discount|shipping|remaining';
        $pattern = '/\(float\)\s*[^;\n]*(\$|->|\[)[a-zA-Z0-9_\'\"]*(' . $keywords . ')[^;\n]*(\+|(?<!-)-(?!>)|\*|\/|<=|>=|<|>)|(\$|->|\[)[a-zA-Z0-9_\'\"]*(' . $keywords . ')[^;\n]*(\+|(?<!-)-(?!>)|\*|\/|<=|>=|<|>)[^;\n]*\(float\)/i';

        $violations = [];

        foreach ($directories as $dir) {
            if (!is_dir($dir)) {
                continue;
            }

            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
            $phpFiles = new RegexIterator($iterator, '/\.php$/');

            foreach ($phpFiles as $file) {
                $filePath = $file->getRealPath();
                $lines = file($filePath);

                foreach ($lines as $index => $line) {
                    $trimmed = trim($line);

                    // تجاهل التعليقات
                    if (str_starts_with($trimmed, '//') || str_starts_with($trimmed, '*') || str_starts_with($trimmed, '/*')) {
                        continue;
                    }

                    // إذا كان السطر يستخدم Money:: فهو ملتزم
                    if (str_contains($line, 'Money::')) {
                        continue;
                    }

                    if (preg_match($pattern, $line)) {
                        $lineNumber = $index + 1;
                        $violations[] = "{$filePath}:{$lineNumber} -> {$trimmed}";
                    }
                }
            }
        }

        $this->assertEmpty(
            $violations,
            "تم رصد مخالفات معمارية لحسابات ومقارنات مالية بـ float دون استخدام كائن Money:\n" . implode("\n", $violations)
        );
    }
}
