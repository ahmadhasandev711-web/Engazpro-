import React from 'react';
import {
  AlertCircle,
  Banknote,
  Briefcase,
  Building2,
  Lock,
  Receipt,
  ShieldCheck,
  Store,
  UserPlus,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { EmployeeItem } from '../mobile/EmployeeMobileCard';
import { Badge, Button, Input, Select } from '../ui';

export interface EmployeeFormState {
  name: string;
  phone: string;
  email: string;
  password: string;
  branch_id: string | number;
  role: 'ADMIN' | 'MANDOB' | 'CASHIER' | 'MANAGER' | 'SUPERVISOR' | 'SALES';
  base_salary: string | number;
  commission_type: 'NONE' | 'PERCENTAGE_OF_SALES' | 'FIXED_PER_INVOICE';
  commission_rate: string | number;
  status: 'ACTIVE' | 'INACTIVE';
}

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEmployee: EmployeeItem | null;
  formData: EmployeeFormState;
  setFormData: React.Dispatch<React.SetStateAction<EmployeeFormState>>;
  errorMessage: string | null;
  isOwnerOrAdmin: boolean;
  isManager: boolean;
  userBranchId?: number | null;
  branches: any[];
  branchOptions: Array<{ value: string; label: string }>;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  onClose,
  editingEmployee,
  formData,
  setFormData,
  errorMessage,
  isOwnerOrAdmin,
  isManager,
  userBranchId,
  branches,
  branchOptions,
  isSaving,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-panel rounded-3xl border border-line shadow-2xl max-w-lg w-full overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-2/60 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand-soft text-brand rounded-lg">
              <UserPlus className="w-5 h-5" />
            </div>
            <h3 className="font-black text-ink text-base">
              {editingEmployee ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد إلى المتجر'}
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-bad-soft text-bad text-xs rounded-xl border border-bad/30 flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Input
            label="اسم الموظف *"
            type="text"
            placeholder="مثال: أحمد محمود"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label="رقم الهاتف (يُستخدم للدخول إلى التطبيق) *"
            type="text"
            placeholder="مثال: 01012345678"
            dir="ltr"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="text-right tabular-nums"
            helperText="سيسجل الموظف دخوله بهذا الرقم وكلمة المرور مباشرة بدون الحاجة لكود المنشأة."
          />

          <div>
            <label className="block text-xs font-bold text-ink mb-1.5">
              الدور الوظيفي والصلاحيات <span className="text-bad">*</span>
            </label>
            <div className="space-y-2">
              {isOwnerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
                  className={clsx(
                    'min-h-[44px] w-full p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer',
                    formData.role === 'ADMIN'
                      ? 'border-ok bg-ok-soft/70 ring-2 ring-ok/20 shadow-sm'
                      : 'border-line hover:border-line-2 bg-surface-2/40'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-ok-soft text-ok flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-ink">مدير نظام / شريك (ADMIN)</span>
                        <Badge tone="ok" className="text-2xs">كامل الصلاحيات مثل المالك</Badge>
                      </div>
                      <p className="text-2xs text-muted mt-0.5">
                        يرى الأرباح الصافية، أسعار التكلفة، الفروع، الموظفين، وإعدادات المتجر بالكامل.
                      </p>
                    </div>
                  </div>
                </button>
              )}

              <div className={clsx('grid gap-2', isManager ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2')}>
                {isOwnerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'MANAGER' })}
                    className={clsx(
                      'min-h-[44px] p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer',
                      formData.role === 'MANAGER'
                        ? 'border-brand bg-brand-soft/60 ring-2 ring-brand/20'
                        : 'border-line hover:border-line-2 bg-panel'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-ink">مدير فرع / متجر</span>
                      <Briefcase className="w-4 h-4 text-brand" />
                    </div>
                    <p className="text-2xs text-muted leading-tight">
                      إدارة الفرع ومخزونه ومشترياته وأسعار التكلفة (محجوب عنه فقط صافي الأرباح)
                    </p>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'SUPERVISOR' })}
                  className={clsx(
                    'min-h-[44px] p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer',
                    formData.role === 'SUPERVISOR'
                      ? 'border-info bg-info-soft/60 ring-2 ring-info/20'
                      : 'border-line hover:border-line-2 bg-panel'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-ink">مشرف ورديات واستلام</span>
                    <Store className="w-4 h-4 text-info" />
                  </div>
                  <p className="text-2xs text-muted leading-tight">
                    استلام تحويلات البضاعة، ومراجعة وتصفية أدراج الكاشير
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'CASHIER' })}
                  className={clsx(
                    'min-h-[44px] p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer',
                    formData.role === 'CASHIER'
                      ? 'border-warn bg-warn-soft/60 ring-2 ring-warn/20'
                      : 'border-line hover:border-line-2 bg-panel'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-ink">كاشير نقطة بيع POS</span>
                    <Receipt className="w-4 h-4 text-warn" />
                  </div>
                  <p className="text-2xs text-muted leading-tight">
                    مبيعات المعرض، درج نقدية، خصم من مخزون الفرع
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'SALES' })}
                  className={clsx(
                    'min-h-[44px] p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer',
                    formData.role === 'SALES'
                      ? 'border-info bg-info-soft/60 ring-2 ring-info/20'
                      : 'border-line hover:border-line-2 bg-panel'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-ink">بائع صالة / سيلز</span>
                    <Store className="w-4 h-4 text-info" />
                  </div>
                  <p className="text-2xs text-muted leading-tight">
                    مساعدة العملاء بالمعرض، تسجيل الفواتير باسمه لاحتساب عمولته
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'MANDOB' })}
                  className={clsx(
                    'min-h-[44px] p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer',
                    formData.role === 'MANDOB'
                      ? 'border-brand bg-brand-soft/60 ring-2 ring-brand/20'
                      : 'border-line hover:border-line-2 bg-panel'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-ink">مندوب مبيعات</span>
                    <ShieldCheck className="w-4 h-4 text-brand" />
                  </div>
                  <p className="text-2xs text-muted leading-tight">
                    تطبيق جوال، تحصيل ميداني، عهدة نقدية
                  </p>
                </button>
              </div>
            </div>
          </div>

          {formData.role !== 'ADMIN' && (
            <div className="p-3.5 bg-surface-2/60 rounded-2xl border border-line space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-ok" />
                  <span className="text-xs font-black text-ink">نظام الراتب والعمولات</span>
                </div>
                <Badge tone={formData.role === 'MANAGER' ? 'brand' : 'neutral'} className="text-2xs">
                  {formData.role === 'MANAGER'
                    ? 'عمولة من مبيعات الفرع (باستثناء ووكومرس)'
                    : 'عمولة على الفواتير المنسوبة له'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1">الراتب الأساسي الشهري</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.base_salary}
                      onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                      className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-line text-xs tabular-nums font-bold focus:outline-none focus:border-brand bg-panel text-ink"
                    />
                    <span className="text-2xs text-muted absolute left-2.5 top-1/2 -translate-y-1/2">ج.م</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted mb-1">نوع احتساب العمولة</label>
                  <select
                    value={formData.commission_type}
                    onChange={(e) => setFormData({ ...formData, commission_type: e.target.value as any })}
                    className="w-full min-h-[44px] px-2.5 py-2 rounded-xl border border-line text-xs focus:outline-none focus:border-brand bg-panel text-ink"
                  >
                    <option value="NONE">بدون عمولة</option>
                    <option value="PERCENTAGE_OF_SALES">نسبة مئوية (%)</option>
                    {formData.role !== 'MANAGER' && (
                      <option value="FIXED_PER_INVOICE">مبلغ ثابت لكل فاتورة (ج.م)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted mb-1">
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
                      className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-line text-xs tabular-nums font-bold focus:outline-none focus:border-brand disabled:bg-surface-2 disabled:opacity-50 bg-panel text-ink"
                    />
                    <span className="text-2xs text-muted absolute left-2.5 top-1/2 -translate-y-1/2">
                      {formData.commission_type === 'PERCENTAGE_OF_SALES' ? '%' : 'ج.م'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-ink">الفرع أو المخزن التابع له الموظف</span>
              <span className="text-xs font-normal text-muted">
                {formData.role === 'CASHIER' || formData.role === 'SALES' ? '(إلزامي لفرع محدد)' : '(اختياري — أو عام لكل الفروع)'}
              </span>
            </div>
            {isManager ? (
              <div className="p-3 bg-brand-soft/60 border border-brand/25 rounded-xl text-xs flex items-center gap-2 text-brand-ink font-medium">
                <Building2 className="w-4 h-4 text-brand flex-shrink-0" />
                <span>
                  يتم ربط الموظف تلقائياً بفرعك:{' '}
                  <strong>{branches.find((b: any) => b.id === userBranchId)?.name || 'فرعك المعين'}</strong>
                </span>
              </div>
            ) : (
              <Select
                value={String(formData.branch_id)}
                onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                options={branchOptions}
              />
            )}
            <p className="text-xs text-muted mt-1">
              عند تسجيل دخول الكاشير، سيتم ربط نقطة البيع POS والخصم التلقائي من مخزون هذا الفرع.
            </p>
          </div>

          <Input
            label={`كلمة المرور ${editingEmployee ? '(اتركها فارغة إذا كنت لا ترغب في تغييرها)' : '*'}`}
            type="password"
            placeholder={editingEmployee ? '••••••••' : '6 خانات على الأقل'}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            leftIcon={<Lock className="w-4 h-4" />}
          />

          <Select
            label="حالة الحساب"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
            options={[
              { value: 'ACTIVE', label: 'نشط (يستطيع تسجيل الدخول والعمل)' },
              { value: 'INACTIVE', label: 'موقوف (محظور من الدخول)' },
            ]}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isSaving} disabled={isSaving}>
              {editingEmployee ? 'تحديث البيانات' : 'إضافة الموظف'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
