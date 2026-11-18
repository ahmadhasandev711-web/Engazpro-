import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../data/api/client';

export interface TierPricingData {
  annual_price: number;
  monthly_price: number;
  yearly_monthly_equivalent: number;
  annual_savings: number;
}

export interface PublicPricingData {
  annual_price: number;
  monthly_price: number;
  yearly_monthly_equivalent: number;
  annual_savings: number;
  trial_days: number;
  currency: string;
  basic: TierPricingData;
  pro: TierPricingData;
}

export const DEFAULT_PUBLIC_PRICING: PublicPricingData = {
  annual_price: 3000,
  monthly_price: 299,
  yearly_monthly_equivalent: 250,
  annual_savings: 588,
  trial_days: 14,
  currency: 'EGP',
  basic: {
    annual_price: 3000,
    monthly_price: 299,
    yearly_monthly_equivalent: 250,
    annual_savings: 588,
  },
  pro: {
    annual_price: 5000,
    monthly_price: 499,
    yearly_monthly_equivalent: 416.67,
    annual_savings: 988,
  },
};

/**
 * Reads canonical subscription pricing from the public API with deterministic fallback.
 */
export function usePublicPricing() {
  return useQuery<PublicPricingData>({
    queryKey: ['public-pricing'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ success: boolean; data: PublicPricingData }>('/public/pricing');
      return data.data;
    },
    initialData: DEFAULT_PUBLIC_PRICING,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
}
