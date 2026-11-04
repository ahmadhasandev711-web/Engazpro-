<?php

namespace App\Services\Anoofy;

use App\DTOs\AnoofyEnvelope;
use App\Enums\AnoofyEventType;
use App\Exceptions\InvalidAnoofyPayloadException;
use Carbon\CarbonImmutable;
use Throwable;

final class AnoofyEnvelopeParser
{
    private const UUID_REGEX = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';

    public function parse(string $rawBody): AnoofyEnvelope
    {
        $payload = $this->decodeJson($rawBody);
        $this->validateBasicFields($payload);

        $eventType = AnoofyEventType::tryFrom((string) ($payload['event_type'] ?? ''));
        if ($eventType === null) {
            throw new InvalidAnoofyPayloadException('نوع الحدث غير مدعوم');
        }

        return new AnoofyEnvelope(
            schemaVersion: (int) $payload['schema_version'],
            eventId: (string) $payload['event_id'],
            eventType: $eventType,
            occurredAt: $this->parseOccurredAt((string) ($payload['occurred_at'] ?? '')),
            orderVersion: isset($payload['order_version']) ? (int) $payload['order_version'] : null,
            data: (array) ($payload['data'] ?? []),
        );
    }

    private function decodeJson(string $rawBody): array
    {
        try {
            $data = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($data)) {
                throw new InvalidAnoofyPayloadException('جسم الطلب يجب أن يكون كائن JSON');
            }
            return $data;
        } catch (Throwable $e) {
            throw new InvalidAnoofyPayloadException('فشل في قراءة بيانات JSON الواردة', previous: $e);
        }
    }

    private function validateBasicFields(array $payload): void
    {
        if (($payload['schema_version'] ?? null) !== 1) {
            throw new InvalidAnoofyPayloadException('إصدار العقد schema_version يجب أن يكون 1');
        }

        $eventId = (string) ($payload['event_id'] ?? '');
        if (!preg_match(self::UUID_REGEX, $eventId)) {
            throw new InvalidAnoofyPayloadException('معرّف الحدث event_id يجب أن يكون UUID صالح');
        }

        if (!isset($payload['data']) || !is_array($payload['data'])) {
            throw new InvalidAnoofyPayloadException('حقل data يجب أن يكون كائناً');
        }
    }

    private function parseOccurredAt(string $dateString): CarbonImmutable
    {
        try {
            return CarbonImmutable::parse($dateString);
        } catch (Throwable $e) {
            throw new InvalidAnoofyPayloadException('تاريخ وقوع الحدث occurred_at غير صالح', previous: $e);
        }
    }
}
