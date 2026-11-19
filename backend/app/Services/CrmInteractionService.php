<?php

namespace App\Services;

use App\Enums\CustomerInteractionChannel;
use App\Enums\CustomerTier;
use App\Exceptions\PosDomainException;
use App\Models\Party;
use App\Models\PartyInteraction;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class CrmInteractionService
{
    public function __construct(
        protected CustomerIntelligenceService $intelligenceService
    ) {}

    /**
     * @return array{party: Party, interactions: LengthAwarePaginator}
     */
    public function getCustomerCrmProfile(User $actor, Party $party, int $perPage = 20): array
    {
        $party->loadCount(['invoices', 'interactions']);
        $this->intelligenceService->enrichPartyCollection($actor, [$party]);

        $interactions = PartyInteraction::where('user_id', $actor->getAccountId())
            ->where('party_id', $party->id)
            ->with('creator:id,name,role')
            ->latest()
            ->paginate(min(max($perPage, 1), 50));

        return [
            'party' => $party,
            'interactions' => $interactions,
        ];
    }

    public function addInteraction(User $actor, Party $party, array $data): PartyInteraction
    {
        return DB::transaction(function () use ($actor, $party, $data) {
            $channel = $data['channel'] instanceof CustomerInteractionChannel
                ? $data['channel']
                : CustomerInteractionChannel::from((string) $data['channel']);

            $interaction = PartyInteraction::create([
                'user_id' => $actor->getAccountId(),
                'party_id' => $party->id,
                'created_by' => $actor->id,
                'channel' => $channel->value,
                'notes' => trim((string) $data['notes']),
                'follow_up_at' => $data['follow_up_at'] ?? null,
            ]);

            return $interaction->load('creator:id,name,role');
        });
    }

    public function deleteInteraction(User $actor, Party $party, PartyInteraction $interaction): void
    {
        if ((int) $interaction->party_id !== (int) $party->id || (int) $interaction->user_id !== $actor->getAccountId()) {
            throw new PosDomainException('سجل التفاعل غير مرتبط بهذه الجهة.', 'INVALID_INTERACTION_SCOPE', 403);
        }

        if (!$actor->isOwnerOrAdmin() && !$actor->isManager() && (int) $interaction->created_by !== (int) $actor->id) {
            throw new PosDomainException('لا تملك صلاحية حذف تفاعل لم تقم بتسجيله.', 'INTERACTION_DELETE_FORBIDDEN', 403);
        }

        $interaction->delete();
    }

    public function updateTierOverride(User $actor, Party $party, ?CustomerTier $tier): Party
    {
        $party->update(['crm_tier_override' => $tier?->value]);
        $party->loadCount(['invoices', 'interactions']);
        $this->intelligenceService->enrichPartyCollection($actor, [$party]);

        return $party;
    }
}
