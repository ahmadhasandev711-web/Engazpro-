import React, { useState } from 'react';
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

export const StockTransfersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isOwner, isManager } = usePermissions();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

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
  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['stock-transfers', statusFilter],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const res = await apiClient.get('/stock-transfers', { params });
      return {
        items: res.data?.data || [],
        total: res.data?.meta?.total || 0,
      };
    },
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
      alert('يرجى تحديد فرع المصدر وفرع الوجهة.');
      return;
    }
    if (formData.from_branch_id === formData.to_branch_id) {
      alert('لا يمكن إجراء تحويل لنفس الفرع.');
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
      alert('يرجى اختيار صنف واحد على الأقل مع تحديد كمية صالحة.');
      return;
    }

    createMutation.mutate(payload);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Clock className="w-3.5 h-3.5" />
            في الطريق
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم الاستلام
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <XCircle className="w-3.5 h-3.5" />
            ملغي
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  const transfers = transfersData?.items || [];
  const inTransitCount = transfers.filter((t: any) => t.status === 'IN_TRANSIT').length;
  const receivedCount = transfers.filter((t: any) => t.status === 'RECEIVED').length;
  const cancelledCount = transfers.filter((t: any) => t.status === 'CANCELLED').length;

  return (
    <div className="space-y-3 sm:space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Desktop Header */}
      <div className="hidden md:flex flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">تحويلات المخزون بين الفروع (Stock Transfers)</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                نقل البضاعة بين المخزن الرئيسي والمعارض وسيارات المناديب مع تأكيد الاستلام الميداني
              </p>
            </div>
          </div>
        </div>

        {(isOwner || isManager) && (
          <button
            onClick={() => {
              resetForm();
              setCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            إذن تحويل بضاعة جديد
          </button>
        )}
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black shrink-0">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 truncate">تحويلات المخزون</h2>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                {transfersData?.total || 0}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              في الطريق: <span className="font-bold text-blue-700">{inTransitCount}</span>
              {receivedCount > 0 && (
                <span className="text-emerald-600 font-bold mr-1.5 inline-flex items-center gap-0.5">
                  • {receivedCount} مستلم
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(isOwner || isManager) && (
            <button
              onClick={() => {
                resetForm();
                setCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1 bg-blue-600 active:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>تحويل جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {message && (
        <div
          className={`p-3 sm:p-4 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm animate-fade-in ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Desktop KPI Stats (Hidden on mobile to save vertical real estate) */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-slate-100 text-slate-700">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">إجمالي التحويلات</div>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{transfersData?.total || 0}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">في الطريق (معلق)</div>
            <div className="text-xl font-bold text-blue-700 mt-0.5">{inTransitCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">تم الاستلام والاعتماد</div>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">{receivedCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-rose-50 text-rose-600">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">أوامر ملغاة</div>
            <div className="text-xl font-bold text-rose-700 mt-0.5">{cancelledCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs (Horizontal Scroll Track) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth flex-nowrap text-xs">
        {[
          { key: 'ALL', label: `جميع التحويلات (${transfersData?.total || 0})` },
          { key: 'IN_TRANSIT', label: `في الطريق (${inTransitCount})` },
          { key: 'RECEIVED', label: `مستلم (${receivedCount})` },
          { key: 'CANCELLED', label: `ملغي (${cancelledCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all text-xs ${
              statusFilter === tab.key
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
            جاري تحميل أوامر التحويل...
          </div>
        ) : transfers.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-600">لا توجد أوامر تحويل مسجلة</p>
            <p className="text-xs text-slate-400 mt-1">يمكنك إنشاء إذن تحويل بضاعة جديد بين أي فرعين بنقرة زر</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 text-xs font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">رقم الإذن</th>
                    <th className="py-3.5 px-4">التاريخ</th>
                    <th className="py-3.5 px-4">فرع المصدر (من)</th>
                    <th className="py-3.5 px-4">فرع الوجهة (إلى)</th>
                    <th className="py-3.5 px-4 text-center">عدد الأصناف</th>
                    <th className="py-3.5 px-4 text-center">الحالة</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transfers.map((trf: any) => (
                    <tr key={trf.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold font-mono text-slate-800">
                        {trf.transfer_number}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-xs">
                        {trf.transferred_at ? new Date(trf.transferred_at).toLocaleString('ar-EG') : '-'}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {trf.from_branch?.name || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-500" />
                          {trf.to_branch?.name || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        {trf.items?.length || 0} صنف
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(trf.status)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {trf.status === 'IN_TRANSIT' && (
                            <>
                              <button
                                onClick={() => {
                                  if (confirm(`هل تؤكد استلام كامل بضاعة الإذن رقم "${trf.transfer_number}"؟`)) {
                                    receiveMutation.mutate(trf.id);
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
                                title="تأكيد الاستلام"
                              >
                                <Check className="w-3.5 h-3.5" />
                                تأكيد الاستلام
                              </button>

                              {(isOwner || isManager) && (
                                <button
                                  onClick={() => {
                                    const reason = prompt('يرجى كتابة سبب الإلغاء:');
                                    if (reason) {
                                      cancelMutation.mutate({ id: trf.id, reason });
                                    }
                                  }}
                                  className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-medium transition-colors"
                                  title="إلغاء التحويل"
                                >
                                  إلغاء
                                </button>
                              )}
                            </>
                          )}

                          <button
                            onClick={() => setSelectedTransfer(trf)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="عرض التفاصيل"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards View (md:hidden) */}
            <div className="md:hidden divide-y divide-slate-100">
              {transfers.map((trf: any) => (
                <div key={trf.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-sm text-slate-800">
                        #{trf.transfer_number}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {trf.transferred_at ? new Date(trf.transferred_at).toLocaleString('ar-EG') : '-'}
                      </p>
                    </div>
                    {getStatusBadge(trf.status)}
                  </div>

                  {/* Route & Items */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">من فرع:</span>
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {trf.from_branch?.name || '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                      <span className="text-slate-500 font-medium">إلى فرع:</span>
                      <span className="font-bold text-blue-700 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-blue-500" />
                        {trf.to_branch?.name || '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-1.5">
                      <span className="text-slate-500 font-medium">عدد الأصناف:</span>
                      <span className="font-mono font-black text-slate-900">{trf.items?.length || 0} صنف</span>
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    {trf.status === 'IN_TRANSIT' && (
                      <button
                        onClick={() => {
                          if (confirm(`هل تؤكد استلام كامل بضاعة الإذن رقم "${trf.transfer_number}"؟`)) {
                            receiveMutation.mutate(trf.id);
                          }
                        }}
                        className="min-h-[38px] px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 shadow-sm"
                      >
                        <Check className="w-4 h-4" />
                        تأكيد الاستلام
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedTransfer(trf)}
                      className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 active:bg-slate-300"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      عرض
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Transfer Modal - Responsive Bottom Sheet */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full sm:max-w-2xl rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-slate-800 text-lg">إذن تحويل بضاعة بين الفروع</h2>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* From & To Branch Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">فرع المصدر (يتم الخصم منه) *</label>
                  <select
                    required
                    value={formData.from_branch_id}
                    onChange={(e) => setFormData({ ...formData, from_branch_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- اختر فرع المصدر --</option>
                    {branches.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">فرع الوجهة (المستقبل) *</label>
                  <select
                    required
                    value={formData.to_branch_id}
                    onChange={(e) => setFormData({ ...formData, to_branch_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- اختر فرع الوجهة --</option>
                    {branches
                      .filter((b: any) => String(b.id) !== formData.from_branch_id)
                      .map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700">الأصناف والكميات المحولة *</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة صنف آخر
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.items.map((item, idx) => {
                    const selectedProd = products.find((p: any) => String(p.id) === item.product_id);
                    const hasVariants = selectedProd?.variants && selectedProd.variants.length > 0;

                    return (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-2">
                        <div className="flex-1 w-full">
                          <select
                            required
                            value={item.product_id}
                            onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-- اختر الصنف --</option>
                            {products.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.code ? `(${p.code})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {hasVariants && (
                          <div className="w-full sm:w-48">
                            <select
                              required
                              value={item.product_variant_id}
                              onChange={(e) => handleItemChange(idx, 'product_variant_id', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-purple-800 font-medium"
                            >
                              <option value="">-- اختر المقاس / اللون --</option>
                              {selectedProd.variants.map((v: any) => (
                                <option key={v.id} value={v.id}>
                                  {v.name} (مقاس: {v.size || '-'} | لون: {v.color || '-'})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="w-full sm:w-28">
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            required
                            placeholder="الكمية"
                            value={item.quantity_sent}
                            onChange={(e) => handleItemChange(idx, 'quantity_sent', Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">ملاحظات التحويل (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل أو رقم مرجعي للشحن والتسليم..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  {createMutation.isPending ? 'جاري التحويل...' : 'تأكيد وإرسال التحويل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Transfer Details Modal - Responsive Bottom Sheet */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full sm:max-w-lg rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">إذن تحويل: {selectedTransfer.transfer_number}</h3>
                <span className="text-xs text-slate-400">
                  {selectedTransfer.transferred_at ? new Date(selectedTransfer.transferred_at).toLocaleString('ar-EG') : ''}
                </span>
              </div>
              <button
                onClick={() => setSelectedTransfer(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 block">من فرع:</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{selectedTransfer.from_branch?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">إلى فرع:</span>
                  <span className="font-bold text-blue-700 mt-0.5 block">{selectedTransfer.to_branch?.name}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-600 mb-2">الأصناف المحولة:</h4>
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {selectedTransfer.items?.map((item: any) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-semibold text-slate-800">{item.product?.name}</div>
                        {item.variant && (
                          <div className="text-xs text-purple-700 font-medium">
                            مقاس: {item.variant.size || '-'} | لون: {item.variant.color || '-'}
                          </div>
                        )}
                      </div>
                      <div className="text-left font-bold text-slate-800">
                        {item.quantity_sent} {item.unit_name || 'قطعة'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTransfer.notes && (
                <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200">
                  <span className="font-bold block mb-0.5">ملاحظات:</span>
                  {selectedTransfer.notes}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedTransfer(null)}
                className="px-5 py-2 text-sm bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
