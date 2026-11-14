import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Edit2, Wallet, AlertCircle, X, CheckCircle2, Download, Tags } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExpenseSchema, ExpenseInput, Expense, formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { usePermissions } from '../../hooks/usePermissions';
import { DateRangeFilter, calculatePresetDates } from '../components/common/DateRangeFilter';
import { PaginationBar } from '../components/common/PaginationBar';
import { ExpenseMobileCard } from '../components/mobile/ExpenseMobileCard';
import { nativeBackButton } from '../../platform/nativeBackButton';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Tabs, TabItem, Textarea } from '../components/ui';

export const ExpensesPage: React.FC = () => {
  const { confirm } = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canDeleteExpense, isOwnerOrAdmin, isCashier, isMandob } = usePermissions();
  const initialDates = calculatePresetDates('today');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(initialDates.from);
  const [toDate, setToDate] = useState<string>(initialDates.to);
  const [page, setPage] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Category Management State
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [catError, setCatError] = useState<string | null>(null);

  // Fetch Categories Query
  const { data: categoriesData } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const res = await apiClient.get('/expense-categories');
      return res.data?.data || [];
    },
  });
  const categories: Array<{ id: number; name: string; is_default: boolean }> = categoriesData || [];

  // Category Mutations
  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiClient.post('/expense-categories', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      setNewCatName('');
      setCatError(null);
    },
    onError: (err: any) => {
      setCatError(err.response?.data?.message || 'تعذر إضافة التصنيف');
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return apiClient.put(`/expense-categories/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setEditingCatId(null);
      setEditingCatName('');
      setCatError(null);
    },
    onError: (err: any) => {
      setCatError(err.response?.data?.message || 'تعذر تعديل التصنيف');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/expense-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setCatError(null);
    },
    onError: (err: any) => {
      setCatError(err.response?.data?.message || 'تعذر حذف التصنيف');
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(ExpenseSchema),
    defaultValues: {
      title: '',
      category: '',
      amount: 0,
      payment_method: 'CASH',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  // Query
  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', selectedCategory, search, fromDate, toDate, page],
    queryFn: async () => {
      const res = await apiClient.get('/expenses', {
        params: {
          category: selectedCategory || undefined,
          search: search || undefined,
          date_from: fromDate || undefined,
          date_to: toDate || undefined,
          page,
        },
      });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const expenses = expensesData?.data || [];
  const totalExpenses = expensesData?.summary?.total_amount || 0;
  const meta = expensesData?.meta;

  // Hardware Back Button integration
  useEffect(() => {
    if (isModalOpen) {
      return nativeBackButton.register(() => {
        setIsModalOpen(false);
        return true;
      });
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (isCategoriesModalOpen) {
      return nativeBackButton.register(() => {
        setIsCategoriesModalOpen(false);
        return true;
      });
    }
  }, [isCategoriesModalOpen]);

  const categoryTabs: TabItem[] = useMemo(
    () => [
      { id: '', label: 'جميع التصنيفات' },
      ...categories.map((cat) => ({ id: cat.name, label: cat.name })),
    ],
    [categories]
  );

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: ExpenseInput) => {
      if (editingExpense) {
        return apiClient.put(`/expenses/${editingExpense.id}`, data);
      }
      return apiClient.post('/expenses', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsModalOpen(false);
      setEditingExpense(null);
      reset();
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'حدث خطأ أثناء حفظ المصروف');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'تعذر حذف المصروف');
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const handleEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setValue('title', exp.title);
    setValue('category', exp.category || '');
    setValue('amount', exp.amount);
    setValue('payment_method', (exp.payment_method as string) || 'CASH');
    setValue('date', exp.date);
    setValue('notes', exp.notes || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number, title: string) => {
    const ok = await confirm({
      title: 'تأكيد حذف المصروف',
      message: `هل أنت متأكد من حذف مصروف "${title}"؟`,
      type: 'danger',
    });
    if (ok) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: ExpenseInput) => {
    setErrorMessage(null);
    saveMutation.mutate(data);
  };

  const handleExportExcel = async () => {
    try {
      const { exportExpensesToExcel } = await import('../utils/excelExport');
      exportExpensesToExcel(expenses);
    } catch (err) {
      console.error('Excel load failed:', err);
      toast.error('تعذر تحميل أداة Excel، تأكد من الاتصال وحاول مرة أخرى');
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Desktop Header & Stats Banner (md:flex) */}
      <div className="hidden md:flex flex-col gap-6">
        <PageHeader
          title="سجل المصروفات"
          description="متابعة المصاريف والمنصرفات اليومية لحساب صافي الأرباح بدقة"
          className="mb-0"
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                size="md"
                leftIcon={<Download className="w-4 h-4 text-ok" />}
                onClick={handleExportExcel}
                disabled={expenses.length === 0}
                className="text-xs font-bold"
                title="تصدير سجل المصروفات إلى Excel"
              >
                تصدير Excel
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                leftIcon={<Tags className="w-4 h-4 text-brand" />}
                onClick={() => {
                  setCatError(null);
                  setIsCategoriesModalOpen(true);
                }}
                className="text-xs font-bold"
                title="إدارة تصنيفات المصروفات"
              >
                إدارة التصنيفات
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setEditingExpense(null);
                  reset({
                    title: '',
                    category: '',
                    amount: 0,
                    date: new Date().toISOString().split('T')[0],
                    notes: '',
                  });
                  setIsModalOpen(true);
                }}
                className="text-sm font-bold"
              >
                إضافة مصروف جديد
              </Button>
            </>
          }
        />

        {/* Desktop Summary Card */}
        <Card className="rounded-2xl p-5 border-bad/30 bg-bad-soft/40 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-bad uppercase tracking-wider">إجمالي منصرفات الفترة</span>
            <h3 className="text-3xl font-black mt-1 tabular-nums text-bad">{formatCurrency(totalExpenses)}</h3>
          </div>
          <div className="w-12 h-12 bg-bad-soft border border-bad/20 rounded-2xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-bad" />
          </div>
        </Card>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <Card className="md:hidden rounded-2xl p-3.5 border-bad/30 bg-bad-soft/40 flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-muted">
            <Wallet className="w-3.5 h-3.5 text-bad" />
            <span>إجمالي المنصرفات ({expenses.length})</span>
          </div>
          <h3 className="text-xl font-black mt-0.5 tracking-tight tabular-nums text-bad">{formatCurrency(totalExpenses)}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleExportExcel}
            disabled={expenses.length === 0}
            className="px-3"
            title="تصدير Excel"
          >
            <Download className="w-4 h-4 text-ok" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              setCatError(null);
              setIsCategoriesModalOpen(true);
            }}
            className="px-3"
            title="إدارة التصنيفات"
          >
            <Tags className="w-4 h-4 text-brand" />
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setEditingExpense(null);
              reset({
                title: '',
                category: '',
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                notes: '',
              });
              setIsModalOpen(true);
            }}
            className="px-3 text-xs font-black"
          >
            مصروف
          </Button>
        </div>
      </Card>

      {errorMessage && (
        <div className="p-4 bg-bad-soft border border-bad/20 text-bad text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-bad flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filters & Search */}
      <Card className="flex flex-col gap-2.5 p-3 sm:p-4 rounded-2xl w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Filters */}
          <div className="w-full sm:w-auto min-w-0">
            <Tabs
              tabs={categoryTabs}
              activeTab={selectedCategory}
              onChange={(catId) => {
                setSelectedCategory(catId);
                setPage(1);
              }}
            />
          </div>

          {/* Search */}
          <div className="flex-1 sm:max-w-xs">
            <Input
              type="text"
              placeholder="بحث في المصروفات..."
              value={search}
              leftIcon={<Search className="w-4 h-4" />}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Date Range Filter Bar */}
        <div className="pt-2 border-t border-line w-full min-w-0 max-w-full overflow-hidden">
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            defaultPreset="today"
            onChange={(from, to) => {
              setFromDate(from);
              setToDate(to);
              setPage(1);
            }}
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="flex-1 rounded-xl p-0 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-muted font-medium flex-1">جاري التحميل...</div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={<Wallet className="w-6 h-6" />}
            title="لا توجد مصروفات مسجلة"
            description={'انقر فوق زر "إضافة مصروف جديد" لبدء تسجيل وتتبع المصروفات اليومية.'}
            className="flex-1 border-0 rounded-none py-16"
          />
        ) : (
          <>
            {/* Desktop Table View (Hidden on Mobile) */}
            <div className="hidden md:block flex-1">
              <DataTable className="border-0 rounded-none shadow-none">
                <thead className="bg-surface-2 text-muted text-xs font-bold border-b border-line">
                  <tr>
                    <th className="py-3.5 px-4">عنوان المصروف</th>
                    <th className="py-3.5 px-4">التصنيف</th>
                    <th className="py-3.5 px-4">طريقة الصرف</th>
                    <th className="py-3.5 px-4">المبلغ</th>
                    <th className="py-3.5 px-4">التاريخ</th>
                    <th className="py-3.5 px-4">ملاحظات</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {expenses.map((exp: any) => (
                    <tr key={exp.id} className="hover:bg-surface-2/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-ink">{exp.title}</td>
                      <td className="py-3.5 px-4">
                        <Badge tone="neutral">{exp.category || 'عام'}</Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          tone={
                            exp.payment_method === 'VODAFONE_CASH'
                              ? 'bad'
                              : exp.payment_method === 'INSTAPAY'
                              ? 'brand'
                              : exp.payment_method === 'TRANSFER' || exp.payment_method === 'CARD'
                              ? 'info'
                              : 'ok'
                          }
                        >
                          {exp.payment_method === 'VODAFONE_CASH'
                            ? 'فودافون كاش'
                            : exp.payment_method === 'INSTAPAY'
                            ? 'إنستاباي'
                            : exp.payment_method === 'TRANSFER'
                            ? 'تحويل بنكي'
                            : exp.payment_method === 'CARD'
                            ? 'بطاقة بنكية'
                            : 'نقدية (الدرج)'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-black text-bad tabular-nums">{formatCurrency(exp.amount)}</td>
                      <td className="py-3.5 px-4 text-muted tabular-nums">{exp.date}</td>
                      <td className="py-3.5 px-4 text-muted max-w-xs truncate">{exp.notes || '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(exp)}
                            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-muted hover:text-brand rounded-xl hover:bg-surface-2 transition-colors"
                            title="تعديل"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {canDeleteExpense && (
                            <button
                              type="button"
                              onClick={() => handleDelete(exp.id, exp.title)}
                              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-muted hover:text-bad rounded-xl hover:bg-bad-soft transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>

            {/* Mobile Cards View (Touch-Optimized) */}
            <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-3 bg-surface-2">
              {expenses.map((exp: any) => (
                <ExpenseMobileCard
                  key={exp.id}
                  expense={exp}
                  canDeleteExpense={canDeleteExpense}
                  onEditExpense={(expense) => handleEdit(expense)}
                  onDeleteExpense={(id, title) => handleDelete(id, title)}
                />
              ))}
            </div>

            <PaginationBar
              currentPage={meta?.current_page || page}
              lastPage={meta?.last_page || 1}
              total={meta?.total || expenses.length}
              perPage={meta?.per_page || 20}
              onPageChange={(newPage) => setPage(newPage)}
              itemLabel="مصروف"
            />
          </>
        )}
      </Card>

      {/* Add / Edit Modal - Responsive Bottom Sheet on Mobile */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-panel border border-line w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Sheet Handle for Mobile */}
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto mt-3 sm:hidden" />
            <div className="p-5 border-b border-line flex items-center justify-between bg-surface">
              <h3 className="font-bold text-base text-ink">
                {editingExpense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-ink rounded-xl hover:bg-surface-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 overflow-y-auto">
              <Input
                label="عنوان أو جهة الصرف *"
                type="text"
                placeholder="مثال: بنزين سيارة التوزيع، غداء المندوب..."
                error={errors.title?.message}
                className="font-medium"
                {...register('title')}
              />

              <div>
                <Input
                  label="التصنيف"
                  type="text"
                  placeholder="اختر أو اكتب تصنيفاً..."
                  list="category-suggestions"
                  {...register('category')}
                />
                <datalist id="category-suggestions">
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <Select
                  label="طريقة الصرف والخصم *"
                  className="font-bold"
                  {...register('payment_method')}
                >
                  <option value="CASH">نقدية كاش (الدرج / الوردية)</option>
                  <option value="VODAFONE_CASH">فودافون كاش والمحافظ الإلكترونية</option>
                  <option value="INSTAPAY">تحويل إنستاباي (InstaPay)</option>
                  {isOwnerOrAdmin && (
                    <>
                      <option value="CARD">بطاقة بنكية / فيزا</option>
                      <option value="TRANSFER">حساب بنكي / تحويل بنكي</option>
                    </>
                  )}
                </Select>
                <p className="text-[11px] text-muted mt-1">
                  {isCashier || isMandob
                    ? 'سيتم خصم المصروف من درج الوردية إذا كان كاش، أو من المحفظة المحددة للمحل.'
                    : 'اختر الخزينة أو القناة المنصرف منها لتحديث رصيدها تلقائياً.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="المبلغ (ج.م) *"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  error={errors.amount?.message}
                  className="font-bold tabular-nums"
                  {...register('amount', { valueAsNumber: true })}
                />

                <Input
                  label="التاريخ *"
                  type="date"
                  {...register('date')}
                />
              </div>

              <Textarea
                label="ملاحظات إضافية"
                rows={2}
                placeholder="أي تفاصيل أخرى..."
                {...register('notes')}
              />

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                  className="text-sm font-bold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={saveMutation.isPending}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  className="text-sm font-bold"
                >
                  {saveMutation.isPending ? 'جاري الحفظ...' : editingExpense ? 'تحديث المصروف' : 'حفظ المصروف'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal - Responsive Bottom Sheet on Mobile */}
      {isCategoriesModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-panel w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col border border-line">
            {/* Sheet Handle for Mobile */}
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto mt-3 sm:hidden" />
            <div className="p-5 border-b border-line flex items-center justify-between bg-surface">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand-soft text-brand rounded-xl border border-brand/20">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-ink">إدارة تصنيفات المصروفات</h3>
                  <p className="text-xs text-muted">إضافة وتعديل وحذف بنود وتصنيفات الصرف</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoriesModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-ink rounded-xl hover:bg-surface-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {catError && (
                <div className="p-3 bg-bad-soft border border-bad/20 text-bad text-xs rounded-xl flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-bad flex-shrink-0" />
                  <span>{catError}</span>
                </div>
              )}

              {/* Add New Category Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newCatName.trim()) {
                    addCategoryMutation.mutate(newCatName.trim());
                  }
                }}
                className="flex items-center gap-2"
              >
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="اسم التصنيف الجديد (مثال: شحن بضائع، دعاية)..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="text-xs font-bold"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={addCategoryMutation.isPending}
                  disabled={!newCatName.trim()}
                  leftIcon={<Plus className="w-4 h-4" />}
                  className="text-xs font-black shrink-0"
                >
                  إضافة
                </Button>
              </form>

              {/* Categories List */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {categories.length === 0 ? (
                  <p className="text-center text-xs text-muted py-6">لا توجد تصنيفات مسجلة بعد</p>
                ) : (
                  categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2.5 bg-surface-2 hover:bg-surface rounded-xl text-xs transition-colors group border border-line/60"
                    >
                      {editingCatId === cat.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            className="flex-1 min-h-[44px] px-2.5 py-1.5 bg-panel border border-line rounded-lg text-xs font-bold text-ink"
                            autoFocus
                          />
                          <Button
                            type="button"
                            variant="primary"
                            size="md"
                            onClick={() => {
                              if (editingCatName.trim()) {
                                updateCategoryMutation.mutate({ id: cat.id, name: editingCatName.trim() });
                              }
                            }}
                            className="text-xs font-bold px-3"
                          >
                            حفظ
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            onClick={() => setEditingCatId(null)}
                            className="text-xs font-bold px-3"
                          >
                            إلغاء
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink">{cat.name}</span>
                            {cat.is_default && (
                              <Badge tone="neutral" className="text-[10px]">
                                أساسي
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCatId(cat.id);
                                setEditingCatName(cat.name);
                              }}
                              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-muted hover:text-brand rounded-xl hover:bg-panel transition-colors"
                              title="تعديل الاسم"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'تأكيد حذف التصنيف',
                                  message: `هل أنت متأكد من حذف تصنيف "${cat.name}"؟`,
                                  type: 'danger',
                                });
                                if (ok) {
                                  deleteCategoryMutation.mutate(cat.id);
                                }
                              }}
                              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-muted hover:text-bad rounded-xl hover:bg-bad-soft transition-colors"
                              title="حذف التصنيف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 bg-surface-2 border-t border-line text-right">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setIsCategoriesModalOpen(false)}
                className="w-full text-xs font-bold"
              >
                إغلاق النافذة
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
