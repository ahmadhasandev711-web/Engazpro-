import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Search,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  Phone,
  Lock,
  Receipt,
  Wallet,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserX,
  Building2,
  Briefcase,
  Store,
  Banknote,
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../../data/api/client';
import { formatCurrency } from '@pos-mandob/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { PayrollModal } from '../components/employees/PayrollModal';
import { EmployeeMobileCard, EmployeeItem } from '../components/mobile/EmployeeMobileCard';
import { MobileFilterChips, FilterChipOption } from '../components/mobile/MobileFilterChips';
import { nativeBackButton } from '../../platform/nativeBackButton';

export const EmployeesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, isOwnerOrAdmin, isManager } = usePermissions();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CASHIER' | 'SALES' | 'MANDOB' | 'MANAGEMENT'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);

  // Payroll Drawer/Modal State
  const [payrollEmployee, setPayrollEmployee] = useState<EmployeeItem | null>(null);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    branch_id: '' as string | number,
    role: 'CASHIER' as 'ADMIN' | 'MANDOB' | 'CASHIER' | 'MANAGER' | 'SUPERVISOR' | 'SALES',
    base_salary: '' as string | number,
    commission_type: 'NONE' as 'NONE' | 'PERCENTAGE_OF_SALES' | 'FIXED_PER_INVOICE',
    commission_rate: '' as string | number,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch Branches
  const { data: rawBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data?.data || [];
    },
  });
  const branches: any[] = Array.isArray(rawBranches) ? rawBranches : ((rawBranches as any)?.data || []);

  // Fetch Employees
  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const res = await apiClient.get('/employees');
      return res.data;
    },
  });

  const employees: EmployeeItem[] = data?.data || [];

  // Filtered Employees
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.phone.includes(search) ||
      (emp.branch?.name && emp.branch.name.toLowerCase().includes(search.toLowerCase()));

    const matchesRole =
      roleFilter === 'ALL'
        ? true
        : roleFilter === 'MANAGEMENT'
        ? emp.role === 'ADMIN' || emp.role === 'MANAGER' || emp.role === 'SUPERVISOR'
        : emp.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // Hardware back button handler for modals
  React.useEffect(() => {
    if (!isModalOpen && !isPayrollModalOpen) return;
    return nativeBackButton.register(() => {
      if (isPayrollModalOpen) {
        setIsPayrollModalOpen(false);
        setPayrollEmployee(null);
        return true;
      }
      if (isModalOpen) {
        setIsModalOpen(false);
        setEditingEmployee(null);
        return true;
      }
      return false;
    });
  }, [isModalOpen, isPayrollModalOpen]);

  const roleFilterChips: FilterChipOption<'ALL' | 'CASHIER' | 'SALES' | 'MANDOB' | 'MANAGEMENT'>[] = [
    { id: 'ALL', label: 'الكل', count: employees.length },
    { id: 'CASHIER', label: 'كاشير', count: employees.filter((e) => e.role === 'CASHIER').length },
    { id: 'SALES', label: 'سيلز / صالة', count: employees.filter((e) => e.role === 'SALES').length },
    { id: 'MANDOB', label: 'مناديب', count: employees.filter((e) => e.role === 'MANDOB').length },
    {
      id: 'MANAGEMENT',
      label: 'إدارة',
      count: employees.filter((e) => e.role === 'MANAGER' || e.role === 'SUPERVISOR' || e.role === 'ADMIN').length,
    },
  ];

  // Summary Metrics
  const totalEmployees = employees.length;
  const activeMandobs = employees.filter(
    (e) => e.role === 'MANDOB' && e.status === 'ACTIVE'
  ).length;
  const activeCashiers = employees.filter(
    (e) => e.role === 'CASHIER' && e.status === 'ACTIVE'
  ).length;
  const totalTodaySales = employees.reduce(
    (sum, e) => sum + (e.today_stats?.sales || 0),
    0
  );
  const totalTodayCollections = employees.reduce(
    (sum, e) => sum + (e.today_stats?.collections || 0),
    0
  );

  // Create / Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      const cleanBranchId = payload.branch_id !== '' && payload.branch_id !== null ? Number(payload.branch_id) : null;
      if (editingEmployee) {
        const updatePayload: any = {
          name: payload.name,
          phone: payload.phone,
          role: payload.role,
          status: payload.status,
          branch_id: cleanBranchId,
          base_salary: payload.base_salary !== '' ? Number(payload.base_salary) : 0,
          commission_type: payload.commission_type || 'NONE',
          commission_rate: payload.commission_rate !== '' ? Number(payload.commission_rate) : 0,
        };
        if (payload.password && payload.password.trim().length > 0) {
          updatePayload.password = payload.password;
        }
        if (payload.email) updatePayload.email = payload.email;

        const res = await apiClient.put(`/employees/${editingEmployee.id}`, updatePayload);
        return res.data;
      } else {
        const createPayload: any = {
          ...payload,
          branch_id: cleanBranchId,
          base_salary: payload.base_salary !== '' ? Number(payload.base_salary) : 0,
          commission_type: payload.commission_type || 'NONE',
          commission_rate: payload.commission_rate !== '' ? Number(payload.commission_rate) : 0,
        };
        const res = await apiClient.post('/employees', createPayload);
        return res.data;
      }
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      setIsModalOpen(false);
      setEditingEmployee(null);
      setSuccessMessage(
        res.message || (editingEmployee ? 'تم تعديل بيانات الموظف بنجاح' : 'تمت إضافة الموظف بنجاح')
      );
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        Object.values(err.response?.data?.errors || {})[0] ||
        'حدث خطأ أثناء حفظ بيانات الموظف';
      setErrorMessage(typeof msg === 'string' ? msg : 'بيانات غير صحيحة');
    },
  });

  // Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: number; newStatus: 'ACTIVE' | 'INACTIVE' }) => {
      const res = await apiClient.put(`/employees/${id}`, { status: newStatus });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setSuccessMessage('تم تحديث حالة الموظف بنجاح');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'فشل تحديث الحالة');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/employees/${id}`);
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setSuccessMessage(res.message || 'تم حذف الموظف بنجاح');
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.message || 'فشل حذف الموظف');
    },
  });

  const openCreateModal = () => {
    setEditingEmployee(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      password: '',
      branch_id: isManager ? (user?.branch_id ?? '') : (branches.length > 0 ? branches[0].id : ''),
      role: 'CASHIER',
      base_salary: '',
      commission_type: 'NONE',
      commission_rate: '',
      status: 'ACTIVE',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (emp: EmployeeItem) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      phone: emp.phone,
      email: emp.email || '',
      password: '',
      branch_id: emp.branch_id ?? '',
      role: (emp.role === 'OWNER' ? 'ADMIN' : emp.role) as any,
      base_salary: emp.base_salary !== undefined && emp.base_salary !== null ? emp.base_salary : '',
      commission_type: emp.commission_type || 'NONE',
      commission_rate: emp.commission_rate !== undefined && emp.commission_rate !== null ? emp.commission_rate : '',
      status: emp.status,
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openPayrollModal = (emp: EmployeeItem) => {
    setPayrollEmployee(emp);
    setIsPayrollModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim()) {
      setErrorMessage('يرجى إدخال اسم الموظف');
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMessage('يرجى إدخال رقم هاتف الموظف');
      return;
    }
    if (!editingEmployee && (!formData.password || formData.password.length < 6)) {
      setErrorMessage('كلمة المرور مطلوبة وتتكون من 6 خانات على الأقل');
      return;
    }

    saveMutation.mutate(formData);
  };

  const handleDelete = (emp: EmployeeItem) => {
    if (
      window.confirm(
        `هل أنت متأكد من رغبتك في حذف الموظف "${emp.name}"؟\n(ملاحظة: إذا كان للموظف فواتير سابقة سيتم إيقاف حسابه فقط للحفاظ على السجلات)`
      )
    ) {
      deleteMutation.mutate(emp.id);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return {
          label: 'مدير نظام (شريك)',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
          dot: 'bg-emerald-600',
        };
      case 'CASHIER':
        return {
          label: 'كاشير POS',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          dot: 'bg-amber-600',
        };
      case 'SALES':
        return {
          label: 'بائع صالة / سيلز',
          bg: 'bg-teal-50 text-teal-700 border-teal-200',
          dot: 'bg-teal-600',
        };
      case 'MANDOB':
        return {
          label: 'مندوب مبيعات',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          dot: 'bg-indigo-600',
        };
      case 'MANAGER':
        return {
          label: 'مدير فرع',
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          dot: 'bg-purple-600',
        };
      case 'SUPERVISOR':
        return {
          label: 'مشرف ورديات',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          dot: 'bg-blue-600',
        };
      default:
        return {
          label: role,
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-600',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-sm font-bold">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <p className="text-sm font-bold">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Desktop Header */}
      <div className="hidden md:flex flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 text-primary-700 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">فريق العمل والمناديب</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                إدارة حسابات المناديب والكاشير، وتعيين الصلاحيات، ومتابعة مبيعاتهم وتحصيلاتهم اليومية
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all hover:shadow"
        >
          <UserPlus className="w-5 h-5" />
          <span>إضافة موظف جديد</span>
        </button>
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-black shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 truncate">فريق العمل</h2>
              <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0">
                {totalEmployees}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              مبيعات اليوم: <span className="font-bold text-primary-700 font-mono">{formatCurrency(totalTodaySales)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1 bg-primary-600 active:bg-primary-700 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة</span>
          </button>
        </div>
      </div>

      {/* Mobile 2-Column Performance Strip (md:hidden) */}
      <div className="md:hidden grid grid-cols-2 gap-2 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs text-center">
        <div className="bg-primary-50/70 border border-primary-100/70 p-2.5 rounded-xl">
          <span className="text-[10px] text-primary-700 font-bold block">مبيعات اليوم</span>
          <span className="text-sm font-black text-primary-800 font-mono block mt-0.5" dir="ltr">
            {formatCurrency(totalTodaySales)}
          </span>
        </div>
        <div className="bg-teal-50/70 border border-teal-100/70 p-2.5 rounded-xl">
          <span className="text-[10px] text-teal-700 font-bold block">تحصيلات اليوم</span>
          <span className="text-sm font-black text-teal-800 font-mono block mt-0.5" dir="ltr">
            {formatCurrency(totalTodayCollections)}
          </span>
        </div>
      </div>

      {/* Desktop Overview Cards */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">إجمالي الفريق</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalEmployees} موظف</h3>
            <p className="text-[11px] text-slate-400 mt-1">
              {activeMandobs} مندوب مبيعات • {activeCashiers} كاشير
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">مناديب الميدان النشطين</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{activeMandobs} مندوب</h3>
            <p className="text-[11px] text-slate-400 mt-1">تطبيق الجوال والمبيعات الميدانية</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">مبيعات الفريق اليوم</p>
            <h3 className="text-2xl font-black text-primary-600 mt-1">
              {formatCurrency(totalTodaySales)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">إجمالي الفواتير الصادرة اليوم</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500">تحصيلات الفريق اليوم</p>
            <h3 className="text-2xl font-black text-teal-600 mt-1">
              {formatCurrency(totalTodayCollections)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">سندات القبض النقدية اليوم</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-2.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="بحث بالاسم أو برقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-4 pr-10 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-right"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
        </div>

        {/* Mobile Filter Chips */}
        <div className="md:hidden w-full overflow-hidden">
          <MobileFilterChips
            options={roleFilterChips}
            selectedId={roleFilter}
            onSelect={(id) => setRoleFilter(id)}
          />
        </div>

        {/* Role Segmented Filter (Horizontal Scroll Track - hidden md:flex) */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar scroll-smooth flex-nowrap">
          <button
            onClick={() => setRoleFilter('ALL')}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
              roleFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            الكل ({employees.length})
          </button>
          <button
            onClick={() => setRoleFilter('CASHIER')}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
              roleFilter === 'CASHIER'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            كاشير ({employees.filter((e) => e.role === 'CASHIER').length})
          </button>
          <button
            onClick={() => setRoleFilter('SALES')}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
              roleFilter === 'SALES'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            سيلز / صالة ({employees.filter((e) => e.role === 'SALES').length})
          </button>
          <button
            onClick={() => setRoleFilter('MANDOB')}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
              roleFilter === 'MANDOB'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            مناديب ({employees.filter((e) => e.role === 'MANDOB').length})
          </button>
          <button
            onClick={() => setRoleFilter('MANAGEMENT')}
            className={clsx(
              'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap',
              roleFilter === 'MANAGEMENT'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            إدارة ({employees.filter((e) => e.role === 'MANAGER' || e.role === 'SUPERVISOR' || e.role === 'ADMIN').length})
          </button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">جاري تحميل بيانات الفريق...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-slate-700 text-base">لا يوجد موظفون مسجلون حالياً</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              أضف كاشير، مناديب مبيعات، أو مدراء فروع ووزعهم على الفروع والمخازن
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary-100"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة أول موظف</span>
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs">
                  <tr>
                    <th className="py-3 px-4">الموظف</th>
                    <th className="py-3 px-4">الدور الوظيفي</th>
                    <th className="py-3 px-4">الفرع / المخزن</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4">مبيعات اليوم</th>
                    <th className="py-3 px-4">تحصيلات اليوم</th>
                    <th className="py-3 px-4">فواتير اليوم</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredEmployees.map((emp) => {
                    const roleBadge = getRoleBadge(emp.role);
                    const isActive = emp.status === 'ACTIVE';

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={clsx(
                                'w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm',
                                emp.role === 'ADMIN'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : emp.role === 'MANDOB'
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : emp.role === 'CASHIER'
                                  ? 'bg-amber-50 text-amber-700'
                                  : emp.role === 'MANAGER'
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'bg-blue-50 text-blue-700'
                              )}
                            >
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{emp.name}</div>
                              <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />
                                <span dir="ltr">{emp.phone}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border',
                              roleBadge.bg
                            )}
                          >
                            <span
                              className={clsx('w-1.5 h-1.5 rounded-full', roleBadge.dot)}
                            />
                            {roleBadge.label}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {emp.branch ? (
                            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
                              <Building2 className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />
                              <span>{emp.branch.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">
                                {emp.branch.code}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                              عام (كل الفروع)
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {isOwnerOrAdmin || (isManager && emp.role !== 'OWNER' && emp.role !== 'ADMIN' && emp.role !== 'MANAGER') ? (
                            <button
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  id: emp.id,
                                  newStatus: isActive ? 'INACTIVE' : 'ACTIVE',
                                })
                              }
                              title="اضغط لتغيير الحالة"
                              className={clsx(
                                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all hover:opacity-80',
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              )}
                            >
                              {isActive ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>نشط</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5 text-rose-600" />
                                  <span>موقوف</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <span
                              className={clsx(
                                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold opacity-60 cursor-not-allowed',
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              )}
                            >
                              {isActive ? 'نشط' : 'موقوف'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {formatCurrency(emp.today_stats?.sales || 0)}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-teal-700">
                          {formatCurrency(emp.today_stats?.collections || 0)}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-600">
                          {emp.today_stats?.invoices_count || 0} فاتورة
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {emp.is_eligible_for_payroll && (isOwnerOrAdmin || (isManager && emp.role !== 'OWNER' && emp.role !== 'ADMIN' && emp.role !== 'MANAGER')) && (
                              <button
                                onClick={() => openPayrollModal(emp)}
                                title="مسير الراتب والعمولات"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">الراتب والعمولة</span>
                              </button>
                            )}
                            {(isOwnerOrAdmin || (isManager && emp.role !== 'OWNER' && emp.role !== 'ADMIN' && emp.role !== 'MANAGER')) && (
                              <button
                                onClick={() => openEditModal(emp)}
                                title="تعديل الموظف"
                                className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {isOwnerOrAdmin && (
                              <button
                                onClick={() => handleDelete(emp)}
                                title="حذف الموظف"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards View (md:hidden) */}
            <div className="md:hidden p-3 space-y-3">
              {filteredEmployees.map((emp) => (
                <EmployeeMobileCard
                  key={emp.id}
                  employee={emp}
                  canManage={
                    isOwnerOrAdmin ||
                    (isManager && emp.role !== 'OWNER' && emp.role !== 'ADMIN' && emp.role !== 'MANAGER')
                  }
                  isOwnerOrAdmin={isOwnerOrAdmin}
                  onToggleStatus={(id, newStatus) =>
                    toggleStatusMutation.mutate({ id, newStatus })
                  }
                  onOpenPayroll={openPayrollModal}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary-100 text-primary-700 rounded-lg">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-900 text-base">
                  {editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد إلى المتجر'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              {errorMessage && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم الموظف <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: أحمد محمود"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الهاتف (يُستخدم للدخول إلى التطبيق) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: 01012345678"
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-right"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  سيسجل الموظف دخوله بهذا الرقم وكلمة المرور مباشرة بدون الحاجة لكود المنشأة.
                </p>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الدور الوظيفي والصلاحيات <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {/* Admin / Partner Option (Owner/Admin Only) */}
                  {isOwnerOrAdmin && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
                      className={clsx(
                        'w-full p-2.5 rounded-xl border text-right transition-all flex items-center justify-between',
                        formData.role === 'ADMIN'
                          ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/40'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                          <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">مدير نظام / شريك (ADMIN)</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                              كامل الصلاحيات مثل المالك
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            يرى الأرباح الصافية، أسعار التكلفة، الفروع، الموظفين، وإعدادات المتجر بالكامل.
                          </p>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Operational Roles Grid */}
                  <div className={clsx('grid gap-2', isManager ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2')}>
                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, role: 'MANAGER' })}
                        className={clsx(
                          'p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between',
                          formData.role === 'MANAGER'
                            ? 'border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20'
                            : 'border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900">مدير فرع / متجر</span>
                          <Briefcase className="w-4 h-4 text-purple-600" />
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          إدارة الفرع ومخزونه ومشترياته وأسعار التكلفة (محجوب عنه فقط صافي الأرباح)
                        </p>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'SUPERVISOR' })}
                      className={clsx(
                        'p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between',
                        formData.role === 'SUPERVISOR'
                          ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">مشرف ورديات واستلام</span>
                        <Store className="w-4 h-4 text-blue-600" />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        استلام تحويلات البضاعة، ومراجعة وتصفية أدراج الكاشير
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'CASHIER' })}
                      className={clsx(
                        'p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between',
                        formData.role === 'CASHIER'
                          ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">كاشير نقطة بيع POS</span>
                        <Receipt className="w-4 h-4 text-amber-600" />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        مبيعات المعرض، درج نقدية، خصم من مخزون الفرع
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'SALES' })}
                      className={clsx(
                        'p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between',
                        formData.role === 'SALES'
                          ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">بائع صالة / سيلز</span>
                        <Store className="w-4 h-4 text-teal-600" />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        مساعدة العملاء بالمعرض، تسجيل الفواتير باسمه لاحتساب عمولته
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'MANDOB' })}
                      className={clsx(
                        'p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between',
                        formData.role === 'MANDOB'
                          ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">مندوب مبيعات</span>
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        تطبيق جوال، تحصيل ميداني، عهدة نقدية
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Financial Compensation (Payroll & Commissions) */}
              {formData.role !== 'ADMIN' && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-black text-slate-900">نظام الراتب والعمولات</span>
                    </div>
                    {formData.role === 'MANAGER' ? (
                      <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                        عمولة من مبيعات الفرع (باستثناء ووكومرس)
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                        عمولة على الفواتير المنسوبة له
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        الراتب الأساسي الشهري
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.base_salary}
                          onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                          className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-primary-500 bg-white"
                        />
                        <span className="text-[10px] text-slate-400 absolute left-2.5 top-2.5">ج.م</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        نوع احتساب العمولة
                      </label>
                      <select
                        value={formData.commission_type}
                        onChange={(e) => setFormData({ ...formData, commission_type: e.target.value as any })}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-primary-500 bg-white"
                      >
                        <option value="NONE">بدون عمولة</option>
                        <option value="PERCENTAGE_OF_SALES">نسبة مئوية (%)</option>
                        {formData.role !== 'MANAGER' && (
                          <option value="FIXED_PER_INVOICE">مبلغ ثابت لكل فاتورة (ج.م)</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {formData.commission_type === 'PERCENTAGE_OF_SALES' ? 'نسبة العمولة (%)' : 'قيمة العمولة (ج.م)'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={formData.commission_type === 'NONE'}
                          placeholder="0"
                          value={formData.commission_rate}
                          onChange={(e) => setFormData({ ...formData, commission_rate: e.target.value })}
                          className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-primary-500 disabled:bg-slate-100 disabled:opacity-50 bg-white"
                        />
                        <span className="text-[10px] text-slate-400 absolute left-2.5 top-2.5">
                          {formData.commission_type === 'PERCENTAGE_OF_SALES' ? '%' : 'ج.م'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Branch Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>الفرع أو المخزن التابع له الموظف</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {formData.role === 'CASHIER' ? '(مهم جداً لنقطة البيع)' : '(اختياري)'}
                  </span>
                </label>
                {isManager ? (
                  <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-xs flex items-center gap-2 text-purple-900 font-medium">
                    <Building2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span>يتم ربط الموظف تلقائياً بفرعك: <strong>{branches.find((b: any) => b.id === user?.branch_id)?.name || 'فرعك المعين'}</strong></span>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={formData.branch_id}
                      onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-white"
                    >
                      <option value="">-- بدون تقييد بفرع (عام على كل الفروع) --</option>
                      {branches.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}) - {b.type === 'STORE' ? 'محل/معرض' : b.type === 'WAREHOUSE' ? 'مخزن' : 'سيارة/فان'}
                        </option>
                      ))}
                    </select>
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  عند تسجيل دخول الكاشير، سيتم ربط نقطة البيع POS والخصم التلقائي من مخزون هذا الفرع.
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كلمة المرور {editingEmployee ? '(اتركها فارغة إذا كنت لا ترغب في تغييرها)' : <span className="text-rose-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder={editingEmployee ? '••••••••' : '6 خانات على الأقل'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة الحساب</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'ACTIVE' | 'INACTIVE',
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                >
                  <option value="ACTIVE">نشط (يستطيع تسجيل الدخول والعمل)</option>
                  <option value="INACTIVE">موقوف (محظور من الدخول)</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'جاري الحفظ...' : editingEmployee ? 'تحديث البيانات' : 'إضافة الموظف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payroll Modal */}
      <PayrollModal
        isOpen={isPayrollModalOpen}
        onClose={() => {
          setIsPayrollModalOpen(false);
          setPayrollEmployee(null);
        }}
        employee={payrollEmployee}
        isOwnerOrAdmin={isOwnerOrAdmin}
        isManager={isManager}
      />
    </div>
  );
};
