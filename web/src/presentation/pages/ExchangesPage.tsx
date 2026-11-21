import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExchangeRecord, ExchangeSettlementType, ExchangeSource, ExchangeStatus, formatCurrency } from '@pos-mandob/shared';
import { ArrowLeftRight, Plus, Printer, Search, XCircle } from 'lucide-react';
import { useCancelExchange, useExchanges } from '../../hooks/useExchange';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePermissions } from '../../hooks/usePermissions';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { Badge, Button, Card, DataTable, EmptyState, PageHeader } from '../components/ui';
import { PaginationBar } from '../components/common/PaginationBar';
import { ExchangeReceiptModal } from '../components/exchange/ExchangeReceiptModal';

export const ExchangesPage: React.FC = () => {
  const navigate = useNavigate();
  const { confirm } = useConfirm();
  const toast = useToast();
  const { isOwnerOrAdmin } = usePermissions();
  const cancelMutation = useCancelExchange();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selectedExchange, setSelectedExchange] = useState<ExchangeRecord | null>(null);

  const { data, isLoading, isFetching } = useExchanges({
    search: debouncedSearch || undefined,
    source: source || undefined,
    status: status || undefined,
    page,
  });

  const exchanges = data?.data || [];
  const meta = data?.meta;

  const renderStatusBadge = (s: string) => {
    if (s === ExchangeStatus.COMPLETED) return <Badge tone="ok">مكتمل</Badge>;
    if (s === ExchangeStatus.AWAITING_COURIER_PICKUP) return <Badge tone="warn">بانتظار الشحنة والاستلام</Badge>;
    return <Badge tone="bad">ملغي</Badge>;
  };

  const renderSettlementBadge = (ex: ExchangeRecord) => {
    if (ex.settlement_type === ExchangeSettlementType.EVEN_EXCHANGE) return <Badge tone="neutral">متساوي (0)</Badge>;
    if (ex.settlement_type === ExchangeSettlementType.CUSTOMER_PAYS) return <Badge tone="ok">تحصيل +{formatCurrency(ex.net_amount)}</Badge>;
    if (ex.settlement_type === ExchangeSettlementType.STORE_CREDIT) return <Badge tone="info">محفظة +{formatCurrency(Math.abs(ex.net_amount))}</Badge>;
    return <Badge tone="warn">مسترد -{formatCurrency(Math.abs(ex.net_amount))}</Badge>;
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12" dir="rtl">
      <PageHeader
        title="سجل عمليات الاستبدال"
        description="متابعة استبدالات الكاشير وطلبات الشحن الأونلاين ومحفظة رصيد المتجر"
        actions={
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => navigate('/exchanges/new')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            استبدال جديد (POS)
          </Button>
        }
      />

      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="بحث برقم الاستبدال أو الفاتورة أو اسم/موبايل العميل..."
            className="w-full min-h-[42px] pr-9 pl-3 bg-panel border border-line rounded-xl text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(1);
          }}
          className="min-h-[42px] px-3 rounded-xl border border-line bg-panel text-xs font-bold"
        >
          <option value="">كل المصادر</option>
          <option value={ExchangeSource.POS}>نقطة البيع (POS)</option>
          <option value={ExchangeSource.ONLINE_ORDER}>طلبات أونلاين</option>
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="min-h-[42px] px-3 rounded-xl border border-line bg-panel text-xs font-bold"
        >
          <option value="">كل الحالات</option>
          <option value={ExchangeStatus.COMPLETED}>مكتمل</option>
          <option value={ExchangeStatus.AWAITING_COURIER_PICKUP}>بانتظار الشحنة</option>
          <option value={ExchangeStatus.CANCELLED}>ملغي</option>
        </select>
      </Card>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-10 text-center text-xs text-muted font-bold">جاري تحميل الاستبدالات...</div>
        ) : exchanges.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight className="w-8 h-8 text-muted" />}
            title="لا توجد عمليات استبدال مسجلة"
            description="يمكنك تنفيذ أول عملية استبدال من الكاشير أو من سطر أي فاتورة مبيعات."
          />
        ) : (
          <>
            <DataTable>
              <thead>
                <tr className="bg-surface-2 text-muted text-xs font-bold border-b border-line text-right">
                  <th className="py-3 px-4">رقم السند</th>
                  <th className="py-3 px-4">المصدر والحالة</th>
                  <th className="py-3 px-4">العميل</th>
                  <th className="py-3 px-4">الأصل المرتبط</th>
                  <th className="py-3 px-4">المرتجع / البديل</th>
                  <th className="py-3 px-4">التسوية</th>
                  <th className="py-3 px-4 text-center">إيصال</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {exchanges.map((ex) => (
                  <tr key={ex.id} className="hover:bg-surface-2/50">
                    <td className="py-3 px-4 font-black text-brand tabular-nums">{ex.exchange_number}</td>
                    <td className="py-3 px-4 space-y-1">
                      <div>{renderStatusBadge(ex.status)}</div>
                      <div className="text-[11px] text-muted">{ex.source === ExchangeSource.ONLINE_ORDER ? 'أونلاين' : 'كاشير POS'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-ink">{ex.party_name || 'عميل نقدي'}</div>
                      {ex.party_phone && <div className="text-[11px] text-muted tabular-nums">{ex.party_phone}</div>}
                    </td>
                    <td className="py-3 px-4 tabular-nums text-muted">
                      {ex.original_invoice_number || ex.original_online_order_number || 'حر بدون فاتورة'}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      <div className="text-warn font-bold">مرتجع: {formatCurrency(ex.return_total)}</div>
                      <div className="text-ok font-bold">بديل: {formatCurrency(ex.replacement_total)}</div>
                    </td>
                    <td className="py-3 px-4">{renderSettlementBadge(ex)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="md"
                          onClick={async () => {
                            const res = await import('../../data/api/client').then((m) => m.apiClient.get(`/exchanges/${ex.id}`));
                            setSelectedExchange(res.data?.data || ex);
                          }}
                          title="معاينة وطباعة الإيصال"
                        >
                          <Printer className="w-4 h-4 text-brand" />
                        </Button>
                        {isOwnerOrAdmin && ex.status !== ExchangeStatus.CANCELLED && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            disabled={cancelMutation.isPending}
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'إلغاء وعكس سند الاستبدال',
                                message: `هل أنت متأكد من إلغاء السند ${ex.exchange_number}؟ سيتم عكس حركات المخزون والخزنة ومحفظة العميل بالكامل في خطوة واحدة.`,
                                type: 'danger',
                              });
                              if (!ok) return;
                              try {
                                await cancelMutation.mutateAsync(ex.id);
                                toast.success(`تم إلغاء وعكس ${ex.exchange_number} بنجاح`);
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || 'تعذر إلغاء سند الاستبدال');
                              }
                            }}
                            title="إلغاء وعكس السند بالكامل"
                          >
                            <XCircle className="w-4 h-4 text-bad" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            <PaginationBar
              currentPage={meta?.current_page || page}
              lastPage={meta?.last_page || 1}
              total={meta?.total || exchanges.length}
              perPage={meta?.per_page || 20}
              isFetching={isFetching}
              onPageChange={setPage}
              itemLabel="عملية استبدال"
            />
          </>
        )}
      </Card>

      <ExchangeReceiptModal exchange={selectedExchange} onClose={() => setSelectedExchange(null)} />
    </div>
  );
};
