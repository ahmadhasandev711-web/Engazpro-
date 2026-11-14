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
import { BranchMobileCard } from '../components/mobile/BranchMobileCard';
import { nativeBackButton } from '../../platform/nativeBackButton';
import { useConfirm } from '../context/ConfirmContext';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';

export const BranchesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isOwner, isManager } = usePermissions();
  const { confirm } = useConfirm();

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

  // Hardware back button handler for modals
  React.useEffect(() => {
    if (!addModalOpen && !editingBranch && !inventoryBranch) return;
    return nativeBackButton.register(() => {
      if (inventoryBranch) {
        setInventoryBranch(null);
        setInventorySearch('');
        return true;
      }
      if (editingBranch) {
        setEditingBranch(null);
        resetForm();
        return true;
      }
      if (addModalOpen) {
        setAddModalOpen(false);
        resetForm();
        return true;
      }
      return false;
    });
  }, [addModalOpen, editingBranch, inventoryBranch]);

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
          <Badge tone="ok" className="gap-1">
            <Store className="w-3.5 h-3.5" />
            معرض بيع تجزئة
          </Badge>
        );
      case 'WAREHOUSE':
        return (
          <Badge tone="warn" className="gap-1">
            <Warehouse className="w-3.5 h-3.5" />
            مستودع / مخزن رئيسي
          </Badge>
        );
      case 'VAN':
        return (
          <Badge tone="info" className="gap-1">
            <Truck className="w-3.5 h-3.5" />
            سيارة مندوب متنقلة
          </Badge>
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
      <PageHeader
        className="hidden md:flex mb-0 bg-panel p-5 rounded-2xl border border-line shadow-xs"
        title="الفروع والمخازن (Multi-Branch)"
        description="إدارة المعارض، المستودعات المركزية، وسيارات التوزيع مع متابعة الأرصدة المستقلة"
        actions={
          (isOwner || isManager) ? (
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                resetForm();
                setEditingBranch(null);
                setAddModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
              className="font-bold"
            >
              إضافة فرع / مخزن جديد
            </Button>
          ) : undefined
        }
      />

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <Card className="md:hidden p-3 sm:p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-ok-soft text-ok flex items-center justify-center font-black shrink-0 border border-ok/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-ink truncate">الفروع والمخازن</h2>
              <Badge tone="neutral" className="text-2xs font-black px-2 py-0.5 shrink-0 tabular-nums">
                {totalBranches}
              </Badge>
            </div>
            <p className="text-2xs text-muted font-medium truncate tabular-nums">
              {storeCount} معارض • {warehouseCount} مخازن • {vanCount} سيارات
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
                setEditingBranch(null);
                setAddModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
              className="px-3 text-xs font-bold"
            >
              إضافة
            </Button>
          )}
        </div>
      </Card>

      {/* Alerts */}
      {message && (
        <div
          className={`p-3 sm:p-4 rounded-xl flex items-center justify-between gap-3 text-xs sm:text-sm animate-fade-in border ${
            message.type === 'success' ? 'bg-ok-soft text-ok border-ok/25' : 'bg-bad-soft text-bad border-bad/25'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
            <span>{message.text}</span>
          </div>
          <Button
            variant="ghost"
            size="md"
            onClick={() => setMessage(null)}
            className="min-w-[44px] px-0 text-muted hover:text-ink"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Desktop KPI Stats Cards (hidden on mobile to save vertical space) */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 sm:p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-ok-soft text-ok border border-ok/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted font-medium">إجمالي الفروع</div>
            <div className="text-xl font-bold text-ink mt-0.5 tabular-nums">{totalBranches}</div>
          </div>
        </Card>

        <Card className="p-4 sm:p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-info-soft text-info border border-info/20">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted font-medium">معارض ومحلات بيع</div>
            <div className="text-xl font-bold text-ink mt-0.5 tabular-nums">{storeCount}</div>
          </div>
        </Card>

        <Card className="p-4 sm:p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-warn-soft text-warn border border-warn/20">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted font-medium">مستودعات ومخازن</div>
            <div className="text-xl font-bold text-ink mt-0.5 tabular-nums">{warehouseCount}</div>
          </div>
        </Card>

        <Card className="p-4 sm:p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-3 rounded-lg bg-brand-soft text-brand border border-brand/20">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted font-medium">سيارات المناديب</div>
            <div className="text-xl font-bold text-ink mt-0.5 tabular-nums">{vanCount}</div>
          </div>
        </Card>
      </div>

      {/* Branches List */}
      <div>
        {isLoading ? (
          <div className="text-center py-12 text-muted">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-brand" />
            جاري تحميل بيانات الفروع...
          </div>
        ) : branches.length === 0 ? (
          <EmptyState
            className="border-dashed border-line"
            icon={<Building2 className="w-6 h-6 text-muted" />}
            title="لا توجد فروع مسجلة حتى الآن"
            description="ابدأ بإضافة أول فرع أو مخزن لمتجرك"
          />
        ) : (
          <>
            {/* Mobile Cards List (md:hidden) */}
            <div className="md:hidden space-y-3">
              {branches.map((branch: any) => (
                <BranchMobileCard
                  key={branch.id}
                  branch={branch}
                  isOwnerOrManager={isOwner || isManager}
                  onOpenInventory={(b) => setInventoryBranch(b)}
                  onEdit={(b) => handleOpenEdit(b)}
                  onDelete={async (id, name) => {
                    const ok = await confirm({
                      title: 'تأكيد حذف الفرع',
                      message: `هل أنت متأكد من حذف الفرع "${name}"؟`,
                      type: 'danger',
                    });
                    if (ok) {
                      deleteMutation.mutate(id);
                    }
                  }}
                />
              ))}
            </div>

            {/* Desktop Grid (hidden md:grid) */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {branches.map((branch: any) => (
                <Card
                  key={branch.id}
                  className="hover:border-line-2 transition-all p-5 sm:p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-ink text-lg">{branch.name}</h3>
                          {branch.is_main && (
                            <Badge tone="warn" className="text-2xs rounded-md px-2 py-0.5">
                              الفرع الرئيسي
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs tabular-nums font-medium text-muted">كود: {branch.code}</span>
                      </div>
                      {getTypeBadge(branch.type)}
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-muted">
                      {branch.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted shrink-0" />
                          <span className="truncate">{branch.address}</span>
                        </div>
                      )}
                      {branch.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted shrink-0" />
                          <span dir="ltr" className="tabular-nums">{branch.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Sub-stats */}
                    <div className="mt-4 pt-3 border-t border-line grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-surface-2 p-2 rounded-lg text-center border border-line">
                        <span className="text-muted block">فريق العمل</span>
                        <span className="font-bold text-ink mt-0.5 tabular-nums">{branch.users_count || 0} موظف</span>
                      </div>
                      <div className="bg-surface-2 p-2 rounded-lg text-center border border-line">
                        <span className="text-muted block">الأصناف المسجلة</span>
                        <span className="font-bold text-ink mt-0.5 tabular-nums">{branch.stocks_count || 0} صنف</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3 border-t border-line flex items-center justify-between gap-2">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => setInventoryBranch(branch)}
                      leftIcon={<Package className="w-3.5 h-3.5" />}
                      className="flex-1 bg-ok-soft hover:bg-ok-soft/80 text-ok border-ok/25 text-xs font-semibold"
                    >
                      جرد المخزون
                    </Button>

                    {(isOwner || isManager) && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="md"
                          onClick={() => handleOpenEdit(branch)}
                          className="min-w-[44px] px-0 text-muted hover:text-brand hover:bg-brand-soft"
                          title="تعديل الفرع"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>

                        {!branch.is_main && (
                          <Button
                            variant="ghost"
                            size="md"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'تأكيد حذف الفرع',
                                message: `هل أنت متأكد من حذف الفرع "${branch.name}"؟`,
                                type: 'danger',
                              });
                              if (ok) {
                                deleteMutation.mutate(branch.id);
                              }
                            }}
                            className="min-w-[44px] px-0 text-muted hover:text-bad hover:bg-bad-soft"
                            title="حذف الفرع"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Branch Modal */}
      {(addModalOpen || editingBranch) && (
        <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panel w-full max-w-md rounded-2xl border border-line shadow-xl overflow-hidden animate-scale-in">
            <div className="p-5 bg-surface-2/60 border-b border-line flex items-center justify-between">
              <h2 className="font-bold text-ink text-lg">
                {editingBranch ? `تعديل فرع: ${editingBranch.name}` : 'إضافة فرع / مخزن جديد'}
              </h2>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setAddModalOpen(false);
                  setEditingBranch(null);
                }}
                className="min-w-[44px] px-0 text-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Input
                label="اسم الفرع / المخزن *"
                type="text"
                required
                placeholder="مثال: فرع المعادي، المخزن الرئيسي، سيارة 1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-surface-2/50"
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="كود الفرع"
                  type="text"
                  placeholder="BR-02"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="bg-surface-2/50 tabular-nums"
                />

                <Select
                  label="طبيعة الفرع *"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as BranchType })}
                  className="bg-surface-2/50"
                >
                  <option value={BranchType.STORE}>معرض / محل تجزئة</option>
                  <option value={BranchType.WAREHOUSE}>مستودع / مخزن مركزي</option>
                  <option value={BranchType.VAN}>سيارة مندوب متنقلة</option>
                </Select>
              </div>

              <Input
                label="رقم الهاتف (اختياري)"
                type="text"
                placeholder="01012345678"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="bg-surface-2/50 tabular-nums"
                dir="ltr"
              />

              <Input
                label="العنوان / الموقع"
                type="text"
                placeholder="الشارع، المنطقة، المدينة"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="bg-surface-2/50"
              />

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-line-2 accent-brand focus:ring-brand h-4 w-4"
                />
                <label htmlFor="is_active" className="text-xs font-medium text-ink cursor-pointer">
                  الفرع نشط ومتاح للعمليات ونقل البضاعة
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setAddModalOpen(false);
                    setEditingBranch(null);
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  isLoading={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'جاري الحفظ...' : editingBranch ? 'حفظ التعديلات' : 'إنشاء الفرع'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branch Inventory Drawer / Modal */}
      {inventoryBranch && (
        <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panel w-full max-w-3xl rounded-2xl border border-line shadow-xl overflow-hidden max-h-[90vh] flex flex-col animate-scale-in">
            <div className="p-5 bg-surface-2/60 border-b border-line flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-brand" />
                  <h2 className="font-bold text-ink text-lg">جرد مخزون: {inventoryBranch.name}</h2>
                </div>
                <p className="text-xs text-muted mt-0.5 tabular-nums">
                  إجمالي الأصناف المتاحة في هذا الفرع: {inventoryData?.total || 0} صنف
                </p>
              </div>
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setInventoryBranch(null);
                  setInventorySearch('');
                }}
                className="min-w-[44px] px-0 text-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-line bg-panel">
              <Input
                type="text"
                placeholder="بحث باسم الصنف أو الباركود..."
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-muted" />}
                className="bg-surface-2/50"
              />
            </div>

            {/* Inventory Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {isInventoryLoading ? (
                <div className="text-center py-12 text-muted">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
                  جاري جرد رصيد الفرع...
                </div>
              ) : inventoryData?.items.length === 0 ? (
                <EmptyState
                  icon={<Package className="w-6 h-6 text-muted" />}
                  title="لا توجد أصناف مطابقة في هذا الفرع"
                />
              ) : (
                <DataTable>
                  <thead className="bg-surface-2 text-muted text-xs font-semibold border-b border-line">
                    <tr>
                      <th className="py-3 px-4">الصنف / المتغير</th>
                      <th className="py-3 px-4">الباركود / الكود</th>
                      <th className="py-3 px-4 text-center">الرصيد في الفرع</th>
                      <th className="py-3 px-4 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {inventoryData?.items.map((stockItem: any) => {
                      const prod = stockItem.product;
                      const variant = stockItem.variant;
                      const qty = Number(stockItem.quantity);
                      const isLow = stockItem.min_quantity !== null && qty <= Number(stockItem.min_quantity);

                      return (
                        <tr key={stockItem.id} className="hover:bg-surface-2/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-ink">{prod?.name}</div>
                            {variant && (
                              <div className="text-xs text-brand font-medium mt-0.5">
                                مقاس: {variant.size || '-'} | لون: {variant.color || '-'}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs tabular-nums text-muted">
                            {variant?.barcode || prod?.barcode || prod?.code || '-'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-ink tabular-nums">
                            {qty} {prod?.unit || 'قطعة'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {qty === 0 ? (
                              <Badge tone="bad" className="text-2xs rounded-md px-2 py-0.5">
                                رصيد نافد
                              </Badge>
                            ) : isLow ? (
                              <Badge tone="warn" className="text-2xs rounded-md px-2 py-0.5">
                                قرب ينفد
                              </Badge>
                            ) : (
                              <Badge tone="ok" className="text-2xs rounded-md px-2 py-0.5">
                                متوفر
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              )}
            </div>

            <div className="p-4 bg-surface-2/60 border-t border-line flex justify-end">
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setInventoryBranch(null);
                  setInventorySearch('');
                }}
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
