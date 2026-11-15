import React from 'react';
import { X, Users, GitBranch, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useStoreStaff } from '../../../hooks/useAdmin';
import { formatDate } from '@pos-mandob/shared';
import { Badge, Button, DataTable, EmptyState } from '../ui';

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
  const { data, isLoading } = useStoreStaff(userId);

  if (!userId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-canvas/80 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="bg-panel rounded-2xl max-w-3xl w-full shadow-2xl border border-line overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-5 bg-surface-2 border-b border-line flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-ink flex items-center gap-2 flex-wrap">
                <span>فريق العمل وفروع المتجر</span>
                {data?.owner?.business_name && (
                  <Badge tone="brand">{data.owner.business_name}</Badge>
                )}
              </h3>
              <p className="text-xs text-muted mt-0.5 truncate">
                المالك: <strong className="text-ink">{data?.owner?.name}</strong> ({data?.owner?.phone})
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-[44px] min-w-[44px] shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
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
                  <EmptyState
                    title="لا توجد فروع إضافية"
                    description="يعمل المتجر حالياً بالفرع الرئيسي الافتراضي."
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.branches.map((b) => (
                      <div
                        key={b.id}
                        className="p-3.5 bg-surface-2 rounded-xl border border-line flex items-center justify-between gap-3"
                      >
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
                  <EmptyState
                    title="لا يوجد موظفون مسجلون"
                    description="صاحب المتجر يعمل منفرداً دون موظفين أو مناديب إضافيين."
                  />
                ) : (
                  <>
                    {/* Desktop DataTable */}
                    <DataTable className="hidden md:block">
                      <thead className="bg-surface-2 text-muted text-xs font-bold border-b border-line">
                        <tr>
                          <th className="px-4 py-3">الموظف</th>
                          <th className="px-4 py-3">الدور والوظيفة</th>
                          <th className="px-4 py-3">الفرع المخصص</th>
                          <th className="px-4 py-3">رقم الهاتف</th>
                          <th className="px-4 py-3">الحالة</th>
                          <th className="px-4 py-3">تاريخ الإضافة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line text-xs">
                        {data.employees.map((emp) => {
                          const isActive = emp.status === 'ACTIVE' || !emp.status;
                          return (
                            <tr key={emp.id} className="hover:bg-surface-2/60 transition-colors">
                              <td className="px-4 py-3 font-bold text-ink">{emp.name}</td>
                              <td className="px-4 py-3">
                                <Badge tone="info">{ROLE_LABELS[emp.role || ''] || emp.role || 'موظف'}</Badge>
                              </td>
                              <td className="px-4 py-3 font-medium text-muted">
                                {emp.branch?.name || 'الكل / غير محدد'}
                              </td>
                              <td className="px-4 py-3 font-mono font-semibold text-ink">{emp.phone}</td>
                              <td className="px-4 py-3">
                                {isActive ? (
                                  <Badge tone="ok">
                                    <CheckCircle2 className="w-3 h-3" />
                                    نشط
                                  </Badge>
                                ) : (
                                  <Badge tone="bad">
                                    <XCircle className="w-3 h-3" />
                                    موقوف
                                  </Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 text-muted font-mono">{formatDate(emp.created_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </DataTable>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-2.5">
                      {data.employees.map((emp) => {
                        const isActive = emp.status === 'ACTIVE' || !emp.status;
                        return (
                          <div
                            key={emp.id}
                            className="p-3.5 bg-surface-2 border border-line rounded-xl space-y-2 text-xs"
                          >
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
