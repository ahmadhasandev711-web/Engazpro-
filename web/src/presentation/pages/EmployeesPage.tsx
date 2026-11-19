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
  Wallet,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserX,
  Building2,
  Banknote,
} from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../../data/api/client';
import { formatCurrency } from '@pos-mandob/shared';
import { usePermissions } from '../../hooks/usePermissions';
import { EmployeeFormModal, EmployeeFormState } from '../components/employees/EmployeeFormModal';
import { PayrollModal } from '../components/employees/PayrollModal';
import { getEmployeeRoleMeta } from '../components/employees/employeeRoleMap';
import { EmployeeMobileCard, EmployeeItem } from '../components/mobile/EmployeeMobileCard';
import { MobileFilterChips, FilterChipOption } from '../components/mobile/MobileFilterChips';
import { nativeBackButton } from '../../platform/nativeBackButton';
import { useConfirm } from '../context/ConfirmContext';
import { Badge, Button, DataTable, EmptyState, Input, PageHeader, StatCard } from '../components/ui';

export const EmployeesPage: React.FC = () => {
  const { confirm } = useConfirm();
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
  const [formData, setFormData] = useState<EmployeeFormState>({
    name: '',
    phone: '',
    email: '',
    password: '',
    branch_id: '',
    role: 'CASHIER',
    base_salary: '',
    commission_type: 'NONE',
    commission_rate: '',
    status: 'ACTIVE',
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch Branches
  const { data: rawBranches = [] } = useQuery({
    queryKey: ['branches', user?.id],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
  });
  const branches: any[] = Array.isArray(rawBranches) ? rawBranches : ((rawBranches as any)?.data || []);

  // Fetch Employees
  const { data, isLoading } = useQuery({
    queryKey: ['employees', user?.id],
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
      const requiresSpecificBranch = payload.role === 'CASHIER' || payload.role === 'SALES';
      if (requiresSpecificBranch && cleanBranchId === null && branches.length > 0) {
        throw new Error('يجب تحديد فرع معين لدور الكاشير أو بائع الصالة عند وجود فروع بالمنشأة.');
      }
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

  const handleDelete = async (emp: EmployeeItem) => {
    const ok = await confirm({
      title: 'تأكيد حذف الموظف',
      message: `هل أنت متأكد من رغبتك في حذف الموظف "${emp.name}"؟\n(ملاحظة: إذا كان للموظف فواتير سابقة سيتم إيقاف حسابه فقط للحفاظ على السجلات)`,
      type: 'danger',
    });
    if (ok) {
      deleteMutation.mutate(emp.id);
    }
  };

  const branchOptions = [
    { value: '', label: '-- بدون تقييد بفرع (عام على كل الفروع) --' },
    ...branches.map((b: any) => ({
      value: String(b.id),
      label: `${b.name} (${b.code}) - ${
        b.type === 'STORE' ? 'محل/معرض' : b.type === 'WAREHOUSE' ? 'مخزن' : 'سيارة/فان'
      }`,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMessage && (
        <div className="bg-ok-soft border border-ok/30 text-ok px-4 py-3 rounded-xl flex items-center gap-3 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-ok flex-shrink-0" />
          <p className="text-sm font-bold">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-bad-soft border border-bad/30 text-bad px-4 py-3 rounded-xl flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-bad flex-shrink-0" />
            <p className="text-sm font-bold">{errorMessage}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setErrorMessage(null)}
            aria-label="إغلاق التنبيه"
            className="p-2 text-bad hover:bg-bad-soft"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Desktop Header */}
      <div className="hidden md:block">
        <PageHeader
          title="فريق العمل والمناديب"
          description="إدارة حسابات المناديب والكاشير، وتعيين الصلاحيات، ومتابعة مبيعاتهم وتحصيلاتهم اليومية"
          badge={<Badge tone="brand">{totalEmployees} موظف</Badge>}
          actions={
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={openCreateModal}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              إضافة موظف جديد
            </Button>
          }
          className="mb-0"
        />
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <div className="md:hidden bg-panel p-3 rounded-2xl border border-line shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center font-black shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-ink truncate">فريق العمل</h2>
              <Badge tone="neutral" className="text-2xs shrink-0">
                {totalEmployees}
              </Badge>
            </div>
            <p className="text-xs text-muted font-medium truncate">
              مبيعات اليوم: <span className="font-bold text-brand tabular-nums">{formatCurrency(totalTodaySales)}</span>
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={openCreateModal}
          leftIcon={<UserPlus className="w-4 h-4" />}
          className="shrink-0"
        >
          إضافة
        </Button>
      </div>

      {/* Mobile 2-Column Performance Strip (md:hidden) */}
      <div className="md:hidden grid grid-cols-2 gap-2 bg-panel p-2.5 rounded-2xl border border-line shadow-xs text-center">
        <div className="bg-brand-soft/60 border border-brand/25 p-2.5 rounded-xl">
          <span className="text-2xs text-brand-ink font-bold block">مبيعات اليوم</span>
          <span className="text-sm font-black text-brand tabular-nums block mt-0.5" dir="ltr">
            {formatCurrency(totalTodaySales)}
          </span>
        </div>
        <div className="bg-ok-soft/60 border border-ok/25 p-2.5 rounded-xl">
          <span className="text-2xs text-ok font-bold block">تحصيلات اليوم</span>
          <span className="text-sm font-black text-ok tabular-nums block mt-0.5" dir="ltr">
            {formatCurrency(totalTodayCollections)}
          </span>
        </div>
      </div>

      {/* Desktop Overview Cards */}
      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الفريق"
          value={`${totalEmployees} موظف`}
          hint={`${activeMandobs} مندوب مبيعات • ${activeCashiers} كاشير`}
          tone="info"
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="مناديب الميدان النشطين"
          value={`${activeMandobs} مندوب`}
          hint="تطبيق الجوال والمبيعات الميدانية"
          tone="ok"
          icon={<ShieldCheck className="w-4 h-4" />}
        />
        <StatCard
          label="مبيعات الفريق اليوم"
          value={formatCurrency(totalTodaySales)}
          hint="إجمالي الفواتير الصادرة اليوم"
          tone="brand"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          label="تحصيلات الفريق اليوم"
          value={formatCurrency(totalTodayCollections)}
          hint="سندات القبض النقدية اليوم"
          tone="ok"
          icon={<Wallet className="w-4 h-4" />}
        />
      </div>

      {/* Filters & Search */}
      <div className="bg-panel p-2.5 sm:p-4 rounded-2xl border border-line shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <Input
            type="text"
            placeholder="بحث بالاسم أو برقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        {/* Mobile Filter Chips */}
        <div className="md:hidden w-full overflow-hidden">
          <MobileFilterChips
            options={roleFilterChips}
            selectedId={roleFilter}
            onSelect={(id) => setRoleFilter(id)}
          />
        </div>

        {/* Role Segmented Filter */}
        <div className="hidden md:flex items-center gap-1 bg-surface-2 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar scroll-smooth flex-nowrap">
          {roleFilterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setRoleFilter(chip.id)}
              className={clsx(
                'min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                roleFilter === chip.id
                  ? 'bg-panel text-ink shadow-xs'
                  : 'text-muted hover:text-ink'
              )}
            >
              {chip.label} ({chip.count})
            </button>
          ))}
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-panel rounded-2xl border border-line shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted text-sm font-bold">جاري تحميل بيانات الفريق...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Users className="w-6 h-6 text-brand" />}
              title="لا يوجد موظفون مسجلون حالياً"
              description="أضف كاشير، مناديب مبيعات، أو مدراء فروع ووزعهم على الفروع والمخازن"
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={openCreateModal}
                  leftIcon={<UserPlus className="w-4 h-4" />}
                >
                  إضافة أول موظف
                </Button>
              }
              className="border-0 py-10"
            />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block">
              <DataTable className="border-0 rounded-none shadow-none">
                <thead className="bg-surface-2/80 border-b border-line text-muted font-bold text-xs">
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
                <tbody className="divide-y divide-line text-ink">
                  {filteredEmployees.map((emp) => {
                    const roleMeta = getEmployeeRoleMeta(emp.role);
                    const isActive = emp.status === 'ACTIVE';
                    const canManageRow =
                      isOwnerOrAdmin ||
                      (isManager && emp.role !== 'OWNER' && emp.role !== 'ADMIN' && emp.role !== 'MANAGER');

                    return (
                      <tr key={emp.id} className="hover:bg-surface-2/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={clsx(
                                'w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm border',
                                roleMeta.avatarClass
                              )}
                            >
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-ink">{emp.name}</div>
                              <div className="text-xs text-muted flex items-center gap-1 mt-0.5 tabular-nums">
                                <Phone className="w-3 h-3" />
                                <span dir="ltr">{emp.phone}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge tone={roleMeta.tone} dot>
                            {roleMeta.label}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4">
                          {emp.branch ? (
                            <div className="flex items-center gap-1.5 text-ink font-bold text-xs">
                              <Building2 className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                              <span>{emp.branch.name}</span>
                              <span className="text-2xs px-1.5 py-0.5 rounded bg-surface-2 text-muted tabular-nums border border-line">
                                {emp.branch.code}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted font-medium">
                              عام (كل الفروع)
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {canManageRow ? (
                            <button
                              type="button"
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  id: emp.id,
                                  newStatus: isActive ? 'INACTIVE' : 'ACTIVE',
                                })
                              }
                              title="اضغط لتغيير الحالة"
                              className={clsx(
                                'min-h-[36px] inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all hover:opacity-80 cursor-pointer border',
                                isActive
                                  ? 'bg-ok-soft text-ok border-ok/30'
                                  : 'bg-bad-soft text-bad border-bad/30'
                              )}
                            >
                              {isActive ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 text-ok" />
                                  <span>نشط</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5 text-bad" />
                                  <span>موقوف</span>
                                </>
                              )}
                            </button>
                          ) : (
                            <Badge tone={isActive ? 'ok' : 'bad'} className="opacity-60 cursor-not-allowed">
                              {isActive ? 'نشط' : 'موقوف'}
                            </Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-ink tabular-nums">
                          {formatCurrency(emp.today_stats?.sales || 0)}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-ok tabular-nums">
                          {formatCurrency(emp.today_stats?.collections || 0)}
                        </td>

                        <td className="py-3.5 px-4 font-medium text-muted tabular-nums">
                          {emp.today_stats?.invoices_count || 0} فاتورة
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {emp.is_eligible_for_payroll && canManageRow && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => openPayrollModal(emp)}
                                title="مسير الراتب والعمولات"
                                leftIcon={<Banknote className="w-3.5 h-3.5 text-ok" />}
                                className="bg-ok-soft text-ok border-ok/30 hover:bg-ok-soft/80"
                              >
                                <span className="hidden xl:inline">الراتب والعمولة</span>
                              </Button>
                            )}
                            {canManageRow && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(emp)}
                                title="تعديل الموظف"
                                aria-label="تعديل الموظف"
                                className="px-2"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                            {isOwnerOrAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(emp)}
                                title="حذف الموظف"
                                aria-label="حذف الموظف"
                                className="px-2 text-bad hover:bg-bad-soft"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </div>

            {/* Mobile Touch Cards View (md:hidden) */}
            <div className="md:hidden p-3 space-y-3 bg-canvas/50">
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
      <EmployeeFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingEmployee={editingEmployee}
        formData={formData}
        setFormData={setFormData}
        errorMessage={errorMessage}
        isOwnerOrAdmin={isOwnerOrAdmin}
        isManager={isManager}
        userBranchId={user?.branch_id}
        branches={branches}
        branchOptions={branchOptions}
        isSaving={saveMutation.isPending}
        onSubmit={handleSubmit}
      />

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
