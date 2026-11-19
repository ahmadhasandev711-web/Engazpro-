import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CustomerInteractionChannel, CustomerTier, Party, PartyInteraction } from '@pos-mandob/shared';
import { apiClient } from '../data/api/client';

export interface PartyCrmResponse {
  success: boolean;
  party: Party;
  interactions: PartyInteraction[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export function usePartyCrm(partyId: number | null, enabled: boolean = true) {
  return useQuery<PartyCrmResponse>({
    queryKey: ['party-crm', partyId],
    queryFn: async () => {
      const res = await apiClient.get(`/parties/${partyId}/crm`);
      return res.data;
    },
    enabled: Boolean(partyId) && enabled,
  });
}

export function usePartyCrmMutations(partyId: number | null) {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['party-crm', partyId] });
    queryClient.invalidateQueries({ queryKey: ['parties'] });
    queryClient.invalidateQueries({ queryKey: ['online-orders'] });
  };

  const addInteraction = useMutation({
    mutationFn: async (payload: {
      channel: CustomerInteractionChannel;
      notes: string;
      follow_up_at?: string | null;
    }) => apiClient.post(`/parties/${partyId}/interactions`, payload),
    onSuccess: invalidateAll,
  });

  const deleteInteraction = useMutation({
    mutationFn: async (interactionId: number) =>
      apiClient.delete(`/parties/${partyId}/interactions/${interactionId}`),
    onSuccess: invalidateAll,
  });

  const updateTier = useMutation({
    mutationFn: async (tier: CustomerTier | null) =>
      apiClient.patch(`/parties/${partyId}/tier`, { tier }),
    onSuccess: invalidateAll,
  });

  return { addInteraction, deleteInteraction, updateTier };
}
