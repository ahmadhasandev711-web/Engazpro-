import React, { useState } from 'react';
import {
  ShieldCheck,
  Key,
  Users,
  RefreshCw,
  ArrowRight,
  Database,
  Globe,
  FileText,
  Sun,
  Moon,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { User } from '@pos-mandob/shared';
import { useAuthStore } from '../../data/store/useAuthStore';
import {
  AdminUserStatusFilter,
  useAdminStats,
  useAdminLicenses,
  useAdminUsers,
  useAdminAuditLogs,
  useGenerateLicenses,
  useExtendUserSubscription,
  useRevokeSubscription,
  useForceLogoutStore,
  useRevokeLicense,
  useToggleUserStatus,
  useToggleUserEcommerce,
  useResetUserPassword,
  useImpersonateStore,
  useAdminPricing,
  useUpdateAdminPricing,
  type UpdatePlatformPricingPayload,
} from '../../hooks/useAdmin';
import { AdminKPICards } from '../components/admin/AdminKPICards';
import { LicenseGeneratorTab } from '../components/admin/LicenseGeneratorTab';
import { UsersManagementTab } from '../components/admin/UsersManagementTab';
import { AdminAuditLogTab } from '../components/admin/AdminAuditLogTab';
import { SystemHealthTab } from '../components/admin/SystemHealthTab';
import { StoreInquiriesTab } from '../components/admin/StoreInquiriesTab';
import { ExtendSubscriptionModal } from '../components/admin/ExtendSubscriptionModal';
import { StoreStaffModal } from '../components/admin/StoreStaffModal';
import { StoreManageModal } from '../components/admin/StoreManageModal';
import { ResetPasswordModal } from '../components/admin/ResetPasswordModal';
import { Badge, Button, PageHeader, Tabs } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

type AdminTab = 'licenses' | 'users' | 'audit' | 'system' | 'inquiries';

export const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { startImpersonation } = useAuthStore();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<AdminTab>('licenses');
  const [licenseSearch, setLicenseSearch] = useState<string>('');
  const [licenseStatusFilter, setLicenseStatusFilter] = useState<'all' | 'unused' | 'used' | 'revoked'>('all');
  const [licensePage, setLicensePage] = useState<number>(1);

  const [userSearch, setUserSearch] = useState<string>('');
  const [userStatusFilter, setUserStatusFilter] = useState<AdminUserStatusFilter>('all');
  const [userPage, setUserPage] = useState<number>(1);

  const [auditSearch, setAuditSearch] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditPage, setAuditPage] = useState<number>(1);

  const [selectedUserForExtend, setSelectedUserForExtend] = useState<User | null>(null);
  const [selectedUserForResetPassword, setSelectedUserForResetPassword] = useState<User | null>(null);
  const [inspectedStoreId, setInspectedStoreId] = useState<number | null>(null);
  const [managedStoreId, setManagedStoreId] = useState<number | null>(null);

  const { data: statsData, isLoading: isLoadingStats, refetch: refetchStats } = useAdminStats();
  const { data: licensesPageData, isLoading: isLoadingLicenses, refetch: refetchLicenses } = useAdminLicenses(
    licenseStatusFilter,
    licenseSearch,
    licensePage
  );
  const { data: usersPageData, isLoading: isLoadingUsers, refetch: refetchUsers } = useAdminUsers(
    userStatusFilter,
    userSearch,
    userPage
  );
  const { data: auditPageData, isLoading: isLoadingAudit, refetch: refetchAudit } = useAdminAuditLogs(
    auditActionFilter,
    auditSearch,
    auditPage
  );

  const generateMutation = useGenerateLicenses();
  const extendUserMutation = useExtendUserSubscription();
  const revokeSubscriptionMutation = useRevokeSubscription();
  const forceLogoutMutation = useForceLogoutStore();
  const revokeLicenseMutation = useRevokeLicense();
  const toggleStatusMutation = useToggleUserStatus();
  const toggleEcommerceMutation = useToggleUserEcommerce();
  const { data: adminPricing, refetch: refetchPricing } = useAdminPricing();
  const updatePricingMutation = useUpdateAdminPricing();

  const handleSavePricing = async (payload: UpdatePlatformPricingPayload) => {
    try {
      const res = await updatePricingMutation.mutateAsync(payload);
      toast.success(res.message || 'تم تحديث تسعير المنصة والموقع العام بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حفظ أسعار المنصة');
      throw err;
    }
  };
  const resetPasswordMutation = useResetUserPassword();
  const impersonateMutation = useImpersonateStore();

  const handleImpersonate = (userId: number) => {
    impersonateMutation.mutate(userId, {
      onSuccess: async (payload) => {
        setManagedStoreId(null);
        await startImpersonation(payload.user, payload.token);
        toast.success(`تم الدخول بوضع الدعم الفني إلى متجر (${payload.user.name})`);
        navigate('/dashboard');
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'تعذر الدخول إلى حساب المتجر'),
    });
  };

  const handleGenerate = (payload: {
    count: number;
    duration_days: number;
    notes: string;
    price?: number | null;
    ecommerce_enabled?: boolean;
  }) => {
    generateMutation.mutate(payload, {
      onSuccess: () => toast.success('تم توليد أكواد التفعيل بنجاح!'),
      onError: (err: any) => toast.error(err.response?.data?.message || 'حدث خطأ أثناء توليد الأكواد'),
    });
  };

  const handleExtend = (payload: { userId: number; days: number; notes: string; price?: number | null }) => {
    extendUserMutation.mutate(payload, {
      onSuccess: (data: any) => {
        setSelectedUserForExtend(null);
        toast.success(data.message || 'تم تمديد اشتراك المستخدم بنجاح!');
      },
      onError: (err: any) => toast.error(err.response?.data?.message || 'تعذر تمديد الاشتراك'),
    });
  };

  const handleResetPassword = async (payload: { userId: number; password: string }): Promise<void> => {
    try {
      const data: any = await resetPasswordMutation.mutateAsync(payload);
      toast.success(data.message || 'تم تغيير كلمة المرور بنجاح!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر تغيير كلمة المرور');
      throw err;
    }
  };

  const handleRevokeLicense = (licenseId: number) => {
    revokeLicenseMutation.mutate(licenseId, {
      onSuccess: (data: any) => toast.success(data.message || 'تم إلغاء كود التفعيل بنجاح!'),
      onError: (err: any) => toast.error(err.response?.data?.message || 'تعذر إلغاء الكود'),
    });
  };

  const handleToggleStatus = (user: User) => {
    toggleStatusMutation.mutate(user.id, {
      onSuccess: (data: any) => toast.success(data.message || 'تم تعديل حالة حساب المتجر بنجاح.'),
      onError: (err: any) => toast.error(err.response?.data?.message || 'تعذر تعديل حالة الحساب'),
    });
  };

  const handleRevokeSubscription = (user: User) => {
    revokeSubscriptionMutation.mutate(
      { userId: user.id },
      {
        onSuccess: (data: any) => toast.success(data.message || 'تم إنهاء الاشتراك بنجاح.'),
        onError: (err: any) => toast.error(err.response?.data?.message || 'تعذر إنهاء الاشتراك'),
      }
    );
  };

  const handleForceLogout = (user: User) => {
    forceLogoutMutation.mutate(user.id, {
      onSuccess: (data: any) => toast.success(data.message || 'تم طرد جميع الجلسات بنجاح.'),
      onError: (err: any) => toast.error(err.response?.data?.message || 'تعذر طرد الجلسات'),
    });
  };

  const handleToggleEcommerce = (user: User) => {
    toggleEcommerceMutation.mutate(user.id, {
      onSuccess: (data: any) => toast.success(data.message || 'تم تحديث صلاحية المتجر الإلكتروني بنجاح.'),
      onError: (err: any) => toast.error(err.response?.data?.message || 'تعذر تعديل صلاحية المتجر الإلكتروني'),
    });
  };

  const isAnyUserMutationPending =
    toggleStatusMutation.isPending ||
    toggleEcommerceMutation.isPending ||
    revokeSubscriptionMutation.isPending ||
    forceLogoutMutation.isPending ||
    impersonateMutation.isPending;

  return (
    <div className="min-h-screen bg-canvas text-ink pb-16 transition-colors" dir="rtl">
      <header className="bg-panel border-b border-line sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/dashboard"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-muted hover:text-ink rounded-xl hover:bg-surface-2 border border-line transition-colors"
              aria-label="العودة للوحة التحكم"
            >
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-brand text-on-brand flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-base sm:text-lg text-ink truncate">الإدارة العامة</span>
                <Badge tone="warn">Super Admin</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={toggleTheme}
              aria-label="تبديل المظهر"
              className="min-h-[44px]"
              leftIcon={resolvedTheme === 'dark' ? <Sun className="w-4 h-4 text-warn" /> : <Moon className="w-4 h-4" />}
            >
              <span className="hidden sm:inline">{resolvedTheme === 'dark' ? 'نهاري' : 'ليلي'}</span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              className="min-h-[44px]"
              onClick={() => {
                refetchStats();
                refetchLicenses();
                refetchUsers();
                refetchAudit();
                refetchPricing();
              }}
              leftIcon={<RefreshCw className={isLoadingStats ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />}
            >
              <span className="hidden sm:inline">تحديث</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 space-y-6">
        <PageHeader
          title="لوحة قيادة منصة إنجاز برو"
          description="إدارة الاشتراكات، بنك الأكواد، حماية الجلسات، وسجل التدقيق السيادي."
          badge={
            <Badge tone="ok" dot>
              السيرفر مؤمن
            </Badge>
          }
        />

        <AdminKPICards stats={statsData} />

        <Tabs
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as AdminTab)}
          tabs={[
            {
              id: 'licenses',
              label: 'أكواد التفعيل',
              count: statsData?.licenses.unused ?? 0,
              icon: <Key className="w-4 h-4" />,
            },
            {
              id: 'users',
              label: 'المتاجر المشتركة',
              count: statsData?.users.merchants ?? statsData?.users.total ?? 0,
              icon: <Users className="w-4 h-4" />,
            },
            {
              id: 'audit',
              label: 'سجل التدقيق',
              icon: <FileText className="w-4 h-4" />,
            },
            {
              id: 'system',
              label: 'حالة النظام',
              icon: <Database className="w-4 h-4" />,
            },
            {
              id: 'inquiries',
              label: 'طلبات المتاجر',
              icon: <Globe className="w-4 h-4" />,
            },
          ]}
        />

        {activeTab === 'licenses' && (
          <LicenseGeneratorTab
            licenses={licensesPageData?.items ?? []}
            isLoading={isLoadingLicenses}
            totalLicenses={statsData?.licenses.total ?? 0}
            unusedCount={statsData?.licenses.unused ?? 0}
            usedCount={statsData?.licenses.used ?? 0}
            revokedCount={statsData?.licenses.revoked ?? 0}
            statusFilter={licenseStatusFilter}
            onStatusFilterChange={(status) => {
              setLicenseStatusFilter(status);
              setLicensePage(1);
            }}
            search={licenseSearch}
            onSearchChange={(val) => {
              setLicenseSearch(val);
              setLicensePage(1);
            }}
            page={licensesPageData?.current_page ?? 1}
            lastPage={licensesPageData?.last_page ?? 1}
            onPageChange={setLicensePage}
            onGenerate={handleGenerate}
            onRevokeLicense={handleRevokeLicense}
            isGenerating={generateMutation.isPending}
            pricing={adminPricing}
            isSavingPricing={updatePricingMutation.isPending}
            onSavePricing={handleSavePricing}
          />
        )}

        {activeTab === 'users' && (
          <UsersManagementTab
            users={usersPageData?.items ?? []}
            totalUsers={usersPageData?.total ?? 0}
            isLoading={isLoadingUsers}
            statusFilter={userStatusFilter}
            onStatusFilterChange={(st) => {
              setUserStatusFilter(st);
              setUserPage(1);
            }}
            search={userSearch}
            onSearchChange={(val) => {
              setUserSearch(val);
              setUserPage(1);
            }}
            page={usersPageData?.current_page ?? 1}
            lastPage={usersPageData?.last_page ?? 1}
            onPageChange={setUserPage}
            onSelectUserForExtend={setSelectedUserForExtend}
            onSelectUserForResetPassword={setSelectedUserForResetPassword}
            onInspectStore={(uid) => setInspectedStoreId(uid)}
            onManageStore={(uid) => setManagedStoreId(uid)}
            onImpersonateStore={handleImpersonate}
            onToggleStatus={handleToggleStatus}
            onToggleEcommerce={handleToggleEcommerce}
            onRevokeSubscription={handleRevokeSubscription}
            onForceLogout={handleForceLogout}
            isMutating={isAnyUserMutationPending}
          />
        )}

        {activeTab === 'audit' && (
          <AdminAuditLogTab
            logs={auditPageData?.items ?? []}
            totalLogs={auditPageData?.total ?? 0}
            isLoading={isLoadingAudit}
            actionFilter={auditActionFilter}
            onActionFilterChange={(act) => {
              setAuditActionFilter(act);
              setAuditPage(1);
            }}
            search={auditSearch}
            onSearchChange={(val) => {
              setAuditSearch(val);
              setAuditPage(1);
            }}
            page={auditPageData?.current_page ?? 1}
            lastPage={auditPageData?.last_page ?? 1}
            onPageChange={setAuditPage}
          />
        )}

        {activeTab === 'system' && (
          <SystemHealthTab stats={statsData} onSelectUserForResetPassword={setSelectedUserForResetPassword} />
        )}

        {activeTab === 'inquiries' && <StoreInquiriesTab />}
      </main>

      {selectedUserForExtend && (
        <ExtendSubscriptionModal
          user={selectedUserForExtend}
          onClose={() => setSelectedUserForExtend(null)}
          onExtend={handleExtend}
          isPending={extendUserMutation.isPending}
        />
      )}

      {selectedUserForResetPassword && (
        <ResetPasswordModal
          user={selectedUserForResetPassword}
          onClose={() => setSelectedUserForResetPassword(null)}
          onReset={handleResetPassword}
          isPending={resetPasswordMutation.isPending}
        />
      )}

      {inspectedStoreId && <StoreStaffModal userId={inspectedStoreId} onClose={() => setInspectedStoreId(null)} />}

      {managedStoreId && (
        <StoreManageModal
          userId={managedStoreId}
          onClose={() => setManagedStoreId(null)}
          onImpersonate={handleImpersonate}
          isImpersonating={impersonateMutation.isPending}
        />
      )}
    </div>
  );
};
