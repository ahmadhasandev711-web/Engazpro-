import React from 'react';
import { Database, ShieldCheck, RefreshCw, Trash2, RotateCcw, Key, X } from 'lucide-react';
import { AdminStatsData, User, formatDate } from '@pos-mandob/shared';
import {
  useAdminQueueOverview,
  useRetryFailedJob,
  useRetryAllFailedJobs,
  useFlushFailedJobs,
  useAdminPasswordResetRequests,
  useDismissAdminPasswordResetRequest,
} from '../../../hooks/useAdmin';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Card, EmptyState } from '../ui';

interface SystemHealthTabProps {
  stats?: AdminStatsData;
  onSelectUserForResetPassword: (user: User) => void;
}

export const SystemHealthTab: React.FC<SystemHealthTabProps> = ({ stats, onSelectUserForResetPassword }) => {
  const toast = useToast();
  const { data: queueData, isLoading: isLoadingQueue, refetch: refetchQueue } = useAdminQueueOverview();
  const { data: resetRequests = [] } = useAdminPasswordResetRequests();
  const retryOne = useRetryFailedJob();
  const retryAll = useRetryAllFailedJobs();
  const flushAll = useFlushFailedJobs();
  const dismissReq = useDismissAdminPasswordResetRequest();

  const ops = stats?.operations;

  const handleRetryOne = (uuid: string) => {
    retryOne.mutate(uuid, {
      onSuccess: (d: any) => toast.success(d.message || 'تمت إعادة المهمة للطابور'),
      onError: () => toast.error('تعذر إعادة تشغيل المهمة'),
    });
  };

  const handleRetryAll = () => {
    retryAll.mutate(undefined, {
      onSuccess: (d: any) => toast.success(d.message || 'تمت إعادة تشغيل كافة المهام الفاشلة'),
      onError: () => toast.error('تعذر إعادة تشغيل المهام'),
    });
  };

  const handleFlush = () => {
    flushAll.mutate(undefined, {
      onSuccess: (d: any) => toast.success(d.message || 'تم تنظيف المهام الفاشلة'),
      onError: () => toast.error('تعذر تنظيف السجل'),
    });
  };

  return (
    <div className="space-y-6">
      {/* Owner Password Reset Requests Alert (if any) */}
      {resetRequests.length > 0 && (
        <Card className="border-warn/40 bg-warn-soft/30 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-black text-ink flex items-center gap-2">
              <Key className="w-5 h-5 text-warn" />
              <span>طلبات استعادة كلمات مرور أصحاب المتاجر ({resetRequests.length})</span>
            </h3>
            <Badge tone="warn">يتطلب تدخل دعم</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {resetRequests.map((req) => (
              <div key={req.id} className="p-3.5 bg-panel border border-line rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0 text-xs space-y-1">
                  <div className="font-black text-ink">{req.user?.name || 'صاحب متجر'}</div>
                  <div className="font-mono text-muted">{req.phone}</div>
                  <div className="text-[11px] text-muted">{formatDate(req.created_at)}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {req.user && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onSelectUserForResetPassword(req.user as User)}
                      leftIcon={<Key className="w-3.5 h-3.5" />}
                    >
                      تعيين باسوورد
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismissReq.mutate(req.id)}
                    aria-label="تجاهل الطلب"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {/* Platform Health & Operations */}
        <Card className="space-y-4">
          <h3 className="text-base font-black text-ink flex items-center gap-2">
            <Database className="w-5 h-5 text-brand" />
            <span>حالة المنصة والسيرفر</span>
          </h3>

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 bg-surface-2 border border-line rounded-xl">
              <span className="text-muted font-medium">محرك قاعدة البيانات:</span>
              <strong className="text-ok font-mono font-bold">
                {stats?.system?.database_label || 'MYSQL (Secured)'}
              </strong>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-2 border border-line rounded-xl">
              <span className="text-muted font-medium">تجارب مجانية جارية:</span>
              <strong className="text-ink font-mono">{ops?.trial_active ?? 0} متجر</strong>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-2 border border-line rounded-xl">
              <span className="text-muted font-medium">اشتراكات تنتهي خلال 7 أيام:</span>
              <strong className={(ops?.expiring_7d ?? 0) > 0 ? 'text-warn font-mono' : 'text-ink font-mono'}>
                {ops?.expiring_7d ?? 0} متجر
              </strong>
            </div>
            <div className="flex items-center justify-between p-3 bg-surface-2 border border-line rounded-xl">
              <span className="text-muted font-medium">طلبات متاجر جديدة (تجهيز):</span>
              <strong className="text-brand font-mono">{ops?.pending_inquiries ?? 0} طلب</strong>
            </div>
          </div>
        </Card>

        {/* Queue & Host Security */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-black text-ink flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-ok" />
              <span>مراقبة طابور المزامنة (Shopify / Woo)</span>
            </h3>
            <Button size="sm" variant="secondary" onClick={() => refetchQueue()} leftIcon={<RefreshCw className={isLoadingQueue ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} />}>
              تحديث
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-surface-2 border border-line rounded-xl">
              <div className="text-muted font-medium">مهام قيد الانتظار (Pending)</div>
              <div className="text-xl font-black text-ink font-mono mt-1">{queueData?.pending_count ?? ops?.pending_jobs ?? 0}</div>
            </div>
            <div className="p-3 bg-surface-2 border border-line rounded-xl">
              <div className="text-muted font-medium">مهام فاشلة (Failed Jobs)</div>
              <div className={`text-xl font-black font-mono mt-1 ${(queueData?.failed_count ?? 0) > 0 ? 'text-bad' : 'text-ok'}`}>
                {queueData?.failed_count ?? ops?.failed_jobs ?? 0}
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-ok-soft border border-ok/20 rounded-xl text-xs text-ink leading-relaxed">
            <p className="font-black text-ok mb-1">البريد والأمان والتفعيلات</p>
            <p className="text-muted">
              إرسال رموز OTP عبر <strong className="text-ink font-mono">info@ebms.online</strong> · فودافون كاش وإنستاباي: <strong className="text-ink font-mono">01125030642</strong>.
            </p>
          </div>
        </Card>
      </div>

      {/* Failed Jobs List */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-black text-ink">سجل المهام الفاشلة في الطابور</h3>
          {(queueData?.failed_count ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="primary" disabled={retryAll.isPending} onClick={handleRetryAll} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
                إعادة تشغيل الكل
              </Button>
              <Button size="sm" variant="danger" disabled={flushAll.isPending} onClick={handleFlush} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
                مسح السجل
              </Button>
            </div>
          )}
        </div>

        {!queueData?.failed_items || queueData.failed_items.length === 0 ? (
          <EmptyState
            title="الطابور سليم تماماً"
            description="لا توجد أي مهام فاشلة في مزامنة Shopify أو WooCommerce على السيرفر حالياً."
          />
        ) : (
          <div className="space-y-2.5">
            {queueData.failed_items.map((job) => (
              <div key={job.uuid} className="p-3 bg-surface-2 border border-line rounded-xl flex items-center justify-between gap-3 flex-wrap text-xs">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone="bad">{job.queue}</Badge>
                    <strong className="text-ink font-mono">{job.job_name}</strong>
                    <span className="text-muted font-mono">{job.failed_at}</span>
                  </div>
                  <p className="text-bad font-mono truncate">{job.error_summary}</p>
                </div>
                <Button size="sm" variant="secondary" disabled={retryOne.isPending} onClick={() => handleRetryOne(job.uuid)} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
                  إعادة
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
