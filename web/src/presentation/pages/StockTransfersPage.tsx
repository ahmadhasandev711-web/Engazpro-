import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Package,
  Building2,
  RefreshCw,
  X,
  Trash2,
  Eye,
  Send,
  Check,
} from 'lucide-react';
import { apiClient } from '../../data/api/client';
import { usePermissions } from '../../hooks/usePermissions';
import { StockTransferStatus, StockTransfer } from '@pos-mandob/shared';
import { StockTransferMobileCard } from '../components/mobile/StockTransferMobileCard';
import { PaginationBar } from '../components/common/PaginationBar';
import { nativeBackButton } from '../../platform/nativeBackButton';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Tabs,
  TabItem,
  Textarea,
} from '../components/ui';

export const StockTransfersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isOwner, isManager } = usePermissions();
  const toast = useToast();
  const { confirm } = useConfirm();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState<{
    from_branch_id: string;
    to_branch_id: string;
    notes: string;
    items: Array<{
      product_id: string;
      product_variant_id: string;
      quantity_sent: number;
    }>;
  }>({
    from_branch_id: '',
    to_branch_id: '',
    notes: '',
    items: [{ product_id: '', product_variant_id: '', quantity_sent: 1 }],
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Fetch Branches for dropdowns
  const { data: rawBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data?.data || [];
    },
  });
  const branches: any[] = Array.isArray(rawBranches) ? rawBranches : ((rawBranches as any)?.data || []);

  // 2. Fetch Products for transfer items
  const { data: products = [] } = useQuery({
    queryKey: ['products-all'],
    queryFn: async () => {
      const res = await apiClient.get('/products', { params: { per_page: 200 } });
      return res.data?.data || [];
    },
  });

  // 3. Fetch Stock Transfers
  const { data: transfersData, isLoading, isFetching } = useQuery({
    queryKey: ['stock-transfers', statusFilter, page],
    queryFn: async () => {
      const params: any = { page, per_page: 25 };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const res = await apiClient.get('/stock-transfers', { params });
      return {
        items: res.data?.data || [],
        meta: res.data?.meta || null,
        total: res.data?.meta?.total || 0,
      };
    },
    placeholderData: (previousData) => previousData,
    refetchInterval: 15000,
  });

  // 4. Create Transfer Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/stock-transfers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setCreateModalOpen(false);
      resetForm();
      setMessage({ type: 'success', text: 'تم إنشاء أمر التحويل وخروج البضاعة من فرع المصدر بنجاح.' });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.response?.data?.message || 'فشل إنشاء أمر التحويل.' });
    },
  });

  // 5. Receive Transfer Mutation
  const receiveMutation = useMutation({
    mutationFn: async (transferId: number) => {
      const res = await apiClient.post(`/stock-transfers/${transferId}/receive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setMessage({ type: 'success', text: 'تم تأكيد الاستلام بنجاح وتغذية رصيد فرع الوجهة.' });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.response?.data?.message || 'فشل تأكيد الاستلام.' });
    },
  });

  // 6. Cancel Transfer Mutation
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiClient.post(`/stock-transfers/${id}/cancel`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setMessage({ type: 'success', text: 'تم إلغاء أمر التحويل وإرجاع البضاعة لفرع المصدر بنجاح.' });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.response?.data?.message || 'تعذر إلغاء التحويل.' });
    },
  });

  const resetForm = () => {
    setFormData({
      from_branch_id: '',
      to_branch_id: '',
      notes: '',
      items: [{ product_id: '', product_variant_id: '', quantity_sent: 1 }],
    });
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { product_id: '', product_variant_id: '', quantity_sent: 1 }],
    });
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length === 1) return;
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    // If product changed, reset variant
    if (field === 'product_id') {
      newItems[index].product_variant_id = '';
    }
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.from_branch_id || !formData.to_branch_id) {
      toast.error('يرجى تحديد فرع المصدر وفرع الوجهة.');
      return;
    }
    if (formData.from_branch_id === formData.to_branch_id) {
      toast.error('لا يمكن إجراء تحويل لنفس الفرع.');
      return;
    }

    const payload = {
      from_branch_id: Number(formData.from_branch_id),
      to_branch_id: Number(formData.to_branch_id),
      notes: formData.notes,
      items: formData.items
        .filter((i) => i.product_id && i.quantity_sent > 0)
        .map((i) => ({
          product_id: Number(i.product_id),
          product_variant_id: i.product_variant_id ? Number(i.product_variant_id) : null,
          quantity_sent: Number(i.quantity_sent),
        })),
    };

    if (payload.items.length === 0) {
      toast.error('يرجى اختيار صنف واحد على الأقل مع تحديد كمية صالحة.');
      return;
    }

    createMutation.mutate(payload);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case StockTransferStatus.IN_TRANSIT:
        return (
          <Badge tone="info" className="gap-1">
            <Clock className="w-3.5 h-3.5" />
            في الطريق
          </Badge>
        );
      case StockTransferStatus.RECEIVED:
        return (
          <Badge tone="ok" className="gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم الاستلام
          </Badge>
        );
      case StockTransferStatus.CANCELLED:
        return (
          <Badge tone="bad" className="gap-1">
            <XCircle className="w-3.5 h-3.5" />
            ملغي
          </Badge>
        );
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  };

  const transfers: StockTransfer[] = transfersData?.items || [];
  const inTransitCount = transfers.filter((t: StockTransfer) => t.status === StockTransferStatus.IN_TRANSIT).length;
  const receivedCount = transfers.filter((t: StockTransfer) => t.status === StockTransferStatus.RECEIVED).length;
  const cancelledCount = transfers.filter((t: StockTransfer) => t.status === StockTransferStatus.CANCELLED).length;

  // Hardware Back Button integration
  useEffect(() => {
    if (createModalOpen) {
      return nativeBackButton.register(() => {
        setCreateModalOpen(false);
        return true;
      });
    }
  }, [createModalOpen]);

  useEffect(() => {
    if (selectedTransfer) {
      return nativeBackButton.register(() => {
        setSelectedTransfer(null);
        return true;
      });
    }
  }, [selectedTransfer]);

  const statusFilterOptions: TabItem[] = useMemo(
    () => [
      { id: 'ALL', label: 'جميع التحويلات', count: transfersData?.total || 0 },
      { id: StockTransferStatus.IN_TRANSIT, label: 'في الطريق', count: inTransitCount },
      { id: StockTransferStatus.RECEIVED, label: 'مستلم', count: receivedCount },
      { id: StockTransferStatus.CANCELLED, label: 'ملغي', count: cancelledCount },
    ],
    [transfersData?.total, inTransitCount, receivedCount, cancelledCount]
  );

  return (
    <div className="space-y-3 sm:space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Desktop Header */}
      <PageHeader
        className="hidden md:flex mb-0 bg-panel p-5 rounded-2xl border border-line shadow-xs"
        title="تحويلات المخزون بين الفروع (Stock Transfers)"
        badge={
          <span className="p-2 bg-brand-soft text-brand-ink rounded-xl inline-flex">
            <ArrowLeftRight className="w-5 h-5" />
          </span>
        }
        description="نقل البضاعة بين المخزن الرئيسي والمعارض وسيارات المناديب مع تأكيد الاستلام الميداني"
        actions={
          (isOwner || isManager) ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                resetForm();
                setCreateModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              إذن تحويل بضاعة جديد
            </Button>
          ) : undefined
        }
      />

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <Card className="md:hidden p-3 sm:p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand-ink flex items-center justify-center font-black shrink-0">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-ink truncate">تحويلات المخزون</h2>
              <Badge tone="neutral" className="tabular-nums shrink-0">
                {transfersData?.total || 0}
              </Badge>
            </div>
            <p className="text-2xs text-muted font-medium truncate">
              في الطريق: <span className="font-bold text-info tabular-nums">{inTransitCount}</span>
              {receivedCount > 0 && (
                <span className="text-ok font-bold mr-1.5 inline-flex items-center gap-0.5 tabular-nums">
                  • {receivedCount} مستلم
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(isOwner || isManager) && (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                resetForm();
                setCreateModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
              className="px-3 text-xs"
            >
              <span>تحويل جديد</span>
            </Button>
          )}
        </div>
      </Card>

      {/* Alerts */}
      {message && (
        <div
          className={`p-3 sm:p-4 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm animate-fade-in border ${
            message.type === 'success'
              ? 'bg-ok-soft text-ok border-ok/30'
              : 'bg-bad-soft text-bad border-bad/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-muted hover:text-ink hover:bg-surface-2 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Desktop KPI Stats (Hidden on mobile to save vertical real estate) */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-surface-2 text-ink">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted font-medium">إجمالي التحويلات</div>
            <div className="text-xl font-bold text-ink mt-0.5 tabular-nums">{transfersData?.total || 0}</div>
          </div>
        </Card>

        <Card className="p-4 sm:p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-info-soft text-info">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted font-medium">في الطريق (معلق)</div>
            <div className="text-xl font-bold text-info mt-0.5 tabular-nums">{inTransitCount}</div>
          </div>
        </Card>

        <Card className="p-4 sm:p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-ok-soft text-ok">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted font-medium">تم الاستلام والاعتماد</div>
            <div className="text-xl font-bold text-ok mt-0.5 tabular-nums">{receivedCount}</div>
          </div>
        </Card>

        <Card className="p-4 sm:p-4 flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-bad-soft text-bad">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted font-medium">أوامر ملغاة</div>
            <div className="text-xl font-bold text-bad mt-0.5 tabular-nums">{cancelledCount}</div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs
        tabs={statusFilterOptions}
        activeTab={statusFilter}
        onChange={(id) => {
          setStatusFilter(id);
          setPage(1);
        }}
      />

      {/* Transfers Table */}
      <Card className="p-0 sm:p-0 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-muted">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-brand" />
            جاري تحميل أوامر التحويل...
          </div>
        ) : transfers.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight className="w-10 h-10" />}
            title="لا توجد أوامر تحويل مسجلة"
            description="يمكنك إنشاء إذن تحويل بضاعة جديد بين أي فرعين بنقرة زر"
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <DataTable className="hidden md:block border-0 rounded-none shadow-none">
              <thead>
                <tr className="bg-surface-2 border-b border-line text-muted text-xs font-semibold">
                  <th className="py-3.5 px-4 text-right">رقم الإذن</th>
                  <th className="py-3.5 px-4 text-right">التاريخ</th>
                  <th className="py-3.5 px-4 text-right">فرع المصدر (من)</th>
                  <th className="py-3.5 px-4 text-right">فرع الوجهة (إلى)</th>
                  <th className="py-3.5 px-4 text-center">عدد الأصناف</th>
                  <th className="py-3.5 px-4 text-center">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {transfers.map((trf: any) => (
                  <tr key={trf.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold tabular-nums text-ink">
                      {trf.transfer_number}
                    </td>
                    <td className="py-3.5 px-4 text-muted text-xs">
                      {trf.transferred_at ? new Date(trf.transferred_at).toLocaleString('ar-EG') : '-'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-ink">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted" />
                        {trf.from_branch?.name || '-'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-ink">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-brand-ink" />
                        {trf.to_branch?.name || '-'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-ink tabular-nums">
                      {trf.items?.length || 0} صنف
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(trf.status)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {trf.status === StockTransferStatus.IN_TRANSIT && (
                          <>
                            <Button
                              variant="primary"
                              size="md"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'تأكيد استلام التحويل',
                                  message: `هل تؤكد استلام كامل بضاعة الإذن رقم "${trf.transfer_number}"؟`,
                                  type: 'info',
                                  confirmText: 'تأكيد الاستلام',
                                });
                                if (ok) {
                                  receiveMutation.mutate(trf.id);
                                }
                              }}
                              leftIcon={<Check className="w-3.5 h-3.5" />}
                              className="bg-ok hover:bg-ok/90 text-on-brand px-3 text-xs"
                              title="تأكيد الاستلام"
                            >
                              تأكيد الاستلام
                            </Button>

                            {(isOwner || isManager) && (
                              <Button
                                variant="danger"
                                size="md"
                                onClick={() => {
                                  const reason = prompt('يرجى كتابة سبب الإلغاء:');
                                  if (reason) {
                                    cancelMutation.mutate({ id: trf.id, reason });
                                  }
                                }}
                                className="bg-bad-soft hover:bg-bad/15 text-bad border border-bad/25 px-3 text-xs"
                                title="إلغاء التحويل"
                              >
                                إلغاء
                              </Button>
                            )}
                          </>
                        )}

                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => setSelectedTransfer(trf)}
                          className="min-w-[44px] px-2.5 text-muted hover:text-brand-ink hover:bg-brand-soft"
                          title="عرض التفاصيل"
                          aria-label="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            {/* Mobile Touch Cards View (md:hidden) */}
            <div className="md:hidden p-3 space-y-3 bg-surface-2/40">
              {transfers.map((trf: any) => (
                <StockTransferMobileCard
                  key={trf.id}
                  transfer={trf}
                  canCancel={isOwner || isManager}
                  isReceiving={receiveMutation.isPending && (receiveMutation.variables as any) === trf.id}
                  onReceive={async (id) => {
                    const ok = await confirm({
                      title: 'تأكيد استلام التحويل',
                      message: `هل تؤكد استلام كامل بضاعة الإذن رقم "${trf.transfer_number}"؟`,
                      type: 'info',
                      confirmText: 'تأكيد الاستلام',
                    });
                    if (ok) {
                      receiveMutation.mutate(id);
                    }
                  }}
                  onCancel={(id) => {
                    const reason = prompt('يرجى كتابة سبب الإلغاء:');
                    if (reason) {
                      cancelMutation.mutate({ id, reason });
                    }
                  }}
                  onView={(selected) => setSelectedTransfer(selected)}
                />
              ))}
            </div>

            <PaginationBar
              currentPage={transfersData?.meta?.current_page || page}
              lastPage={transfersData?.meta?.last_page || 1}
              total={transfersData?.total || transfers.length}
              perPage={transfersData?.meta?.per_page || 25}
              isFetching={isFetching}
              onPageChange={setPage}
              itemLabel="أمر تحويل"
            />
          </>
        )}
      </Card>

      {/* Create Transfer Modal - Responsive Bottom Sheet */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-panel border border-line w-full sm:max-w-2xl rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line-2 rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-5 bg-surface-2 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-brand-ink" />
                <h2 className="font-bold text-ink text-lg">إذن تحويل بضاعة بين الفروع</h2>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* From & To Branch Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="فرع المصدر (يتم الخصم منه) *"
                  required
                  value={formData.from_branch_id}
                  onChange={(e) => setFormData({ ...formData, from_branch_id: e.target.value })}
                >
                  <option value="">-- اختر فرع المصدر --</option>
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </Select>

                <Select
                  label="فرع الوجهة (المستقبل) *"
                  required
                  value={formData.to_branch_id}
                  onChange={(e) => setFormData({ ...formData, to_branch_id: e.target.value })}
                >
                  <option value="">-- اختر فرع الوجهة --</option>
                  {branches
                    .filter((b: any) => String(b.id) !== formData.from_branch_id)
                    .map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                </Select>
              </div>

              {/* Items List */}
              <div className="pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-ink">الأصناف والكميات المحولة *</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={handleAddItem}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                    className="text-xs font-semibold text-brand-ink"
                  >
                    إضافة صنف آخر
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.items.map((item, idx) => {
                    const selectedProd = products.find((p: any) => String(p.id) === item.product_id);
                    const hasVariants = selectedProd?.variants && selectedProd.variants.length > 0;

                    return (
                      <div key={idx} className="p-3 bg-surface-2 border border-line rounded-xl flex flex-col sm:flex-row items-center gap-2">
                        <div className="flex-1 w-full">
                          <Select
                            required
                            value={item.product_id}
                            onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                          >
                            <option value="">-- اختر الصنف --</option>
                            {products.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.code ? `(${p.code})` : ''}
                              </option>
                            ))}
                          </Select>
                        </div>

                        {hasVariants && (
                          <div className="w-full sm:w-48">
                            <Select
                              required
                              value={item.product_variant_id}
                              onChange={(e) => handleItemChange(idx, 'product_variant_id', e.target.value)}
                              className="text-brand-ink font-medium"
                            >
                              <option value="">-- اختر المقاس / اللون --</option>
                              {selectedProd.variants.map((v: any) => (
                                <option key={v.id} value={v.id}>
                                  {v.name} (مقاس: {v.size || '-'} | لون: {v.color || '-'})
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}

                        <div className="w-full sm:w-28">
                          <Input
                            type="number"
                            min="0.1"
                            step="any"
                            required
                            placeholder="الكمية"
                            value={item.quantity_sent}
                            onChange={(e) => handleItemChange(idx, 'quantity_sent', Number(e.target.value))}
                            className="text-center font-bold tabular-nums"
                          />
                        </div>

                        {formData.items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            onClick={() => handleRemoveItem(idx)}
                            className="min-w-[44px] px-2.5 text-muted hover:text-bad hover:bg-bad-soft"
                            aria-label="حذف الصنف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Textarea
                label="ملاحظات التحويل (اختياري)"
                rows={2}
                placeholder="أي تفاصيل أو رقم مرجعي للشحن والتسليم..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="resize-none"
              />

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setCreateModalOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={createMutation.isPending}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  {createMutation.isPending ? 'جاري التحويل...' : 'تأكيد وإرسال التحويل'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Transfer Details Modal - Responsive Bottom Sheet */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-panel border border-line w-full sm:max-w-lg rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line-2 rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-5 bg-surface-2 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="font-bold text-ink text-lg">إذن تحويل: {selectedTransfer.transfer_number}</h3>
                <span className="text-xs text-muted">
                  {selectedTransfer.transferred_at ? new Date(selectedTransfer.transferred_at).toLocaleString('ar-EG') : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-surface-2 rounded-xl text-xs">
                <div>
                  <span className="text-muted block">من فرع:</span>
                  <span className="font-bold text-ink mt-0.5 block">{selectedTransfer.from_branch?.name}</span>
                </div>
                <div>
                  <span className="text-muted block">إلى فرع:</span>
                  <span className="font-bold text-brand-ink mt-0.5 block">{selectedTransfer.to_branch?.name}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-muted mb-2">الأصناف المحولة:</h4>
                <div className="divide-y divide-line border border-line rounded-xl overflow-hidden">
                  {selectedTransfer.items?.map((item: any) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-semibold text-ink">{item.product?.name}</div>
                        {item.variant && (
                          <div className="text-xs text-brand-ink font-medium">
                            مقاس: {item.variant.size || '-'} | لون: {item.variant.color || '-'}
                          </div>
                        )}
                      </div>
                      <div className="text-left font-bold text-ink tabular-nums">
                        {item.quantity_sent} {item.unit_name || 'قطعة'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTransfer.notes && (
                <div className="p-3 bg-warn-soft rounded-xl text-xs text-warn border border-warn/25">
                  <span className="font-bold block mb-0.5">ملاحظات:</span>
                  {selectedTransfer.notes}
                </div>
              )}
            </div>

            <div className="p-4 bg-surface-2 border-t border-line flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setSelectedTransfer(null)}
              >
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
