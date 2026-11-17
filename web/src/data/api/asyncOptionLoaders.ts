import { formatCurrency, Party, Product } from '@pos-mandob/shared';
import { apiClient } from './client';
import type { AsyncSearchOption } from '../../presentation/components/ui/AsyncSearchSelect';

export const fetchProductSelectOptions = async (
  search: string,
  branchId?: number | string | null
): Promise<AsyncSearchOption<Product>[]> => {
  const res = await apiClient.get('/products', {
    params: {
      search: search || undefined,
      branch_id: branchId || undefined,
      per_page: 20,
    },
  });
  const list: Product[] = res.data?.data?.data || res.data?.data || [];
  return list.map((p) => ({
    value: p.id,
    label: p.code ? `${p.name} (${p.code})` : p.name,
    sublabel: `الرصيد المتاح: ${p.quantity} ${p.unit || 'قطعة'}`,
    raw: p,
  }));
};

export const fetchPartySelectOptions = async (
  partyType: string,
  search: string,
  includeBalanceSublabel = false
): Promise<AsyncSearchOption<Party>[]> => {
  const res = await apiClient.get('/parties', {
    params: {
      type: partyType,
      search: search || undefined,
      per_page: 25,
    },
  });
  const list: Party[] = res.data?.data?.data || res.data?.data || [];
  return list.map((p) => ({
    value: p.id,
    label: p.phone ? `${p.name} (${p.phone})` : p.name,
    sublabel: includeBalanceSublabel
      ? Number(p.balance) !== 0
        ? `الرصيد الحالي: ${formatCurrency(p.balance)}`
        : 'رصيد خالص (0)'
      : undefined,
    raw: p,
  }));
};
