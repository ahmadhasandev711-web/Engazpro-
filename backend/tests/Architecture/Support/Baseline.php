<?php

namespace Tests\Architecture\Support;

use PHPUnit\Framework\Assert;

class Baseline
{
    public static function dir(): string
    {
        $dir = __DIR__ . '/../baselines';
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }
        return realpath($dir) ?: $dir;
    }

    public static function path(string $name): string
    {
        return self::dir() . '/' . ltrim($name, '/');
    }

    /**
     * @return array<string, mixed>
     */
    public static function load(string $name): array
    {
        $file = self::path($name);
        if (!file_exists($file)) {
            return [];
        }
        $json = file_get_contents($file);
        return json_decode($json, true) ?: [];
    }

    public static function save(string $name, array $data): void
    {
        ksort($data);
        $file = self::path($name);
        file_put_contents(
            $file,
            json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n"
        );
    }

    /**
     * Ratchet comparison for method lengths (GR-10).
     *
     * @param array<string, int> $current [ "Path::method" => length ]
     * @param string $baselineFile
     */
    public static function assertMethodLengths(array $current, string $baselineFile): void
    {
        $baseline = self::load($baselineFile);
        $errors = [];

        // 1. Check for new violations or length increases
        foreach ($current as $key => $length) {
            if (!isset($baseline[$key])) {
                $errors[] = "[مخالفة جديدة] الدالة '{$key}' طولها {$length} سطراً (الحد الأقصى 30 سطراً). يجب اختصارها إلى 30 سطراً أو أقل وتوزيع المهام على دوال أصغر.";
            } elseif ($length > $baseline[$key]) {
                $errors[] = "[زيادة مخالفة] الدالة '{$key}' زاد طولها من {$baseline[$key]} إلى {$length} سطراً. يمنع زيادة طول الدوال المسجلة بالـ baseline.";
            }
        }

        // 2. Check for fixed violations that still exist in baseline
        foreach ($baseline as $key => $recordedLength) {
            if (!isset($current[$key])) {
                $errors[] = "[مخالفة تم إصلاحها!] الدالة '{$key}' لم تعد تتجاوز 30 سطراً (أو تم حذفها). يجب إزالتها فوراً من ملف الـ baseline ({$baselineFile}) لخفض السقف.";
            } elseif ($current[$key] < $recordedLength) {
                $errors[] = "[تحسين تم رصده] الدالة '{$key}' تم اختصارها من {$recordedLength} إلى {$current[$key]} سطراً. يجب تحديث الرقم في ملف الـ baseline ({$baselineFile}) إلى {$current[$key]} لخفض السقف.";
            }
        }

        Assert::assertEmpty(
            $errors,
            "فشل فحص طول الدوال المعماري (GR-10):\n" . implode("\n", $errors)
        );
    }

    /**
     * Ratchet comparison for controller purity (GR-3 + GR-9).
     *
     * @param array<string, array{queries: int, try: int}> $current
     */
    public static function assertControllerPurity(array $current, string $baselineFile): void
    {
        $baseline = self::load($baselineFile);
        $errors = [];

        foreach ($current as $file => $metrics) {
            if (!isset($baseline[$file])) {
                $errors[] = "[مخالفة جديدة] الـ Controller '{$file}' يحتوي على استعلامات ({$metrics['queries']}) أو كتل try ({$metrics['try']}). انقل المنطق لـ Service.";
            } else {
                $baseMetrics = $baseline[$file];
                if ($metrics['queries'] > $baseMetrics['queries']) {
                    $errors[] = "[زيادة مخالفة] الـ Controller '{$file}' زادت استعلاماته من {$baseMetrics['queries']} إلى {$metrics['queries']}.";
                }
                if ($metrics['try'] > $baseMetrics['try']) {
                    $errors[] = "[زيادة مخالفة] الـ Controller '{$file}' زادت كتل try فيه من {$baseMetrics['try']} إلى {$metrics['try']}.";
                }
            }
        }

        foreach ($baseline as $file => $baseMetrics) {
            if (!isset($current[$file])) {
                $errors[] = "[مخالفة تم إصلاحها!] الـ Controller '{$file}' أصبح نظيفاً تماماً! يجب حذفه من ملف الـ baseline ({$baselineFile}).";
            } else {
                $cur = $current[$file];
                if ($cur['queries'] < $baseMetrics['queries'] || $cur['try'] < $baseMetrics['try']) {
                    $errors[] = "[تحسين تم رصده] الـ Controller '{$file}' انخفضت مخالفاته (queries: {$cur['queries']} بدلاً من {$baseMetrics['queries']}, try: {$cur['try']} بدلاً من {$baseMetrics['try']}). يجب تحديث ملف الـ baseline ({$baselineFile}) لخفض السقف.";
                }
            }
        }

        Assert::assertEmpty(
            $errors,
            "فشل فحص نقاء الـ Controllers المعماري (GR-3 + GR-9):\n" . implode("\n", $errors)
        );
    }

    /**
     * Ratchet comparison for scalar count baselines (Magic Strings, Float Casts).
     *
     * @param array<string, int> $current [ "file" => count ]
     */
    public static function assertFileCounts(array $current, string $baselineFile, string $ruleName, string $fixGuidance): void
    {
        $baseline = self::load($baselineFile);
        $errors = [];

        foreach ($current as $file => $count) {
            if (!isset($baseline[$file])) {
                $errors[] = "[مخالفة جديدة] الملف '{$file}' ظهرت به {$count} مخالفات ({$ruleName}). {$fixGuidance}";
            } elseif ($count > $baseline[$file]) {
                $errors[] = "[زيادة مخالفة] الملف '{$file}' زادت به مخالفات ({$ruleName}) من {$baseline[$file]} إلى {$count}.";
            }
        }

        foreach ($baseline as $file => $baseCount) {
            if (!isset($current[$file])) {
                $errors[] = "[مخالفة تم إصلاحها!] الملف '{$file}' لم يعد به أي مخالفات ({$ruleName})! يجب حذفه من ملف الـ baseline ({$baselineFile}).";
            } elseif ($current[$file] < $baseCount) {
                $errors[] = "[تحسين تم رصده] الملف '{$file}' انخفضت مخالفاته من {$baseCount} إلى {$current[$file]}. يجب تحديث ملف الـ baseline ({$baselineFile}) لخفض السقف.";
            }
        }

        Assert::assertEmpty(
            $errors,
            "فشل فحص {$ruleName}:\n" . implode("\n", $errors)
        );
    }
}
