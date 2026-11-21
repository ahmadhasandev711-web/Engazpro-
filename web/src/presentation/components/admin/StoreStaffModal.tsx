import React, { useState } from 'react';
import { X, Users, GitBranch, CheckCircle2, XCircle, RefreshCw, Key, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useStoreStaff, useResetStaffPassword, useToggleStaffStatus, useForceLogoutStaff } from '../../../hooks/useAdmin';
import { formatDate } from '@pos-mandob/shared';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Badge, Button, DataTable, EmptyState, Input } from '../ui';

interface StoreStaffModalProps {
  userId: number | null;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  MANDOB: 'مندوب شحن',
  CASHIER: 'كاشير',
  MANAGER: 'مدير فرع',
};

export const StoreStaffModal: React.FC<StoreStaffModalProps> = ({ userId, onClose }) => {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { data, isLoading } = useStoreStaff(userId);
  const resetPwd = useResetStaffPassword();
  const toggleStatus = useToggleStaffStatus();
  const forceLogout = useForceLogoutStaff();

  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');

  if (!userId) return null;

  const handleSubmitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || newPassword.length < 8) {
      toast.error('كلمة المرور يجب أن لا تقل عن 8 أحرف أو أرقام');
      return;
    }
    try {
      const res = await resetPwd.mutateAsync({ ownerId: userId, staffId: resetTarget.id, password: newPassword });
      toast.success(res.message || 'تم تغيير كلمة مرور الموظف بنجاح');
      setResetTarget(null);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر تغيير كلمة المرور');
    }
  };

  const handleToggleStaff = async (emp: { id: number; name: string; status?: string }) => {
    const active = emp.status === 'ACTIVE' || !emp.status;
    const ok = await confirm({
      title: active ? 'إيقاف حساب موظف' : 'تنشيط حساب موظف',
      message: `هل تريد ${active ? 'إيقاف وطرد جلسات' : 'إعادة تفعيل'} الموظف (${emp.name})؟`,
      confirmText: active ? 'إيقاف الموظف' : 'تنشيط',
      type: active ? 'danger' : 'warning',
    });
    if (!ok) return;
    toggleStatus.mutate(
      { ownerId: userId, staffId: emp.id },
      {
        onSuccess: (d: any) => toast.success(d.message || 'تم تحديث حالة الموظف'),
        onError: (err: any) => toast.error(err.response?.data?.message || 'تعذر تحديث الحالة'),
      }
    );
  };

  const handleKickStaff = (emp: { id: number; name: string }) => {
    forceLogout.mutate(
      { ownerId: userId, staffId: emp.id },
      {
        onSuccess: (d: any) => toast.success(d.message || 'تم طرد جلسات الموظف'),
        onError: () => toast.error('تعذر طرد الجلسات'),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 backdrop-blur-sm" dir="rtl">
      <div className="bg-panel rounded-2xl max-w-4xl w-full shadow-2xl border border-line overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-5 bg-surface-2 border-b border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-ink flex items-center gap-2 flex-wrap">
                <span>فريق العمل وفروع المتجر</span>
                {data?.owner?.business_name && <Badge tone="brand">{data.owner.business_name}</Badge>}
              </h3>
              <p className="text-xs text-muted mt-0.5 truncate">
                المالك: <strong className="text-ink">{data?.owner?.name}</strong> ({data?.owner?.phone})
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} aria-label="إغلاق" className="min-h-[44px] min-w-[44px] shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {resetTarget && (
            <form onSubmit={handleSubmitReset} className="p-4 rounded-xl bg-brand-soft/40 border border-brand/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-ink">تعيين كلمة مرور جديدة للموظف: {resetTarget.name}</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setResetTarget(null)}>إلغاء</Button>
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    type="password"
                    label="كلمة المرور الجديدة (8 أحرف على الأقل)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" variant="primary" isLoading={resetPwd.isPending}>حفظ وتطبيق</Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <div className="py-16 text-center text-muted">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-brand" />
              <p className="text-sm font-medium">جاري فحص الفروع والموظفين التابعين للمتجر...</p>
            </div>
          ) : (
            <>
              <section className="space-y-3">
                <h4 className="text-xs font-black text-muted uppercase tracking-wider flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-brand" />
                  <span>فروع المتجر ({data?.branches?.length || 0})</span>
                </h4>

                {!data?.branches || data.branches.length === 0 ? (
                  <EmptyState title="لا توجد فروع إضافية" description="يعمل المتجر حالياً بالفرع الرئيسي الافتراضي." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.branches.map((b) => (
                      <div key={b.id} className="p-3.5 bg-surface-2 rounded-xl border border-line flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-ink text-sm flex items-center gap-2 flex-wrap">
                            <span>{b.name}</span>
                            {b.is_main && <Badge tone="ok">فرع رئيسي</Badge>}
                          </div>
                          <div className="text-xs text-muted mt-1 flex items-center gap-3 flex-wrap">
                            <span className="font-mono">كود: {b.code}</span>
                            {b.phone && <span className="font-mono">{b.phone}</span>}
                          </div>
                        </div>
                        <Badge tone="neutral">{b.users_count ?? 0} موظف</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3">
                <h4 className="text-xs font-black text-muted uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-info" />
                  <span>طاقم العمل والمناديب ({data?.employees?.length || 0})</span>
                </h4>

                {!data?.employees || data.employees.length === 0 ? (
                  <EmptyState title="لا يوجد موظفون مسجلون" description="صاحب المتجر يعمل منفرداً دون موظفين أو مناديب إضافيين." />
                ) : (
                  <>
                    <DataTable className="hidden md:block">
                      <thead className="bg-surface-2 text-muted text-xs font-bold border-b border-line">
                        <tr>
                          <th className="px-4 py-3">الموظف</th>
                          <th className="px-4 py-3">الدور</th>
                          <th className="px-4 py-3">الفرع</th>
                          <th className="px-4 py-3">الهاتف</th>
                          <th className="px-4 py-3">الحالة</th>
                          <th className="px-4 py-3 text-center">تحكم الإدارة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-xs">
                        {data.employees.map((emp) => {
                          const isActive = emp.status === 'ACTIVE' || !emp.status;
                          return (
                            <tr key={emp.id} className="hover:bg-surface-2/60 transition-colors">
                              <td className="px-4 py-3 font-bold text-ink">{emp.name}</td>
                              <td className="px-4 py-3"><Badge tone="info">{ROLE_LABELS[emp.role || ''] || emp.role || 'موظف'}</Badge></td>
                              <td className="px-4 py-3 font-medium text-muted">{emp.branch?.name || 'الكل / غير محدد'}</td>
                              <td className="px-4 py-3 font-mono font-semibold text-ink">{emp.phone}</td>
                              <td className="px-4 py-3">
                                {isActive ? (
                                  <Badge tone="ok"><CheckCircle2 className="w-3 h-3" /> نشط</Badge>
                                ) : (
                                  <Badge tone="bad"><XCircle className="w-3 h-3" /> موقوف</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <Button size="sm" variant="secondary" onClick={() => setResetTarget({ id: emp.id, name: emp.name })} leftIcon={<Key className="w-3.5 h-3.5 text-brand" />}>
                                    باسوورد
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => handleKickStaff(emp)} leftIcon={<LogOut className="w-3.5 h-3.5 text-warn" />}>
                                    طرد
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={isActive ? 'danger' : 'secondary'}
                                    onClick={() => handleToggleStaff(emp)}
                                    leftIcon={isActive ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5 text-ok" />}
                                  >
                                    {isActive ? 'إيقاف' : 'تنشيط'}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </DataTable>

                    <div className="md:hidden space-y-2.5">
                      {data.employees.map((emp) => {
                        const isActive = emp.status === 'ACTIVE' || !emp.status;
                        return (
                          <div key={emp.id} className="p-3.5 bg-surface-2 border border-line rounded-xl space-y-2.5 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-ink">{emp.name}</span>
                              {isActive ? <Badge tone="ok">نشط</Badge> : <Badge tone="bad">موقوف</Badge>}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-muted">
                              <Badge tone="info">{ROLE_LABELS[emp.role || ''] || emp.role || 'موظف'}</Badge>
                              <span className="font-mono text-ink">{emp.phone}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted">
                              <span>الفرع: {emp.branch?.name || 'غير محدد'}</span>
                              <span className="font-mono">{formatDate(emp.created_at)}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-line">
                              <Button size="sm" variant="secondary" onClick={() => setResetTarget({ id: emp.id, name: emp.name })}>باسوورد</Button>
                              <Button size="sm" variant="secondary" onClick={() => handleKickStaff(emp)}>طرد</Button>
                              <Button size="sm" variant={isActive ? 'danger' : 'secondary'} onClick={() => handleToggleStaff(emp)}>{isActive ? 'إيقاف' : 'تنشيط'}</Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
