import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Store,
  Warehouse,
  Truck,
  MapPin,
  Phone,
  CheckCircle2,
  AlertCircle,
  Package,
  Search,
  RefreshCw,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { BranchType } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { usePermissions } from '../../hooks/usePermissions';

export const BranchesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isOwner, isManager } = usePermissions();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [inventoryBranch, setInventoryBranch] = useState<any | null>(null);
  const [inventorySearch, setInventorySearch] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: BranchType.STORE,
    phone: '',
    address: '',
    is_active: true,
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Fetch Branches
  const { data: rawBranches, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data?.data || [];
    },
  });

  // Defensive array normalization for branches (prevents crashes if cached object exists)
  const branches: any[] = useMemo(() => {
    if (Array.isArray(rawBranches)) return rawBranches;
    if (rawBranches && Array.isArray((rawBranches as any).data)) return (rawBranches as any).data;
    return [];
  }, [rawBranches]);

  // 2. Fetch Branch Inventory
  const { data: inventoryData, isLoading: isInventoryLoading } = useQuery({
    queryKey: ['branch-inventory', inventoryBranch?.id, inventorySearch],
    queryFn: async () => {
      if (!inventoryBranch?.id) return { items: [], total: 0 };
      const res = await apiClient.get(`/branches/${inventoryBranch.id}/inventory`, {
        params: { search: inventorySearch },
      });
      return {
        items: res.data?.data || [],
        total: res.data?.meta?.total || 0,
      };
    },
    enabled: !!inventoryBranch?.id,
  });

  // 3. Create Branch Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const res = await apiClient.post('/branches', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setAddModalOpen(false);
      resetForm();
      setMessage({ type: 'success', text: 'تمت إضافة الفرع بنجاح وتجهيز سجلات المخزون له.' });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.response?.data?.message || 'فشل إنشاء الفرع.' });
    },
  });

  // 4. Update Branch Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<typeof formData> }) => {
      const res = await apiClient.put(`/branches/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setEditingBranch(null);
      resetForm();
      setMessage({ type: 'success', text: 'تم تحديث بيانات الفرع بنجاح.' });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.response?.data?.message || 'فشل تحديث الفرع.' });
    },
  });

  // 5. Delete Branch Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/branches/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setMessage({ type: 'success', text: 'تم حذف الفرع بنجاح.' });
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.response?.data?.message || 'تعذر حذف الفرع.' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: BranchType.STORE,
      phone: '',
      address: '',
      is_active: true,
    });
  };

  const handleOpenEdit = (branch: any) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      type: branch.type,
      phone: branch.phone || '',
      address: branch.address || '',
      is_active: branch.is_active,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, payload: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'STORE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <Store className="w-3.5 h-3.5" />
            معرض بيع تجزئة
          </span>
        );
      case 'WAREHOUSE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Warehouse className="w-3.5 h-3.5" />
            مستودع / مخزن رئيسي
          </span>
        );
      case 'VAN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
            <Truck className="w-3.5 h-3.5" />
            سيارة مندوب متنقلة
          </span>
        );
      default:
        return null;
    }
  };

  // Counts
  const totalBranches = branches.length;
  const storeCount = branches.filter((b: any) => b.type === 'STORE').length;
  const warehouseCount = branches.filter((b: any) => b.type === 'WAREHOUSE').length;
  const vanCount = branches.filter((b: any) => b.type === 'VAN').length;

  return (
    <div className="space-y-3 sm:space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Desktop Header */}
      <div className="hidden md:flex flex-row justify-between items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">الفروع والمخازن (Multi-Branch)</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                إدارة المعارض، المستودعات المركزية، وسيارات التوزيع مع متابعة الأرصدة المستقلة
              </p>
            </div>
          </div>
        </div>

        {(isOwner || isManager) && (
          <button
            onClick={() => {
              resetForm();
              setEditingBranch(null);
              setAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium shadow-sm transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            إضافة فرع / مخزن جديد
          </button>
        )}
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 truncate">الفروع والمخازن</h2>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                {totalBranches}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              {storeCount} معارض • {warehouseCount} مخازن • {vanCount} سيارات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {(isOwner || isManager) && (
            <button
              onClick={() => {
                resetForm();
                setEditingBranch(null);
                setAddModalOpen(true);
              }}
              className="inline-flex items-center gap-1 bg-emerald-600 active:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة</span>
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

      {/* Desktop KPI Stats Cards (hidden on mobile to save vertical space) */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">إجمالي الفروع</div>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{totalBranches}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">معارض ومحلات بيع</div>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{storeCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">مستودعات ومخازن</div>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{warehouseCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">سيارات المناديب</div>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{vanCount}</div>
          </div>
        </div>
      </div>

      {/* Branches List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
            جاري تحميل بيانات الفروع...
          </div>
        ) : branches.length === 0 ? (
          <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-semibold">لا توجد فروع مسجلة حتى الآن</p>
            <p className="text-slate-400 text-sm mt-1">ابدأ بإضافة أول فرع أو مخزن لمتجرك</p>
          </div>
        ) : (
          branches.map((branch: any) => (
            <div
              key={branch.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-lg">{branch.name}</h3>
                      {branch.is_main && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          الفرع الرئيسي
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-medium text-slate-400">كود: {branch.code}</span>
                  </div>
                  {getTypeBadge(branch.type)}
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {branch.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span dir="ltr">{branch.phone}</span>
                    </div>
                  )}
                </div>

                {/* Sub-stats */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2 rounded-lg text-center">
                    <span className="text-slate-400 block">فريق العمل</span>
                    <span className="font-bold text-slate-700 mt-0.5">{branch.users_count || 0} موظف</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg text-center">
                    <span className="text-slate-400 block">الأصناف المسجلة</span>
                    <span className="font-bold text-slate-700 mt-0.5">{branch.stocks_count || 0} صنف</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setInventoryBranch(branch)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Package className="w-3.5 h-3.5" />
                  جرد المخزون
                </button>

                {(isOwner || isManager) && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(branch)}
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="تعديل الفرع"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {!branch.is_main && (
                      <button
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف الفرع "${branch.name}"؟`)) {
                            deleteMutation.mutate(branch.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="حذف الفرع"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Branch Modal */}
      {(addModalOpen || editingBranch) && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-scale-in">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-lg">
                {editingBranch ? `تعديل فرع: ${editingBranch.name}` : 'إضافة فرع / مخزن جديد'}
              </h2>
              <button
                onClick={() => {
                  setAddModalOpen(false);
                  setEditingBranch(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">اسم الفرع / المخزن *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فرع المعادي، المخزن الرئيسي، سيارة 1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">كود الفرع</label>
                  <input
                    type="text"
                    placeholder="BR-02"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">طبيعة الفرع *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as BranchType })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value={BranchType.STORE}>معرض / محل تجزئة</option>
                    <option value={BranchType.WAREHOUSE}>مستودع / مخزن مركزي</option>
                    <option value={BranchType.VAN}>سيارة مندوب متنقلة</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">رقم الهاتف (اختياري)</label>
                <input
                  type="text"
                  placeholder="01012345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">العنوان / الموقع</label>
                <input
                  type="text"
                  placeholder="الشارع، المنطقة، المدينة"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                />
                <label htmlFor="is_active" className="text-xs font-medium text-slate-700 cursor-pointer">
                  الفرع نشط ومتاح للعمليات ونقل البضاعة
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setAddModalOpen(false);
                    setEditingBranch(null);
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all shadow-sm"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'جاري الحفظ...' : editingBranch ? 'حفظ التعديلات' : 'إنشاء الفرع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branch Inventory Drawer / Modal */}
      {inventoryBranch && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col animate-scale-in">
            <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-bold text-slate-800 text-lg">جرد مخزون: {inventoryBranch.name}</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  إجمالي الأصناف المتاحة في هذا الفرع: {inventoryData?.total || 0} صنف
                </p>
              </div>
              <button
                onClick={() => {
                  setInventoryBranch(null);
                  setInventorySearch('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="بحث باسم الصنف أو الباركود..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Inventory Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {isInventoryLoading ? (
                <div className="text-center py-12 text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  جاري جرد رصيد الفرع...
                </div>
              ) : inventoryData?.items.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  لا توجد أصناف مطابقة في هذا الفرع
                </div>
              ) : (
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-semibold">
                      <th className="pb-3">الصنف / المتغير</th>
                      <th className="pb-3">الباركود / الكود</th>
                      <th className="pb-3 text-center">الرصيد في الفرع</th>
                      <th className="pb-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inventoryData?.items.map((stockItem: any) => {
                      const prod = stockItem.product;
                      const variant = stockItem.variant;
                      const qty = Number(stockItem.quantity);
                      const isLow = stockItem.min_quantity !== null && qty <= Number(stockItem.min_quantity);

                      return (
                        <tr key={stockItem.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3">
                            <div className="font-semibold text-slate-800">{prod?.name}</div>
                            {variant && (
                              <div className="text-xs text-purple-700 font-medium mt-0.5">
                                مقاس: {variant.size || '-'} | لون: {variant.color || '-'}
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-xs font-mono text-slate-500">
                            {variant?.barcode || prod?.barcode || prod?.code || '-'}
                          </td>
                          <td className="py-3 text-center font-bold text-slate-800">
                            {qty} {prod?.unit || 'قطعة'}
                          </td>
                          <td className="py-3 text-center">
                            {qty === 0 ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-700">
                                رصيد نافد
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-700">
                                قرب ينفد
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                                متوفر
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => {
                  setInventoryBranch(null);
                  setInventorySearch('');
                }}
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
