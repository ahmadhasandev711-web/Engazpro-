import React from 'react';
import { ShieldCheck, Search, RefreshCw, ChevronRight, ChevronLeft } from 'lucide-react';
import { AdminAuditLogItem } from '@pos-mandob/shared';
import { Badge, Button, Card, DataTable, EmptyState, Input, Select } from '../ui';
import type { BadgeTone } from '../ui/Badge';

interface AdminAuditLogTabProps {
  logs: AdminAuditLogItem[];
  totalLogs: number;
  isLoading: boolean;
  actionFilter: string;
  onActionFilterChange: (action: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  page: number;
  lastPage: number;
  onPageChange: (page: number) => void;
}

const ACTION_OPTIONS = [
  { value: 'all', label: 'كل الإجراءات' },
  { value: 'LICENSES_GENERATED', label: 'توليد أكواد' },
  { value: 'LICENSE_REVOKED', label: 'إلغاء كود' },
  { value: 'LICENSE_REDEEM_FAILED', label: 'فشل تفعيل كود' },
  { value: 'SUBSCRIPTION_EXTENDED', label: 'تمديد اشتراك' },
  { value: 'SUBSCRIPTION_REVOKED', label: 'إنهاء اشتراك' },
  { value: 'USER_FROZEN', label: 'تجميد متجر' },
  { value: 'USER_UNFROZEN', label: 'تنشيط متجر' },
  { value: 'USER_PASSWORD_RESET', label: 'تغيير كلمة مرور' },
  { value: 'STORE_SESSIONS_REVOKED', label: 'طرد جلسات' },
  { value: 'ADMIN_ACCESS_DENIED', label: 'رفض وصول إداري' },
  { value: 'INQUIRY_UPDATED', label: 'تحديث طلب متجر' },
  { value: 'INQUIRY_DELETED', label: 'حذف طلب متجر' },
];

const ACTION_META: Record<string, { label: string; tone: BadgeTone }> = {
  LICENSES_GENERATED: { label: 'توليد أكواد', tone: 'ok' },
  LICENSE_REVOKED: { label: 'إلغاء كود', tone: 'warn' },
  LICENSE_REDEEM_FAILED: { label: 'فشل تفعيل كود', tone: 'bad' },
  SUBSCRIPTION_EXTENDED: { label: 'تمديد اشتراك', tone: 'ok' },
  SUBSCRIPTION_REVOKED: { label: 'إنهاء اشتراك', tone: 'bad' },
  USER_FROZEN: { label: 'تجميد متجر', tone: 'bad' },
  USER_UNFROZEN: { label: 'تنشيط متجر', tone: 'ok' },
  USER_PASSWORD_RESET: { label: 'تغيير كلمة مرور', tone: 'warn' },
  STORE_SESSIONS_REVOKED: { label: 'طرد جلسات', tone: 'warn' },
  ADMIN_ACCESS_DENIED: { label: 'رفض وصول إداري', tone: 'bad' },
  INQUIRY_UPDATED: { label: 'تحديث طلب', tone: 'info' },
  INQUIRY_DELETED: { label: 'حذف طلب', tone: 'warn' },
};

export const AdminAuditLogTab: React.FC<AdminAuditLogTabProps> = ({
  logs,
  totalLogs,
  isLoading,
  actionFilter,
  onActionFilterChange,
  search,
  onSearchChange,
  page,
  lastPage,
  onPageChange,
}) => {
  const renderActionBadge = (action: string) => {
    const meta = ACTION_META[action] || { label: action, tone: 'neutral' as BadgeTone };
    return <Badge tone={meta.tone}>{meta.label}</Badge>;
  };

  return (
    <Card className="p-4 sm:p-5 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="w-full lg:max-w-md">
          <Input
            leftIcon={<Search className="w-4 h-4" />}
            placeholder="ابحث بالملخص أو اسم الأدمن أو المتجر أو عنوان IP..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-52">
            <Select
              value={actionFilter}
              onChange={(e) => onActionFilterChange(e.target.value)}
              options={ACTION_OPTIONS}
            />
          </div>
          <Badge tone="neutral">
            <ShieldCheck className="w-3.5 h-3.5 text-brand" />
            <span>السجلات: {totalLogs}</span>
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
          جاري تحميل سجل التدقيق السيادي...
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="w-6 h-6" />}
          title="لا توجد أحداث تدقيق مطابقة"
          description="جميع الإجراءات السيادية ومحاولات الوصول الحساسة تُحفظ هنا بشكل غير قابل للتعديل."
        />
      ) : (
        <>
          <DataTable className="hidden md:block">
            <thead className="bg-surface-2 text-muted text-xs font-bold border-b border-line">
              <tr>
                <th className="px-4 py-3.5">الحدث</th>
                <th className="px-4 py-3.5">الملخص</th>
                <th className="px-4 py-3.5">المنفذ</th>
                <th className="px-4 py-3.5">المتجر المستهدف</th>
                <th className="px-4 py-3.5">عنوان IP</th>
                <th className="px-4 py-3.5">التوقيت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-xs">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-2/60 transition-colors">
                  <td className="px-4 py-3.5">{renderActionBadge(log.action)}</td>
                  <td className="px-4 py-3.5 font-medium text-ink max-w-md">{log.summary}</td>
                  <td className="px-4 py-3.5">
                    {log.actor ? (
                      <div>
                        <div className="font-bold text-ink">{log.actor.name}</div>
                        <div className="text-[11px] font-mono text-muted">{log.actor.phone}</div>
                      </div>
                    ) : (
                      <span className="text-muted">النظام</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {log.target_user ? (
                      <div>
                        <div className="font-bold text-ink">{log.target_user.name}</div>
                        <div className="text-[11px] font-mono text-muted">{log.target_user.phone}</div>
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-muted">{log.ip_address || '-'}</td>
                  <td className="px-4 py-3.5 font-mono text-muted whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('ar-EG', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="p-4 rounded-xl bg-surface-2 border border-line space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  {renderActionBadge(log.action)}
                  <span className="font-mono text-[11px] text-muted">
                    {new Date(log.created_at).toLocaleDateString('ar-EG', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="font-bold text-ink">{log.summary}</p>
                <div className="flex items-center justify-between text-[11px] text-muted pt-1 border-t border-line">
                  <span>المنفذ: {log.actor?.name || 'النظام'}</span>
                  <span className="font-mono">{log.ip_address || '-'}</span>
                </div>
              </div>
            ))}
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
