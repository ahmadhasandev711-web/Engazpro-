import React from 'react';
import {
  Search,
  RefreshCw,
  Clock,
  Users,
  Store,
  ShieldAlert,
  ShieldCheck,
  Key,
  LogOut,
  XCircle,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { formatDate, User } from '@pos-mandob/shared';
import clsx from 'clsx';
import { useConfirm } from '../../context/ConfirmContext';
import { AdminUserStatusFilter } from '../../../hooks/useAdmin';
import { Badge, Button, Card, DataTable, EmptyState, Input } from '../ui';

interface UsersManagementTabProps {
  users: User[];
  totalUsers: number;
  isLoading: boolean;
  statusFilter: AdminUserStatusFilter;
  onStatusFilterChange: (status: AdminUserStatusFilter) => void;
  search: string;
  onSearchChange: (val: string) => void;
  page: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  onSelectUserForExtend: (user: User) => void;
  onSelectUserForResetPassword: (user: User) => void;
  onInspectStore: (userId: number) => void;
  onToggleStatus: (user: User) => void;
  onRevokeSubscription: (user: User) => void;
  onForceLogout: (user: User) => void;
  isMutating?: boolean;
}

const STATUS_PILLS: Array<{ key: AdminUserStatusFilter; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'نشط' },
  { key: 'inactive', label: 'مجمد' },
  { key: 'expired', label: 'منتهي الاشتراك' },
  { key: 'trial', label: 'تجريبي' },
];

export const UsersManagementTab: React.FC<UsersManagementTabProps> = ({
  users,
  totalUsers,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  page,
  lastPage,
  onPageChange,
  onSelectUserForExtend,
  onSelectUserForResetPassword,
  onInspectStore,
  onToggleStatus,
  onRevokeSubscription,
  onForceLogout,
  isMutating = false,
}) => {
  const { confirm } = useConfirm();

  const handleToggleConfirm = async (usr: User, isStoreActive: boolean) => {
    const ok = await confirm({
      title: isStoreActive ? 'تجميد حساب المتجر' : 'تنشيط حساب المتجر',
      message: isStoreActive
        ? `هل أنت متأكد من تجميد متجر (${usr.name})؟ سيتم إبطال جميع جلسات المالك والموظفين فورياً ومنع الدخول.`
        : `هل ترغب في إعادة تنشيط حساب المتجر (${usr.name})؟`,
      type: isStoreActive ? 'danger' : 'info',
      confirmText: isStoreActive ? 'تأكيد التجميد' : 'تنشيط',
    });
    if (ok) onToggleStatus(usr);
  };

  const handleRevokeSubConfirm = async (usr: User) => {
    const ok = await confirm({
      title: 'إنهاء اشتراك المتجر',
      message: `هل أنت متأكد من إلغاء اشتراك متجر (${usr.name}) فورياً؟ سيتم تحويل حالة الاشتراك إلى CANCELLED ومنع العمليات.`,
      type: 'danger',
      confirmText: 'تأكيد الإنهاء',
    });
    if (ok) onRevokeSubscription(usr);
  };

  const handleForceLogoutConfirm = async (usr: User) => {
    const ok = await confirm({
      title: 'طرد جميع جلسات المتجر',
      message: `سيتم إنهاء كل جلسات الدخول النشطة للمالك (${usr.name}) وجميع موظفيه دون تجميد الحساب.`,
      type: 'warning',
      confirmText: 'طرد الجلسات',
    });
    if (ok) onForceLogout(usr);
  };

  const getSubMeta = (usr: any) => {
    const sub = usr.subscription;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = sub?.end_date ? new Date(sub.end_date) : null;
    const diffTime = endDate ? endDate.getTime() - today.getTime() : 0;
    const computedDaysLeft = endDate ? Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) : 0;
    const daysLeft =
      sub?.days_remaining !== undefined && sub.days_remaining > 0 ? sub.days_remaining : computedDaysLeft;
    const isSubActive =
      sub?.status === 'ACTIVE' && (daysLeft > 0 || (endDate !== null && endDate >= today));
    const isStoreActive = usr.status === 'ACTIVE' || usr.status?.value === 'ACTIVE' || !usr.status;
    const isAdminAccount = Boolean(usr.is_admin);
    return { sub, daysLeft, isSubActive, isStoreActive, isAdminAccount };
  };

  return (
    <Card className="p-4 sm:p-5 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="w-full lg:max-w-md">
          <Input
            leftIcon={<Search className="w-4 h-4" />}
            placeholder="ابحث بالاسم أو اسم المتجر أو رقم الهاتف أو البريد..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => onStatusFilterChange(pill.key)}
              className={clsx(
                'min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer',
                statusFilter === pill.key
                  ? 'bg-brand text-on-brand border-brand'
                  : 'bg-surface-2 text-muted border-line hover:text-ink'
              )}
            >
              {pill.label}
            </button>
          ))}
          <Badge tone="neutral">
            <Store className="w-3.5 h-3.5 text-brand" />
            <span>الإجمالي: {totalUsers}</span>
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
          جاري تحميل قائمة المتاجر والمشتركين...
        </div>
      ) : users.length === 0 ? (
        <EmptyState title="لا توجد متاجر مطابقة" description="جرّب تغيير حالة الفلتر أو البحث ببيانات أخرى." />
      ) : (
        <>
          {/* Desktop DataTable */}
          <DataTable className="hidden md:block">
            <thead className="bg-surface-2 text-muted text-xs font-bold border-b border-line">
              <tr>
                <th className="px-4 py-3.5">التاجر / المنشأة</th>
                <th className="px-4 py-3.5">الهاتف والطاقم</th>
                <th className="px-4 py-3.5">الحالة</th>
                <th className="px-4 py-3.5">الاشتراك</th>
                <th className="px-4 py-3.5">النشاط</th>
                <th className="px-4 py-3.5 text-center">إجراءات الإدارة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs">
              {users.map((usr: any) => {
                const { sub, daysLeft, isSubActive, isStoreActive, isAdminAccount } = getSubMeta(usr);
                return (
                  <tr key={usr.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-ink flex items-center gap-2 flex-wrap">
                        <span>{usr.name}</span>
                        {isAdminAccount && <Badge tone="warn">مدير عام</Badge>}
                      </div>
                      {usr.business_name && usr.business_name !== usr.name && (
                        <div className="text-[11px] font-bold text-brand mt-0.5 flex items-center gap-1">
                          <Store className="w-3 h-3" />
                          <span>{usr.business_name}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-muted mt-0.5">{usr.email || 'بدون بريد'}</div>
                    </td>

                    <td className="px-4 py-3.5 space-y-1.5">
                      <div className="font-mono font-semibold text-ink">{usr.phone}</div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onInspectStore(usr.id)}
                        leftIcon={<Users className="w-3.5 h-3.5 text-info" />}
                      >
                        {usr.branches_count ?? 0} فرع | {usr.employees_count ?? 0} موظف
                      </Button>
                    </td>

                    <td className="px-4 py-3.5">
                      {isStoreActive ? (
                        <Badge tone="ok" dot>نشط</Badge>
                      ) : (
                        <Badge tone="bad" dot>مجمد</Badge>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className={clsx('font-bold', isSubActive ? 'text-ok' : 'text-bad')}>
                        {isSubActive ? `ساري حتى ${sub?.end_date ? formatDate(sub.end_date) : '-'}` : `منتهي (${sub?.end_date ? formatDate(sub.end_date) : '-'})`}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {daysLeft > 0 ? `متبقي ${daysLeft} يوم` : 'منتهي الصلاحية'} ({sub?.plan || 'TRIAL'})
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-muted font-mono">
                      <div>{usr.invoices_count || 0} فاتورة</div>
                      <div>{usr.products_count || 0} صنف</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onSelectUserForExtend(usr)}
                          leftIcon={<Clock className="w-3.5 h-3.5 text-ok" />}
                        >
                          تمديد
                        </Button>

                        {!isAdminAccount && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => onSelectUserForResetPassword(usr)}
                              leftIcon={<Key className="w-3.5 h-3.5 text-brand" />}
                            >
                              باسوورد
                            </Button>

                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isMutating}
                              onClick={() => handleForceLogoutConfirm(usr)}
                              leftIcon={<LogOut className="w-3.5 h-3.5 text-warn" />}
                            >
                              طرد
                            </Button>

                            {sub && (
                              <Button
                                size="sm"
                                variant="danger"
                                disabled={isMutating}
                                onClick={() => handleRevokeSubConfirm(usr)}
                                leftIcon={<XCircle className="w-3.5 h-3.5" />}
                              >
                                إنهاء
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant={isStoreActive ? 'danger' : 'secondary'}
                              disabled={isMutating}
                              onClick={() => handleToggleConfirm(usr, isStoreActive)}
                              leftIcon={isStoreActive ? <ShieldAlert className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5 text-ok" />}
                            >
                              {isStoreActive ? 'تجميد' : 'تنشيط'}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>

          {/* Mobile Cards (360px) */}
          <div className="md:hidden space-y-3">
            {users.map((usr: any) => {
              const { sub, daysLeft, isSubActive, isStoreActive, isAdminAccount } = getSubMeta(usr);
              return (
                <div key={usr.id} className="p-4 rounded-xl bg-surface-2 border border-line space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-ink flex items-center gap-2">
                        <span>{usr.name}</span>
                        {isAdminAccount && <Badge tone="warn">مدير عام</Badge>}
                      </div>
                      <div className="font-mono text-muted mt-0.5">{usr.phone}</div>
                    </div>
                    {isStoreActive ? <Badge tone="ok" dot>نشط</Badge> : <Badge tone="bad" dot>مجمد</Badge>}
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className={isSubActive ? 'text-ok font-bold' : 'text-bad font-bold'}>
                      {isSubActive ? `ينتهي ${sub?.end_date ? formatDate(sub.end_date) : '-'}` : 'منتهي الاشتراك'}
                    </span>
                    <span className="text-muted">متبقي {daysLeft} يوم</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => onInspectStore(usr.id)}
                      leftIcon={<Users className="w-3.5 h-3.5 text-info" />}
                    >
                      الطاقم ({usr.employees_count ?? 0})
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => onSelectUserForExtend(usr)}
                      leftIcon={<Clock className="w-3.5 h-3.5 text-ok" />}
                    >
                      تمديد
                    </Button>
                    {!isAdminAccount && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="min-h-[44px]"
                          onClick={() => onSelectUserForResetPassword(usr)}
                          leftIcon={<Key className="w-3.5 h-3.5 text-brand" />}
                        >
                          باسوورد
                        </Button>
                        <Button
                          size="sm"
                          variant={isStoreActive ? 'danger' : 'secondary'}
                          className="min-h-[44px]"
                          disabled={isMutating}
                          onClick={() => handleToggleConfirm(usr, isStoreActive)}
                        >
                          {isStoreActive ? 'تجميد' : 'تنشيط'}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="min-h-[44px]"
                          disabled={isMutating}
                          onClick={() => handleForceLogoutConfirm(usr)}
                        >
                          طرد الجلسات
                        </Button>
                        {sub && (
                          <Button
                            size="sm"
                            variant="danger"
                            className="min-h-[44px]"
                            disabled={isMutating}
                            onClick={() => handleRevokeSubConfirm(usr)}
                          >
                            إنهاء الاشتراك
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {lastPage > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-line text-xs">
              <span className="text-muted font-medium">
                صفحة <strong className="text-ink">{page}</strong> من <strong className="text-ink">{lastPage}</strong>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  السابق
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={page >= lastPage}
                  onClick={() => onPageChange(page + 1)}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};
