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

const PARTY_TYPE_LABELS: Record<string, string> = {
  CUSTOMER: 'عميل',
  SUPPLIER: 'مورد',
  COURIER: 'شركة شحن',
};

export const fetchPartySelectOptions = async (
  partyType: string | string[],
  search: string,
  includeBalanceSublabel = false
): Promise<AsyncSearchOption<Party>[]> => {
  const normalizedType = Array.isArray(partyType) ? partyType.join(',') : partyType;
  const isMultiType = Array.isArray(partyType) ? partyType.length > 1 : normalizedType.includes(',');

  const res = await apiClient.get('/parties', {
    params: {
      type: normalizedType,
      search: search || undefined,
      per_page: 25,
    },
  });
  const list: Party[] = res.data?.data?.data || res.data?.data || [];
  return list.map((p) => {
    const typeTag = isMultiType && p.type ? `[${PARTY_TYPE_LABELS[p.type] || p.type}] ` : '';
    const balanceText = Number(p.balance) !== 0
      ? `الرصيد الحالي: ${formatCurrency(p.balance)}`
      : 'رصيد خالص (0)';

    return {
      value: p.id,
      label: p.phone ? `${p.name} (${p.phone})` : p.name,
      sublabel: includeBalanceSublabel ? `${typeTag}${balanceText}` : (typeTag ? typeTag.trim() : undefined),
      raw: p,
    };
  });
};
