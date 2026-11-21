import React, { useState, useMemo } from 'react';
import {
  Globe,
  Search,
  MessageSquare,
  Phone,
  CheckCircle2,
  Clock,
  Briefcase,
  Trash2,
  Edit3,
  X,
  Save,
  ShoppingBag,
  RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import {
  StoreInquiry,
  useAdminInquiries,
  useUpdateInquiryStatus,
  useDeleteInquiry,
} from '../../../hooks/useAdmin';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Badge, Button, Card, DataTable, EmptyState, Input, Select, StatCard, Textarea } from '../ui';

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'جديد' },
  { value: 'CONTACTED', label: 'جاري التواصل' },
  { value: 'CONTRACTED', label: 'تم التعاقد' },
  { value: 'CLOSED', label: 'مغلق' },
];

export const StoreInquiriesTab: React.FC = () => {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [editingNotesInquiry, setEditingNotesInquiry] = useState<StoreInquiry | null>(null);
  const [adminNotesText, setAdminNotesText] = useState<string>('');

  const { data: inquiries = [], isLoading, refetch } = useAdminInquiries(statusFilter, search);
  const updateStatusMutation = useUpdateInquiryStatus();
  const deleteMutation = useDeleteInquiry();

  const metrics = useMemo(() => {
    return {
      total: inquiries.length,
      new: inquiries.filter((i) => i.status === 'NEW').length,
      contacted: inquiries.filter((i) => i.status === 'CONTACTED').length,
      contracted: inquiries.filter((i) => i.status === 'CONTRACTED').length,
    };
  }, [inquiries]);

  const handleStatusChange = (inquiry: StoreInquiry, newStatus: StoreInquiry['status']) => {
    updateStatusMutation.mutate(
      { id: inquiry.id, status: newStatus },
      {
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'تعذر تعديل حالة الطلب');
        },
      }
    );
  };

  const handleSaveNotes = () => {
    if (!editingNotesInquiry) return;
    updateStatusMutation.mutate(
      {
        id: editingNotesInquiry.id,
        status: editingNotesInquiry.status,
        admin_notes: adminNotesText,
      },
      {
        onSuccess: () => {
          setEditingNotesInquiry(null);
          toast.success('تم حفظ ملاحظات الإدارة بنجاح.');
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'تعذر حفظ ملاحظات الإدارة');
        },
      }
    );
  };

  const handleDelete = async (id: number, clientName: string) => {
    const ok = await confirm({
      title: 'تأكيد الحذف',
      message: `هل أنت متأكد من حذف طلب العميل "${clientName}" نهائياً؟`,
      type: 'danger',
    });
    if (ok) {
      deleteMutation.mutate(id, {
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'تعذر حذف الطلب');
        },
      });
    }
  };

  const openWhatsApp = (phone: string, name: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('01')) {
      clean = '2' + clean;
    }
    const msg = encodeURIComponent(
      `أهلاً بك يا أستاذ ${name}، بخصوص طلبك لتصميم وتطوير متجر إلكتروني متكامل عبر EBMS.`
    );
    window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
  };

  const getStatusBadge = (status: StoreInquiry['status']) => {
    switch (status) {
      case 'NEW':
        return (
          <Badge tone="ok" dot>
            جديد
          </Badge>
        );
      case 'CONTACTED':
        return (
          <Badge tone="info">
            <Clock className="w-3 h-3" />
            جاري التواصل
          </Badge>
        );
      case 'CONTRACTED':
        return (
          <Badge tone="brand">
            <CheckCircle2 className="w-3 h-3" />
            تم التعاقد
          </Badge>
        );
      case 'CLOSED':
        return <Badge tone="neutral">مغلق</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-brand/30 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-ink">طلبات المتاجر الإلكترونية وتطوير المواقع</h2>
                <Badge tone="brand">Lead Management</Badge>
              </div>
              <p className="text-xs text-muted mt-0.5">
                متابعة عملاء المتجر المباشرين من الصفحة الرئيسية والتواصل عبر واتساب
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => refetch()}
          >
            تحديث القائمة
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="إجمالي الطلبات" value={metrics.total} tone="neutral" />
          <StatCard label="طلبات جديدة" value={metrics.new} tone="warn" />
          <StatCard label="قيد التفاوض" value={metrics.contacted} tone="info" />
          <StatCard label="تم التعاقد" value={metrics.contracted} tone="ok" />
        </div>
      </Card>

      <Card className="p-4 sm:p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="w-full lg:max-w-md">
            <Input
              leftIcon={<Search className="w-4 h-4" />}
              placeholder="ابحث بالاسم، الهاتف، النشاط، المدينة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {[{ key: 'all', label: 'الكل' }, ...STATUS_OPTIONS.map((o) => ({ key: o.value, label: o.label }))].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={clsx(
                  'min-h-[40px] px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer',
                  statusFilter === tab.key
                    ? 'bg-brand text-on-brand border-brand'
                    : 'bg-surface-2 text-muted border-line hover:text-ink'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand" />
            جاري تحميل طلبات المتاجر...
          </div>
        ) : inquiries.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="w-6 h-6" />}
            title="لا توجد طلبات تطابق بحثك"
            description="عندما يقوم زوار الصفحة الرئيسية بطلب تصميم متجر إلكتروني، ستظهر بياناتهم هنا."
          />
        ) : (
          <>
            <DataTable className="hidden md:block">
              <thead className="bg-surface-2 border-b border-line text-muted font-bold text-xs">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">العميل والاتصال</th>
                  <th className="py-3.5 px-4">النشاط والمدينة</th>
                  <th className="py-3.5 px-4">تفاصيل الطلب</th>
                  <th className="py-3.5 px-4">الحالة</th>
                  <th className="py-3.5 px-4">ملاحظات الإدارة</th>
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {inquiries.map((inq, idx) => (
                  <tr key={inq.id} className="hover:bg-surface-2/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-muted font-bold">{idx + 1}</td>
                    <td className="py-3 px-4 space-y-1.5">
                      <div className="font-black text-ink text-sm">{inq.name}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-muted dir-ltr">{inq.phone}</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openWhatsApp(inq.phone, inq.name)}
                          leftIcon={<MessageSquare className="w-3 h-3 text-ok" />}
                        >
                          واتساب
                        </Button>
                        <a
                          href={`tel:${inq.phone}`}
                          className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-surface-2"
                          title="اتصال هاتفي"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-ink flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-muted" />
                        <span>{inq.business_type}</span>
                      </div>
                      {inq.city && <div className="text-[11px] text-muted mt-0.5">{inq.city}</div>}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      {inq.notes ? (
                        <p className="text-ink whitespace-pre-wrap line-clamp-3">{inq.notes}</p>
                      ) : (
                        <span className="text-muted">بدون ملاحظات إضافية</span>
                      )}
                    </td>
                    <td className="py-3 px-4 space-y-1.5">
                      {getStatusBadge(inq.status)}
                      <Select
                        value={inq.status}
                        onChange={(e) => handleStatusChange(inq, e.target.value as StoreInquiry['status'])}
                        disabled={updateStatusMutation.isPending}
                        options={STATUS_OPTIONS}
                      />
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-muted line-clamp-2">{inq.admin_notes || 'لا توجد ملاحظات'}</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingNotesInquiry(inq);
                            setAdminNotesText(inq.admin_notes || '');
                          }}
                          aria-label="تعديل ملاحظات الإدارة"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-muted font-mono text-[11px]">
                      {new Date(inq.created_at).toLocaleDateString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(inq.id, inq.name)}
                        aria-label="حذف الطلب"
                        className="text-bad"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {inquiries.map((inq) => (
                <div key={inq.id} className="p-4 rounded-xl bg-surface-2 border border-line space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-black text-ink text-sm">{inq.name}</div>
                      <div className="font-mono text-muted">{inq.phone}</div>
                    </div>
                    {getStatusBadge(inq.status)}
                  </div>
                  <div className="text-muted">
                    {inq.business_type} {inq.city ? `— ${inq.city}` : ''}
                  </div>
                  {inq.notes && <p className="text-ink">{inq.notes}</p>}
                  <Select
                    label="تغيير الحالة"
                    value={inq.status}
                    onChange={(e) => handleStatusChange(inq, e.target.value as StoreInquiry['status'])}
                    disabled={updateStatusMutation.isPending}
                    options={STATUS_OPTIONS}
                  />
                  <div className="flex items-center gap-2 pt-2 border-t border-line">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-[44px] flex-1"
                      onClick={() => openWhatsApp(inq.phone, inq.name)}
                      leftIcon={<MessageSquare className="w-3.5 h-3.5 text-ok" />}
                    >
                      واتساب
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => {
                        setEditingNotesInquiry(inq);
                        setAdminNotesText(inq.admin_notes || '');
                      }}
                      leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                    >
                      ملاحظات
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="min-h-[44px]"
                      onClick={() => handleDelete(inq.id, inq.name)}
                      aria-label="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {editingNotesInquiry && (
        <div
          className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="bg-panel border border-line rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-black text-ink text-base">ملاحظات الإدارة للطلب</h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingNotesInquiry(null)}
                aria-label="إغلاق"
                className="min-h-[44px] min-w-[44px]"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-xs text-muted">
              العميل: <strong className="text-ink">{editingNotesInquiry.name}</strong> ({editingNotesInquiry.phone})
            </div>

            <Textarea
              label="سجل الملاحظات الخاصة"
              rows={4}
              value={adminNotesText}
              onChange={(e) => setAdminNotesText(e.target.value)}
              placeholder="اكتب الاتفاق المالي وتفاصيل المتجر..."
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditingNotesInquiry(null)}>
                إلغاء
              </Button>
              <Button
                variant="primary"
                isLoading={updateStatusMutation.isPending}
                onClick={handleSaveNotes}
                leftIcon={<Save className="w-4 h-4" />}
              >
                حفظ الملاحظات
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
