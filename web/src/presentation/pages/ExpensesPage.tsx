import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Edit2, Wallet, AlertCircle, X, CheckCircle2, Download, Tags } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExpenseSchema, ExpenseInput, Expense, formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { exportExpensesToExcel } from '../utils/excelExport';
import { usePermissions } from '../../hooks/usePermissions';
import { DateRangeFilter, calculatePresetDates } from '../components/common/DateRangeFilter';
import { PaginationBar } from '../components/common/PaginationBar';
import { MobileFilterChips, FilterChipOption } from '../components/mobile/MobileFilterChips';
import { ExpenseMobileCard } from '../components/mobile/ExpenseMobileCard';
import { nativeBackButton } from '../../platform/nativeBackButton';

export const ExpensesPage: React.FC = () => {
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

  const categoryFilterOptions: FilterChipOption<string>[] = useMemo(
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

  const handleDelete = (id: number, title: string) => {
    if (window.confirm(`هل أنت متأكد من حذف مصروف "${title}"؟`)) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (data: ExpenseInput) => {
    setErrorMessage(null);
    saveMutation.mutate(data);
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Desktop Header & Stats Banner (md:flex) */}
      <div className="hidden md:flex flex-col gap-6">
        <div className="flex sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">سجل المصروفات</h2>
            <p className="text-sm text-slate-500">متابعة المصاريف والمنصرفات اليومية لحساب صافي الأرباح بدقة</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportExpensesToExcel(expenses)}
              disabled={expenses.length === 0}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
              title="تصدير سجل المصروفات إلى Excel"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              تصدير Excel
            </button>
            <button
              onClick={() => {
                setCatError(null);
                setIsCategoriesModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors"
              title="إدارة تصنيفات المصروفات"
            >
              <Tags className="w-4 h-4 text-indigo-600" />
              إدارة التصنيفات
            </button>
            <button
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
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة مصروف جديد
            </button>
          </div>
        </div>

        {/* Desktop Summary Card */}
        <div className="bg-gradient-to-l from-rose-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-100 uppercase tracking-wider">إجمالي منصرفات الفترة</span>
            <h3 className="text-3xl font-black mt-1">{formatCurrency(totalExpenses)}</h3>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <Wallet className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-gradient-to-l from-rose-500 to-amber-600 rounded-2xl p-3.5 text-white shadow-md flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-rose-100">
            <Wallet className="w-3.5 h-3.5" />
            <span>إجمالي المنصرفات ({expenses.length})</span>
          </div>
          <h3 className="text-xl font-black mt-0.5 tracking-tight">{formatCurrency(totalExpenses)}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => exportExpensesToExcel(expenses)}
            disabled={expenses.length === 0}
            className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-sm transition-colors disabled:opacity-40"
            title="تصدير Excel"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setCatError(null);
              setIsCategoriesModalOpen(true);
            }}
            className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-sm transition-colors"
            title="إدارة التصنيفات"
          >
            <Tags className="w-4 h-4" />
          </button>
          <button
            type="button"
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
            className="px-3 py-2 bg-white text-rose-700 hover:bg-rose-50 rounded-xl font-black text-xs shadow-sm flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>مصروف</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col gap-2.5 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Category Filters (Single-line horizontal scroll track on mobile) */}
          <div className="w-full sm:w-auto min-w-0">
            <MobileFilterChips
              options={categoryFilterOptions}
              selectedId={selectedCategory}
              onSelect={(catId) => {
                setSelectedCategory(catId);
                setPage(1);
              }}
            />
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث في المصروفات..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-3 pr-9 py-1.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Date Range Filter Bar */}
        <div className="pt-2 border-t border-slate-100 w-full min-w-0 max-w-full overflow-hidden">
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
      </div>

      {/* Table */}
      <div className="bg-white flex-1 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-slate-400 font-medium flex-1">جاري التحميل...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16 flex-1 flex flex-col justify-center items-center">
            <h3 className="text-base font-bold text-slate-700">لا توجد مصروفات مسجلة</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              انقر فوق زر "إضافة مصروف جديد" لبدء تسجيل وتتبع المصروفات اليومية.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((exp: any) => (
                    <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{exp.title}</td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium">
                          {exp.category || 'عام'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          exp.payment_method === 'VODAFONE_CASH'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : exp.payment_method === 'INSTAPAY'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : exp.payment_method === 'TRANSFER' || exp.payment_method === 'CARD'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {exp.payment_method === 'VODAFONE_CASH'
                            ? 'فودافون كاش'
                            : exp.payment_method === 'INSTAPAY'
                            ? 'إنستاباي'
                            : exp.payment_method === 'TRANSFER'
                            ? 'تحويل بنكي'
                            : exp.payment_method === 'CARD'
                            ? 'بطاقة بنكية'
                            : 'نقدية (الدرج)'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-rose-600">{formatCurrency(exp.amount)}</td>
                      <td className="py-3.5 px-4 text-slate-600">{exp.date}</td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{exp.notes || '-'}</td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEdit(exp)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="تعديل"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {canDeleteExpense && (
                            <button
                              onClick={() => handleDelete(exp.id, exp.title)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
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
              </table>
            </div>

            {/* Mobile Cards View (Touch-Optimized) */}
            <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-3 bg-slate-50/60">
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
      </div>

      {/* Add / Edit Modal - Responsive Bottom Sheet on Mobile */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Sheet Handle for Mobile */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                {editingExpense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان أو جهة الصرف *</label>
                <input
                  type="text"
                  placeholder="مثال: بنزين سيارة التوزيع، غداء المندوب..."
                  {...register('title')}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                />
                {errors.title && <p className="text-xs text-rose-500 mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
                <input
                  type="text"
                  placeholder="اختر أو اكتب تصنيفاً..."
                  list="category-suggestions"
                  {...register('category')}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <datalist id="category-suggestions">
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الصرف والخصم *</label>
                <select
                  {...register('payment_method')}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {isCashier || isMandob
                    ? 'سيتم خصم المصروف من درج الوردية إذا كان كاش، أو من المحفظة المحددة للمحل.'
                    : 'اختر الخزينة أو القناة المنصرف منها لتحديث رصيدها تلقائياً.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    {...register('amount', { valueAsNumber: true })}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {errors.amount && <p className="text-xs text-rose-500 mt-1">{errors.amount.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التاريخ *</label>
                  <input
                    type="date"
                    {...register('date')}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل أخرى..."
                  {...register('notes')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saveMutation.isPending ? 'جاري الحفظ...' : editingExpense ? 'تحديث المصروف' : 'حفظ المصروف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Management Modal - Responsive Bottom Sheet on Mobile */}
      {isCategoriesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full sm:max-w-md rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col border border-slate-100">
            {/* Sheet Handle for Mobile */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden" />
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">إدارة تصنيفات المصروفات</h3>
                  <p className="text-xs text-slate-400">إضافة وتعديل وحذف بنود وتصنيفات الصرف</p>
                </div>
              </div>
              <button
                onClick={() => setIsCategoriesModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {catError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
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
                <input
                  type="text"
                  placeholder="اسم التصنيف الجديد (مثال: شحن بضائع، دعاية)..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={addCategoryMutation.isPending || !newCatName.trim()}
                  className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-xs transition-colors flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة</span>
                </button>
              </form>

              {/* Categories List */}
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {categories.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">لا توجد تصنيفات مسجلة بعد</p>
                ) : (
                  categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl text-xs transition-colors group"
                    >
                      {editingCatId === cat.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingCatName}
                            onChange={(e) => setEditingCatName(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              if (editingCatName.trim()) {
                                updateCategoryMutation.mutate({ id: cat.id, name: editingCatName.trim() });
                              }
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                          >
                            حفظ
                          </button>
                          <button
                            onClick={() => setEditingCatId(null)}
                            className="px-2 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-300"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{cat.name}</span>
                            {cat.is_default && (
                              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-medium">
                                أساسي
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingCatId(cat.id);
                                setEditingCatName(cat.name);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-white transition-colors"
                              title="تعديل الاسم"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`هل أنت متأكد من حذف تصنيف "${cat.name}"؟`)) {
                                  deleteCategoryMutation.mutate(cat.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-white transition-colors"
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

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setIsCategoriesModalOpen(false)}
                className="w-full py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
