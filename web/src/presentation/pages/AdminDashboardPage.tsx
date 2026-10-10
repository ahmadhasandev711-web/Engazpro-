import React, { useState } from 'react';
import {
  ShieldCheck,
  Key,
  Users,
  RefreshCw,
  ArrowRight,
  Database,
  Globe,
} from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { User } from '@pos-mandob/shared';
import {
  useAdminStats,
  useAdminLicenses,
  useAdminUsers,
  useGenerateLicenses,
  useExtendUserSubscription,
  useRevokeLicense,
  useToggleUserStatus,
  useResetUserPassword,
} from '../../hooks/useAdmin';
import { AdminKPICards } from '../components/admin/AdminKPICards';
import { LicenseGeneratorTab } from '../components/admin/LicenseGeneratorTab';
import { UsersManagementTab } from '../components/admin/UsersManagementTab';
import { SystemHealthTab } from '../components/admin/SystemHealthTab';
import { StoreInquiriesTab } from '../components/admin/StoreInquiriesTab';
import { ExtendSubscriptionModal } from '../components/admin/ExtendSubscriptionModal';
import { StoreStaffModal } from '../components/admin/StoreStaffModal';
import { ResetPasswordModal } from '../components/admin/ResetPasswordModal';

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'licenses' | 'users' | 'system' | 'inquiries'>('licenses');
  const [licenseSearch, setLicenseSearch] = useState<string>('');
  const [licenseStatusFilter, setLicenseStatusFilter] = useState<'all' | 'unused' | 'used' | 'revoked'>('all');
  const [userSearch, setUserSearch] = useState<string>('');
  const [selectedUserForExtend, setSelectedUserForExtend] = useState<User | null>(null);
  const [selectedUserForResetPassword, setSelectedUserForResetPassword] = useState<User | null>(null);
  const [inspectedStoreId, setInspectedStoreId] = useState<number | null>(null);

  // Queries & Mutations via Custom Hooks
  const { data: statsData, isLoading: isLoadingStats, refetch: refetchStats } = useAdminStats();
  const {
    data: licenses = [],
    isLoading: isLoadingLicenses,
    refetch: refetchLicenses,
  } = useAdminLicenses(licenseStatusFilter, licenseSearch);
  const {
    data: users = [],
    isLoading: isLoadingUsers,
    refetch: refetchUsers,
  } = useAdminUsers(userSearch);

  const generateMutation = useGenerateLicenses();
  const extendUserMutation = useExtendUserSubscription();
  const revokeLicenseMutation = useRevokeLicense();
  const toggleStatusMutation = useToggleUserStatus();
  const resetPasswordMutation = useResetUserPassword();

  const handleGenerate = (payload: { count: number; duration_days: number; notes: string }) => {
    generateMutation.mutate(payload, {
      onSuccess: () => alert('تم توليد أكواد التفعيل بنجاح! 🔑'),
      onError: (err: any) => alert(err.response?.data?.message || 'حدث خطأ أثناء توليد الأكواد'),
    });
  };

  const handleExtend = (payload: { userId: number; days: number; notes: string }) => {
    extendUserMutation.mutate(payload, {
      onSuccess: (data: any) => {
        setSelectedUserForExtend(null);
        alert(data.message || 'تم تمديد اشتراك المستخدم بنجاح! 🎉');
      },
      onError: (err: any) => alert(err.response?.data?.message || 'تعذر تمديد الاشتراك'),
    });
  };

  const handleResetPassword = (payload: { userId: number; password: string }) => {
    resetPasswordMutation.mutate(payload, {
      onSuccess: (data: any) => {
        setSelectedUserForResetPassword(null);
        alert(data.message || 'تم تغيير كلمة المرور بنجاح! 🔑');
      },
      onError: (err: any) => alert(err.response?.data?.message || 'تعذر تغيير كلمة المرور'),
    });
  };

  const handleRevokeLicense = (licenseId: number) => {
    revokeLicenseMutation.mutate(licenseId, {
      onSuccess: (data: any) => {
        alert(data.message || 'تم حرق وإلغاء كود التفعيل بنجاح ومنع استخدامه نهائياً! 🚫');
      },
      onError: (err: any) => alert(err.response?.data?.message || 'تعذر إلغاء الكود'),
    });
  };

  const handleToggleStatus = (user: User) => {
    toggleStatusMutation.mutate(user.id, {
      onSuccess: (data: any) => {
        alert(data.message || 'تم تعديل حالة حساب المتجر بنجاح.');
      },
      onError: (err: any) => alert(err.response?.data?.message || 'تعذر تعديل حالة الحساب'),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16" dir="rtl">
      {/* Top Super Admin Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors">
              <ArrowRight className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black shadow-md shadow-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 leading-tight">لوحة تحكم الإدارة العامة</h1>
                <span className="px-2 py-0.5 text-[11px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                  👑 Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">إدارة منصة إنجاز برو، الاشتراكات، وبنك الأكواد الآمنة ومكافحة الاحتيال</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                refetchStats();
                refetchLicenses();
                refetchUsers();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className={clsx('w-3.5 h-3.5', isLoadingStats && 'animate-spin')} />
              <span>تحديث البيانات</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              السيرفر متصل وقاعدة البيانات مؤمنة
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* KPI Cards */}
        <AdminKPICards stats={statsData} />

        {/* Tab Navigation Controls */}
        <div className="flex border-b border-slate-200 space-x-reverse space-x-8">
          <button
            onClick={() => setActiveTab('licenses')}
            className={clsx(
              'pb-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors',
              activeTab === 'licenses'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <Key className="w-4 h-4" />
            <span>بنك ومولد أكواد التفعيل ({statsData?.licenses.unused ?? 0} متاح)</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={clsx(
              'pb-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors',
              activeTab === 'users'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <Users className="w-4 h-4" />
            <span>إدارة المتاجر المشتركة ({statsData?.users.merchants ?? statsData?.users.total ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={clsx(
              'pb-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors',
              activeTab === 'system'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <Database className="w-4 h-4" />
            <span>حالة النظام والبيانات</span>
          </button>

          <button
            onClick={() => setActiveTab('inquiries')}
            className={clsx(
              'pb-4 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors',
              activeTab === 'inquiries'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            <Globe className="w-4 h-4" />
            <span>طلبات المتاجر وإدارة الموقع</span>
          </button>
        </div>

        {/* TAB Content */}
        {activeTab === 'licenses' && (
          <LicenseGeneratorTab
            licenses={licenses}
            isLoading={isLoadingLicenses}
            totalLicenses={statsData?.licenses.total ?? 0}
            unusedCount={statsData?.licenses.unused ?? 0}
            usedCount={statsData?.licenses.used ?? 0}
            revokedCount={statsData?.licenses.revoked ?? 0}
            statusFilter={licenseStatusFilter}
            onStatusFilterChange={setLicenseStatusFilter}
            search={licenseSearch}
            onSearchChange={setLicenseSearch}
            onGenerate={handleGenerate}
            onRevokeLicense={handleRevokeLicense}
            isGenerating={generateMutation.isPending}
          />
        )}

        {activeTab === 'users' && (
          <UsersManagementTab
            users={users}
            isLoading={isLoadingUsers}
            search={userSearch}
            onSearchChange={setUserSearch}
            onSelectUserForExtend={setSelectedUserForExtend}
            onSelectUserForResetPassword={setSelectedUserForResetPassword}
            onInspectStore={(uid) => setInspectedStoreId(uid)}
            onToggleStatus={handleToggleStatus}
            isTogglingStatus={toggleStatusMutation.isPending}
          />
        )}

        {activeTab === 'system' && <SystemHealthTab stats={statsData} />}

        {activeTab === 'inquiries' && <StoreInquiriesTab />}
      </main>

      {/* Direct Extend Subscription Modal */}
      {selectedUserForExtend && (
        <ExtendSubscriptionModal
          user={selectedUserForExtend}
          onClose={() => setSelectedUserForExtend(null)}
          onExtend={handleExtend}
          isPending={extendUserMutation.isPending}
        />
      )}

      {/* Direct Reset Password Modal */}
      {selectedUserForResetPassword && (
        <ResetPasswordModal
          user={selectedUserForResetPassword}
          onClose={() => setSelectedUserForResetPassword(null)}
          onReset={handleResetPassword}
          isPending={resetPasswordMutation.isPending}
        />
      )}

      {/* Store Staff & Branches Inspection Modal */}
      {inspectedStoreId && (
        <StoreStaffModal
          userId={inspectedStoreId}
          onClose={() => setInspectedStoreId(null)}
        />
      )}
    </div>
  );
};
